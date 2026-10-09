import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { DirectionsResponse, RouteResult } from '../api/types';
import { api } from '../api/client';
import { parseRouteGeometry } from '../utils/mapRoute';

export interface UseRouteCalculationOptions {
  tripId: ComputedRef<number | undefined | null> | Ref<number | undefined | null>;
  fromCoords:
    | ComputedRef<{ lat?: number | null; lng?: number | null } | null>
    | Ref<{ lat?: number | null; lng?: number | null } | null>;
  toCoords:
    | ComputedRef<{ lat?: number | null; lng?: number | null } | null>
    | Ref<{ lat?: number | null; lng?: number | null } | null>;
  transportType: Ref<string> | ComputedRef<string>;
  onRouteSelected?: (route: RouteResult) => void;
}

export interface CachedModeRoute {
  routes: RouteResult[];
  selectedRouteIndex: number;
  routeGeometry: string | null;
  distance: number | null;
  duration: number | null;
  profile: string | null;
  preference: 'fastest' | 'shortest';
}

export function normalizeRoutingTransport(t?: string | null): string {
  const s = (t || '').trim().toLowerCase();
  if (s === 'auto' || s === 'car' || s === 'driving' || s === 'driving-car') return 'Auto';
  if (s === 'fahrrad' || s === 'bike' || s === 'cycling' || s === 'cycling-regular')
    return 'Fahrrad';
  if (
    s === 'zu fuß' ||
    s === 'zu fuss' ||
    s === 'fuss' ||
    s === 'fuß' ||
    s === 'foot' ||
    s === 'walking' ||
    s === 'foot-walking'
  ) {
    return 'zu Fuß';
  }
  return t || '';
}

export function useRouteCalculation(options: UseRouteCalculationOptions) {
  const { tripId, fromCoords, toCoords, transportType, onRouteSelected } = options;

  const isCalculatingRoute = ref(false);
  const routeCalculationError = ref<string | null>(null);
  const calculatedDistanceMeters = ref<number | null>(null);
  const calculatedDurationSeconds = ref<number | null>(null);
  const routeGeometry = ref<string | null>(null);
  const routingProfile = ref<string | null>(null);
  const routePreference = ref<'fastest' | 'shortest'>('fastest');
  const calculatedRoutes = ref<RouteResult[]>([]);
  const selectedRouteIndex = ref<number>(0);
  const routeDisplayMode = ref<'exact' | 'direct'>('exact');

  const cachedExactRoute = ref<{
    geometry: string | null;
    distance: number | null;
    duration: number | null;
    profile: string | null;
  } | null>(null);

  // In-Memory-Cache pro Verkehrsmittel für sofortiges Wechseln ohne API-Neuabfrage
  const routeCacheByTransport = ref<Record<string, CachedModeRoute>>({});
  let activeCalcRequestId = 0;

  const fastestRouteIndex = computed(() => {
    if (!calculatedRoutes.value.length) return -1;
    let minDur = Infinity;
    let idx = 0;
    calculatedRoutes.value.forEach((r, i) => {
      if (r.duration_seconds < minDur) {
        minDur = r.duration_seconds;
        idx = i;
      }
    });
    return idx;
  });

  const shortestRouteIndex = computed(() => {
    if (!calculatedRoutes.value.length) return -1;
    let minDist = Infinity;
    let idx = 0;
    calculatedRoutes.value.forEach((r, i) => {
      if (r.distance_meters < minDist) {
        minDist = r.distance_meters;
        idx = i;
      }
    });
    return idx;
  });

  const suggestedRouteIndex = computed(() => {
    return routePreference.value === 'shortest'
      ? shortestRouteIndex.value
      : fastestRouteIndex.value;
  });

  const hasExactRoute = computed(() => {
    return (
      (routeGeometry.value != null ||
        cachedExactRoute.value?.geometry != null ||
        Object.keys(routeCacheByTransport.value).length > 0) &&
      (calculatedDistanceMeters.value != null ||
        cachedExactRoute.value?.distance != null ||
        Object.keys(routeCacheByTransport.value).length > 0)
    );
  });

  const hasCoordinates = computed(() => {
    const from = fromCoords.value;
    const to = toCoords.value;
    return from?.lat != null && from?.lng != null && to?.lat != null && to?.lng != null;
  });

  const isRoutable = computed(() => {
    if (!hasCoordinates.value) return false;
    const t = (transportType.value || '').toLowerCase();
    return t === 'auto' || t === 'fahrrad' || t === 'zu fuß' || t === 'zu fuss';
  });

  function applyCachedRoute(cached: CachedModeRoute) {
    calculatedRoutes.value = cached.routes;
    selectedRouteIndex.value = cached.selectedRouteIndex;
    routeGeometry.value = cached.routeGeometry;
    calculatedDistanceMeters.value = cached.distance;
    calculatedDurationSeconds.value = cached.duration;
    routingProfile.value = cached.profile;
    routePreference.value = cached.preference;
    routeDisplayMode.value = 'exact';
    routeCalculationError.value = null;

    cachedExactRoute.value = {
      geometry: cached.routeGeometry,
      distance: cached.distance,
      duration: cached.duration,
      profile: cached.profile,
    };

    if (cached.routes[cached.selectedRouteIndex]) {
      onRouteSelected?.(cached.routes[cached.selectedRouteIndex]);
    }
  }

  function selectRoute(idx: number) {
    if (!calculatedRoutes.value[idx]) return;
    selectedRouteIndex.value = idx;
    const selected = calculatedRoutes.value[idx];
    calculatedDistanceMeters.value = selected.distance_meters;
    calculatedDurationSeconds.value = selected.duration_seconds;
    routeGeometry.value = JSON.stringify(selected.coordinates);
    routingProfile.value = selected.profile;
    cachedExactRoute.value = {
      geometry: JSON.stringify(selected.coordinates),
      distance: selected.distance_meters,
      duration: selected.duration_seconds,
      profile: selected.profile,
    };
    routeDisplayMode.value = 'exact';

    const modeKey = normalizeRoutingTransport(transportType.value);
    if (modeKey) {
      routeCacheByTransport.value[modeKey] = {
        routes: calculatedRoutes.value,
        selectedRouteIndex: idx,
        routeGeometry: routeGeometry.value,
        distance: selected.distance_meters,
        duration: selected.duration_seconds,
        profile: selected.profile,
        preference: routePreference.value,
      };
    }

    onRouteSelected?.(selected);
  }

  function onPreferenceToggle(val: string) {
    const pref = val as 'fastest' | 'shortest';
    routePreference.value = pref;
    const modeKey = normalizeRoutingTransport(transportType.value);
    if (modeKey && routeCacheByTransport.value[modeKey]) {
      routeCacheByTransport.value[modeKey].preference = pref;
    }
    if (calculatedRoutes.value.length > 1) {
      const targetIdx = pref === 'shortest' ? shortestRouteIndex.value : fastestRouteIndex.value;
      if (targetIdx >= 0) {
        selectRoute(targetIdx);
      }
    }
  }

  function onRouteModeChange(val: string) {
    routeDisplayMode.value = val as 'exact' | 'direct';
    routeCalculationError.value = null;
    if (val === 'exact') {
      const modeKey = normalizeRoutingTransport(transportType.value);
      const cached = routeCacheByTransport.value[modeKey];
      if (cached && cached.routes.length > 0) {
        applyCachedRoute(cached);
      } else if (hasCoordinates.value && isRoutable.value) {
        calculateRoute();
      }
    }
  }

  function resetToDirectLine() {
    routeGeometry.value = null;
    calculatedDistanceMeters.value = null;
    calculatedDurationSeconds.value = null;
    routingProfile.value = null;
    cachedExactRoute.value = null;
    calculatedRoutes.value = [];
    selectedRouteIndex.value = 0;
    routeDisplayMode.value = 'exact';
    routeCalculationError.value = null;
    routeCacheByTransport.value = {};
  }

  function setInitialRoute(
    geometry?: string | null,
    distance?: number | null,
    duration?: number | null,
    profile?: string | null
  ) {
    routeCacheByTransport.value = {};
    calculatedDistanceMeters.value = distance ?? null;
    calculatedDurationSeconds.value = duration ?? null;
    routeGeometry.value = geometry ?? null;
    routingProfile.value = profile ?? null;
    routeCalculationError.value = null;

    if (geometry) {
      cachedExactRoute.value = {
        geometry,
        distance: distance ?? null,
        duration: duration ?? null,
        profile: profile ?? null,
      };
      const parsedCoords = parseRouteGeometry(geometry);
      if (parsedCoords) {
        calculatedRoutes.value = [
          {
            coordinates: parsedCoords,
            distance_meters: distance ?? 0,
            duration_seconds: duration ?? 0,
            profile: profile ?? '',
          },
        ];
        selectedRouteIndex.value = 0;
      } else {
        calculatedRoutes.value = [];
        selectedRouteIndex.value = 0;
      }
      routeDisplayMode.value = 'exact';

      const modeKey = normalizeRoutingTransport(transportType.value);
      if (modeKey) {
        routeCacheByTransport.value[modeKey] = {
          routes: calculatedRoutes.value,
          selectedRouteIndex: 0,
          routeGeometry: geometry,
          distance: distance ?? null,
          duration: duration ?? null,
          profile: profile ?? null,
          preference: routePreference.value,
        };
      }
    } else {
      cachedExactRoute.value = null;
      calculatedRoutes.value = [];
      selectedRouteIndex.value = 0;
      routeDisplayMode.value = 'exact';
    }
  }

  async function calculateRoute(): Promise<boolean> {
    const from = fromCoords.value;
    const to = toCoords.value;
    if (!from || !to || !hasCoordinates.value) return false;

    const reqId = ++activeCalcRequestId;
    isCalculatingRoute.value = true;
    routeCalculationError.value = null;

    try {
      const id = tripId.value;
      if (!id) {
        routeCalculationError.value = 'Keine Reise-ID vorhanden';
        return false;
      }

      const res = await api.post<DirectionsResponse>(`/trips/${id}/routes/directions`, {
        from_lat: from.lat,
        from_lng: from.lng,
        to_lat: to.lat,
        to_lng: to.lng,
        transport_type: transportType.value,
        preference: routePreference.value,
      });

      if (reqId !== activeCalcRequestId) return false;

      if (!res.supported || !res.routes?.length) {
        routeCalculationError.value = res.reason || 'Keine Route gefunden';
        return false;
      }

      calculatedRoutes.value = res.routes.slice(0, 3);
      const suggestedIdx = suggestedRouteIndex.value >= 0 ? suggestedRouteIndex.value : 0;
      selectRoute(suggestedIdx);
      return true;
    } catch (err: unknown) {
      if (reqId !== activeCalcRequestId) return false;
      routeCalculationError.value =
        err instanceof Error ? err.message : 'Fehler beim Abrufen der Route';
      return false;
    } finally {
      if (reqId === activeCalcRequestId) {
        isCalculatingRoute.value = false;
      }
    }
  }

  // Automatischer Wechsel oder Neuabfrage bei Änderung des Verkehrsmittels
  watch(
    () => transportType.value,
    async (newType, oldType) => {
      if (!newType || newType === oldType) return;
      const modeKey = normalizeRoutingTransport(newType);
      if (!modeKey || !isRoutable.value) return;

      // Wenn Exakte Route aktiv ist, sofort aus Cache bedienen oder automatisch neu abfragen
      if (hasExactRoute.value && routeDisplayMode.value === 'exact') {
        const cached = routeCacheByTransport.value[modeKey];
        if (cached && cached.routes.length > 0) {
          applyCachedRoute(cached);
        } else {
          await calculateRoute();
        }
      }
    }
  );

  function clearRoute() {
    calculatedDurationSeconds.value = null;
    calculatedDistanceMeters.value = null;
    routeGeometry.value = null;
    routingProfile.value = null;
    calculatedRoutes.value = [];
    selectedRouteIndex.value = 0;
    cachedExactRoute.value = null;
    routeCalculationError.value = null;
  }

  return {
    isCalculatingRoute,
    routeCalculationError,
    calculatedDistanceMeters,
    calculatedDurationSeconds,
    routeGeometry,
    routingProfile,
    routePreference,
    calculatedRoutes,
    selectedRouteIndex,
    fastestRouteIndex,
    shortestRouteIndex,
    suggestedRouteIndex,
    routeDisplayMode,
    cachedExactRoute,
    routeCacheByTransport,
    hasExactRoute,
    hasCoordinates,
    isRoutable,
    calculateRoute,
    selectRoute,
    onPreferenceToggle,
    onRouteModeChange,
    resetToDirectLine,
    setInitialRoute,
    clearRoute,
  };
}

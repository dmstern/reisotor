import { computed, shallowRef, watch, type ComputedRef } from 'vue';
import { api } from '../api/client';
import { useSpotsStore } from '../stores/spots';
import { useTripStore } from '../stores/trip';
import {
  chooseRoutingProfile,
  getValidAccommodations,
  haversineMeters,
  resolveReferenceAccommodation,
  shouldShowAccommodationDistance,
  type SpotAccommodationDistanceInfo,
} from '../utils/spotAccommodationDistance';

interface BatchSummaryResponse {
  results: Record<
    string,
    {
      distance_meters: number;
      duration_seconds: number | null;
      profile: 'foot-walking' | 'driving-car';
      is_fallback: boolean;
    }
  >;
}

export interface UseAccommodationDistancesOptions {
  spotScheduledDates?: ComputedRef<Map<number, string>>;
}

// In-Memory-Cache pro Session über Trip-Wechsel hinweg
const routingMemoryCache = new Map<
  string,
  { distance_meters: number; duration_seconds: number | null; is_fallback: boolean }
>();

const COORD_DECIMALS = 5;

function buildCacheKey(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  profile: string
): string {
  return `${origin.lat.toFixed(COORD_DECIMALS)},${origin.lng.toFixed(COORD_DECIMALS)}->${destination.lat.toFixed(COORD_DECIMALS)},${destination.lng.toFixed(COORD_DECIMALS)}:${profile}`;
}

export function useAccommodationDistances(options?: UseAccommodationDistancesOptions) {
  const spotsStore = useSpotsStore();
  const tripStore = useTripStore();

  const fetchedRoutingResults = shallowRef<
    Map<string, { distance_meters: number; duration_seconds: number | null; is_fallback: boolean }>
  >(new Map(routingMemoryCache));

  const validAccommodations = computed(() => getValidAccommodations(spotsStore.spots));

  const spotAccommodationDistances = computed<Map<number, SpotAccommodationDistanceInfo>>(() => {
    const map = new Map<number, SpotAccommodationDistanceInfo>();
    const accommodations = validAccommodations.value;

    if (!accommodations.length) {
      return map;
    }

    const scheduledMap = options?.spotScheduledDates?.value;

    for (const spot of spotsStore.spots) {
      if (!shouldShowAccommodationDistance(spot)) {
        continue;
      }

      const scheduledDate = scheduledMap?.get(spot.id) ?? null;
      const refAccommodation = resolveReferenceAccommodation(spot, accommodations, scheduledDate);

      if (!refAccommodation || refAccommodation.lat == null || refAccommodation.lng == null) {
        continue;
      }

      const airDistance = haversineMeters(
        { lat: refAccommodation.lat, lng: refAccommodation.lng },
        { lat: spot.lat!, lng: spot.lng! }
      );
      const profile = chooseRoutingProfile(airDistance);
      const cacheKey = buildCacheKey(
        { lat: refAccommodation.lat, lng: refAccommodation.lng },
        { lat: spot.lat!, lng: spot.lng! },
        profile
      );

      const cached = fetchedRoutingResults.value.get(cacheKey);

      if (cached) {
        map.set(spot.id, {
          accommodationId: refAccommodation.id,
          accommodationTitle: refAccommodation.title,
          distanceMeters: cached.distance_meters,
          durationSeconds: cached.duration_seconds,
          profile,
          isFallback: cached.is_fallback,
        });
      } else {
        // Sofortige synchrone Haversine-Initialanzeige
        map.set(spot.id, {
          accommodationId: refAccommodation.id,
          accommodationTitle: refAccommodation.title,
          distanceMeters: Math.round(airDistance),
          durationSeconds: null,
          profile,
          isFallback: true,
        });
      }
    }

    return map;
  });

  let activeFetchAbort: AbortController | null = null;

  async function fetchMissingRoutes() {
    const tripId = tripStore.currentTripId;
    const accommodations = validAccommodations.value;

    if (!tripId || !accommodations.length) {
      return;
    }

    const scheduledMap = options?.spotScheduledDates?.value;
    const missingItems: Array<{
      key: string;
      from_lat: number;
      from_lng: number;
      to_lat: number;
      to_lng: number;
      profile: 'foot-walking' | 'driving-car';
    }> = [];
    const seenKeys = new Set<string>();

    for (const spot of spotsStore.spots) {
      if (!shouldShowAccommodationDistance(spot)) {
        continue;
      }

      const scheduledDate = scheduledMap?.get(spot.id) ?? null;
      const refAccommodation = resolveReferenceAccommodation(spot, accommodations, scheduledDate);

      if (!refAccommodation || refAccommodation.lat == null || refAccommodation.lng == null) {
        continue;
      }

      const airDistance = haversineMeters(
        { lat: refAccommodation.lat, lng: refAccommodation.lng },
        { lat: spot.lat!, lng: spot.lng! }
      );
      const profile = chooseRoutingProfile(airDistance);
      const cacheKey = buildCacheKey(
        { lat: refAccommodation.lat, lng: refAccommodation.lng },
        { lat: spot.lat!, lng: spot.lng! },
        profile
      );

      if (!routingMemoryCache.has(cacheKey) && !seenKeys.has(cacheKey)) {
        seenKeys.add(cacheKey);
        missingItems.push({
          key: cacheKey,
          from_lat: refAccommodation.lat,
          from_lng: refAccommodation.lng,
          to_lat: spot.lat!,
          to_lng: spot.lng!,
          profile,
        });
      }
    }

    if (!missingItems.length) {
      return;
    }

    activeFetchAbort?.abort();
    activeFetchAbort = new AbortController();

    try {
      const res = await api.post<BatchSummaryResponse>(
        `/trips/${tripId}/routes/batch-summary`,
        { items: missingItems },
        { signal: activeFetchAbort.signal }
      );

      let hasNew = false;

      for (const [key, data] of Object.entries(res.results)) {
        routingMemoryCache.set(key, data);
        hasNew = true;
      }

      if (hasNew) {
        fetchedRoutingResults.value = new Map(routingMemoryCache);
      }
    } catch {
      // Offline oder abgebrochen -> Haversine-Fallback bleibt aktiv
    }
  }

  watch(
    [() => spotsStore.spots, () => options?.spotScheduledDates?.value],
    () => {
      fetchMissingRoutes();
    },
    { immediate: true, deep: true }
  );

  return {
    spotAccommodationDistances,
    validAccommodations,
    fetchMissingRoutes,
  };
}

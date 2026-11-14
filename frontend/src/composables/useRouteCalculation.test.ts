// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { normalizeRoutingTransport, useRouteCalculation } from './useRouteCalculation';
import { api } from '../api/client';

describe('useRouteCalculation helpers', () => {
  it('normalizes transport modes correctly', () => {
    expect(normalizeRoutingTransport('Auto')).toBe('Auto');
    expect(normalizeRoutingTransport('car')).toBe('Auto');
    expect(normalizeRoutingTransport('driving-car')).toBe('Auto');
    expect(normalizeRoutingTransport('bike')).toBe('Fahrrad');
    expect(normalizeRoutingTransport('cycling')).toBe('Fahrrad');
    expect(normalizeRoutingTransport('zu Fuß')).toBe('zu Fuß');
    expect(normalizeRoutingTransport('walking')).toBe('zu Fuß');
    expect(normalizeRoutingTransport('Zug')).toBe('Zug');
  });
});

describe('useRouteCalculation composable', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('initializes with default routing state', () => {
    const tripId = ref(1);
    const fromCoords = ref({ lat: 48.1, lng: 11.5 });
    const toCoords = ref({ lat: 48.2, lng: 11.6 });
    const transportType = ref('Auto');

    const {
      isCalculatingRoute,
      hasExactRoute,
      hasCoordinates,
      isRoutable,
      routeDisplayMode,
      routePreference,
    } = useRouteCalculation({
      tripId,
      fromCoords,
      toCoords,
      transportType,
    });

    expect(isCalculatingRoute.value).toBe(false);
    expect(hasExactRoute.value).toBe(false);
    expect(hasCoordinates.value).toBe(true);
    expect(isRoutable.value).toBe(true);
    expect(routeDisplayMode.value).toBe('exact');
    expect(routePreference.value).toBe('fastest');
  });

  it('determines fastest and shortest route indices', () => {
    const tripId = ref(1);
    const fromCoords = ref({ lat: 48.1, lng: 11.5 });
    const toCoords = ref({ lat: 48.2, lng: 11.6 });
    const transportType = ref('Auto');

    const {
      calculatedRoutes,
      fastestRouteIndex,
      shortestRouteIndex,
      suggestedRouteIndex,
      onPreferenceToggle,
    } = useRouteCalculation({
      tripId,
      fromCoords,
      toCoords,
      transportType,
    });

    calculatedRoutes.value = [
      {
        coordinates: [
          [48.1, 11.5],
          [48.2, 11.6],
        ],
        distance_meters: 12000,
        duration_seconds: 1500, // slower, but shorter
        profile: 'driving-car',
      },
      {
        coordinates: [
          [48.1, 11.5],
          [48.2, 11.6],
        ],
        distance_meters: 15000,
        duration_seconds: 1000, // faster, but longer
        profile: 'driving-car',
      },
    ];

    expect(fastestRouteIndex.value).toBe(1);
    expect(shortestRouteIndex.value).toBe(0);
    expect(suggestedRouteIndex.value).toBe(1); // default fastest

    onPreferenceToggle('shortest');
    expect(suggestedRouteIndex.value).toBe(0);
  });

  it('setInitialRoute and clearRoute manage route state correctly', () => {
    const tripId = ref(1);
    const fromCoords = ref({ lat: 48.1, lng: 11.5 });
    const toCoords = ref({ lat: 48.2, lng: 11.6 });
    const transportType = ref('Auto');

    const {
      calculatedDistanceMeters,
      calculatedDurationSeconds,
      hasExactRoute,
      setInitialRoute,
      clearRoute,
    } = useRouteCalculation({
      tripId,
      fromCoords,
      toCoords,
      transportType,
    });

    setInitialRoute('encoded_geom', 25000, 1800, 'driving-car');
    expect(calculatedDistanceMeters.value).toBe(25000);
    expect(calculatedDurationSeconds.value).toBe(1800);
    expect(hasExactRoute.value).toBe(true);

    clearRoute();
    expect(calculatedDistanceMeters.value).toBeNull();
    expect(calculatedDurationSeconds.value).toBeNull();
    // Cache is preserved for switching back
    expect(hasExactRoute.value).toBe(true);

    // Full reset clears cache as well
    setInitialRoute(null, null, null, null);
    expect(hasExactRoute.value).toBe(false);
  });

  it('populates routeCalculationErrorDetails on routing failure and clears on reset', async () => {
    vi.spyOn(api, 'post').mockResolvedValueOnce({
      supported: false,
      reason: 'Für „Auto“ wurde in der Nähe von Start oder Ziel keine befahrbare Straße gefunden.',
      details: 'OpenRouteService HTTP 404: {"error":{"code":2010}}',
      routes: [],
    });

    const tripId = ref(7);
    const fromCoords = ref({ lat: 52.535603, lng: 13.4905235 });
    const toCoords = ref({ lat: 52.4200284, lng: 13.6318564 });
    const transportType = ref('Auto');

    const {
      routeCalculationError,
      routeCalculationErrorDetails,
      calculateRoute,
      resetToDirectLine,
    } = useRouteCalculation({
      tripId,
      fromCoords,
      toCoords,
      transportType,
    });

    const ok = await calculateRoute();
    expect(ok).toBe(false);
    expect(routeCalculationError.value).toContain('keine befahrbare Straße gefunden');
    expect(routeCalculationErrorDetails.value).not.toBeNull();
    expect(routeCalculationErrorDetails.value?.summary).toContain('Routenberechnung (Auto)');
    expect(routeCalculationErrorDetails.value?.rawMessage).toContain('OpenRouteService HTTP 404');

    resetToDirectLine();
    expect(routeCalculationError.value).toBeNull();
    expect(routeCalculationErrorDetails.value).toBeNull();
  });
});

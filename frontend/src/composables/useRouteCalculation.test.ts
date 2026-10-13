// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { normalizeRoutingTransport, useRouteCalculation } from './useRouteCalculation';

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
});

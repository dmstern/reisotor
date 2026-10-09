// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegRouteSection from './LegRouteSection.vue';
import type { RouteResult, Spot } from '../api/types';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function mountTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  const vm = app.mount(container);
  return {
    app,
    container,
    vm,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

const mockFromSpot = { id: 1, title: 'Start', lat: 50.1, lng: 8.6 } as Spot;
const mockToSpot = { id: 2, title: 'Ziel', lat: 50.2, lng: 8.7 } as Spot;

const mockRoutes: RouteResult[] = [
  {
    coordinates: [
      [50.1, 8.6],
      [50.2, 8.7],
    ],
    duration_seconds: 1200,
    distance_meters: 15000,
    profile: 'driving-car',
  },
];

describe('LegRouteSection', () => {
  it('renders initial calculation controls when no exact route exists', async () => {
    let calcTriggered = false;
    const { cleanUp } = mountTestApp(LegRouteSection, {
      isOpen: true,
      isDisabled: false,
      isCalculatingRoute: false,
      hasExactRoute: false,
      routeCalculationError: null,
      transportType: 'Auto',
      routePreference: 'fastest',
      routeDisplayMode: 'exact',
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      calculatedRoutes: [],
      selectedRouteIndex: 0,
      fastestRouteIndex: 0,
      shortestRouteIndex: 0,
      suggestedRouteIndex: 0,
      calculatedDistanceMeters: null,
      calculatedDurationSeconds: null,
      onCalculateRoute: () => {
        calcTriggered = true;
      },
    });
    await nextTick();

    const fieldset = document.querySelector('.route-calc-fieldset');
    expect(fieldset).not.toBeNull();
    expect(fieldset?.textContent).toContain('Exakte Route, Distanz und Fahrzeit für Auto');

    const calcBtn = document.querySelector('.btn-calc-route') as HTMLButtonElement;
    expect(calcBtn).not.toBeNull();
    calcBtn.click();
    await nextTick();

    expect(calcTriggered).toBe(true);

    cleanUp();
  });

  it('renders loading badge when route calculation is running', async () => {
    const { cleanUp } = mountTestApp(LegRouteSection, {
      isOpen: true,
      isDisabled: false,
      isCalculatingRoute: true,
      hasExactRoute: false,
      routeCalculationError: null,
      transportType: 'Auto',
      routePreference: 'fastest',
      routeDisplayMode: 'exact',
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      calculatedRoutes: [],
      selectedRouteIndex: 0,
      fastestRouteIndex: 0,
      shortestRouteIndex: 0,
      suggestedRouteIndex: 0,
      calculatedDistanceMeters: null,
      calculatedDurationSeconds: null,
    });
    await nextTick();

    const badge = document.querySelector('.route-calc-badge--loading');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('Route wird berechnet…');

    cleanUp();
  });

  it('renders mini map and floating card when route exists', async () => {
    const { cleanUp } = mountTestApp(LegRouteSection, {
      isOpen: true,
      isDisabled: false,
      isCalculatingRoute: false,
      hasExactRoute: true,
      routeCalculationError: null,
      transportType: 'Auto',
      routePreference: 'fastest',
      routeDisplayMode: 'exact',
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      calculatedRoutes: mockRoutes,
      selectedRouteIndex: 0,
      fastestRouteIndex: 0,
      shortestRouteIndex: 0,
      suggestedRouteIndex: 0,
      calculatedDistanceMeters: 15000,
      calculatedDurationSeconds: 1200,
    });
    await nextTick();

    const mapContainer = document.querySelector('.route-mini-map-container');
    expect(mapContainer).not.toBeNull();

    const floatingCard = document.querySelector('.route-floating-card');
    expect(floatingCard).not.toBeNull();

    cleanUp();
  });
});

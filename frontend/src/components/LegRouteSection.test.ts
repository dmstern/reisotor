// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import LegRouteSection from './LegRouteSection.vue';
import ErrorDetailModal from './ErrorDetailModal.vue';
import { useErrorNotifier } from '../composables/useErrorNotifier';
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
  beforeEach(() => {
    setActivePinia(createPinia());
    useErrorNotifier().clearErrors();
  });

  it('renders initial calculation controls when no exact route exists', async () => {
    let calcTriggered = false;
    const { cleanUp } = mountTestApp(LegRouteSection, {
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

  it('renders clickable reportable Alert outside header and opens central error detail and feedback flow', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h('div', [
          h(LegRouteSection, {
            isDisabled: false,
            isCalculatingRoute: false,
            hasExactRoute: false,
            routeCalculationError:
              'Für „Auto“ wurde in der Nähe von Start oder Ziel keine befahrbare Straße gefunden.',
            routeCalculationErrorDetails: {
              id: 1,
              summary:
                'Routenberechnung (Auto): Für „Auto“ wurde in der Nähe von Start oder Ziel keine befahrbare Straße gefunden.',
              kind: 'api',
              errorName: 'Error',
              rawMessage: 'OpenRouteService HTTP 404: {"error":{"code":2010}}',
              method: 'POST',
              path: '/trips/1/routes/directions',
              componentInfo: 'LegRouteSection (transport=Auto, preference=fastest)',
              timestamp: '2026-11-14T15:00:00.000Z',
              online: true,
            },
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
          }),
          h(ErrorDetailModal),
        ]),
    });
    app.use(pinia);
    app.mount(container);
    await nextTick();

    const header = document.querySelector('.route-calc-header');
    const errorBtn = document.querySelector('.route-calc-error-alert') as HTMLButtonElement | null;
    expect(errorBtn).not.toBeNull();
    expect(header?.contains(errorBtn)).toBe(false);
    expect(errorBtn?.textContent).toContain('keine befahrbare Straße gefunden');
    expect(errorBtn?.textContent).toContain('Fehlerdetails anzeigen & melden');

    errorBtn!.click();
    await nextTick();

    const { isErrorModalOpen, activeError } = useErrorNotifier();
    expect(isErrorModalOpen.value).toBe(true);
    expect(activeError.value?.rawMessage).toContain('OpenRouteService HTTP 404');

    const reportBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Als Bug melden')
    );
    expect(reportBtn).toBeDefined();
    reportBtn!.click();
    await nextTick();
    await nextTick();

    expect(document.body.innerHTML).toContain('Feedback geben');
    const titleInput = document.body.querySelector('input[type="text"]') as HTMLInputElement | null;
    const descTextarea = document.body.querySelector('textarea') as HTMLTextAreaElement | null;
    expect(titleInput?.value).toContain('Routenberechnung (Auto)');
    expect(descTextarea?.value).toContain('<details>');
    expect(descTextarea?.value).toContain('OpenRouteService HTTP 404');

    app.unmount();
    container.remove();
    document.body.innerHTML = '';
  });
});

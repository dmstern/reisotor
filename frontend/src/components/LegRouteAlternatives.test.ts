// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegRouteAlternatives from './LegRouteAlternatives.vue';
import type { RouteResult } from '../api/types';

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

const mockRoutes: RouteResult[] = [
  {
    coordinates: [
      [50.11, 8.68],
      [50.12, 8.69],
    ],
    duration_seconds: 1800, // 30 Min
    distance_meters: 30000, // 30 km
    profile: 'driving-car',
  },
  {
    coordinates: [
      [50.11, 8.68],
      [50.13, 8.7],
    ],
    duration_seconds: 2100, // 35 Min
    distance_meters: 25000, // 25 km
    profile: 'driving-car',
  },
];

describe('LegRouteAlternatives', () => {
  it('renders single route card without preference toggle button when only 1 route is provided', async () => {
    const { cleanUp } = mountTestApp(LegRouteAlternatives, {
      routes: [mockRoutes[0]],
      selectedRouteIndex: 0,
      calculatedDurationSeconds: 1800,
      calculatedDistanceMeters: 30000,
    });
    await nextTick();

    // Kein Toggle-Button für Präferenzen vorhanden
    expect(document.querySelector('.route-preference-toggle')).toBeNull();
    expect(document.querySelector('.route-preference-row')).toBeNull();

    // Einzelkarte vorhanden
    const singleCard = document.querySelector('.route-alt-card--single');
    expect(singleCard).not.toBeNull();
    expect(singleCard?.textContent).not.toContain('Route 1');
    expect(singleCard?.textContent).toContain('30 Min.');
    expect(singleCard?.textContent).toContain('30,0 km');

    cleanUp();
  });

  it('renders multiple route cards with fastest and shortest badges without preference toggle or suggestion badge', async () => {
    let selectedIdx = -1;
    const { cleanUp } = mountTestApp(LegRouteAlternatives, {
      routes: mockRoutes,
      selectedRouteIndex: 0,
      fastestRouteIndex: 0,
      shortestRouteIndex: 1,
      'onSelect-route': (idx: number) => {
        selectedIdx = idx;
      },
    });
    await nextTick();

    // Kein Toggle-Button für Präferenzen vorhanden
    expect(document.querySelector('.route-preference-toggle')).toBeNull();
    expect(document.querySelector('.route-preference-row')).toBeNull();

    // 2 Alternativen-Karten gerendert
    const cards = document.querySelectorAll('.route-alt-card');
    expect(cards.length).toBe(2);

    // Keine redundanten technischen Nummern-Labels (Route 1, Route 2)
    expect(cards[0].textContent).not.toContain('Route 1');
    expect(cards[1].textContent).not.toContain('Route 2');

    // Erste Alternative ist schnellste
    expect(cards[0].querySelector('.badge-fastest')?.textContent).toContain('Schnellste');
    expect(cards[0].querySelector('.badge-shortest')).toBeNull();
    // Kein redundanter Vorschlag-Badge
    expect(cards[0].querySelector('.badge-suggested')).toBeNull();

    // Route 2 ist kürzeste (+5 Min. Diff)
    expect(cards[1].querySelector('.badge-shortest')?.textContent).toContain('Kürzeste');
    expect(cards[1].querySelector('.badge-fastest')).toBeNull();
    expect(cards[1].querySelector('.badge-suggested')).toBeNull();
    expect(cards[1].querySelector('.route-alt-diff')?.textContent).toContain('+5 Min.');

    // Klick auf Route 2 emittiert select-route Event
    (cards[1] as HTMLElement).click();
    await nextTick();
    expect(selectedIdx).toBe(1);

    cleanUp();
  });
});

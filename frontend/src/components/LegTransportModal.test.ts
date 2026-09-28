// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegTransportModal from './LegTransportModal.vue';
import type { Spot, User, ExcursionLeg } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

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

const mockUsers: User[] = [
  { id: 1, username: 'alice', email: 'alice@example.com', avatar: '👩' },
  { id: 2, username: 'bob', email: 'bob@example.com', avatar: '👨' },
];

const mockFromSpot = {
  id: 10,
  trip_id: 1,
  title: 'Frankfurt Hbf',
  category: 'Bahnhof',
} as Spot;

const mockToSpot = {
  id: 11,
  trip_id: 1,
  title: 'Lisboa Oriente',
  category: 'Bahnhof',
} as Spot;

const mockLeg: ExcursionLeg = {
  id: 100,
  position: 0,
  from_spot_id: 10,
  to_spot_id: 11,
  transport_type: 'Zug',
  departure_time: '08:00',
  arrival_time: '20:00',
  amount: 89.9,
  paid_by_user_id: 1,
};

describe('LegTransportModal', () => {
  it('renders route summary with fromSpot and toSpot names and spot pills', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: mockLeg,
      users: mockUsers,
    });
    await nextTick();

    const summary = document.querySelector('.route-summary');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('Frankfurt Hbf');
    expect(summary?.textContent).toContain('Lisboa Oriente');
    expect(summary?.textContent).toContain('→');

    const pills = document.querySelectorAll('.spot-pill');
    expect(pills.length).toBe(2);

    cleanUp();
  });

  it('renders modal title reflecting route fromSpot and toSpot', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: null,
      users: mockUsers,
    });
    await nextTick();

    const titleEl = document.querySelector('h2, .modal-title, .title');
    expect(titleEl?.textContent).toContain('Teilstrecke: Frankfurt Hbf → Lisboa Oriente');

    cleanUp();
  });

  it('populates form fields from existing leg and renders delete button', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: mockLeg,
      users: mockUsers,
    });
    await nextTick();

    // Delete button should be visible when leg exists
    const deleteBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Löschen')
    );
    expect(deleteBtn).toBeDefined();

    cleanUp();
  });

  it('renders collapsible fieldset labeled "Erweiterte Angaben"', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: null,
      users: mockUsers,
    });
    await nextTick();

    const toggleBtn = document.querySelector('.collapsible-toggle');
    expect(toggleBtn?.textContent).toContain('Erweiterte Angaben');

    cleanUp();
  });

  it('zeigt Routen-Berechnung bei Koordinaten und Auto/Fahrrad/zu Fuß', async () => {
    const spotWithCoordsA = { ...mockFromSpot, lat: 38.71, lng: -9.14 };
    const spotWithCoordsB = { ...mockToSpot, lat: 38.8, lng: -9.38 };
    const carLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'Auto',
      departure_time: '10:00',
      arrival_time: '',
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: spotWithCoordsA,
      toSpot: spotWithCoordsB,
      leg: carLeg,
      users: mockUsers,
    });
    await nextTick();

    const calcWrapper = document.querySelector('.route-calc-wrapper');
    expect(calcWrapper).not.toBeNull();
    expect(calcWrapper?.classList.contains('is-expanded')).toBe(true);

    const calcSection = document.querySelector('.route-calc-section');
    expect(calcSection).not.toBeNull();
    expect(calcSection?.textContent).toContain('Exakte Route (OpenRouteService)');

    cleanUp();
  });

  it('klappt Routen-Berechnung ein wenn Verkehrsmittel nicht geroutet werden kann', async () => {
    const spotWithCoordsA = { ...mockFromSpot, lat: 38.71, lng: -9.14 };
    const spotWithCoordsB = { ...mockToSpot, lat: 38.8, lng: -9.38 };
    const trainLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'Zug',
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: spotWithCoordsA,
      toSpot: spotWithCoordsB,
      leg: trainLeg,
      users: mockUsers,
    });
    await nextTick();

    const calcWrapper = document.querySelector('.route-calc-wrapper');
    expect(calcWrapper).not.toBeNull();
    expect(calcWrapper?.classList.contains('is-expanded')).toBe(false);
    expect(calcWrapper?.hasAttribute('inert')).toBe(true);

    cleanUp();
  });

  it('berechnet Route per Klick und aktualisiert Ankunftszeit', async () => {
    const { api } = await import('../api/client');
    vi.mocked(api.post).mockResolvedValueOnce({
      supported: true,
      routes: [
        {
          coordinates: [
            [38.71, -9.14],
            [38.8, -9.38],
          ],
          distance_meters: 30000,
          duration_seconds: 1800, // 30 Min.
          profile: 'driving-car',
        },
      ],
    });

    const spotWithCoordsA = { ...mockFromSpot, lat: 38.71, lng: -9.14 };
    const spotWithCoordsB = { ...mockToSpot, lat: 38.8, lng: -9.38 };
    const carLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'Auto',
      departure_time: '14:15',
      arrival_time: '',
    };

    let savedLeg: ExcursionLeg | undefined;
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: spotWithCoordsA,
      toSpot: spotWithCoordsB,
      leg: carLeg,
      users: mockUsers,
      onSave: (leg: ExcursionLeg) => {
        savedLeg = leg;
      },
    });
    await nextTick();

    const calcBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Route berechnen')
    );
    expect(calcBtn).toBeDefined();

    calcBtn?.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    // Distanz und Dauer sollen nun angezeigt werden:
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('30,0 km');
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('30 Min.');

    // Ankunftszeit soll von 14:15 + 30m auf 14:45 gesetzt sein:
    const arrivalInput = document.querySelector('.arrival-time-wrapper input') as HTMLInputElement;
    expect(arrivalInput?.value).toBe('14:45');

    // Formular absenden
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Übernehmen')
    );
    submitBtn?.click();
    await nextTick();

    expect(savedLeg).toBeDefined();
    const resultLeg = savedLeg as ExcursionLeg;
    expect(resultLeg.distance_meters).toBe(30000);
    expect(resultLeg.duration_seconds).toBe(1800);
    expect(resultLeg.arrival_time).toBe('14:45');

    cleanUp();
  });

  it('rendert 4 Toggle-Buttons für Zu Fuß, Auto, Fahrrad und ÖPNV', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: null,
      users: mockUsers,
    });
    await nextTick();

    const toggle = document.querySelector('.transport-toggle');
    expect(toggle).not.toBeNull();

    const options = Array.from(toggle?.querySelectorAll('.segmented-option') ?? []);
    expect(options.length).toBe(4);
    const labels = options.map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Zu Fuß', 'Auto', 'Fahrrad', 'ÖPNV']);

    // Standardmäßig ist Zu Fuß aktiv
    expect(options[0].classList.contains('active')).toBe(true);
    expect(options[0].getAttribute('aria-pressed')).toBe('true');

    cleanUp();
  });

  it('steuert Öffi-Dropdown über ÖPNV-Toggle und unterstützt Verkehrsmittel-Auswahl', async () => {
    let savedLeg: ExcursionLeg | undefined;
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: { ...mockFromSpot, lat: 38.71, lng: -9.14 },
      toSpot: { ...mockToSpot, lat: 38.8, lng: -9.38 },
      leg: mockLeg, // Zug (ÖPNV)
      users: mockUsers,
      onSave: (leg: ExcursionLeg) => {
        savedLeg = leg;
      },
    });
    await nextTick();

    const transitWrapper = document.querySelector('.transit-dropdown-wrapper');
    expect(transitWrapper).not.toBeNull();
    // Da mockLeg 'Zug' ist, soll ÖPNV aktiv sein und das Dropdown ausgeklappt
    expect(transitWrapper?.classList.contains('is-expanded')).toBe(true);
    expect(transitWrapper?.hasAttribute('inert')).toBe(false);

    const toggleOptions = Array.from(
      document.querySelectorAll('.transport-toggle .segmented-option')
    );
    const opnvBtn = toggleOptions.find((o) => o.textContent?.includes('ÖPNV')) as HTMLButtonElement;
    const autoBtn = toggleOptions.find((o) => o.textContent?.includes('Auto')) as HTMLButtonElement;
    const bikeBtn = toggleOptions.find((o) =>
      o.textContent?.includes('Fahrrad')
    ) as HTMLButtonElement;
    const walkBtn = toggleOptions.find((o) =>
      o.textContent?.includes('Zu Fuß')
    ) as HTMLButtonElement;

    expect(opnvBtn.classList.contains('active')).toBe(true);

    // Klick auf Auto: Dropdown klappt ein, Route-Berechnung klappt aus
    autoBtn.click();
    await nextTick();

    expect(transitWrapper?.classList.contains('is-expanded')).toBe(false);
    expect(transitWrapper?.hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.route-calc-wrapper')?.classList.contains('is-expanded')).toBe(
      true
    );

    // Klick auf Fahrrad: Dropdown bleibt eingeklappt, Route-Berechnung bleibt aktiv
    bikeBtn.click();
    await nextTick();
    expect(transitWrapper?.classList.contains('is-expanded')).toBe(false);
    expect(document.querySelector('.route-calc-wrapper')?.classList.contains('is-expanded')).toBe(
      true
    );

    // Klick auf Zu Fuß: Dropdown bleibt eingeklappt, Route-Berechnung bleibt aktiv
    walkBtn.click();
    await nextTick();
    expect(transitWrapper?.classList.contains('is-expanded')).toBe(false);
    expect(document.querySelector('.route-calc-wrapper')?.classList.contains('is-expanded')).toBe(
      true
    );

    // Zurück zu ÖPNV: Dropdown klappt wieder aus, Route-Berechnung klappt ein
    opnvBtn.click();
    await nextTick();

    expect(transitWrapper?.classList.contains('is-expanded')).toBe(true);
    expect(transitWrapper?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('.route-calc-wrapper')?.classList.contains('is-expanded')).toBe(
      false
    );

    // Öffi-Verkehrsmittel im Dropdown auf "Bus" umstellen
    const select = document.querySelector('.transit-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    select.value = 'Bus';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    // Speichern und prüfen
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Übernehmen')
    );
    submitBtn?.click();
    await nextTick();

    expect(savedLeg).toBeDefined();
    expect((savedLeg as ExcursionLeg).transport_type).toBe('Bus');

    cleanUp();
  });

  it('erlaubt Umschalten auf Luftlinie nach Routenberechnung und speichert ohne Route-Geometrie', async () => {
    const { api } = await import('../api/client');
    vi.mocked(api.post).mockResolvedValueOnce({
      supported: true,
      routes: [
        {
          coordinates: [
            [38.71, -9.14],
            [38.8, -9.38],
          ],
          distance_meters: 1800,
          duration_seconds: 1260,
          profile: 'driving-car',
        },
      ],
    });

    const spotWithCoordsA = { ...mockFromSpot, lat: 38.71, lng: -9.14 };
    const spotWithCoordsB = { ...mockToSpot, lat: 38.8, lng: -9.38 };
    const carLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'Auto',
    };

    let savedLeg: ExcursionLeg | undefined;
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: spotWithCoordsA,
      toSpot: spotWithCoordsB,
      leg: carLeg,
      users: mockUsers,
      onSave: (leg: ExcursionLeg) => {
        savedLeg = leg;
      },
    });
    await nextTick();

    const calcBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Route berechnen')
    );
    calcBtn?.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    // Nach Berechnung ist Exakte Route aktiv
    expect(document.querySelector('.route-calc-badge')?.textContent).toContain(
      'Exakte Route aktiv'
    );
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('1,8 km');

    // Umschalten auf Luftlinie über SegmentedToggle
    const routeModeToggle = document.querySelector('.route-mode-toggle');
    expect(routeModeToggle).not.toBeNull();
    const luftlinieBtn = Array.from(routeModeToggle?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('Luftlinie')
    );
    expect(luftlinieBtn).toBeDefined();
    luftlinieBtn?.click();
    await nextTick();

    expect(document.querySelector('.route-calc-badge')?.textContent).toContain('Luftlinie aktiv');
    expect(document.querySelector('.route-calc-hint')?.textContent).toContain(
      'ungefähre Luftlinie'
    );

    // Speichern und prüfen: route_geometry und Distanz sollen null sein
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Übernehmen')
    );
    submitBtn?.click();
    await nextTick();

    expect(savedLeg).toBeDefined();
    expect(savedLeg?.route_geometry).toBeNull();
    expect(savedLeg?.distance_meters).toBeNull();
    expect(savedLeg?.duration_seconds).toBeNull();

    cleanUp();
  });

  it('setzt Route komplett auf Luftlinie zurück per Klick auf Auf Luftlinie zurücksetzen', async () => {
    const spotWithCoordsA = { ...mockFromSpot, lat: 38.71, lng: -9.14 };
    const spotWithCoordsB = { ...mockToSpot, lat: 38.8, lng: -9.38 };
    const legWithRoute: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'Auto',
      route_geometry: '[[38.71,-9.14],[38.8,-9.38]]',
      distance_meters: 1800,
      duration_seconds: 1260,
      routing_profile: 'driving-car',
    };

    let savedLeg: ExcursionLeg | undefined;
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: spotWithCoordsA,
      toSpot: spotWithCoordsB,
      leg: legWithRoute,
      users: mockUsers,
      onSave: (leg: ExcursionLeg) => {
        savedLeg = leg;
      },
    });
    await nextTick();

    // Route liegt vor: Badge und Toggle sind sichtbar
    expect(document.querySelector('.route-calc-active')).not.toBeNull();
    expect(document.querySelector('.route-calc-badge')?.textContent).toContain(
      'Exakte Route aktiv'
    );

    const resetBtn = Array.from(document.querySelectorAll('.btn-reset-route')).find((b) =>
      b.textContent?.includes('Auf Luftlinie zurücksetzen')
    ) as HTMLElement;
    expect(resetBtn).toBeDefined();
    resetBtn.click();
    await nextTick();

    // Box soll wieder im unberechneten Ausgangszustand mit "Route berechnen" sein
    expect(document.querySelector('.route-calc-active')).toBeNull();
    const calcBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Route berechnen')
    );
    expect(calcBtn).toBeDefined();

    // Speichern
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Übernehmen')
    );
    submitBtn?.click();
    await nextTick();

    expect(savedLeg).toBeDefined();
    expect(savedLeg?.route_geometry).toBeNull();
    expect(savedLeg?.distance_meters).toBeNull();
    expect(savedLeg?.duration_seconds).toBeNull();

    cleanUp();
  });
});

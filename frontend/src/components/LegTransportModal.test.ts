// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import LegTransportModal from './LegTransportModal.vue';
import type { Spot, User, ExcursionLeg } from '../api/types';

(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
  it('renders modal title with category icons and spot names, without redundant summary box', async () => {
    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: mockLeg,
      users: mockUsers,
    });
    await nextTick();

    const summary = document.querySelector('.route-summary');
    expect(summary).toBeNull();

    const titleEl = document.querySelector('h2, .modal-title, .title');
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toContain('Teilstrecke:');
    expect(titleEl?.textContent).toContain('Frankfurt Hbf');
    expect(titleEl?.textContent).toContain('Lisboa Oriente');
    expect(titleEl?.textContent).toContain('→');

    const icons = titleEl?.querySelectorAll('.app-icon');
    expect(icons?.length).toBe(2);

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
    expect(titleEl?.textContent).toContain('Teilstrecke:');
    expect(titleEl?.textContent).toContain('Frankfurt Hbf');
    expect(titleEl?.textContent).toContain('Lisboa Oriente');
    expect(titleEl?.textContent).toContain('→');

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

    const toggleBtns = Array.from(document.querySelectorAll('.collapsible-toggle'));
    const extendedBtn = toggleBtns.find((b) => b.textContent?.includes('Erweiterte Angaben'));
    expect(extendedBtn).toBeDefined();

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

    const routeFieldset = document.querySelector('.route-calc-fieldset');
    expect(routeFieldset).not.toBeNull();
    expect(routeFieldset?.classList.contains('is-open')).toBe(true);
    expect(routeFieldset?.textContent).toContain('Routenführung');
    expect(routeFieldset?.textContent).toContain('Route berechnen');
    expect(routeFieldset?.textContent).toContain('Quelle: OpenRouteService');

    const sourceLink = routeFieldset?.querySelector('a.route-source-link') as HTMLAnchorElement;
    expect(sourceLink).not.toBeNull();
    expect(sourceLink?.href).toBe('https://openrouteservice.org/');
    expect(sourceLink?.target).toBe('_blank');

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

    const routeFieldset = document.querySelector('.route-calc-fieldset');
    expect(routeFieldset).not.toBeNull();
    expect(routeFieldset?.classList.contains('is-closed')).toBe(true);
    const toggleBtn = routeFieldset?.querySelector('.collapsible-toggle');
    expect(toggleBtn?.hasAttribute('disabled')).toBe(true);
    expect(toggleBtn?.getAttribute('title')).toContain('Für ÖPNV');

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

    // Distanz und Dauer sollen nun im Single-Route-Card angezeigt werden (ohne überflüssiges "Route 1"-Label):
    expect(document.querySelector('.route-alt-card--single')?.textContent).not.toContain('Route 1');
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

    // Hinweis zu nicht verfügbarer exakter Routenberechnung soll als Tooltip am deaktivierten Routen-Toggle sichtbar sein
    const routeFieldset = document.querySelector('.route-calc-fieldset');
    expect(routeFieldset).not.toBeNull();
    expect(routeFieldset?.classList.contains('is-closed')).toBe(true);
    const routeToggle = routeFieldset?.querySelector('.collapsible-toggle');
    expect(routeToggle?.hasAttribute('disabled')).toBe(true);
    expect(routeToggle?.getAttribute('title')).toContain(
      'Für ÖPNV ist aktuell noch keine Routenberechnung möglich'
    );

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
    expect(document.querySelector('.route-calc-fieldset')?.classList.contains('is-open')).toBe(
      true
    );

    // Klick auf Fahrrad: Dropdown bleibt eingeklappt, Route-Berechnung bleibt aktiv
    bikeBtn.click();
    await nextTick();
    expect(transitWrapper?.classList.contains('is-expanded')).toBe(false);
    expect(document.querySelector('.route-calc-fieldset')?.classList.contains('is-open')).toBe(
      true
    );

    // Klick auf Zu Fuß: Dropdown bleibt eingeklappt, Route-Berechnung bleibt aktiv
    walkBtn.click();
    await nextTick();
    expect(transitWrapper?.classList.contains('is-expanded')).toBe(false);
    expect(document.querySelector('.route-calc-fieldset')?.classList.contains('is-open')).toBe(
      true
    );

    // Zurück zu ÖPNV: Dropdown klappt wieder aus, Route-Berechnung klappt ein und ist deaktiviert
    opnvBtn.click();
    await nextTick();

    expect(transitWrapper?.classList.contains('is-expanded')).toBe(true);
    expect(transitWrapper?.hasAttribute('inert')).toBe(false);
    expect(document.querySelector('.route-calc-fieldset')?.classList.contains('is-closed')).toBe(
      true
    );
    expect(
      document.querySelector('.route-calc-fieldset .collapsible-toggle')?.hasAttribute('disabled')
    ).toBe(true);

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

    // Nach Berechnung ist Exakte Route im Toggle aktiv und der Exakt-Pane sichtbar
    const routeModeToggle = document.querySelector('.route-mode-toggle');
    expect(routeModeToggle).not.toBeNull();
    expect(routeModeToggle?.querySelector('.active')?.textContent).toContain('Exakte Route');
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('1,8 km');

    const exactPane = document.querySelector('.route-mode-pane--exact');
    const directPane = document.querySelector('.route-mode-pane--direct');
    expect(exactPane?.classList.contains('is-active')).toBe(true);
    expect(exactPane?.hasAttribute('inert')).toBe(false);
    expect(directPane?.classList.contains('is-active')).toBe(false);
    expect(directPane?.hasAttribute('inert')).toBe(true);

    // Umschalten auf Luftlinie über SegmentedToggle: animierter Wechsel der Panes
    const luftlinieBtn = Array.from(routeModeToggle?.querySelectorAll('button') ?? []).find((b) =>
      b.textContent?.includes('Luftlinie')
    );
    expect(luftlinieBtn).toBeDefined();
    luftlinieBtn?.click();
    await nextTick();

    expect(routeModeToggle?.querySelector('.active')?.textContent).toContain('Luftlinie');
    expect(document.querySelector('.route-calc-hint')?.textContent).toContain(
      'ungefähre Luftlinie'
    );
    expect(exactPane?.classList.contains('is-active')).toBe(false);
    expect(exactPane?.hasAttribute('inert')).toBe(true);
    expect(directPane?.classList.contains('is-active')).toBe(true);
    expect(directPane?.hasAttribute('inert')).toBe(false);

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

  it('rendert Mini-Map und zeigt mehrere Routenalternativen zur Auswahl', async () => {
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
          duration_seconds: 1800, // 30 Min. - schnellste
          profile: 'driving-car',
        },
        {
          coordinates: [
            [38.71, -9.14],
            [38.75, -9.2],
            [38.8, -9.38],
          ],
          distance_meters: 25000, // 25 km - kürzeste
          duration_seconds: 2100, // 35 Min.
          profile: 'driving-car',
        },
        {
          coordinates: [
            [38.71, -9.14],
            [38.82, -9.3],
            [38.8, -9.38],
          ],
          distance_meters: 32000,
          duration_seconds: 2400, // 40 Min.
          profile: 'driving-car',
        },
      ],
    });

    const spotWithCoordsA = { ...mockFromSpot, lat: 38.71, lng: -9.14 };
    const spotWithCoordsB = { ...mockToSpot, lat: 38.8, lng: -9.38 };
    const carLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'Auto',
      departure_time: '14:00',
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
    calcBtn?.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 150));
    await nextTick();

    // Mini-Map soll gerendert sein
    const miniMap = document.querySelector('[data-testid="leg-mini-map"]');
    expect(miniMap).not.toBeNull();

    // 3 Alternativen-Karten sollen gerendert sein
    const altCards = document.querySelectorAll('.route-alt-card');
    expect(altCards.length).toBe(3);

    // Initial ist Route 1 vorausgewählt (schnellste / Standard-Präferenz)
    expect(altCards[0].classList.contains('is-selected')).toBe(true);
    expect(altCards[0].querySelector('.badge-fastest')?.textContent).toContain('Schnellste');
    expect(altCards[0].querySelector('.badge-suggested')).toBeNull();
    expect(altCards[1].querySelector('.badge-shortest')?.textContent).toContain('Kürzeste');

    // Route 2 anklicken (kürzere Strecke, aber 35 Min.)
    (altCards[1] as HTMLElement).click();
    await nextTick();

    expect(altCards[1].classList.contains('is-selected')).toBe(true);
    expect(altCards[0].classList.contains('is-selected')).toBe(false);

    // Ankunftszeit soll aus Route 2 (14:00 + 35m = 14:35) aktualisiert worden sein
    const arrivalInput = document.querySelector('.arrival-time-wrapper input') as HTMLInputElement;
    expect(arrivalInput?.value).toBe('14:35');

    // Speichern
    const submitBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Übernehmen')
    );
    submitBtn?.click();
    await nextTick();

    expect(savedLeg).toBeDefined();
    expect(savedLeg?.distance_meters).toBe(25000);
    expect(savedLeg?.duration_seconds).toBe(2100);
    expect(savedLeg?.arrival_time).toBe('14:35');

    cleanUp();
  });

  it('schaltet bei aktivem Routing automatisch auf neues Verkehrsmittel um und nutzt Cache beim Zurückwechseln', async () => {
    const { api } = await import('../api/client');
    const postSpy = vi.mocked(api.post);
    postSpy.mockClear();

    // Mock für Fahrrad
    postSpy.mockResolvedValueOnce({
      supported: true,
      routes: [
        {
          coordinates: [
            [38.71, -9.14],
            [38.8, -9.38],
          ],
          distance_meters: 22000,
          duration_seconds: 4800, // 1 Std. 20 Min.
          profile: 'cycling-regular',
        },
      ],
    });

    const spotWithCoordsA = { ...mockFromSpot, lat: 38.71, lng: -9.14 };
    const spotWithCoordsB = { ...mockToSpot, lat: 38.8, lng: -9.38 };
    const carLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'Auto',
      route_geometry: '[[38.71,-9.14],[38.8,-9.38]]',
      distance_meters: 30000,
      duration_seconds: 1800, // 30 Min.
      routing_profile: 'driving-car',
      departure_time: '10:00',
      arrival_time: '10:30',
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: spotWithCoordsA,
      toSpot: spotWithCoordsB,
      leg: carLeg,
      users: mockUsers,
    });
    await nextTick();

    // Initial: Auto aktiv, 30,0 km • 30 Min.
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('30,0 km');
    expect(postSpy).not.toHaveBeenCalled();

    // Umschalten auf "Fahrrad":
    const bikeBtn = Array.from(document.querySelectorAll('.transport-toggle button')).find((b) =>
      b.textContent?.includes('Fahrrad')
    ) as HTMLElement | undefined;
    expect(bikeBtn).toBeDefined();
    bikeBtn?.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 20));
    await nextTick();

    // Sollte api.post für Fahrrad aufgerufen haben
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy.mock.calls[0][1]).toMatchObject({
      transport_type: 'Fahrrad',
    });

    // Stats und Ankunftszeit aktualisiert für Fahrrad (22,0 km, 1 Std. 20 Min., Ankunft 11:20):
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('22,0 km');
    const arrivalInput = document.querySelector('.arrival-time-wrapper input') as HTMLInputElement;
    expect(arrivalInput?.value).toBe('11:20');

    // Zurückwechseln auf "Auto":
    const autoBtn = Array.from(document.querySelectorAll('.transport-toggle button')).find((b) =>
      b.textContent?.includes('Auto')
    ) as HTMLElement | undefined;
    autoBtn?.click();
    await nextTick();

    // Darf KEINEN weiteren API-Aufruf ausgelöst haben, da Auto im Frontend-Cache lag!
    expect(postSpy).toHaveBeenCalledTimes(1);

    // Wiederhergestellte Werte für Auto:
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('30,0 km');
    expect(arrivalInput?.value).toBe('10:30');

    // Erneut auf "Fahrrad" klicken:
    bikeBtn?.click();
    await nextTick();

    // Weiterhin kein zusätzlicher API-Aufruf!
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.route-calc-stats')?.textContent).toContain('22,0 km');
    expect(arrivalInput?.value).toBe('11:20');

    cleanUp();
  });

  it('erlaubt Auswahl zwischen schnellster und kürzester Route in der Alternativen-Liste', async () => {
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
          duration_seconds: 1800, // Schnellste
          profile: 'driving-car',
        },
        {
          coordinates: [
            [38.71, -9.14],
            [38.75, -9.2],
            [38.8, -9.38],
          ],
          distance_meters: 22000, // Kürzeste
          duration_seconds: 2200,
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

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: spotWithCoordsA,
      toSpot: spotWithCoordsB,
      leg: carLeg,
      users: mockUsers,
    });
    await nextTick();

    const calcBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Route berechnen')
    );
    calcBtn?.click();
    await nextTick();
    await new Promise((r) => setTimeout(r, 150));
    await nextTick();

    const altCards = document.querySelectorAll('.route-alt-card');
    expect(altCards.length).toBe(2);
    // Kein redundanter Präferenz-Toggle
    expect(document.querySelector('.route-preference-toggle')).toBeNull();
    // Initial ist Route 1 (schnellste) ausgewählt
    expect(altCards[0].classList.contains('is-selected')).toBe(true);
    expect(altCards[0].querySelector('.badge-fastest')?.textContent).toContain('Schnellste');

    // Klick auf Route 2 (kürzeste Strecke) in der Alternativen-Liste
    (altCards[1] as HTMLElement).click();
    await nextTick();

    // Route 2 (kürzeste) soll nun ausgewählt sein
    expect(altCards[1].classList.contains('is-selected')).toBe(true);
    expect(altCards[0].classList.contains('is-selected')).toBe(false);
    expect(altCards[1].querySelector('.badge-shortest')?.textContent).toContain('Kürzeste');

    cleanUp();
  });

  it('berechnet Abfahrtszeit rückwärts aus Wunschankunftszeit per Glitzer-Button', async () => {
    const legWithDuration: ExcursionLeg = {
      ...mockLeg,
      departure_time: null,
      arrival_time: '15:30',
      duration_seconds: 3600, // 60 Minuten
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: legWithDuration,
      users: mockUsers,
    });
    await nextTick();

    const depSparkle = document.querySelector(
      '[data-testid="departure-sparkle-btn"]'
    ) as HTMLButtonElement;
    expect(depSparkle).not.toBeNull();

    depSparkle.click();
    await nextTick();

    const depInput = document.querySelector('.departure-time-wrapper input') as HTMLInputElement;
    expect(depInput.value).toBe('14:30');

    cleanUp();
  });

  it('berechnet Ankunftszeit vorwärts aus Abfahrtszeit per Glitzer-Button', async () => {
    const legWithDuration: ExcursionLeg = {
      ...mockLeg,
      departure_time: '10:15',
      arrival_time: null,
      duration_seconds: 1800, // 30 Minuten
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: legWithDuration,
      users: mockUsers,
    });
    await nextTick();

    const arrSparkle = document.querySelector(
      '[data-testid="arrival-sparkle-btn"]'
    ) as HTMLButtonElement;
    expect(arrSparkle).not.toBeNull();

    arrSparkle.click();
    await nextTick();

    const arrInput = document.querySelector('.arrival-time-wrapper input') as HTMLInputElement;
    expect(arrInput.value).toBe('10:45');

    cleanUp();
  });

  it('synchronisiert Abfahrts- und Ankunftszeit automatisch wenn gekoppelt', async () => {
    const legWithDuration: ExcursionLeg = {
      ...mockLeg,
      departure_time: '09:00',
      arrival_time: '09:45',
      duration_seconds: 2700, // 45 Minuten
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: legWithDuration,
      users: mockUsers,
    });
    await nextTick();

    const depInput = document.querySelector('.departure-time-wrapper input') as HTMLInputElement;
    const arrInput = document.querySelector('.arrival-time-wrapper input') as HTMLInputElement;
    const linkToggle = document.querySelector(
      '[data-testid="time-link-toggle"]'
    ) as HTMLButtonElement;

    expect(linkToggle).not.toBeNull();
    expect(linkToggle.classList.contains('is-linked')).toBe(true);

    // Abfahrtszeit auf 11:00 ändern -> Ankunft passt sich automatisch an (11:45)
    depInput.value = '11:00';
    depInput.dispatchEvent(new Event('input'));
    await nextTick();

    expect(arrInput.value).toBe('11:45');

    // Ankunftszeit auf 13:15 ändern -> Abfahrt passt sich automatisch an (12:30)
    arrInput.value = '13:15';
    arrInput.dispatchEvent(new Event('input'));
    await nextTick();

    expect(depInput.value).toBe('12:30');

    cleanUp();
  });

  it('erlaubt Entkoppeln der Zeiten und zeigt Statusbalken bei Abweichung', async () => {
    const legWithDuration: ExcursionLeg = {
      ...mockLeg,
      departure_time: '08:00',
      arrival_time: '08:30',
      duration_seconds: 1800, // 30 Minuten
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: legWithDuration,
      users: mockUsers,
    });
    await nextTick();

    const linkToggle = document.querySelector(
      '[data-testid="time-link-toggle"]'
    ) as HTMLButtonElement;
    expect(linkToggle).not.toBeNull();

    // Entkoppeln
    linkToggle.click();
    await nextTick();
    expect(linkToggle.classList.contains('is-linked')).toBe(false);

    // Jetzt Ankunft manuell auf 10:00 ändern (1,5 Std. Puffer)
    const arrInput = document.querySelector('.arrival-time-wrapper input') as HTMLInputElement;
    const depInput = document.querySelector('.departure-time-wrapper input') as HTMLInputElement;
    arrInput.value = '10:00';
    arrInput.dispatchEvent(new Event('input'));
    await nextTick();

    // Abfahrtszeit bleibt unverändert bei 08:00
    expect(depInput.value).toBe('08:00');

    // Statusbalken zeigt Mismatch an
    const syncBar = document.querySelector('[data-testid="time-sync-bar"]');
    expect(syncBar?.classList.contains('time-sync-bar--mismatch')).toBe(true);
    expect(syncBar?.textContent).toContain('Zeitfenster');

    // Glitzer-Button bei Abfahrt berechnet Abfahrt passend zur neuen Ankunft 10:00 (10:00 - 30 Min. = 09:30)
    const depSparkle = document.querySelector(
      '[data-testid="departure-sparkle-btn"]'
    ) as HTMLButtonElement;
    depSparkle.click();
    await nextTick();

    expect(depInput.value).toBe('09:30');

    cleanUp();
  });

  it('passt das Abfahrts-Label dynamisch an das Verkehrsmittel an', async () => {
    // 1. Initial mit 'zu Fuß' -> 'Losgehen'
    const footLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'zu Fuß',
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: footLeg,
      users: mockUsers,
    });
    await nextTick();

    const getDepLabelText = () =>
      document
        .querySelector('.departure-time-wrapper')
        ?.closest('.form-field')
        ?.querySelector('.form-field-label')
        ?.textContent?.trim();

    expect(getDepLabelText()).toBe('Losgehen');

    // Umschalten auf 'Auto' per Toggle-Button -> 'Abfahrt'
    const toggleOptions = Array.from(
      document.querySelectorAll('.transport-toggle .segmented-option')
    ) as HTMLButtonElement[];
    const carOption = toggleOptions.find((btn) => btn.textContent?.includes('Auto'));
    expect(carOption).toBeDefined();

    carOption?.click();
    await nextTick();

    expect(getDepLabelText()).toBe('Abfahrt');

    // Umschalten auf 'ÖPNV' (Default: 'Zug') -> 'Abfahrt'
    const transitOption = toggleOptions.find((btn) => btn.textContent?.includes('ÖPNV'));
    transitOption?.click();
    await nextTick();

    expect(getDepLabelText()).toBe('Abfahrt');

    // Im Dropdown auf 'Flug' wechseln -> 'Abflug'
    const select = document.querySelector('.transit-dropdown-inner select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    select.value = 'Flug';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    expect(getDepLabelText()).toBe('Abflug');

    // Im Dropdown auf 'Fähre' wechseln -> 'Ablegen'
    select.value = 'Fähre';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    expect(getDepLabelText()).toBe('Ablegen');

    cleanUp();
  });

  it('passt die Erweiterten Angaben dynamisch an das Verkehrsmittel an und blendet unpassende Felder aus', async () => {
    // 1. Initial mit 'zu Fuß'
    const footLeg: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'zu Fuß',
      seat: null,
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: footLeg,
      users: mockUsers,
    });
    await nextTick();

    const getFieldLabels = () =>
      Array.from(document.querySelectorAll('.collapsible-content .form-field-label')).map((el) =>
        el.textContent?.trim()
      );

    const getInputs = () =>
      Array.from(document.querySelectorAll<HTMLInputElement>('.collapsible-content input')).map(
        (i) => ({ placeholder: i.placeholder, value: i.value })
      );

    // Bei Zu Fuß: Sitzplatz-Feld ist ausgeblendet
    let labels = getFieldLabels();
    expect(labels).toContain('Treffpunkt / Startpunkt');
    expect(labels).toContain('Ausrüstung & Rucksack');
    expect(labels).toContain('Touren-Link / Wanderkarte');
    expect(labels).toContain('Eintritt & Kosten (€)');
    expect(labels).toContain('Notiz zur Strecke');
    expect(labels.some((l) => l?.includes('Sitzplatz'))).toBe(false);

    let inputs = getInputs();
    expect(inputs.some((i) => i.placeholder.includes('Haupteingang'))).toBe(true);
    expect(inputs.some((i) => i.placeholder.includes('Wanderschuhe'))).toBe(true);

    // 2. Umschalten auf Auto
    const toggleOptions = Array.from(
      document.querySelectorAll('.transport-toggle .segmented-option')
    ) as HTMLButtonElement[];
    const carOption = toggleOptions.find((btn) => btn.textContent?.includes('Auto'));
    carOption?.click();
    await nextTick();

    labels = getFieldLabels();
    expect(labels).toContain('Treffpunkt / Abholort');
    expect(labels).toContain('Fahrzeug / Fahrer:in');
    expect(labels).toContain('Kofferraum & Gepäck');
    expect(labels).toContain('Mietwagen-Link / Buchung');
    expect(labels).toContain('Kosten (Maut, Sprit, Miete) (€)');
    expect(labels).toContain('Notiz zur Fahrt');

    inputs = getInputs();
    expect(inputs.some((i) => i.placeholder.includes('Terminal 1'))).toBe(true);
    expect(inputs.some((i) => i.placeholder.includes('VW Golf'))).toBe(true);
    expect(inputs.some((i) => i.placeholder.includes('Kofferraum'))).toBe(true);

    // 3. Umschalten auf ÖPNV -> Flug
    const transitOption = toggleOptions.find((btn) => btn.textContent?.includes('ÖPNV'));
    transitOption?.click();
    await nextTick();

    const select = document.querySelector('.transit-dropdown-inner select') as HTMLSelectElement;
    select.value = 'Flug';
    select.dispatchEvent(new Event('change'));
    await nextTick();

    labels = getFieldLabels();
    expect(labels).toContain('Terminal, Gate & Check-in');
    expect(labels).toContain('Sitzplatz & Flugnummer');
    expect(labels).toContain('Aufgabe- & Handgepäck');
    expect(labels).toContain('Online-Check-in / Flug-Link');
    expect(labels).toContain('Flugkosten (€)');
    expect(labels).toContain('Notiz zum Flug');

    cleanUp();
  });

  it('erhält bestehende Sitzplatz-Angaben auch wenn Zu Fuß gewählt ist', async () => {
    const footLegWithSeat: ExcursionLeg = {
      ...mockLeg,
      transport_type: 'zu Fuß',
      seat: 'Bank #3',
    };

    const { cleanUp } = mountTestApp(LegTransportModal, {
      modelValue: true,
      fromSpot: mockFromSpot,
      toSpot: mockToSpot,
      leg: footLegWithSeat,
      users: mockUsers,
    });
    await nextTick();

    const labels = Array.from(
      document.querySelectorAll('.collapsible-content .form-field-label')
    ).map((el) => el.textContent?.trim());

    // Weil form.seat gefüllt ist, wird das Feld gerendert, damit keine Daten verloren gehen
    expect(labels.some((l) => l?.includes('Sitzplatz'))).toBe(true);

    cleanUp();
  });
});

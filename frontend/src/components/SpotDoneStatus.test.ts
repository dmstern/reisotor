// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotDoneStatus from './SpotDoneStatus.vue';
import type { Spot, Excursion } from '../api/types';
import { useSpotsStore } from '../stores/spots';

const routerPush = vi.fn();
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRouter: () => ({ push: routerPush }),
}));

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

describe('SpotDoneStatus', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
  });

  const mockSpot = {
    id: 1,
    trip_id: 1,
    title: 'Fernsehturm',
    category: 'Aussichtspunkt',
    lat: 52.5208,
    lng: 13.4094,
    created_by: 1,
    is_home: 0,
    dates: [],
  } as unknown as Spot;

  function mountComponent(props: { spot: Spot; scheduledDate: string | null; expanded: boolean }) {
    const app = createApp({
      render: () => h(SpotDoneStatus, props),
    });
    app.use(getActivePinia() ?? createPinia());
    return renderToString(app);
  }

  it('renders default unvisited/unplanned status when no date is assigned', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      scheduledDate: null,
      expanded: false,
    });
    expect(html).toContain('done-toggle');
    expect(html).toContain('Besucht');
    expect(html).toContain('Als gemacht markieren');
  });

  it('renders planned date label when scheduledDate is provided', async () => {
    const plannedSpot: Spot = {
      ...mockSpot,
      dates: [{ id: 101, trip_id: 1, spot_id: 1, date: '2026-06-12', done: 0, created_at: '' }],
    };

    const html = await mountComponent({
      spot: plannedSpot,
      scheduledDate: '2026-06-12',
      expanded: false,
    });

    expect(html).toContain('done-toggle');
    expect(html).not.toContain('done-toggle--split');
    expect(html).toContain('Geplant für');
    expect(html).toContain('12.06');
  });

  it('renders dropdown button when spot has 1 planned date and expanded=true, opening dates popover and jumping to calendar', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const { useDrawersStore } = await import('../stores/drawers');
    const drawers = useDrawersStore();
    const openCalendarSpy = vi.spyOn(drawers, 'openCalendar').mockImplementation(() => {});

    const plannedSpot: Spot = {
      ...mockSpot,
      dates: [{ id: 101, trip_id: 1, spot_id: 1, date: '2026-06-12', done: 0, created_at: '' }],
    };

    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(SpotDoneStatus, {
          spot: plannedSpot,
          scheduledDate: '2026-06-12',
          expanded: true,
        }),
    });
    app.use(pinia);
    app.mount(el);

    const toggleBtn = el.querySelector<HTMLButtonElement>('.done-toggle');
    expect(toggleBtn).not.toBeNull();
    expect(el.querySelector('.done-toggle-chevron')).not.toBeNull();
    expect(toggleBtn?.textContent).toContain('12.06');

    toggleBtn?.click();
    await new Promise((r) => setTimeout(r, 20));

    const popover = document.body.querySelector('.spot-dates-popover');
    expect(popover).not.toBeNull();

    const jumpBtn = document.body.querySelector<HTMLButtonElement>('.date-calendar-jump-btn');
    expect(jumpBtn).not.toBeNull();
    jumpBtn?.click();
    expect(openCalendarSpy).toHaveBeenCalledWith('2026-06-12');

    app.unmount();
    el.remove();
  });

  it('toggles done state via checklist item in dates popover when 1 date is planned', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const spotsStore = useSpotsStore();
    const updateDateSpy = vi.spyOn(spotsStore, 'updateDate').mockResolvedValue({
      id: 101,
      trip_id: 1,
      spot_id: 1,
      date: '2026-06-12',
      done: 1,
      created_at: '',
    });

    const plannedSpot: Spot = {
      ...mockSpot,
      dates: [{ id: 101, trip_id: 1, spot_id: 1, date: '2026-06-12', done: 0, created_at: '' }],
    };

    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(SpotDoneStatus, {
          spot: plannedSpot,
          scheduledDate: '2026-06-12',
          expanded: true,
        }),
    });
    app.use(pinia);
    app.mount(el);

    const toggleBtn = el.querySelector<HTMLButtonElement>('.done-toggle');
    expect(toggleBtn).not.toBeNull();
    toggleBtn?.click();
    await new Promise((r) => setTimeout(r, 20));

    const checkItem = document.body.querySelector<HTMLButtonElement>('.date-check-item');
    expect(checkItem).not.toBeNull();
    checkItem?.click();

    expect(updateDateSpy).toHaveBeenCalledWith(1, 101, { done: true });

    app.unmount();
    el.remove();
  });

  it('renders "Geplant an 2 Tagen" (expanded) and "2x geplant" (collapsed) when spot is in 2 tours', async () => {
    const { useExcursionsStore } = await import('../stores/excursions');
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      {
        id: 1,
        trip_id: 1,
        title: 'Hinflug nach Lissabon',
        date: '2026-11-07',
        spot_ids: [1],
      } as unknown as Excursion,
      {
        id: 2,
        trip_id: 1,
        title: 'Rückflug nach Berlin',
        date: '2026-11-17',
        spot_ids: [1],
      } as unknown as Excursion,
    ];

    const htmlExpanded = await mountComponent({
      spot: mockSpot,
      scheduledDate: '2026-11-07',
      expanded: true,
    });
    expect(htmlExpanded).toContain('Geplant an 2 Tagen');

    const htmlCollapsed = await mountComponent({
      spot: mockSpot,
      scheduledDate: '2026-11-07',
      expanded: false,
    });
    expect(htmlCollapsed).toContain('2x geplant');
  });

  it('renders "Geplant an 3 Tagen" when spot has 1 tour and 2 spot dates', async () => {
    const { useExcursionsStore } = await import('../stores/excursions');
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      {
        id: 1,
        trip_id: 1,
        title: 'Panoramatour',
        date: '2026-11-08',
        spot_ids: [1],
      } as unknown as Excursion,
    ];

    const multiSpot: Spot = {
      ...mockSpot,
      dates: [
        { id: 101, trip_id: 1, spot_id: 1, date: '2026-10-27', done: 0, created_at: '' },
        { id: 102, trip_id: 1, spot_id: 1, date: '2026-10-28', done: 0, created_at: '' },
      ],
    };

    const html = await mountComponent({
      spot: multiSpot,
      scheduledDate: '2026-10-27',
      expanded: true,
    });
    expect(html).toContain('Geplant an 3 Tagen');
  });

  it('renders calendar jump button as a compact primitive button in dates popover', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const { useDrawersStore } = await import('../stores/drawers');
    const drawers = useDrawersStore();
    const openCalendarSpy = vi.spyOn(drawers, 'openCalendar').mockImplementation(() => {});

    const { useExcursionsStore } = await import('../stores/excursions');
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      {
        id: 1,
        trip_id: 1,
        title: 'Hinflug nach Lissabon',
        date: '2026-11-07',
        spot_ids: [1],
      } as unknown as Excursion,
      {
        id: 2,
        trip_id: 1,
        title: 'Rückflug nach Berlin',
        date: '2026-11-17',
        spot_ids: [1],
      } as unknown as Excursion,
    ];

    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(SpotDoneStatus, {
          spot: mockSpot,
          scheduledDate: '2026-11-07',
          expanded: true,
        }),
    });
    app.use(pinia);
    app.mount(el);

    // Klick auf den DoneToggle öffnet das Popover bei 2 Terminen
    const toggleBtn = el.querySelector<HTMLButtonElement>('.done-toggle');
    expect(toggleBtn).not.toBeNull();
    toggleBtn?.click();

    // Warten auf Teleport-Rendering im body
    await new Promise((r) => setTimeout(r, 20));

    const jumpBtns = document.body.querySelectorAll<HTMLButtonElement>('.date-calendar-jump-btn');
    expect(jumpBtns.length).toBe(2);
    // Button primitive hat stets die Klasse 'btn'
    expect(jumpBtns[0].classList.contains('btn')).toBe(true);

    // Tour-Einträge springen direkt zur Tour in der Ausflugsliste statt zum Kalendertag
    expect(document.body.querySelectorAll('.date-check-row.is-tour').length).toBe(2);

    jumpBtns[1].click();
    expect(routerPush).toHaveBeenCalledWith('/excursions#excursion-2');
    expect(openCalendarSpy).not.toHaveBeenCalled();

    app.unmount();
    el.remove();
  });

  it('opens spot-unplanned-popover and schedules spot for date via Für Datum einplanen', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const { useTripStore } = await import('../stores/trip');
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;

    const spotsStore = useSpotsStore();
    const addDateSpy = vi.spyOn(spotsStore, 'addDate').mockResolvedValue({
      id: 201,
      trip_id: 1,
      spot_id: 1,
      date: '2026-08-12',
      done: 0,
      created_at: '',
    });

    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(SpotDoneStatus, {
          spot: mockSpot,
          scheduledDate: null,
          expanded: true,
        }),
    });
    app.use(pinia);
    app.mount(el);

    const toggleBtn = el.querySelector<HTMLButtonElement>('.done-toggle');
    expect(toggleBtn).not.toBeNull();
    toggleBtn?.click();

    await new Promise((r) => setTimeout(r, 20));

    const popover = document.body.querySelector('.spot-unplanned-popover');
    expect(popover).not.toBeNull();

    const dateInput = popover?.querySelector<HTMLInputElement>('input[type="date"]');
    expect(dateInput).not.toBeNull();

    if (dateInput) {
      dateInput.value = '2026-08-12';
      dateInput.dispatchEvent(new Event('input'));
    }

    await new Promise((r) => setTimeout(r, 10));

    const planBtn = Array.from(popover?.querySelectorAll('button') ?? []).find((btn) =>
      btn.textContent?.includes('Für Datum einplanen')
    );
    expect(planBtn).toBeDefined();
    planBtn?.click();

    await new Promise((r) => setTimeout(r, 10));

    expect(addDateSpy).toHaveBeenCalledWith(1, '2026-08-12', false);

    app.unmount();
    el.remove();
  });
});

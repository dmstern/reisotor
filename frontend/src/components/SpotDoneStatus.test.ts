// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia, getActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotDoneStatus from './SpotDoneStatus.vue';
import type { Spot, ScheduleItem, Excursion } from '../api/types';
import { useScheduleStore } from '../stores/schedule';

describe('SpotDoneStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockSpot: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Fernsehturm',
    category: 'Aussichtspunkt',
    lat: 52.5208,
    lng: 13.4094,
    created_by: 1,
    is_home: 0,
  } as Spot;

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
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [
      {
        id: 101,
        trip_id: 1,
        spot_id: 1,
        day_date: '2026-06-12',
        completed: 0,
      } as unknown as ScheduleItem,
    ];

    const html = await mountComponent({
      spot: mockSpot,
      scheduledDate: '2026-06-12',
      expanded: false,
    });

    expect(html).toContain('done-toggle');
    expect(html).toContain('done-toggle--split');
    expect(html).toContain('done-toggle-btn--check');
    expect(html).toContain('done-toggle-btn--action');
    expect(html).toContain('Geplant für');
    expect(html).toContain('12.06');
    expect(html).toContain('Zum 12.06 im Kalender springen');
  });

  it('triggers drawers.openCalendar with scheduled date when calendar action button is clicked', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const { useDrawersStore } = await import('../stores/drawers');
    const drawers = useDrawersStore();
    const openCalendarSpy = vi.spyOn(drawers, 'openCalendar').mockImplementation(() => {});

    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(SpotDoneStatus, {
          spot: mockSpot,
          scheduledDate: '2026-06-12',
          expanded: true,
        }),
    });
    app.use(pinia);
    app.mount(el);

    const actionBtn = el.querySelector('.done-toggle-btn--action') as HTMLButtonElement | null;
    expect(actionBtn).not.toBeNull();
    actionBtn?.click();

    expect(openCalendarSpy).toHaveBeenCalledWith('2026-06-12');
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

  it('renders "Geplant an 3 Tagen" when spot has 1 tour and 2 schedule items', async () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [
      { id: 101, trip_id: 1, spot_id: 1, date: '2026-10-27' } as unknown as ScheduleItem,
      { id: 102, trip_id: 1, spot_id: 1, date: '2026-10-28' } as unknown as ScheduleItem,
    ];
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

    const html = await mountComponent({
      spot: mockSpot,
      scheduledDate: '2026-10-27',
      expanded: true,
    });
    expect(html).toContain('Geplant an 3 Tagen');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotDoneStatus from './SpotDoneStatus.vue';
import type { Spot, ScheduleItem } from '../api/types';
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
    app.use(createPinia());
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
});

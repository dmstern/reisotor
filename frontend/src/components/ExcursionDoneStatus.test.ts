// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ExcursionDoneStatus from './ExcursionDoneStatus.vue';
import type { Excursion } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';

describe('ExcursionDoneStatus', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockExcursion: Excursion = {
    id: 1,
    trip_id: 1,
    title: 'Wanderung',
    date: '2026-07-15',
    done: 0,
    created_by: 1,
  } as unknown as Excursion;

  function mountComponent(props: {
    excursion: Excursion;
    expanded: boolean;
    resolvedStations?: ExcursionStation[];
  }) {
    const app = createApp({
      render: () => h(ExcursionDoneStatus, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders passive planned status text without button when excursion has a date and is collapsed', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      expanded: false,
    });
    expect(html).toContain('Geplant für');
    expect(html).toContain('15.07');
    expect(html).toContain('tour-status-meta');
    expect(html).not.toContain('done-toggle ');
    expect(html).not.toContain('<button');
  });

  it('renders passive done status text without button when excursion is done and collapsed', async () => {
    const doneExcursion: Excursion = {
      ...mockExcursion,
      done: 1,
    };
    const html = await mountComponent({
      excursion: doneExcursion,
      expanded: false,
    });
    expect(html).toContain('Gemacht am');
    expect(html).toContain('15.07');
    expect(html).toContain('tour-status-meta');
    expect(html).not.toContain('<button');
  });

  it('renders nothing when excursion is unplanned, not done, and collapsed', async () => {
    const unplannedExcursion: Excursion = {
      ...mockExcursion,
      date: null,
      done: 0,
    };
    const html = await mountComponent({
      excursion: unplannedExcursion,
      expanded: false,
    });
    expect(html).not.toContain('tour-status-meta');
    expect(html).not.toContain('<button');
  });

  it('renders interactive DoneToggle dropdown button when unplanned and expanded', async () => {
    const unplannedExcursion: Excursion = {
      ...mockExcursion,
      date: null,
      done: 0,
    };
    const html = await mountComponent({
      excursion: unplannedExcursion,
      expanded: true,
    });
    expect(html).toContain('Gemacht');
    expect(html).toContain('done-toggle');
    expect(html).toContain('done-toggle-chevron');
    expect(html).not.toContain('done-toggle--split');
    expect(html).toContain('<button');
  });

  it('renders dropdown DoneToggle button when planned and expanded', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      expanded: true,
    });
    expect(html).toContain('done-toggle');
    expect(html).toContain('done-toggle-chevron');
    expect(html).not.toContain('done-toggle--split');
    expect(html).toContain('Geplant für');
    expect(html).toContain('15.07');
  });

  it('renders dropdown DoneToggle button when excursion is done and planned', async () => {
    const doneExcursion: Excursion = {
      ...mockExcursion,
      done: 1,
    };
    const html = await mountComponent({
      excursion: doneExcursion,
      expanded: true,
    });
    expect(html).toContain('done-toggle');
    expect(html).toContain('done-toggle-chevron');
    expect(html).not.toContain('done-toggle--split');
    expect(html).toContain('Gemacht am');
    expect(html).toContain('15.07');
  });

  it('opens tour-dates-popover on click, toggles done, and jumps to calendar via date-calendar-jump-btn', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const { useDrawersStore } = await import('../stores/drawers');
    const drawers = useDrawersStore();
    const openCalendarSpy = vi.spyOn(drawers, 'openCalendar').mockImplementation(() => {});

    const { useExcursionsStore } = await import('../stores/excursions');
    const excursionsStore = useExcursionsStore();
    const setDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue();

    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(ExcursionDoneStatus, {
          excursion: mockExcursion,
          expanded: true,
        }),
    });
    app.use(pinia);
    app.mount(el);

    const toggleBtn = el.querySelector('.done-toggle') as HTMLButtonElement | null;
    expect(toggleBtn).not.toBeNull();
    toggleBtn?.click();

    await new Promise((r) => setTimeout(r, 20));

    const popover = document.body.querySelector('.tour-dates-popover');
    expect(popover).not.toBeNull();
    expect(popover?.textContent).toContain('Tour abhaken');
    expect(popover?.textContent).not.toContain('Besuche abhaken');

    const checkItem = document.body.querySelector('.date-check-item') as HTMLButtonElement | null;
    expect(checkItem).not.toBeNull();
    checkItem?.click();
    expect(setDoneSpy).toHaveBeenCalledWith(1, true);

    const jumpBtn = document.body.querySelector(
      '.date-calendar-jump-btn'
    ) as HTMLButtonElement | null;
    expect(jumpBtn).not.toBeNull();
    jumpBtn?.click();
    expect(openCalendarSpy).toHaveBeenCalledWith('2026-07-15');

    app.unmount();
    el.remove();
  });

  it('opens tour-unplanned-popover on click and triggers setDate via Für Datum einplanen', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const { useExcursionsStore } = await import('../stores/excursions');
    const excursionsStore = useExcursionsStore();
    const setDateSpy = vi.spyOn(excursionsStore, 'setDate').mockResolvedValue();
    const setDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue();

    const unplannedExcursion: Excursion = {
      ...mockExcursion,
      date: null,
      done: 0,
    };

    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({
      render: () =>
        h(ExcursionDoneStatus, {
          excursion: unplannedExcursion,
          expanded: true,
        }),
    });
    app.use(pinia);
    app.mount(el);

    const toggleBtn = el.querySelector('.done-toggle') as HTMLButtonElement | null;
    expect(toggleBtn).not.toBeNull();
    toggleBtn?.click();

    await new Promise((r) => setTimeout(r, 20));

    const popover = document.body.querySelector('.tour-unplanned-popover');
    expect(popover).not.toBeNull();

    const dateInput = popover?.querySelector('input[type="date"]') as HTMLInputElement | null;
    expect(dateInput).not.toBeNull();

    if (dateInput) {
      dateInput.value = '2026-08-05';
      dateInput.dispatchEvent(new Event('input'));
    }

    await new Promise((r) => setTimeout(r, 10));

    const planBtn = Array.from(popover?.querySelectorAll('button') ?? []).find((btn) =>
      btn.textContent?.includes('Für Datum einplanen')
    );
    expect(planBtn).toBeDefined();
    planBtn?.click();

    await new Promise((r) => setTimeout(r, 10));

    expect(setDateSpy).toHaveBeenCalledWith(1, '2026-08-05');
    expect(setDoneSpy).not.toHaveBeenCalled();

    app.unmount();
    el.remove();
  });
});

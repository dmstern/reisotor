// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('renders planned status when excursion has a date and is not done', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      expanded: false,
    });
    expect(html).toContain('Geplant für');
    expect(html).toContain('15.07');
  });

  it('renders done status when excursion is done', async () => {
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
  });

  it('renders mark as done label when unplanned and expanded', async () => {
    const unplannedExcursion: Excursion = {
      ...mockExcursion,
      date: null,
      done: 0,
    };
    const html = await mountComponent({
      excursion: unplannedExcursion,
      expanded: true,
    });
    expect(html).toContain('Als gemacht markieren');
  });
});

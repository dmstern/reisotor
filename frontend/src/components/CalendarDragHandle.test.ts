// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CalendarDragHandle from './CalendarDragHandle.vue';
import type { Excursion, Spot } from '../api/types';

describe('CalendarDragHandle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockSpot: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Museumsinsel',
    category: 'Museum',
    lat: 52.52,
    lng: 13.4,
    created_by: 1,
    is_home: 0,
  } as Spot;

  const mockExcursion: Excursion = {
    id: 2,
    trip_id: 1,
    title: 'Wanderung',
    created_by: 1,
  } as unknown as Excursion;

  function mountComponent(props: { spot?: Spot; excursion?: Excursion; label?: string }) {
    const app = createApp({
      render: () => h(CalendarDragHandle, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders drag handle for spot with appropriate aria-label', async () => {
    const html = await mountComponent({ spot: mockSpot });
    expect(html).toContain('calendar-drag-handle');
    expect(html).toContain('Einplanen');
    expect(html).toContain('Auf Kalender ziehen zum spontanen Einplanen');
  });

  it('renders drag handle for excursion with appropriate aria-label', async () => {
    const html = await mountComponent({ excursion: mockExcursion });
    expect(html).toContain('calendar-drag-handle');
    expect(html).toContain('Einplanen');
    expect(html).toContain('Auf Kalender ziehen zum Einplanen');
  });
});

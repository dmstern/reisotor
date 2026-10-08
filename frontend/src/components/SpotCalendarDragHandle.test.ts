// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotCalendarDragHandle from './SpotCalendarDragHandle.vue';
import type { Spot } from '../api/types';

describe('SpotCalendarDragHandle', () => {
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

  function mountComponent(props: { spot: Spot }) {
    const app = createApp({
      render: () => h(SpotCalendarDragHandle, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders calendar drag handle with title and label', async () => {
    const html = await mountComponent({ spot: mockSpot });
    expect(html).toContain('calendar-drag-handle');
    expect(html).toContain('Einplanen');
    expect(html).toContain('Auf Kalender ziehen zum spontanen Einplanen');
  });
});

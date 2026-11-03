// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import CalendarDragHandle from './CalendarDragHandle.vue';
import type { Excursion } from '../api/types';

describe('CalendarDragHandle', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockExcursion: Excursion = {
    id: 2,
    trip_id: 1,
    title: 'Wanderung',
    created_by: 1,
  } as unknown as Excursion;

  function mountComponent(props: { excursion: Excursion; label?: string }) {
    const app = createApp({
      render: () => h(CalendarDragHandle, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders drag handle for excursion with appropriate aria-label', async () => {
    const html = await mountComponent({ excursion: mockExcursion });
    expect(html).toContain('calendar-drag-handle');
    expect(html).toContain('Einplanen');
    expect(html).toContain('Auf Kalender ziehen zum Einplanen');
  });
});

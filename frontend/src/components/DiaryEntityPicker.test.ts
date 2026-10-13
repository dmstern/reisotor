import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import DiaryEntityPicker from './DiaryEntityPicker.vue';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useScheduleStore } from '../stores/schedule';
import type { Spot, Excursion } from '../api/types';

describe('DiaryEntityPicker', () => {
  async function render(props: Record<string, unknown> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const spotsStore = useSpotsStore();
    const excursionsStore = useExcursionsStore();
    const scheduleStore = useScheduleStore();

    spotsStore.spots = [
      {
        id: 10,
        trip_id: 1,
        title: 'Eiffelturm',
        category: 'viewpoint',
      } as unknown as Spot,
    ];
    excursionsStore.excursions = [
      {
        id: 20,
        trip_id: 1,
        title: 'Seine Rundfahrt',
        date: '2026-06-15',
        spot_ids: [],
      } as unknown as Excursion,
    ];
    scheduleStore.items = [];

    const app = createApp({
      render: () =>
        h(DiaryEntityPicker, {
          date: '2026-06-15',
          excursionIds: [],
          spotIds: [],
          ...props,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert Touren und Spots in den Optionen', async () => {
    const html = await render();
    expect(html).toContain('Touren zuordnen');
    expect(html).toContain('Spots zuordnen');
    expect(html).toContain('Seine Rundfahrt');
    expect(html).toContain('Eiffelturm');
  });

  it('hebt geplante Tour an passendem Datum als empfohlen hervor', async () => {
    const html = await render({ date: '2026-06-15' });
    expect(html).toContain('Empfohlen – an diesem Tag geplant');
  });

  it('zeigt Badge hinzugefügt, wenn Spot in spotIds ist', async () => {
    const html = await render({ spotIds: [10] });
    expect(html).toContain('hinzugefügt');
  });
});

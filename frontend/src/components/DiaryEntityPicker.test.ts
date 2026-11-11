// @vitest-environment jsdom
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

  it('markiert Checkbox des Spots als aktiv, wenn Spot in spotIds ist', async () => {
    const html = await render({ spotIds: [10] });
    expect(html).toContain('id="diary-spot-10"');
    expect(html).toContain('checked');
  });

  it('hebt Tour an abweichendem Datum mit Warn-Badge hervor', async () => {
    const html = await render({ date: '2026-06-16' });
    expect(html).toContain('Geplant am 15.06.2026');
  });

  it('blendet Alert-Box ein, wenn eine ausgewählte Tour ein abweichendes Datum hat', async () => {
    const html = await render({ date: '2026-06-16', excursionIds: [20] });
    expect(html).toContain('data-testid="diary-date-mismatch-alert"');
    expect(html).toContain('Seine Rundfahrt');
    expect(html).toContain('Folgende ausgewählte Elemente sind für andere Tage geplant:');
  });

  it('blendet Alert-Box und Warn-Badge für ausgewählten Spot mit abweichendem Datum ein', async () => {
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
    excursionsStore.excursions = [];
    scheduleStore.items = [
      {
        id: 101,
        trip_id: 1,
        spot_id: 10,
        date: '2026-06-20',
      } as any,
    ];

    const app = createApp({
      render: () =>
        h(DiaryEntityPicker, {
          date: '2026-06-16',
          excursionIds: [],
          spotIds: [10],
        }),
    });
    app.use(pinia);
    const html = await renderToString(app);

    expect(html).toContain('Geplant am 20.06.2026');
    expect(html).toContain('data-testid="diary-date-mismatch-alert"');
    expect(html).toContain('Eiffelturm');
  });
});

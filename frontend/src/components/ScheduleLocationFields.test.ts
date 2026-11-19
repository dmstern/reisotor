import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ScheduleLocationFields from './ScheduleLocationFields.vue';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import type { Spot, Excursion } from '../api/types';

describe('ScheduleLocationFields', () => {
  async function render(props: Record<string, unknown> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const spotsStore = useSpotsStore();
    const excursionsStore = useExcursionsStore();
    spotsStore.spots = [
      {
        id: 1,
        trip_id: 1,
        title: 'Brandenburger Tor',
        category: 'Sehenswürdigkeit',
        lat: 52.5163,
        lng: 13.3777,
      } as unknown as Spot,
    ];
    excursionsStore.excursions = [
      {
        id: 2,
        trip_id: 1,
        title: 'Spreefahrt',
      } as unknown as Excursion,
    ];

    const app = createApp({
      render: () =>
        h(ScheduleLocationFields, {
          linkKey: '',
          location: '',
          mapsLink: '',
          expanded: true,
          ...props,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert ausschließlich Spots in der optionalen Orts-Auswahl (ohne Touren)', async () => {
    const html = await render();
    expect(html).toContain('Brandenburger Tor');
    expect(html).not.toContain('Spreefahrt');
    expect(html).toContain('Keinen Spot als Ort wählen');
  });

  it('zeigt Freitext-Ort und Maps-Link, wenn keine Verknüpfung gewählt ist', async () => {
    const html = await render({ linkKey: '' });
    expect(html).toContain('Ort (Freitext)');
    expect(html).toContain('Maps-Link');
  });

  it('blendet Freitext-Ort und Maps-Link aus, wenn ein Spot verknüpft ist', async () => {
    const html = await render({ linkKey: 'spot:1' });
    expect(html).not.toContain('Ort (Freitext)');
    expect(html).not.toContain('placeholder="Maps-Link (Google/Apple)"');
  });
});

import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ScheduleDayDetail from './ScheduleDayDetail.vue';
import type { CalendarEntry } from '../api/types';
import type { DayWeatherEntry } from '../utils/dayWeather';

describe('ScheduleDayDetail', () => {
  const dummyEntry: CalendarEntry = {
    key: 'schedule:1',
    date: '2026-10-15',
    title: 'Museumsinsel Besuch',
    category: 'excursion',
    kind: 'schedule',
    time: '14:00',
    location: 'Berlin Mitte',
  } as CalendarEntry;

  async function render(props: Record<string, unknown> = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    const app = createApp({
      render: () =>
        h(ScheduleDayDetail, {
          selectedDate: '2026-10-15',
          formatDay: 'Donnerstag, 15. Oktober',
          entries: [dummyEntry],
          accommodations: [{ id: 4, title: 'Hotel Adlon' }],
          weatherEntries: [
            {
              key: 'weather:1',
              label: 'Berlin',
              weather: {
                date: '2026-10-15',
                weatherCode: 1,
                tempMax: 18,
                tempMin: 11,
                precipitationProbability: 10,
              },
            } as DayWeatherEntry,
          ],
          isToday: false,
          isTripDate: true,
          entryDone: () => false,
          ...props,
        }),
    });
    app.use(pinia);
    return renderToString(app);
  }

  it('rendert Datum, Urlaubstag-Badge und Karte-Aktion', async () => {
    const html = await render();
    expect(html).toContain('Donnerstag, 15. Oktober');
    expect(html).toContain('Urlaubstag');
    expect(html).toContain('Tag auf Karte anzeigen');
  });

  it('rendert Wetter- und Unterkunftspills', async () => {
    const html = await render();
    expect(html).toContain('Berlin');
    expect(html).toContain('18°');
    expect(html).toContain('11°');
    expect(html).toContain('Hotel Adlon');
  });

  it('rendert Termineinträge mit Titel und Ort', async () => {
    const html = await render();
    expect(html).toContain('Museumsinsel Besuch');
    expect(html).toContain('Berlin Mitte');
    expect(html).toContain('14:00');
  });

  it('rendert EmptyState bei leeren Terminen', async () => {
    const html = await render({ entries: [] });
    expect(html).toContain('Noch keine Termine an diesem Tag.');
  });
});

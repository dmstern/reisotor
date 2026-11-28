// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import TourDetailView from './TourDetailView.vue';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import type { Excursion, Spot, TravelItem } from '../api/types';
import type { CommentItem } from './Comments.vue';

const { mockWeatherSummary } = vi.hoisted(() => ({
  mockWeatherSummary: {
    value: {
      weatherCode: 1,
      tempLabel: '22 °C',
      tempMin: 16,
      tempMax: 22,
    } as {
      weatherCode: number;
      tempLabel: string;
      tempMin: number;
      tempMax: number;
    } | null,
  },
}));

vi.mock('../composables/useExcursionWeather', async () => {
  const { ref } = await import('vue');
  return {
    useExcursionWeather: () => ({
      mappedStations: ref([]),
      weatherSummary: ref(mockWeatherSummary.value),
      statusDateLabel: ref('15.07.'),
      primaryWeatherDay: ref(null),
      primaryWeatherDays: ref([]),
      primaryWeatherLocation: ref(null),
    }),
  };
});

describe('TourDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockWeatherSummary.value = {
      weatherCode: 1,
      tempLabel: '22 °C',
      tempMin: 16,
      tempMax: 22,
    };
  });

  const mockExcursion: Excursion = {
    id: 1,
    trip_id: 1,
    title: 'Wanderung zum Wasserfall',
    date: '2026-07-15',
    done: 0,
    spot_ids: [10, 11],
    note: 'Festes Schuhwerk erforderlich',
    note_format: 'text',
    legs: [{ duration_seconds: 5400 }],
    created_by: 1,
  } as unknown as Excursion;

  const mockStations: Spot[] = [
    {
      id: 10,
      trip_id: 1,
      title: 'Parkplatz',
      category: 'Start',
      lat: 47.1,
      lng: 11.2,
      done: 0,
    } as Spot,
    {
      id: 11,
      trip_id: 1,
      title: 'Wasserfall',
      category: 'Ziel',
      lat: 47.12,
      lng: 11.25,
      done: 0,
    } as Spot,
  ];

  function mountComponent(props: {
    excursion: Excursion;
    creatorLabel: string | null;
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    stations: Spot[];
    travelItems: TravelItem[];
  }) {
    const app = createApp({
      render: () =>
        h(TourDetailView, props, {
          stations: () => h('div', { class: 'test-stations-slot' }, 'Stationen'),
        }),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('rendert Header mit dezenter Meta-Zeile, Datum neben Wetter, ToggleSwitch (sm) und ohne Info-Badges oder Track-Counter', async () => {
    const html = await mountComponent({
      excursion: {
        ...mockExcursion,
        tracks: [{ id: 99, title: 'GPX-Track' }],
      } as unknown as Excursion,
      creatorLabel: 'Daniel',
      likeCount: 3,
      liked: true,
      comments: [],
      stations: mockStations,
      travelItems: [],
    });

    expect(html).toContain('tour-detail-view');
    expect(html).toContain('Wanderung zum Wasserfall');
    expect(html).toContain('tour-detail-author-row');
    expect(html).toContain('tour-detail-meta-row');
    expect(html).toContain('tour-detail-meta');
    expect(html).toContain('tour-detail-author');
    expect(html).toContain('tour-detail-duration');
    expect(html).toContain('Von Daniel');
    expect(html).toContain('1\u00A0Std. 30\u00A0Min.');
    expect(html).toContain('tour-detail-date-weather');
    expect(html).toContain('tour-detail-date-btn');
    expect(html).toContain('Mi, 15.07.');
    expect(html).toContain('22 °C');
    expect(html).toContain('aria-label="Wetter: Überwiegend klar, 22 °C – Tagesverlauf anzeigen"');
    expect(html).not.toContain('2 Stationen');
    expect(html).not.toContain('Parkplatz → Wasserfall');
    expect(html).toContain('tour-detail-header-controls');
    expect(html).toContain('toggle-switch--sm');
    expect(html).toContain('role="switch"');
    expect(html).toContain('Gemacht');
    expect(html).not.toContain('done-toggle');
    expect(html).toContain('like-btn');
    expect(html).toContain('tour-detail-links-row');
    expect(html).toContain('Auf Karte anzeigen');
    expect(html).toContain('Festes Schuhwerk erforderlich');
    expect(html).toContain('tour-detail-title-group');
    expect(html).toContain('tour-edit-btn');
    expect(html).toContain('is-translucent');
    expect(html).toContain('test-stations-slot');

    const titleGroupIdx = html.indexOf('tour-detail-title-group');
    const badgeIdx = html.indexOf('tour-type-badge');
    const editBtnIdx = html.indexOf('tour-edit-btn');
    const dateBtnIdx = html.indexOf('tour-detail-date-btn');
    const weatherBtnIdx = html.indexOf('tour-detail-weather-btn');
    expect(titleGroupIdx).toBeGreaterThan(-1);
    expect(badgeIdx).toBeGreaterThan(titleGroupIdx);
    expect(editBtnIdx).toBeGreaterThan(badgeIdx);
    expect(dateBtnIdx).toBeGreaterThan(-1);
    expect(weatherBtnIdx).toBeGreaterThan(dateBtnIdx);
  });

  it('rendert Uhrzeit-Spanne (Abfahrt/Ankunft) zusammen mit der Dauer in der Meta-Zeile', async () => {
    const html = await mountComponent({
      excursion: {
        ...mockExcursion,
        departure_time: '09:30',
        arrival_time: '15:40',
        legs: [{ departure_time: '09:30', arrival_time: '15:40', duration_seconds: 22200 }],
      } as unknown as Excursion,
      creatorLabel: 'Mia',
      likeCount: 0,
      liked: false,
      comments: [],
      stations: mockStations,
      travelItems: [],
    });

    expect(html).toContain('tour-detail-time');
    expect(html).toContain('09:30\u201315:40\u00A0Uhr');
    expect(html).toContain('6\u00A0Std. 10\u00A0Min.');
  });

  it('rendert kompakte Teilstrecken-Zusammenfassung nach Verkehrsmittel', async () => {
    const html = await mountComponent({
      excursion: {
        ...mockExcursion,
        legs: [
          {
            transport_type: 'zu Fuß',
            distance_meters: 1400,
            duration_seconds: 1200,
          },
          {
            transport_type: 'Auto',
            distance_meters: 46000,
            departure_time: '11:00',
            arrival_time: '11:55',
          },
          {
            transport_type: 'Straßenbahn',
            departure_time: '14:00',
            arrival_time: '14:40',
          },
        ],
      } as unknown as Excursion,
      creatorLabel: 'Daniel',
      likeCount: 0,
      liked: false,
      comments: [],
      stations: mockStations,
      travelItems: [],
    });

    expect(html).toContain('tour-detail-transport-summary');
    expect(html).toContain('1,4\u00A0km');
    expect(html).toContain('46\u00A0km');
    expect(html).toContain('40\u00A0Min.');
    expect(html).toContain('Auto: 46\u00A0km (55\u00A0Min.)');
    expect(html).toContain('Straßenbahn: 40\u00A0Min.');
  });

  it('rendert den Wetter-Button als interaktives Element', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      creatorLabel: 'Daniel',
      likeCount: 0,
      liked: false,
      comments: [],
      stations: mockStations,
      travelItems: [],
    });

    expect(html).toContain('class="btn btn--ghost btn--sm tour-detail-weather-btn"');
    expect(html).toContain('title="Überwiegend klar (22 °C) – Tagesverlauf anzeigen"');
  });

  it('rendert das Datum auch ohne Wetter und Meta-Text und blendet es ohne Datum aus', async () => {
    mockWeatherSummary.value = null;

    const withDateHtml = await mountComponent({
      excursion: { ...mockExcursion, legs: [] } as unknown as Excursion,
      creatorLabel: null,
      likeCount: 0,
      liked: false,
      comments: [],
      stations: [],
      travelItems: [],
    });

    expect(withDateHtml).toContain('tour-detail-meta-row');
    expect(withDateHtml).toContain('tour-detail-date-btn');
    expect(withDateHtml).toContain('Mi, 15.07.');
    expect(withDateHtml).not.toContain('tour-detail-weather-btn');

    const withoutDateHtml = await mountComponent({
      excursion: { ...mockExcursion, date: null, legs: [] } as unknown as Excursion,
      creatorLabel: null,
      likeCount: 0,
      liked: false,
      comments: [],
      stations: [],
      travelItems: [],
    });

    expect(withoutDateHtml).not.toContain('tour-detail-meta-row');
    expect(withoutDateHtml).not.toContain('tour-detail-date-btn');
  });

  it('schaltet done direkt über den ToggleSwitch um und öffnet das Datum im Kalender', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const excursionsStore = useExcursionsStore(pinia);
    const drawersStore = useDrawersStore(pinia);
    const setDoneSpy = vi.spyOn(excursionsStore, 'setDone').mockResolvedValue();
    const openCalendarSpy = vi.spyOn(drawersStore, 'openCalendar').mockImplementation(() => {});

    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(TourDetailView, {
          excursion: mockExcursion,
          creatorLabel: 'Daniel',
          likeCount: 0,
          liked: false,
          comments: [],
          stations: mockStations,
          travelItems: [],
        }),
    });
    app.use(pinia);
    app.mount(container);

    const switchBtn = container.querySelector<HTMLButtonElement>('[role="switch"]');
    const dateBtn = container.querySelector<HTMLButtonElement>('.tour-detail-date-btn');
    expect(switchBtn).not.toBeNull();
    expect(switchBtn?.getAttribute('aria-checked')).toBe('false');
    expect(dateBtn).not.toBeNull();

    switchBtn?.click();
    await nextTick();
    expect(setDoneSpy).toHaveBeenCalledWith(1, true);
    expect(switchBtn?.getAttribute('aria-checked')).toBe('true');

    dateBtn?.click();
    expect(openCalendarSpy).toHaveBeenCalledWith('2026-07-15');

    app.unmount();
    container.remove();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import TourDetailView from './TourDetailView.vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import type { CommentItem } from './Comments.vue';

const { mockWeatherSummary } = vi.hoisted(() => ({
  mockWeatherSummary: {
    weatherCode: 1,
    tempLabel: '22 °C',
    tempMin: 16,
    tempMax: 22,
  },
}));

vi.mock('../composables/useExcursionWeather', async () => {
  const { ref } = await import('vue');
  return {
    useExcursionWeather: () => ({
      mappedStations: ref([]),
      weatherSummary: ref(mockWeatherSummary),
      statusDateLabel: ref('15.07.'),
    }),
  };
});

describe('TourDetailView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

  it('rendert Header mit dezenter Meta-Zeile, offener Wetter-Grafik, DoneStatus und ohne Info-Badges oder Track-Counter', async () => {
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
    expect(html).toContain('tour-detail-meta-row');
    expect(html).toContain('tour-detail-meta');
    expect(html).toContain('tour-detail-author');
    expect(html).toContain('tour-detail-duration');
    expect(html).toContain('tour-detail-weather');
    expect(html).not.toContain('tour-detail-info-badges');
    expect(html).not.toContain('tour-detail-info-badge');
    expect(html).not.toContain('1 Aufzeichnung');
    expect(html).toContain('Von Daniel');
    expect(html).toContain('1\u00A0Std. 30\u00A0Min.');
    expect(html).toContain('22 °C');
    expect(html).toContain('aria-label="Wetter: Überwiegend klar, 22 °C"');
    expect(html).not.toContain('2 Stationen');
    expect(html).not.toContain('Parkplatz → Wasserfall');
    expect(html).toContain('tour-detail-header-controls');
    expect(html).toContain('done-toggle');
    expect(html).toContain('like-btn');
    expect(html).toContain('tour-detail-links-row');
    expect(html).toContain('Auf Karte anzeigen');
    expect(html).toContain('Festes Schuhwerk erforderlich');
    expect(html).toContain('tour-edit-btn');
    expect(html).toContain('is-translucent');
    expect(html).toContain('test-stations-slot');
  });
});

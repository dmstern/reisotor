// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ExcursionCard from './ExcursionCard.vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import type { CommentItem } from './Comments.vue';

describe('ExcursionCard', () => {
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
    legs: [],
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
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    stations: Spot[];
    travelItems: TravelItem[];
    highlighted?: boolean;
  }) {
    const app = createApp({
      render: () => h(ExcursionCard, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('rendert den kompakten Listen-Eintrag mit Titel, Route, Badges und Rechts-Pfeil ohne Edit-Button und Notiz', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      likeCount: 3,
      liked: false,
      comments: [],
      stations: mockStations,
      travelItems: [],
    });

    expect(html).toContain('Wanderung zum Wasserfall');
    expect(html).toContain('card-title-row');
    expect(html).toContain('tour-type-badge');
    expect(html).not.toContain('is-translucent');
    expect(html).toContain('Parkplatz → Wasserfall');
    expect(html).toContain('excursion-card');
    expect(html).toContain('tour-status-meta');
    expect(html).toContain('is-readonly');
    expect(html).toContain('tour-detail-chevron');
    expect(html).not.toContain('tour-edit-btn');
    expect(html).not.toContain('Festes Schuhwerk erforderlich');
    expect(html).not.toContain('disclosure-pill');
    expect(html).not.toContain('calendar-drag-handle');
    expect(html).not.toContain('like-btn');
    expect(html).not.toContain('Als gemacht markieren');
  });

  it('rendert Travel-Leg mit Route und Transportart-Rolle korrekt', async () => {
    const travelExcursion: Excursion = {
      ...mockExcursion,
      role: 'arrival',
      transport_type: 'train',
    };

    const html = await mountComponent({
      excursion: travelExcursion,
      likeCount: 0,
      liked: false,
      comments: [],
      stations: mockStations,
      travelItems: [],
    });

    expect(html).toContain('is-travel');
    expect(html).toContain('has-role');
  });
});

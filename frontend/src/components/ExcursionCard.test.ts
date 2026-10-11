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
    creatorLabel: string | null;
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    stations: Spot[];
    travelItems: TravelItem[];
    expanded: boolean;
    highlighted?: boolean;
  }) {
    const app = createApp({
      render: () => h(ExcursionCard, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('rendert den eingeklappten Zustand mit Titel, Stationen-Zusammenfassung und Status', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      creatorLabel: 'Daniel',
      likeCount: 3,
      liked: false,
      comments: [],
      stations: mockStations,
      travelItems: [],
      expanded: false,
    });

    expect(html).toContain('Wanderung zum Wasserfall');
    expect(html).toContain('Parkplatz → Wasserfall');
    expect(html).toContain('excursion-card');
    expect(html).not.toContain('card-title-meta');
  });

  it('rendert den ausgeklappten Zustand mit Header-Metadaten und Aktionen', async () => {
    const html = await mountComponent({
      excursion: mockExcursion,
      creatorLabel: 'Daniel',
      likeCount: 3,
      liked: true,
      comments: [],
      stations: mockStations,
      travelItems: [],
      expanded: true,
    });

    expect(html).toContain('Wanderung zum Wasserfall');
    expect(html).toContain('card-title-meta');
    expect(html).toContain('Von Daniel');
    expect(html).toContain('2 Stationen');
    expect(html).toContain('Auf Karte anzeigen');
  });

  it('rendert Travel-Leg mit Route und Transportart-Rolle korrekt', async () => {
    const travelExcursion: Excursion = {
      ...mockExcursion,
      role: 'arrival',
      transport_type: 'train',
    };

    const html = await mountComponent({
      excursion: travelExcursion,
      creatorLabel: null,
      likeCount: 0,
      liked: false,
      comments: [],
      stations: mockStations,
      travelItems: [],
      expanded: false,
    });

    expect(html).toContain('is-travel');
    expect(html).toContain('has-role');
  });
});

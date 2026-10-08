// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotCard from './SpotCard.vue';
import type { Spot } from '../api/types';

import type { CommentItem } from './Comments.vue';

describe('SpotCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockSpot: Spot = {
    id: 42,
    trip_id: 1,
    title: 'Schloss Sanssouci',
    category: 'Sehenswürdigkeit',
    lat: 52.4042,
    lng: 13.0385,
    image_url: null,
    address: 'Maulbeerallee, 14469 Potsdam',
    note: 'Historisches Schloss von Friedrich dem Großen',
    note_format: 'text',
    created_by: 1,
    is_home: 0,
  } as Spot;

  function mountComponent(props: {
    spot: Spot;
    creatorLabel: string | null;
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    expanded: boolean;
    scheduledDate: string | null;
    groupMode: 'category' | 'tours';
    layoverMinutes?: number | null;
  }) {
    const app = createApp({
      render: () => h(SpotCard, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders collapsed state with category chip, clamped note and collapsed body', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      creatorLabel: 'Daniel',
      likeCount: 5,
      liked: false,
      comments: [],
      expanded: false,
      scheduledDate: null,
      groupMode: 'category',
    });

    expect(html).toContain('spot-card');
    expect(html).not.toContain('spot-card expanded');
    expect(html).toContain('Schloss Sanssouci');
    expect(html).toContain('Historisches Schloss von Friedrich dem Großen');
    expect(html).toContain('category-chip');
    expect(html).toContain('Sehenswürdigkeit');
    expect(html).toContain('social-row');
  });

  it('renders expanded state with map actions, details, and cover overlay', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      creatorLabel: 'Daniel',
      likeCount: 5,
      liked: true,
      comments: [],
      expanded: true,
      scheduledDate: null,
      groupMode: 'category',
    });

    expect(html).toContain('expanded');
    expect(html).toContain('show-on-map-btn');
    expect(html).toContain('image-expanded-overlay');
    expect(html).toContain('Von Daniel');
    expect(html).toContain('Maulbeerallee, 14469 Potsdam');
    expect(html).toContain('spot-accordion');
    expect(html).toContain('card-actions');
  });

  it('renders layover badge when layoverMinutes is provided', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      creatorLabel: 'Daniel',
      likeCount: 0,
      liked: false,
      comments: [],
      expanded: false,
      scheduledDate: null,
      groupMode: 'category',
      layoverMinutes: 45,
    });

    expect(html).toContain('spot-layover-badge');
    expect(html).toContain('Umstieg');
    expect(html).toContain('45');
  });
});

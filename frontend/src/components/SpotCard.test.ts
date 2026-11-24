// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotCard from './SpotCard.vue';
import type { Spot } from '../api/types';
import { api } from '../api/client';

import type { CommentItem } from './Comments.vue';

describe('SpotCard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    iconOnlyCategory?: boolean;
    accommodationDistance?: any;
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
    expect(html).toContain('is-readonly');
    expect(html).toContain('disclosure-pill');
    expect(html).toContain('spot-edit-btn');
    expect(html).toContain('btn--ghost');
    expect(html).not.toContain('disclosure-pill--overlay');
    expect(html).not.toContain('like-btn');
    expect(html).toContain('card-header-actions');

    const titleBlockIdx = html.indexOf('card-title-block');
    const chipIdx = html.indexOf('category-chip');
    const actionsIdx = html.indexOf('card-header-actions');
    expect(titleBlockIdx).toBeGreaterThan(-1);
    expect(chipIdx).toBeGreaterThan(titleBlockIdx);
    expect(actionsIdx).toBeGreaterThan(chipIdx);
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
    expect(html).toContain('spot-edit-btn');
    expect(html).not.toContain('btn--circle');
    expect(html).toContain('btn--overlay');
    expect(html).not.toContain('btn--secondary');
    expect(html).toContain('show-on-map-btn');
    expect(html).toContain('image-expanded-overlay');
    expect(html).toContain('disclosure-pill--overlay');
    expect(html).toContain('Einklappen');
    expect(html).toContain('Von Daniel');
    expect(html).toContain('>Maulbeerallee,</span>');
    expect(html).toContain('>14469 Potsdam</span>');
    expect(html).toContain('spot-accordion');
    expect(html).toContain('card-actions');
    expect(html).toContain('category-chip');
    expect(html).toContain('category-chip-label');
    expect(html).toContain('Sehenswürdigkeit');
    expect(html).toContain('card-title-inline');
    expect(html).not.toContain('is-icon-only');
  });

  it('renders full category label even when iconOnlyCategory was true if card is expanded', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      creatorLabel: 'Daniel',
      likeCount: 5,
      liked: true,
      comments: [],
      expanded: true,
      scheduledDate: null,
      groupMode: 'category',
      iconOnlyCategory: true,
    });

    expect(html).toContain('category-chip');
    expect(html).toContain('category-chip-label');
    expect(html).toContain('Sehenswürdigkeit');
    expect(html).toContain('card-title-inline');
    expect(html).not.toContain('is-icon-only');
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

  it('renders spot location warning badge when spot has no coordinates in collapsed state', async () => {
    const spotNoCoords = { ...mockSpot, lat: null, lng: null };
    const html = await mountComponent({
      spot: spotNoCoords,
      creatorLabel: 'Daniel',
      likeCount: 0,
      liked: false,
      comments: [],
      expanded: false,
      scheduledDate: null,
      groupMode: 'category',
    });

    expect(html).toContain('spot-location-badge');
    expect(html).toContain('Standort fehlt');
    expect(html).not.toContain('show-on-map-btn');
  });

  it('renders "Standort festlegen" button in map-actions when expanded and coordinates are missing', async () => {
    const spotNoCoords = { ...mockSpot, lat: null, lng: null };
    const html = await mountComponent({
      spot: spotNoCoords,
      creatorLabel: 'Daniel',
      likeCount: 0,
      liked: false,
      comments: [],
      expanded: true,
      scheduledDate: null,
      groupMode: 'category',
    });

    expect(html).toContain('card-status-badges');
    expect(html).toContain('spot-location-badge');
    expect(html).toContain('set-location-btn');
    expect(html).toContain('Standort festlegen');
    expect(html).toContain('tabler-icon-map-pin-exclamation');
    expect(html).not.toContain('show-on-map-btn');
  });

  it('renders accommodation distance badge when accommodationDistance is provided in collapsed state', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      creatorLabel: 'Daniel',
      likeCount: 0,
      liked: false,
      comments: [],
      expanded: false,
      scheduledDate: null,
      groupMode: 'category',
      accommodationDistance: {
        accommodationId: 10,
        accommodationTitle: 'Hotel Central',
        distanceMeters: 1200,
        durationSeconds: 900,
        profile: 'foot-walking',
        isFallback: false,
      },
    });

    expect(html).toContain('spot-distance-badge');
    expect(html).toContain('1,2\u00A0km');
    expect(html).toContain('Hotel Central');
  });

  function mountToDom(options: { expanded: boolean; spot: Spot }) {
    vi.spyOn(api, 'get').mockResolvedValue([]);

    const container = document.createElement('div');
    document.body.appendChild(container);

    const onOpen = vi.fn();
    const onClose = vi.fn();

    const app = createApp({
      render: () =>
        h(SpotCard, {
          spot: options.spot,
          creatorLabel: 'Daniel',
          likeCount: 0,
          liked: false,
          comments: [],
          expanded: options.expanded,
          scheduledDate: null,
          onOpen,
          onClose,
        }),
    });
    app.use(createPinia());
    app.mount(container);

    return {
      container,
      onOpen,
      onClose,
      cleanup: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  it('ignores clicks on status badges in collapsed state while category chip opens the card', async () => {
    const pendingSpotNoCoords: Spot = {
      ...mockSpot,
      lat: null,
      lng: null,
      _pending: true,
    };
    const { container, onOpen, cleanup } = mountToDom({
      expanded: false,
      spot: pendingSpotNoCoords,
    });

    try {
      const locationBadge = container.querySelector('.spot-location-badge') as HTMLElement;
      const pendingBadge = container.querySelector('.pending-sync-badge') as HTMLElement;
      const categoryChip = container.querySelector('.category-chip') as HTMLElement;

      expect(locationBadge).not.toBeNull();
      expect(pendingBadge).not.toBeNull();
      expect(categoryChip).not.toBeNull();

      locationBadge.click();
      pendingBadge.click();
      await nextTick();
      expect(onOpen).not.toHaveBeenCalled();

      categoryChip.click();
      await nextTick();
      expect(onOpen).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('closes on clicking cover category chip in expanded state and ignores status badge clicks', async () => {
    const pendingSpotNoCoords: Spot = {
      ...mockSpot,
      lat: null,
      lng: null,
      _pending: true,
    };
    const { container, onClose, cleanup } = mountToDom({
      expanded: true,
      spot: pendingSpotNoCoords,
    });

    try {
      const locationBadge = container.querySelector(
        '.card-status-badges .spot-location-badge'
      ) as HTMLElement;
      const pendingBadge = container.querySelector(
        '.card-status-badges .pending-sync-badge'
      ) as HTMLElement;
      const coverCategoryChip = container.querySelector('.image .category-chip') as HTMLElement;

      expect(locationBadge).not.toBeNull();
      expect(pendingBadge).not.toBeNull();
      expect(coverCategoryChip).not.toBeNull();

      locationBadge.click();
      pendingBadge.click();
      await nextTick();
      expect(onClose).not.toHaveBeenCalled();

      coverCategoryChip.click();
      await nextTick();
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });
});

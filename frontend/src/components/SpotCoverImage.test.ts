// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotCoverImage from './SpotCoverImage.vue';
import type { Spot } from '../api/types';

describe('SpotCoverImage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockSpot: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Brandenburger Tor',
    category: 'Sehenswürdigkeit',
    lat: 52.5163,
    lng: 13.3777,
    image_url: null,
    address: 'Pariser Platz, 10117 Berlin',
    note: 'Ein schöner historischer Ort',
    note_format: 'text',
    created_by: 1,
    is_home: 0,
  } as Spot;

  function mountComponent(props: {
    spot: Spot;
    expanded: boolean;
    creatorLabel: string | null;
    isAccommodation: boolean;
    headingTag?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  }) {
    const app = createApp({
      render: () => h(SpotCoverImage, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders placeholder icon when no image_url is provided', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      expanded: false,
      creatorLabel: 'Daniel',
      isAccommodation: false,
    });
    expect(html).toContain('placeholder');
    expect(html).not.toContain('background-image');
    expect(html).not.toContain('image-expanded-overlay');
  });

  it('renders background-image style when image_url is provided', async () => {
    const html = await mountComponent({
      spot: { ...mockSpot, image_url: 'https://example.com/gate.jpg' },
      expanded: false,
      creatorLabel: 'Daniel',
      isAccommodation: false,
    });
    expect(html).toContain('https://example.com/gate.jpg');
    expect(html).not.toContain('placeholder');
  });

  it('renders expanded overlay with title, creator and note when expanded', async () => {
    const html = await mountComponent({
      spot: mockSpot,
      expanded: true,
      creatorLabel: 'Daniel',
      isAccommodation: false,
      headingTag: 'h3',
    });
    expect(html).toContain('image-expanded-overlay');
    expect(html).toContain('Brandenburger Tor');
    expect(html).toContain('Von Daniel');
    expect(html).toContain('Ein schöner historischer Ort');
    expect(html).toContain('<h3');
  });

  it('renders accommodation date range when expanded', async () => {
    const accommodationSpot: Spot = {
      ...mockSpot,
      category: 'Unterkunft',
      start_date: '2026-06-10',
      end_date: '2026-06-15',
    };
    const html = await mountComponent({
      spot: accommodationSpot,
      expanded: true,
      creatorLabel: null,
      isAccommodation: true,
    });
    expect(html).toContain('overlay-submeta');
    expect(html).toContain('10.06.2026');
    expect(html).toContain('15.06.2026');
  });
});

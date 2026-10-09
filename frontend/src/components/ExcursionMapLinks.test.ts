// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ExcursionMapLinks from './ExcursionMapLinks.vue';
import type { LocationTrack } from '../api/types';

describe('ExcursionMapLinks', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const mockTracks: LocationTrack[] = [
    {
      id: 1,
      trip_id: 1,
      title: 'GPS Wanderung',
      author_username: 'Daniel',
      author_avatar: '🦊',
    } as unknown as LocationTrack,
  ];

  function mountComponent(props: { hasMappedStations: boolean; linkedTracks: LocationTrack[] }) {
    const app = createApp({
      render: () => h(ExcursionMapLinks, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders show on map button when stations have coordinates', async () => {
    const html = await mountComponent({
      hasMappedStations: true,
      linkedTracks: [],
    });
    expect(html).toContain('Auf Karte anzeigen');
  });

  it('renders linked track buttons with title and avatar', async () => {
    const html = await mountComponent({
      hasMappedStations: false,
      linkedTracks: mockTracks,
    });
    expect(html).toContain('GPS Wanderung');
    expect(html).toContain('🦊');
  });
});

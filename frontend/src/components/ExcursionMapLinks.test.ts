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

  it('renders linked track buttons and show on map button when tracks exist without mapped stations', async () => {
    const html = await mountComponent({
      hasMappedStations: false,
      linkedTracks: mockTracks,
    });
    expect(html).toContain('Auf Karte anzeigen');
    expect(html).toContain('GPS Wanderung');
    expect(html).toContain('🦊');
  });

  it('calls drawers.openMapForTrack when track button is clicked', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const { useDrawersStore } = await import('../stores/drawers');
    const drawers = useDrawersStore();
    const container = document.createElement('div');
    const app = createApp({
      render: () =>
        h(ExcursionMapLinks, {
          hasMappedStations: false,
          linkedTracks: mockTracks,
        }),
    });
    app.use(pinia);
    app.mount(container);

    const buttons = container.querySelectorAll<HTMLButtonElement>('.linked-track-btn');
    expect(buttons.length).toBe(1);
    buttons[0].click();

    expect(drawers.mapFocusTrackId).toBe(1);
    app.unmount();
  });
});

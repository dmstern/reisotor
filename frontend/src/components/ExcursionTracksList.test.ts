// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ExcursionTracksList from './ExcursionTracksList.vue';
import type { LocationTrack, User } from '../api/types';

describe('ExcursionTracksList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const dummyUser: User = {
    id: 1,
    email: 'test@example.com',
    username: 'Max',
    avatar: '🦊',
  };

  const dummyTracks: LocationTrack[] = [
    {
      id: 101,
      trip_id: 1,
      user_id: 1,
      excursion_id: null,
      title: 'Wanderung zum Leuchtturm',
      started_at: '2026-05-10T10:00:00Z',
      ended_at: '2026-05-10T11:30:00Z',
      visibility: 'shared',
      end_reason: 'completed',
    },
    {
      id: 102,
      trip_id: 1,
      user_id: 1,
      excursion_id: null,
      title: 'Geheime Route',
      started_at: '2026-05-11T14:00:00Z',
      ended_at: null,
      visibility: 'private',
    },
  ];

  function render(props: InstanceType<typeof ExcursionTracksList>['$props']) {
    const app = createApp({
      render: () => h(ExcursionTracksList, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders track list with author, title, and action buttons', async () => {
    const html = await render({
      tracks: dummyTracks,
      users: [dummyUser],
      activeTrackId: 101,
      currentUserId: 1,
    });

    expect(html).toContain('tracks-view');
    expect(html).toContain('Wanderung zum Leuchtturm');
    expect(html).toContain('active');
    expect(html).toContain('🦊');
    expect(html).toContain('Max');
    expect(html).toContain('Geheime Route');
    expect(html).toContain('Aufzeichnung läuft');
    expect(html).toContain('1\u00A0Std. 30\u00A0Min.');
    expect(html).toContain('Nur für dich sichtbar (privat)');
  });

  it('renders empty state when tracks array is empty', async () => {
    const html = await render({
      tracks: [],
      users: [dummyUser],
      currentUserId: 1,
    });

    expect(html).toContain('tracks-empty-state');
    expect(html).toContain('Noch keine Tracks aufgezeichnet.');
    expect(html).not.toContain('track-row');
  });
});

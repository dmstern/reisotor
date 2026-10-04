// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TrackEditModal from './TrackEditModal.vue';
import type { LocationTrack, User } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
}));

describe('TrackEditModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const dummyUser: User = {
    id: 1,
    username: 'Max',
    avatar: '🦊',
    email: 'max@example.com',
  };

  const dummyTrack: LocationTrack = {
    id: 55,
    trip_id: 1,
    user_id: 1,
    excursion_id: null,
    title: 'Gipfelsturm',
    started_at: '2026-06-15T08:00:00Z',
    ended_at: '2026-06-15T12:00:00Z',
    visibility: 'private',
    end_reason: 'completed',
  };

  function mountModal(props: any) {
    const pinia = createPinia();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(TrackEditModal, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders "Aufzeichnung bearbeiten" modal when track is provided', async () => {
    const { cleanUp } = mountModal({
      track: dummyTrack,
      users: [dummyUser],
    });
    await nextTick();

    expect(document.body.textContent).toContain('Aufzeichnung bearbeiten');
    expect(document.body.textContent).toContain('Allgemein');
    expect(document.body.textContent).toContain('Berechtigungen');
    expect(document.body.textContent).toContain('Speichern');
    expect(document.body.textContent).toContain('Löschen');
    cleanUp();
  });

  it('does not render modal content when track is null', async () => {
    const { cleanUp } = mountModal({
      track: null,
      users: [dummyUser],
    });
    await nextTick();

    expect(document.body.textContent).not.toContain('Aufzeichnung bearbeiten');
    cleanUp();
  });
});

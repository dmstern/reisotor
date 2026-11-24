// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TrackEditModal from './TrackEditModal.vue';
import type { Excursion, LocationTrack, User } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';

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
    } as unknown as typeof ResizeObserver;
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

  it('suggests a smart title via sparkle button click', async () => {
    const { api } = await import('../api/client');
    vi.mocked(api.post).mockResolvedValueOnce({ title: 'Spaziergang durch den Plänterwald' });

    const { cleanUp } = mountModal({
      track: dummyTrack,
      users: [dummyUser],
    });
    await nextTick();

    const sparkleBtn = document.querySelector(
      '[data-testid="track-suggest-title-btn"]'
    ) as HTMLButtonElement | null;
    expect(sparkleBtn).toBeTruthy();

    sparkleBtn?.click();
    await nextTick();
    await nextTick();

    expect(api.post).toHaveBeenCalledWith('/tracks/55/suggest-title');
    const input = document.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(input?.value).toBe('Spaziergang durch den Plänterwald');
    cleanUp();
  });

  it('marks tour-assign-btn with btn--modified when assigned tour changes', async () => {
    const { cleanUp } = mountModal({
      track: dummyTrack,
      users: [dummyUser],
    });
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      {
        id: 10,
        trip_id: 1,
        title: 'Bergtour',
        date: '2026-06-15',
        done: 0,
        role: null,
        note: null,
        spot_ids: [],
      } as unknown as Excursion,
    ];
    await nextTick();

    const assignBtn = document.querySelector('.tour-assign-btn') as HTMLButtonElement | null;
    expect(assignBtn).toBeTruthy();
    expect(assignBtn?.classList.contains('btn--modified')).toBe(false);

    assignBtn?.click();
    await nextTick();

    const menuItems = Array.from(document.querySelectorAll('.dropdown-item'));
    const tourItem = menuItems.find((el) => el.textContent?.includes('Bergtour')) as
      HTMLElement | undefined;
    expect(tourItem).toBeTruthy();
    tourItem?.click();
    await nextTick();

    expect(assignBtn?.classList.contains('btn--modified')).toBe(true);
    cleanUp();
  });

  it('marks visibility-settings and selected radio-card as modified when visibility changes', async () => {
    const { cleanUp } = mountModal({
      track: dummyTrack,
      users: [dummyUser],
    });
    await nextTick();

    const visibilitySettings = document.querySelector('.visibility-settings');
    expect(visibilitySettings?.classList.contains('is-modified')).toBe(false);

    const sharedRadio = document.querySelector(
      'input[type="radio"][value="shared"]'
    ) as HTMLInputElement | null;
    expect(sharedRadio).toBeTruthy();
    sharedRadio?.click();
    await nextTick();

    expect(visibilitySettings?.classList.contains('is-modified')).toBe(true);
    const radioCards = Array.from(document.querySelectorAll('.radio-card'));
    const sharedCard = radioCards.find((el) =>
      el.textContent?.includes('Für alle Mitreisenden sichtbar')
    );
    expect(sharedCard?.classList.contains('is-modified')).toBe(true);
    cleanUp();
  });
});

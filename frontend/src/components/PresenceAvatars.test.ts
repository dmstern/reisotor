// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import PresenceAvatars from './PresenceAvatars.vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import type { Trip, User } from '../api/types';

class MockEventSource {
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
}
vi.stubGlobal('EventSource', MockEventSource);

describe('PresenceAvatars', () => {
  let pinia: ReturnType<typeof createPinia>;

  const userAlice: User = { id: 1, username: 'alice', email: 'alice@example.com', avatar: '🦊' };
  const userBob: User = { id: 2, username: 'bob', email: 'bob@example.com', avatar: '🐼' };
  const userCharlie: User = {
    id: 3,
    username: 'charlie',
    email: 'charlie@example.com',
    avatar: '🐱',
  };
  const userDave: User = { id: 4, username: 'dave', email: 'dave@example.com', avatar: '🐶' };
  const userEve: User = { id: 5, username: 'eve', email: 'eve@example.com', avatar: '🐸' };
  const userFrank: User = { id: 6, username: 'frank', email: 'frank@example.com', avatar: '🦁' };

  const mockTrip1: Trip = {
    id: 10,
    name: 'Sommerurlaub Lissabon',
    destination: 'Lissabon',
    start_date: '2026-08-01',
    end_date: '2026-08-10',
    maps_link: null,
    image_url: null,
    packing_category_required: 1,
    weather_model: 'ecmwf_ifs025',
    lat: 38.72,
    lng: -9.14,
  };

  const mockTrip2: Trip = {
    id: 20,
    name: 'Herbsturlaub Tokio',
    destination: 'Tokio',
    start_date: '2026-10-01',
    end_date: '2026-10-10',
    maps_link: null,
    image_url: null,
    packing_category_required: 1,
    weather_model: 'ecmwf_ifs025',
    lat: 35.68,
    lng: 139.76,
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);

    const authStore = useAuthStore();
    authStore.user = userAlice;

    const tripStore = useTripStore();
    tripStore.trips = [mockTrip1, mockTrip2];
    tripStore.currentTripId = 10;

    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/trips/10/members') {
        return [userAlice, userBob, userCharlie];
      }
      if (path === '/trips/20/members') {
        return [userAlice]; // Nur Alice allein auf Trip 20
      }
      if (path === '/trips/30/members') {
        // Viele Mitglieder für Overflow-Test
        return [userAlice, userBob, userCharlie, userDave, userEve, userFrank];
      }
      return [];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountComponent() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(PresenceAvatars),
    });
    app.use(pinia);
    app.mount(container);
    return {
      container,
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  it('renders other members on initial load and filters out the current user', async () => {
    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    const avatars = container.querySelectorAll('.presence-avatar');
    expect(avatars).toHaveLength(2); // bob & charlie, alice excluded
    expect(container.textContent).toContain('🐼');
    expect(container.textContent).toContain('🐱');
    expect(container.textContent).not.toContain('🦊');
    cleanUp();
  });

  it('instantly updates and clears old members when currentTripId changes in trip switcher', async () => {
    const tripStore = useTripStore();
    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelectorAll('.presence-avatar')).toHaveLength(2);

    // Switch trip to trip 20 (which only has alice)
    tripStore.selectTrip(20);
    await nextTick();

    // Immediately cleared on trip change
    expect(container.querySelectorAll('.presence-avatar')).toHaveLength(0);

    // After response resolves
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    // Still 0 because trip 20 only has Alice (current user)
    expect(container.querySelectorAll('.presence-avatar')).toHaveLength(0);

    // Switch back to trip 10
    tripStore.selectTrip(10);
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelectorAll('.presence-avatar')).toHaveLength(2);
    cleanUp();
  });

  it('applies online and offline classes based on liveSync.onlineUserIds', async () => {
    const liveSync = useLiveSyncStore();
    liveSync.onlineUserIds = [userBob.id]; // Bob is online, Charlie is offline

    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    const avatars = container.querySelectorAll('.presence-avatar');
    expect(avatars[0].classList.contains('online')).toBe(true);
    expect(avatars[0].classList.contains('offline')).toBe(false);
    expect(avatars[1].classList.contains('online')).toBe(false);
    expect(avatars[1].classList.contains('offline')).toBe(true);
    cleanUp();
  });

  it('renders overflow counter when more than 4 other members are present', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 30;

    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    // Alice excluded, leaving 5 other members (bob, charlie, dave, eve, frank)
    // MAX_VISIBLE = 4, overflow = +1
    const avatars = container.querySelectorAll('.presence-avatar:not(.overflow)');
    expect(avatars).toHaveLength(4);

    const overflow = container.querySelector('.presence-avatar.overflow');
    expect(overflow).not.toBeNull();
    expect(overflow?.textContent?.trim()).toBe('+1');
    cleanUp();
  });

  it('reloads members when liveSync.notificationVersion updates', async () => {
    const liveSync = useLiveSyncStore();
    const { container, cleanUp } = mountComponent();
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelectorAll('.presence-avatar')).toHaveLength(2);

    // Mock API returns an additional member on subsequent call
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/trips/10/members') {
        return [userAlice, userBob, userCharlie, userDave];
      }
      return [];
    });

    liveSync.notificationVersion++;
    await nextTick();
    await new Promise((r) => setTimeout(r, 10));
    await nextTick();

    expect(container.querySelectorAll('.presence-avatar')).toHaveLength(3);
    cleanUp();
  });
});

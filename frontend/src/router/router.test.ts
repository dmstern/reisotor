// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import router from './index';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

describe('Router Deeplinks & Navigation Guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('leitet nicht eingeloggte Nutzer von /trip/1/excursions auf /login um', async () => {
    const auth = useAuthStore();
    auth.user = null;
    auth.checked = true;

    await router.push('/trip/1/excursions');
    expect(router.currentRoute.value.name).toBe('login');
  });

  it('erlaubt Navigation zu /trip/:tripId/... wenn Trip existiert', async () => {
    const auth = useAuthStore();
    auth.user = { id: 1, username: 'test', avatar: '🦊' };
    auth.checked = true;

    const tripStore = useTripStore();
    tripStore.trips = [
      {
        id: 42,
        name: 'Sommerurlaub',
        destination: null,
        start_date: null,
        end_date: null,
        maps_link: null,
        lat: null,
        lng: null,
        image_url: null,
        packing_category_required: 0,
      },
    ];
    tripStore.loaded = true;

    await router.push('/trip/42/excursions');
    expect(router.currentRoute.value.name).toBe('excursions');
    expect(router.currentRoute.value.params.tripId).toBe('42');
    expect(tripStore.currentTripId).toBe(42);
  });

  it('leitet zu /trips um, wenn Trip-ID nicht existiert', async () => {
    const auth = useAuthStore();
    auth.user = { id: 1, username: 'test', avatar: '🦊' };
    auth.checked = true;

    const tripStore = useTripStore();
    tripStore.trips = [
      {
        id: 42,
        name: 'Sommerurlaub',
        destination: null,
        start_date: null,
        end_date: null,
        maps_link: null,
        lat: null,
        lng: null,
        image_url: null,
        packing_category_required: 0,
      },
    ];
    tripStore.loaded = true;

    await router.push('/trip/999/listen');
    expect(router.currentRoute.value.name).toBe('trips');
  });

  it('leitet Legacy-Route /listen auf /trip/:currentTripId/listen weiter', async () => {
    const auth = useAuthStore();
    auth.user = { id: 1, username: 'test', avatar: '🦊' };
    auth.checked = true;

    const tripStore = useTripStore();
    tripStore.trips = [
      {
        id: 42,
        name: 'Sommerurlaub',
        destination: null,
        start_date: null,
        end_date: null,
        maps_link: null,
        lat: null,
        lng: null,
        image_url: null,
        packing_category_required: 0,
      },
    ];
    tripStore.currentTripId = 42;
    tripStore.loaded = true;

    await router.push('/listen?tab=todo');
    expect(router.currentRoute.value.path).toBe('/trip/42/listen');
    expect(router.currentRoute.value.query.tab).toBe('todo');
  });
});

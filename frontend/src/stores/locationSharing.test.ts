import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocationSharingStore } from './locationSharing';
import { useTripStore } from './trip';

const apiGet = vi.fn();
const apiPut = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
  },
}));

vi.mock('./liveSync', () => ({
  useLiveSyncStore: () => ({
    sendPosition: vi.fn(),
    stopSharingPosition: vi.fn(),
  }),
}));

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('useLocationSharingStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    setActivePinia(createPinia());
    apiGet.mockReset();
    apiPut.mockReset();
  });

  it('initializes with activeDuration = off and shareUntil = null', () => {
    const store = useLocationSharingStore();
    expect(store.shareUntil).toBeNull();
    expect(store.activeDuration).toBe('off');
  });

  it('sets activeDuration to day and persists when choosing day', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 42;
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    apiPut.mockResolvedValueOnce({ location_share_until: tomorrow });

    const store = useLocationSharingStore();
    await store.setDuration('day');

    expect(apiPut).toHaveBeenCalledWith('/realtime/location-share', {
      trip_id: 42,
      duration: 'day',
    });
    expect(store.shareUntil).toBe(tomorrow);
    expect(store.activeDuration).toBe('day');

    const stored = JSON.parse(localStorage.getItem('reisotor-location-share-42') || '{}');
    expect(stored).toEqual({ duration: 'day', shareUntil: tomorrow });
  });

  it('sets activeDuration to week and forever respectively', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 42;

    const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    apiPut.mockResolvedValueOnce({ location_share_until: inAWeek });

    const store = useLocationSharingStore();
    await store.setDuration('week');
    expect(store.activeDuration).toBe('week');

    const farFuture = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000).toISOString();
    apiPut.mockResolvedValueOnce({ location_share_until: farFuture });

    await store.setDuration('forever');
    expect(store.activeDuration).toBe('forever');
  });

  it('resets to off when choosing off', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 42;

    const inAWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    apiPut.mockResolvedValueOnce({ location_share_until: inAWeek });

    const store = useLocationSharingStore();
    await store.setDuration('week');
    expect(store.activeDuration).toBe('week');

    apiPut.mockResolvedValueOnce({ location_share_until: null });
    await store.setDuration('off');

    expect(store.shareUntil).toBeNull();
    expect(store.activeDuration).toBe('off');
    expect(localStorage.getItem('reisotor-location-share-42')).toBeNull();
  });

  it('restores duration from localStorage on load()', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 42;

    const inAWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(
      'reisotor-location-share-42',
      JSON.stringify({ duration: 'week', shareUntil: inAWeek })
    );

    apiGet.mockResolvedValueOnce({ location_share_until: inAWeek });

    const store = useLocationSharingStore();
    await vi.waitFor(() => {
      expect(store.shareUntil).toBe(inAWeek);
      expect(store.activeDuration).toBe('week');
    });
  });

  it('infers duration if localStorage is missing on load()', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 99;

    const farFuture = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
    apiGet.mockResolvedValueOnce({ location_share_until: farFuture });

    const store = useLocationSharingStore();
    await vi.waitFor(() => {
      expect(store.shareUntil).toBe(farFuture);
      expect(store.activeDuration).toBe('forever');
    });
  });

  it('handles expired shareUntil by resetting to off', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 99;

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    apiGet.mockResolvedValueOnce({ location_share_until: yesterday });

    const store = useLocationSharingStore();
    await vi.waitFor(() => {
      expect(store.shareUntil).toBeNull();
      expect(store.activeDuration).toBe('off');
    });
  });
});

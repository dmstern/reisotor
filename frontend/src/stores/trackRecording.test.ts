import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseAltitude, useTrackRecordingStore } from './trackRecording';
import { useTripStore } from './trip';
import { useAuthStore } from './auth';

const rawRequestMock = vi.fn();
const apiPost = vi.fn();
const apiGet = vi.fn();

vi.mock('../api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
  rawRequest: (...args: unknown[]) => rawRequestMock(...args),
}));

vi.mock('./liveSync', () => ({
  useLiveSyncStore: () => ({
    refreshAll: vi.fn(),
    domainVersion: { ideas: 0 },
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

describe('parseAltitude', () => {
  it('handles null, undefined, NaN and non-finite values by returning null', () => {
    expect(parseAltitude(null)).toBeNull();
    expect(parseAltitude(undefined)).toBeNull();
    expect(parseAltitude(NaN)).toBeNull();
    expect(parseAltitude(Infinity)).toBeNull();
    expect(parseAltitude(-Infinity)).toBeNull();
    expect(parseAltitude('100' as unknown as number)).toBeNull();
    expect(parseAltitude({} as unknown as number)).toBeNull();
  });

  it('rounds valid altitudes to 1 decimal place', () => {
    expect(parseAltitude(250.54)).toBe(250.5);
    expect(parseAltitude(250.56)).toBe(250.6);
    expect(parseAltitude(540)).toBe(540);
    expect(parseAltitude(12.345)).toBe(12.3);
  });

  it('handles 0 and normalizes -0 to positive 0', () => {
    expect(parseAltitude(0)).toBe(0);
    expect(Object.is(parseAltitude(0), 0)).toBe(true);
    expect(Object.is(parseAltitude(-0), 0)).toBe(true);
    expect(Object.is(parseAltitude(-0.01), 0)).toBe(true);
  });

  it('preserves valid negative altitudes (below sea level)', () => {
    expect(parseAltitude(-415.82)).toBe(-415.8);
    expect(parseAltitude(-12.0)).toBe(-12.0);
  });
});

describe('useTrackRecordingStore altitude capturing and flushing', () => {
  let mockGeolocation: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
    watchPosition: ReturnType<typeof vi.fn>;
    clearWatch: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const memoryStorage = createMemoryStorage();
    vi.stubGlobal('localStorage', memoryStorage);
    setActivePinia(createPinia());
    rawRequestMock.mockReset().mockResolvedValue({ ok: true });
    apiPost.mockReset();
    apiGet.mockReset().mockResolvedValue([]);

    mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };
    vi.stubGlobal('navigator', {
      geolocation: mockGeolocation,
    });
  });

  it('captures altitude from geolocation and flushes to /tracks/:id/points', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;
    const authStore = useAuthStore();
    authStore.user = {
      id: 1,
      email: 'test@example.com',
      username: 'Test',
      avatar: '🐱',
      is_admin: false,
    };

    apiPost.mockResolvedValueOnce({
      id: 99,
      trip_id: 1,
      user_id: 1,
      visibility: 'private',
      started_at: '2026-09-26T12:00:00.000Z',
      ended_at: null,
    });

    const store = useTrackRecordingStore();

    // Trigger getCurrentPosition callback when start() calls startWatch()
    mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
      success({
        coords: {
          latitude: 48.2082,
          longitude: 16.3738,
          accuracy: 5.0,
          altitude: 235.64,
        },
      });
    });

    await store.start({ visibility: 'private' });
    expect(store.recording).toBe(true);

    // Stop to flush
    apiPost.mockResolvedValueOnce({ id: 99, ended_at: '2026-09-26T12:05:00.000Z' });
    await store.stop();

    expect(rawRequestMock).toHaveBeenCalledWith(
      '/tracks/99/points',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"altitude":235.6'),
      })
    );
  });

  it('captures altitude updates during watchPosition callbacks', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;
    const authStore = useAuthStore();
    authStore.user = {
      id: 1,
      email: 'test@example.com',
      username: 'Test',
      avatar: '🐱',
      is_admin: false,
    };

    apiPost.mockResolvedValueOnce({
      id: 101,
      trip_id: 1,
      user_id: 1,
      visibility: 'private',
      started_at: '2026-09-26T12:00:00.000Z',
      ended_at: null,
    });

    let watchCallback: ((pos: unknown) => void) | null = null;
    mockGeolocation.watchPosition.mockImplementationOnce((success) => {
      watchCallback = success;
      return 42;
    });

    const store = useTrackRecordingStore();
    await store.start({ visibility: 'private' });

    expect(watchCallback).not.toBeNull();
    // Simulate position update from watchPosition
    watchCallback!({
      coords: {
        latitude: 48.209,
        longitude: 16.375,
        accuracy: 3.5,
        altitude: 312.78,
      },
    });

    apiPost.mockResolvedValueOnce({ id: 101, ended_at: '2026-09-26T12:10:00.000Z' });
    await store.stop();

    expect(rawRequestMock).toHaveBeenCalledWith(
      '/tracks/101/points',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"altitude":312.8'),
      })
    );
  });

  it('captures altitude in stop() fallback geolocation point', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;
    const authStore = useAuthStore();
    authStore.user = {
      id: 1,
      email: 'test@example.com',
      username: 'Test',
      avatar: '🐱',
      is_admin: false,
    };

    apiPost.mockResolvedValueOnce({
      id: 102,
      trip_id: 1,
      user_id: 1,
      visibility: 'private',
      started_at: '2026-09-26T12:00:00.000Z',
      ended_at: null,
    });

    const store = useTrackRecordingStore();
    await store.start({ visibility: 'private' });

    // In stop(), getCurrentPosition will be called because buffer is empty
    mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
      success({
        coords: {
          latitude: 48.21,
          longitude: 16.38,
          accuracy: 4.0,
          altitude: 180.25,
        },
      });
    });

    apiPost.mockResolvedValueOnce({ id: 102, ended_at: '2026-09-26T12:15:00.000Z' });
    await store.stop();

    expect(rawRequestMock).toHaveBeenCalledWith(
      '/tracks/102/points',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"altitude":180.3'),
      })
    );
  });

  it('records null altitude when geolocation returns null altitude', async () => {
    const tripStore = useTripStore();
    tripStore.currentTripId = 1;
    const authStore = useAuthStore();
    authStore.user = {
      id: 1,
      email: 'test@example.com',
      username: 'Test',
      avatar: '🐱',
      is_admin: false,
    };

    apiPost.mockResolvedValueOnce({
      id: 103,
      trip_id: 1,
      user_id: 1,
      visibility: 'private',
      started_at: '2026-09-26T12:00:00.000Z',
      ended_at: null,
    });

    mockGeolocation.getCurrentPosition.mockImplementationOnce((success) => {
      success({
        coords: {
          latitude: 48.2082,
          longitude: 16.3738,
          accuracy: 5.0,
          altitude: null,
        },
      });
    });

    const store = useTrackRecordingStore();
    await store.start({ visibility: 'private' });

    apiPost.mockResolvedValueOnce({ id: 103, ended_at: '2026-09-26T12:05:00.000Z' });
    await store.stop();

    expect(rawRequestMock).toHaveBeenCalledWith(
      '/tracks/103/points',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"altitude":null'),
      })
    );
  });
});

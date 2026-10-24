import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { api, rawRequest } from './client';
import { writeCache } from './offline';

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
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe('api client error handling & network resilience', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      location: { pathname: '/trip/1' },
    });
  });

  it('provides a descriptive fallback message for 502 Bad Gateway when body and statusText are empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: '',
        json: async () => {
          throw new Error('not json');
        },
      })
    );

    await expect(rawRequest('/attachments?domain=ideas&entity_id=14')).rejects.toMatchObject({
      name: 'ApiError',
      status: 502,
      message: 'Bad Gateway (Server nicht erreichbar)',
      path: '/attachments?domain=ideas&entity_id=14',
    });
  });

  it('falls back to cached data on 502 Bad Gateway for GET requests (#527)', async () => {
    writeCache('/ideas?trip_id=1', [{ id: 14, title: 'Wanderung' }]);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: '',
        json: async () => {
          throw new Error('not json');
        },
      })
    );

    const result = await api.get<{ id: number; title: string }[]>('/ideas?trip_id=1');
    expect(result).toEqual([{ id: 14, title: 'Wanderung' }]);
  });

  it('marks confirmed offline when 502 occurs and throws if not cached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: '',
        json: async () => {
          throw new Error('not json');
        },
      })
    );

    await expect(api.get('/uncached-path')).rejects.toThrow(
      'Offline und keine zwischengespeicherten Daten'
    );
  });
});

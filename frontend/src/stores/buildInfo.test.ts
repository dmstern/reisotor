import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBuildInfoStore } from './buildInfo';

const apiGet = vi.fn();
vi.mock('../api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
  },
}));

describe('useBuildInfoStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiGet.mockReset();
  });

  it('initializes with null buildInfo', () => {
    const store = useBuildInfoStore();
    expect(store.buildInfo).toBeNull();
  });

  it('loads build info from /build-info and caches the result', async () => {
    const mockInfo = {
      version: '1.4.0',
      ref: 'abc',
      builtAt: '2026-09-19T10:00:00Z',
      changelog: null,
      repoUrl: 'https://github.com/dmstern/reisotor',
      hostingLocation: 'Berlin',
      environment: 'production',
    };
    apiGet.mockResolvedValueOnce(mockInfo);

    const store = useBuildInfoStore();
    await store.load();

    expect(apiGet).toHaveBeenCalledWith('/build-info');
    expect(store.buildInfo).toEqual(mockInfo);

    // Subsequent call should reuse cached promise and not call API again
    await store.load();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('allows retrying load() after a failure (e.g. unauthenticated 401)', async () => {
    apiGet.mockRejectedValueOnce(new Error('Unauthorized'));

    const store = useBuildInfoStore();
    await store.load();

    expect(store.buildInfo).toBeNull();
    expect(apiGet).toHaveBeenCalledTimes(1);

    // After login or retry, load() should attempt to fetch again
    const mockInfo = {
      version: '1.4.0',
      ref: 'abc',
      builtAt: '2026-09-19T10:00:00Z',
      changelog: null,
      repoUrl: 'https://github.com/dmstern/reisotor',
      hostingLocation: 'Berlin',
      environment: 'production',
    };
    apiGet.mockResolvedValueOnce(mockInfo);

    await store.load();
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(store.buildInfo).toEqual(mockInfo);
  });
});

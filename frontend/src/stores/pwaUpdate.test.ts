// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

import { usePwaUpdateStore } from './pwaUpdate';

describe('usePwaUpdateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initializes with needRefresh and offlineReady set to false', () => {
    const store = usePwaUpdateStore();
    expect(store.needRefresh).toBe(false);
    expect(store.offlineReady).toBe(false);
  });

  it('dismissOfflineReady clears offlineReady flag', () => {
    const store = usePwaUpdateStore();
    store.offlineReady = true;
    expect(store.offlineReady).toBe(true);

    store.dismissOfflineReady();
    expect(store.offlineReady).toBe(false);
  });
});

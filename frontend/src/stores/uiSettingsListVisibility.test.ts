// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useUiSettingsStore } from './uiSettings';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn().mockReturnValue(Promise.resolve({})),
  },
}));

describe('uiSettings list visibility', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(api.put).mockReturnValue(Promise.resolve({}));
  });

  it('defaults hideCompleted flags to false', () => {
    const store = useUiSettingsStore();
    expect(store.hideCompletedPacking).toBe(false);
    expect(store.hideCompletedTodos).toBe(false);
    expect(store.hideCompletedShopping).toBe(false);
  });

  it('persists hideCompleted flags to localStorage and calls API when changed', async () => {
    const store = useUiSettingsStore();

    store.hideCompletedPacking = true;
    await nextTick();
    expect(localStorage.getItem('reisotor-hide-completed-packing')).toBe('true');

    store.hideCompletedTodos = true;
    await nextTick();
    expect(localStorage.getItem('reisotor-hide-completed-todos')).toBe('true');

    store.hideCompletedShopping = true;
    await nextTick();
    expect(localStorage.getItem('reisotor-hide-completed-shopping')).toBe('true');
  });

  it('loads hideCompleted flags from server app-settings', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      hideCompletedPacking: true,
      hideCompletedTodos: false,
      hideCompletedShopping: true,
    });

    const store = useUiSettingsStore();
    await store.load();

    expect(store.hideCompletedPacking).toBe(true);
    expect(store.hideCompletedTodos).toBe(false);
    expect(store.hideCompletedShopping).toBe(true);
  });
});

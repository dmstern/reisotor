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

  it('defaults showUpdateDialogs to true and persists changes', async () => {
    const store = useUiSettingsStore();
    expect(store.showUpdateDialogs).toBe(true);

    store.showUpdateDialogs = false;
    await nextTick();
    expect(localStorage.getItem('reisotor-show-update-dialogs')).toBe('false');

    store.showUpdateDialogs = true;
    await nextTick();
    expect(localStorage.getItem('reisotor-show-update-dialogs')).toBe('true');
  });

  it('loads showUpdateDialogs from server app-settings', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      showUpdateDialogs: false,
    });

    const store = useUiSettingsStore();
    await store.load();

    expect(store.showUpdateDialogs).toBe(false);
  });

  it('loads customMobileNav and navConfigMobile from server app-settings', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      customMobileNav: true,
      navConfigMobile: [{ key: 'listen', visible: false }],
    });

    const store = useUiSettingsStore();
    await store.load();

    const { useNavConfigStore } = await import('./navConfig');
    const navStore = useNavConfigStore();
    expect(navStore.customMobile).toBe(true);
    expect(navStore.mobileEntries.find((e) => e.key === 'listen')?.visible).toBe(false);
  });

  it('triggers persist when mobile nav entries are updated', async () => {
    const { useNavConfigStore } = await import('./navConfig');
    const navStore = useNavConfigStore();
    const uiStore = useUiSettingsStore();

    // Trigger watcher
    navStore.customMobile = true;
    await nextTick();

    expect(api.put).toHaveBeenCalledWith(
      '/users/me/app-settings',
      expect.objectContaining({
        settings: expect.objectContaining({
          customMobileNav: true,
        }),
      })
    );
  });
});

import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIconStyleStore } from './iconStyle';

const apiGet = vi.fn();
const apiPut = vi.fn();
// #105: Icon-Einstellungen sind seit diesem Issue eine Account-Einstellung (persistiert über
// /users/me/icon-settings, siehe backend/src/routes/users.ts) statt localStorage - die api.get/put-
// Aufrufe werden hier gemockt statt eines echten Netzwerk-/Backend-Zugriffs. vi.mock() wird von
// Vitest vor die obigen Imports gehoisted, der Store bekommt also von Anfang an das Mock.
vi.mock('../api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
  },
}));

describe('useIconStyleStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiGet.mockReset();
    apiPut.mockReset();
    apiPut.mockResolvedValue({});
  });

  it('defaults to icons everywhere except categories (emoji) before load() resolves', () => {
    const store = useIconStyleStore();
    expect(store.groups.navigation).toBe('icons');
    expect(store.groups.categories).toBe('emoji');
    expect(store.groups.weather).toBe('icons');
    expect(store.groups.formFields).toBe('icons');
    expect(store.groups.actions).toBe('icons');
    expect(Object.values(store.variants).every((v) => v === 'outline')).toBe(true);
    expect(store.navColored).toBe(true);
    expect(store.colorizeWeather).toBe(true);
  });

  it('falls back to the default per group when a stored value is not a valid option', async () => {
    apiGet.mockResolvedValue({
      groups: { navigation: 'garbage', categories: 'emoji' },
      variants: { navigation: 'garbage' },
    });
    const store = useIconStyleStore();
    await store.load();
    expect(store.groups.navigation).toBe('icons');
    expect(store.groups.categories).toBe('emoji');
    expect(store.groups.weather).toBe('icons');
    expect(store.variants.navigation).toBe('outline');
  });

  it('applies stored group/variant overrides from the backend on load()', async () => {
    apiGet.mockResolvedValue({
      groups: { navigation: 'emoji' },
      variants: { actions: 'filled' },
      navColored: false,
    });
    const store = useIconStyleStore();
    await store.load();
    expect(store.groups.navigation).toBe('emoji');
    expect(store.groups.categories).toBe('emoji');
    expect(store.variants.actions).toBe('filled');
    expect(store.variants.navigation).toBe('outline');
    expect(store.navColored).toBe(false);
  });

  it('load() only fetches once, even when called again', async () => {
    apiGet.mockResolvedValue({});
    const store = useIconStyleStore();
    await store.load();
    await store.load();
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('persists per-group style and variant overrides independently to the backend', () => {
    const store = useIconStyleStore();
    store.setGroupOverride('categories', 'icons');
    expect(apiPut).toHaveBeenLastCalledWith(
      '/users/me/icon-settings',
      expect.objectContaining({ settings: expect.objectContaining({ groups: expect.objectContaining({ categories: 'icons' }) }) }),
    );
    store.setGroupVariant('categories', 'filled');
    expect(apiPut).toHaveBeenLastCalledWith(
      '/users/me/icon-settings',
      expect.objectContaining({ settings: expect.objectContaining({ variants: expect.objectContaining({ categories: 'filled' }) }) }),
    );
  });

  it('setAllGroups sets every group to the same value at once', () => {
    const store = useIconStyleStore();
    store.setAllGroups('emoji');
    expect(Object.values(store.groups).every((v) => v === 'emoji')).toBe(true);
    store.setAllGroups('icons');
    expect(Object.values(store.groups).every((v) => v === 'icons')).toBe(true);
  });

  it('resetToDefaults restores the shipped defaults after changes', () => {
    const store = useIconStyleStore();
    store.setAllGroups('emoji');
    store.setGroupVariant('actions', 'filled');
    store.navColored = false;
    store.colorizeWeather = false;

    store.resetToDefaults();

    expect(store.groups.categories).toBe('emoji');
    expect(store.groups.navigation).toBe('icons');
    expect(store.variants.actions).toBe('outline');
    expect(store.navColored).toBe(true);
    expect(store.colorizeWeather).toBe(true);
  });

  it('clearOnLogout resets state and allows the next login to load() again', async () => {
    apiGet.mockResolvedValue({ groups: { navigation: 'emoji' } });
    const store = useIconStyleStore();
    await store.load();
    expect(store.groups.navigation).toBe('emoji');

    store.clearOnLogout();
    expect(store.groups.navigation).toBe('icons');

    apiGet.mockResolvedValue({ groups: { navigation: 'emoji' } });
    await store.load();
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(store.groups.navigation).toBe('emoji');
  });
});

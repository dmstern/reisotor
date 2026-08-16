import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIconStyleStore } from './iconStyle';

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

describe('useIconStyleStore', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    setActivePinia(createPinia());
  });

  it('defaults to icons everywhere except categories (emoji) when nothing is stored', () => {
    const store = useIconStyleStore();
    expect(store.variant).toBe('outline');
    expect(store.groups.navigation).toBe('icons');
    expect(store.groups.categories).toBe('emoji');
    expect(store.groups.weather).toBe('icons');
    expect(store.groups.formFields).toBe('icons');
    expect(store.groups.actions).toBe('icons');
    expect(store.navColored).toBe(true);
    expect(store.colorizeWeather).toBe(true);
  });

  it('falls back to the default per group when the stored value is not a valid option', () => {
    localStorage.setItem('reisotor-icon-variant', 'garbage');
    localStorage.setItem('reisotor-icon-style-groups', JSON.stringify({ navigation: 'garbage', categories: 'emoji' }));
    const store = useIconStyleStore();
    expect(store.variant).toBe('outline');
    expect(store.groups.navigation).toBe('icons');
    expect(store.groups.categories).toBe('emoji');
    expect(store.groups.weather).toBe('icons');
  });

  it('persists variant and per-group overrides independently to localStorage', async () => {
    const store = useIconStyleStore();
    store.variant = 'filled';
    store.setGroupOverride('categories', 'icons');
    await nextTick(); // watch() flushes on the next tick, not synchronously
    expect(localStorage.getItem('reisotor-icon-variant')).toBe('filled');
    expect(JSON.parse(localStorage.getItem('reisotor-icon-style-groups')!).categories).toBe('icons');
  });

  it('round-trips stored group overrides across store re-creation', () => {
    localStorage.setItem('reisotor-icon-style-groups', JSON.stringify({ navigation: 'emoji' }));
    const store = useIconStyleStore();
    expect(store.groups.navigation).toBe('emoji');
    expect(store.groups.categories).toBe('emoji');
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
    store.variant = 'filled';
    store.navColored = false;
    store.colorizeWeather = false;

    store.resetToDefaults();

    expect(store.variant).toBe('outline');
    expect(store.groups.categories).toBe('emoji');
    expect(store.groups.navigation).toBe('icons');
    expect(store.navColored).toBe(true);
    expect(store.colorizeWeather).toBe(true);
  });
});

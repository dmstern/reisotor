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

  it('defaults to emoji/outline when nothing is stored - existing users see no visual change', () => {
    const store = useIconStyleStore();
    expect(store.style).toBe('emoji');
    expect(store.variant).toBe('outline');
  });

  it('falls back to the default when the stored value is not a valid option', () => {
    localStorage.setItem('reisotor-icon-style', 'garbage');
    localStorage.setItem('reisotor-icon-variant', 'garbage');
    const store = useIconStyleStore();
    expect(store.style).toBe('emoji');
    expect(store.variant).toBe('outline');
  });

  it('persists style and variant independently to localStorage', async () => {
    const store = useIconStyleStore();
    store.style = 'icons';
    store.variant = 'filled';
    await nextTick(); // watch() flushes on the next tick, not synchronously
    expect(localStorage.getItem('reisotor-icon-style')).toBe('icons');
    expect(localStorage.getItem('reisotor-icon-variant')).toBe('filled');
  });

  it('round-trips a stored preference across store re-creation', () => {
    localStorage.setItem('reisotor-icon-style', 'icons');
    localStorage.setItem('reisotor-icon-variant', 'filled');
    const store = useIconStyleStore();
    expect(store.style).toBe('icons');
    expect(store.variant).toBe('filled');
  });
});

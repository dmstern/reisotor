// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNavPositionStore } from './navPosition';

describe('navPosition store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('defaults desktop to top and mobile to bottom', () => {
    const store = useNavPositionStore();
    expect(store.desktop).toBe('top');
    expect(store.mobile).toBe('bottom');
  });

  it('cleans up legacy localStorage key on store initialization', () => {
    localStorage.setItem('reisotor-nav-position-desktop', 'bottom');
    const store = useNavPositionStore();
    expect(localStorage.getItem('reisotor-nav-position-desktop')).toBeNull();
    expect(store.desktop).toBe('top');
  });

  it('resets desktop to top and mobile to bottom', () => {
    const store = useNavPositionStore();
    store.mobile = 'top';
    store.reset();
    expect(store.desktop).toBe('top');
    expect(store.mobile).toBe('bottom');
  });
});

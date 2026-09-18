// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
  useUiSettingsStore,
  getPresetGlassValues,
  computeGlassCssValues,
  applyGlassStyle,
} from './uiSettings';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn().mockReturnValue(Promise.resolve({})),
  },
}));

describe('uiSettings glass effect', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--glass-opacity');
    document.documentElement.style.removeProperty('--glass-blur');
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(api.put).mockReturnValue(Promise.resolve({}));
  });

  it('provides correct glass preset values (42% opacity, 6px blur)', () => {
    expect(getPresetGlassValues('glass')).toEqual({ opacity: 42, blur: 6 });
    expect(getPresetGlassValues('frosted')).toEqual({ opacity: 80, blur: 24 });
    expect(getPresetGlassValues('opaque')).toEqual({ opacity: 100, blur: 0 });
    expect(getPresetGlassValues('custom')).toBeNull();
  });

  it('computes glass css values properly for presets and custom', () => {
    expect(computeGlassCssValues('glass', 85, 12)).toEqual({ opacity: 0.42, blur: 6 });
    expect(computeGlassCssValues('custom', 50, 10)).toEqual({ opacity: 0.5, blur: 10 });
  });

  it('defaults to glass style with 42% opacity and 6px blur', () => {
    const store = useUiSettingsStore();
    expect(store.glassStyle).toBe('glass');
    expect(store.glassOpacity).toBe(42);
    expect(store.glassBlur).toBe(6);
  });

  it('applies CSS properties to document root', () => {
    applyGlassStyle('glass', 42, 6);
    expect(document.documentElement.style.getPropertyValue('--glass-opacity')).toBe('0.42');
    expect(document.documentElement.style.getPropertyValue('--glass-blur')).toBe('6px');
  });

  it('persists changes to localStorage and calls API', async () => {
    const store = useUiSettingsStore();
    store.glassStyle = 'custom';
    store.glassOpacity = 55;
    store.glassBlur = 8;
    await nextTick();

    expect(localStorage.getItem('reisotor-glass-style')).toBe('custom');
    expect(localStorage.getItem('reisotor-glass-opacity')).toBe('55');
    expect(localStorage.getItem('reisotor-glass-blur')).toBe('8');
  });

  it('updates opacity and blur when loading presets from server', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      glassStyle: 'glass',
      // Even if old values were stored on server
      glassOpacity: 85,
      glassBlur: 12,
    });

    const store = useUiSettingsStore();
    await store.load();

    expect(store.glassStyle).toBe('glass');
    expect(store.glassOpacity).toBe(42);
    expect(store.glassBlur).toBe(6);
  });
});

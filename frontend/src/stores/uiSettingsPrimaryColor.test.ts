// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useUiSettingsStore, DEFAULT_PRIMARY_COLOR, applyPrimaryColor } from './uiSettings';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn().mockReturnValue(Promise.resolve({})),
  },
}));

describe('uiSettings primary color & theme-color meta tag (#668)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--color-primary');
    document.querySelectorAll('meta[name="theme-color"]').forEach((el) => el.remove());
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(api.put).mockReturnValue(Promise.resolve({}));
  });

  it('has DEFAULT_PRIMARY_COLOR set to #9141AC', () => {
    expect(DEFAULT_PRIMARY_COLOR).toBe('#9141AC');
  });

  it('updates meta[name="theme-color"] and CSS variable on custom primary color (e.g. Türkis)', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', DEFAULT_PRIMARY_COLOR);
    document.head.appendChild(meta);

    applyPrimaryColor('#2a7f74');

    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#2a7f74');
    expect(meta.getAttribute('content')).toBe('#2a7f74');
  });

  it('creates meta[name="theme-color"] if not present and sets custom color', () => {
    expect(document.querySelector('meta[name="theme-color"]')).toBeNull();

    applyPrimaryColor('#2563eb');

    const created = document.querySelector('meta[name="theme-color"]');
    expect(created).not.toBeNull();
    expect(created?.getAttribute('content')).toBe('#2563eb');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#2563eb');
  });

  it('removes inline CSS variable and keeps default color on meta tag when using default', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#2a7f74');
    document.head.appendChild(meta);
    document.documentElement.style.setProperty('--color-primary', '#2a7f74');

    applyPrimaryColor(DEFAULT_PRIMARY_COLOR);

    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(meta.getAttribute('content')).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it('handles lowercase default primary color correctly', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#2a7f74');
    document.head.appendChild(meta);
    document.documentElement.style.setProperty('--color-primary', '#2a7f74');

    applyPrimaryColor('#9141ac');

    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(meta.getAttribute('content')).toBe('#9141ac');
  });

  it('falls back to default color when an invalid color is passed', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#2a7f74');
    document.head.appendChild(meta);

    applyPrimaryColor('invalid-color');

    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
    expect(meta.getAttribute('content')).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it('updates meta[name="theme-color"] reactively when primaryColor store state changes', async () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', DEFAULT_PRIMARY_COLOR);
    document.head.appendChild(meta);

    const store = useUiSettingsStore();
    expect(store.primaryColor).toBe(DEFAULT_PRIMARY_COLOR);

    // Change to Türkis
    store.primaryColor = '#2a7f74';
    await nextTick();

    expect(meta.getAttribute('content')).toBe('#2a7f74');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#2a7f74');

    // Reset back to default
    store.primaryColor = DEFAULT_PRIMARY_COLOR;
    await nextTick();

    expect(meta.getAttribute('content')).toBe(DEFAULT_PRIMARY_COLOR);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('');
  });
});

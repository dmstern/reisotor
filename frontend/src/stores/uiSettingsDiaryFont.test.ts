// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import {
  useUiSettingsStore,
  DIARY_FONT_OPTIONS,
  DEFAULT_DIARY_FONT,
  applyDiaryFont,
} from './uiSettings';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn().mockReturnValue(Promise.resolve({})),
  },
}));

describe('uiSettings diary font', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty('--font-diary');
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.mocked(api.put).mockReturnValue(Promise.resolve({}));
  });

  it('defaults to architects-daughter', () => {
    const store = useUiSettingsStore();
    expect(store.diaryFont).toBe('architects-daughter');
    expect(DEFAULT_DIARY_FONT).toBe('architects-daughter');
  });

  it('contains all 6 expected font options including Fira Sans and Architects Daughter', () => {
    const ids = DIARY_FONT_OPTIONS.map((o) => o.id);
    expect(ids).toEqual([
      'architects-daughter',
      'comic-neue',
      'balsamiq-sans',
      'short-stack',
      'patrick-hand',
      'fira-sans',
    ]);
  });

  it('applies CSS property --font-diary to document root', () => {
    applyDiaryFont('comic-neue');
    expect(document.documentElement.style.getPropertyValue('--font-diary')).toBe(
      "'Comic Neue', cursive, sans-serif"
    );

    applyDiaryFont('architects-daughter');
    expect(document.documentElement.style.getPropertyValue('--font-diary')).toBe(
      "'Architects Daughter', cursive, sans-serif"
    );

    applyDiaryFont('fira-sans');
    expect(document.documentElement.style.getPropertyValue('--font-diary')).toBe(
      'var(--font-sans)'
    );
  });

  it('persists changes to localStorage and sends to API', async () => {
    const store = useUiSettingsStore();
    store.diaryFont = 'patrick-hand';
    await nextTick();

    expect(localStorage.getItem('reisotor-diary-font')).toBe('patrick-hand');
    expect(document.documentElement.style.getPropertyValue('--font-diary')).toBe(
      "'Patrick Hand', cursive, sans-serif"
    );
    expect(api.put).toHaveBeenCalledWith(
      '/users/me/app-settings',
      expect.objectContaining({
        settings: expect.objectContaining({
          diaryFont: 'patrick-hand',
        }),
      })
    );
  });

  it('loads diaryFont from server settings', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      diaryFont: 'short-stack',
    });

    const store = useUiSettingsStore();
    await store.load();

    expect(store.diaryFont).toBe('short-stack');
    expect(document.documentElement.style.getPropertyValue('--font-diary')).toBe(
      "'Short Stack', cursive, sans-serif"
    );
  });
});

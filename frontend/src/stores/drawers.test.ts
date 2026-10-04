// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { nextTick } from 'vue';
import { useDrawersStore } from './drawers';
import router from '../router';

describe('drawers store', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.body.style.overflow = '';

    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  describe('Mobile behavior (<1024px)', () => {
    beforeEach(() => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: query.includes('min-width: 1024px') ? false : true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it('never locks body scroll when initialized on mobile', () => {
      const store = useDrawersStore();
      expect(document.body.style.overflow).toBe('');
      expect(store.calendarOpen).toBe(false);
    });

    it('ignores stored true preference on mobile so calendar drawer remains closed', () => {
      localStorage.setItem('reisotor-drawer-calendar-open', 'true');
      const store = useDrawersStore();

      expect(store.calendarOpen).toBe(false);
      expect(document.body.style.overflow).toBe('');
    });

    it('does not lock body scroll even if calendarOpen is set to true on mobile', async () => {
      const store = useDrawersStore();
      store.calendarOpen = true;
      await nextTick();

      expect(document.body.style.overflow).toBe('');
      // Does not persist to localStorage on mobile
      expect(localStorage.getItem('reisotor-drawer-calendar-open')).toBeNull();
    });

    it('routes to /calendar on mobile when openCalendar is invoked', () => {
      const pushSpy = vi.spyOn(router, 'push').mockResolvedValue(undefined as never);
      const store = useDrawersStore();

      store.openCalendar();
      expect(pushSpy).toHaveBeenCalledWith('/calendar');
      expect(store.calendarOpen).toBe(false);
    });
  });

  describe('Desktop behavior (>=1024px)', () => {
    beforeEach(() => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: query.includes('min-width: 1024px') ? true : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it('defaults calendar to open on desktop without locking body scroll', () => {
      const store = useDrawersStore();
      expect(store.calendarOpen).toBe(true);
      expect(document.body.style.overflow).toBe('');
    });

    it('respects stored desktop preference and persists changes', async () => {
      localStorage.setItem('reisotor-drawer-calendar-open', 'false');
      const store = useDrawersStore();
      expect(store.calendarOpen).toBe(false);

      store.calendarOpen = true;
      await nextTick();
      expect(localStorage.getItem('reisotor-drawer-calendar-open')).toBe('true');
      expect(document.body.style.overflow).toBe('');
    });

    it('sets calendarOpen to true on desktop when openCalendar is invoked', () => {
      const store = useDrawersStore();
      store.calendarOpen = false;

      store.openCalendar();
      expect(store.calendarOpen).toBe(true);
    });
  });
});

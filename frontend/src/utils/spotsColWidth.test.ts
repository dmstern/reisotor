import { describe, it, expect, beforeEach } from 'vitest';
import {
  SPOTS_COL_WIDTH_KEY,
  MIN_SPOTS_COL_WIDTH,
  DEFAULT_SPOTS_COL_WIDTH,
  MAX_SPOTS_COL_WIDTH,
  loadStoredSpotsColWidth,
  saveStoredSpotsColWidth,
  calcValidSpotsColWidth,
} from './spotsColWidth';

describe('spotsColWidth', () => {
  let mockStorage: Storage;
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      length: 0,
    };
  });

  describe('loadStoredSpotsColWidth', () => {
    it('returns null when nothing is stored', () => {
      expect(loadStoredSpotsColWidth(mockStorage)).toBeNull();
    });

    it('returns stored value when valid', () => {
      mockStorage.setItem(SPOTS_COL_WIDTH_KEY, '450');
      expect(loadStoredSpotsColWidth(mockStorage)).toBe(450);
    });

    it('rejects values below MIN_SPOTS_COL_WIDTH (e.g. corrupted 12 or -10)', () => {
      mockStorage.setItem(SPOTS_COL_WIDTH_KEY, '12');
      expect(loadStoredSpotsColWidth(mockStorage)).toBeNull();

      mockStorage.setItem(SPOTS_COL_WIDTH_KEY, '-10');
      expect(loadStoredSpotsColWidth(mockStorage)).toBeNull();
    });

    it('rejects values above MAX_SPOTS_COL_WIDTH', () => {
      mockStorage.setItem(SPOTS_COL_WIDTH_KEY, '9999');
      expect(loadStoredSpotsColWidth(mockStorage)).toBeNull();
    });

    it('rejects non-numeric values', () => {
      mockStorage.setItem(SPOTS_COL_WIDTH_KEY, 'invalid');
      expect(loadStoredSpotsColWidth(mockStorage)).toBeNull();
    });
  });

  describe('saveStoredSpotsColWidth', () => {
    it('saves valid widths', () => {
      saveStoredSpotsColWidth(420, mockStorage);
      expect(mockStorage.getItem(SPOTS_COL_WIDTH_KEY)).toBe('420');
    });

    it('refuses to save widths below MIN_SPOTS_COL_WIDTH', () => {
      saveStoredSpotsColWidth(15, mockStorage);
      expect(mockStorage.getItem(SPOTS_COL_WIDTH_KEY)).toBeNull();
    });

    it('refuses to save invalid numbers', () => {
      saveStoredSpotsColWidth(NaN, mockStorage);
      expect(mockStorage.getItem(SPOTS_COL_WIDTH_KEY)).toBeNull();
    });
  });

  describe('calcValidSpotsColWidth', () => {
    it('defaults to DEFAULT_SPOTS_COL_WIDTH when preferredWidth is missing or invalid', () => {
      expect(calcValidSpotsColWidth({ isDesktop: true, availableWidth: 1200 })).toBe(
        DEFAULT_SPOTS_COL_WIDTH
      );
      expect(
        calcValidSpotsColWidth({ preferredWidth: 50, isDesktop: true, availableWidth: 1200 })
      ).toBe(DEFAULT_SPOTS_COL_WIDTH);
    });

    it('preserves preferred desktop width on mobile without shrinking to mobile viewport', () => {
      // On mobile (390px wide screen), the desktop width of 450px must stay intact
      expect(
        calcValidSpotsColWidth({ preferredWidth: 450, availableWidth: 390, isDesktop: false })
      ).toBe(450);
    });

    it('uses preferred width when within valid desktop limits', () => {
      expect(
        calcValidSpotsColWidth({ preferredWidth: 420, availableWidth: 1200, isDesktop: true })
      ).toBe(420);
    });

    it('clamps to maxAllowed on smaller desktop viewports without dropping below MIN_SPOTS_COL_WIDTH', () => {
      // available: 750 -> maxAllowed: 750 - 380 - 16 = 354
      expect(
        calcValidSpotsColWidth({ preferredWidth: 500, availableWidth: 750, isDesktop: true })
      ).toBe(354);

      // available: 600 -> 600 - 380 - 16 = 204 (< 280), but must clamp to MIN_SPOTS_COL_WIDTH (280)
      expect(
        calcValidSpotsColWidth({ preferredWidth: 500, availableWidth: 600, isDesktop: true })
      ).toBe(MIN_SPOTS_COL_WIDTH);
    });

    it('never returns a value below MIN_SPOTS_COL_WIDTH', () => {
      const result = calcValidSpotsColWidth({
        preferredWidth: 10,
        availableWidth: 300,
        isDesktop: true,
      });
      expect(result).toBeGreaterThanOrEqual(MIN_SPOTS_COL_WIDTH);
    });
  });
});

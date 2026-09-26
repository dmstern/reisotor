import { describe, it, expect } from 'vitest';
import {
  formatDestinationLocationLabel,
  formatHomeLocationLabel,
  formatOverDestinationLabel,
} from './weatherLocationLabel';

describe('weatherLocationLabel', () => {
  describe('formatDestinationLocationLabel', () => {
    it('uses destination name when destination is provided', () => {
      expect(formatDestinationLocationLabel('Toskana', 'Sommerurlaub')).toBe('in Toskana');
      expect(formatDestinationLocationLabel('Rom, Italien', 'Städtetrip')).toBe('in Rom, Italien');
    });

    it('falls back to trip name when destination is missing or empty', () => {
      expect(formatDestinationLocationLabel(null, 'bla blubber italien')).toBe(
        'am Reiseziel (bla blubber italien)'
      );
      expect(formatDestinationLocationLabel('', 'Schweiz 98')).toBe('am Reiseziel (Schweiz 98)');
      expect(formatDestinationLocationLabel('   ', 'Alpenüberquerung')).toBe(
        'am Reiseziel (Alpenüberquerung)'
      );
    });

    it('falls back to generic label when both destination and trip name are missing', () => {
      expect(formatDestinationLocationLabel(null, null)).toBe('am Reiseziel');
      expect(formatDestinationLocationLabel('', '')).toBe('am Reiseziel');
      expect(formatDestinationLocationLabel('  ', '  ')).toBe('am Reiseziel');
    });
  });

  describe('formatHomeLocationLabel', () => {
    it('formats city name with "in [City]"', () => {
      expect(formatHomeLocationLabel('Berlin')).toBe('in Berlin');
      expect(formatHomeLocationLabel('München')).toBe('in München');
      expect(formatHomeLocationLabel('Zürich')).toBe('in Zürich');
    });

    it('formats "Zuhause" as lowercase "zuhause"', () => {
      expect(formatHomeLocationLabel('Zuhause')).toBe('zuhause');
      expect(formatHomeLocationLabel('zuhause')).toBe('zuhause');
      expect(formatHomeLocationLabel('ZUHAUSE')).toBe('zuhause');
    });

    it('falls back to "zuhause" when title is empty or missing', () => {
      expect(formatHomeLocationLabel(null)).toBe('zuhause');
      expect(formatHomeLocationLabel('')).toBe('zuhause');
      expect(formatHomeLocationLabel('   ')).toBe('zuhause');
    });
  });

  describe('formatOverDestinationLabel', () => {
    it('formats label with destination when present', () => {
      expect(formatOverDestinationLabel('Toskana', 'Italien 2026')).toBe('am Reiseziel (Toskana)');
    });

    it('formats label with trip name when destination is missing', () => {
      expect(formatOverDestinationLabel(null, 'bla blubber italien')).toBe(
        'am Reiseziel (bla blubber italien)'
      );
    });

    it('formats generic label when neither is present', () => {
      expect(formatOverDestinationLabel(null, null)).toBe('am Reiseziel');
      expect(formatOverDestinationLabel('', '')).toBe('am Reiseziel');
    });
  });
});

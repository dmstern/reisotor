import { describe, it, expect } from 'vitest';
import {
  travelDurationMinutes,
  formatTravelDuration,
  formatTravelDurationParts,
  tourTotalDurationMinutes,
} from './travelDuration';

describe('travelDuration', () => {
  describe('travelDurationMinutes', () => {
    it('returns null if either time is missing or invalid', () => {
      expect(travelDurationMinutes(null, '10:00')).toBeNull();
      expect(travelDurationMinutes('10:00', null)).toBeNull();
      expect(travelDurationMinutes('invalid', '10:00')).toBeNull();
    });

    it('calculates same-day duration correctly', () => {
      expect(travelDurationMinutes('07:20', '10:05')).toBe(165);
      expect(travelDurationMinutes('06:00', '23:03')).toBe(1023);
    });

    it('handles overnight flights (cross-day)', () => {
      expect(travelDurationMinutes('23:40', '01:15')).toBe(95);
    });
  });

  describe('formatTravelDuration', () => {
    it('formats minutes only', () => {
      expect(formatTravelDuration(45)).toBe('45 Min.');
    });

    it('formats hours only', () => {
      expect(formatTravelDuration(120)).toBe('2 Std.');
    });

    it('formats hours and minutes', () => {
      expect(formatTravelDuration(165)).toBe('2 Std. 45 Min.');
      expect(formatTravelDuration(1023)).toBe('17 Std. 3 Min.');
    });
  });

  describe('formatTravelDurationParts', () => {
    it('returns single part with non-breaking space for minutes only', () => {
      expect(formatTravelDurationParts(45)).toEqual(['45\u00A0Min.']);
    });

    it('returns single part with non-breaking space for hours only', () => {
      expect(formatTravelDurationParts(120)).toEqual(['2\u00A0Std.']);
    });

    it('returns separate parts for hours and minutes, each non-breaking', () => {
      expect(formatTravelDurationParts(165)).toEqual(['2\u00A0Std.', '45\u00A0Min.']);
      expect(formatTravelDurationParts(1023)).toEqual(['17\u00A0Std.', '3\u00A0Min.']);
    });
  });
});

describe('tourTotalDurationMinutes', () => {
  it('returns duration from top-level if no legs', () => {
    expect(tourTotalDurationMinutes({ departure_time: '10:00', arrival_time: '12:00' })).toBe(120);
  });

  it('sums multiple contiguous legs correctly', () => {
    const legs = [
      { departure_time: '10:00', arrival_time: '12:00' },
      { departure_time: '13:00', arrival_time: '14:30' },
    ];
    // Leg1: 2h (120m). Wait: 12-13 (60m). Leg2: 1.5h (90m). Total = 270m
    expect(tourTotalDurationMinutes({ legs })).toBe(270);
  });

  it('handles multi-day wrappers correctly without explicit dates', () => {
    const legs = [
      { departure_time: '10:00', arrival_time: '03:00' }, // 17h
      { departure_time: '12:00', arrival_time: '13:00' }, // wait: 03:00 -> 12:00 = 9h, leg: 1h
    ];
    // Total: 17h + 9h + 1h = 27h = 1620m
    expect(tourTotalDurationMinutes({ legs })).toBe(1620);
  });

  it('handles legs with missing arrival or departure times', () => {
    const legs = [
      { departure_time: '10:00', arrival_time: '12:00' },
      { departure_time: null, arrival_time: null },
      { departure_time: '13:00', arrival_time: '14:00' },
    ];
    // Wait time from 12:00 to 13:00 is preserved, skips the empty leg
    // 10:00->12:00 (120), 12:00->13:00 (60), 13:00->14:00 (60) => 240
    expect(tourTotalDurationMinutes({ legs })).toBe(240);
  });
});

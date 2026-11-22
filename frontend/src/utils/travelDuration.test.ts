import { describe, it, expect } from 'vitest';
import {
  travelDurationMinutes,
  formatTravelDuration,
  formatTravelDurationParts,
  formatLegDistance,
  normalizeTransportType,
  summarizeTourLegsByTransport,
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
      expect(formatTravelDuration(45)).toBe('45\u00A0Min.');
    });

    it('formats hours only', () => {
      expect(formatTravelDuration(120)).toBe('2\u00A0Std.');
    });

    it('formats hours and minutes', () => {
      expect(formatTravelDuration(165)).toBe('2\u00A0Std. 45\u00A0Min.');
      expect(formatTravelDuration(1023)).toBe('17\u00A0Std. 3\u00A0Min.');
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

  it('sums mixed legs with departure/arrival times and duration_seconds', () => {
    const legs = [
      { departure_time: '09:00', arrival_time: '10:30' }, // 90m
      { duration_seconds: 6840 }, // 114m (zu Fuß)
    ];
    expect(tourTotalDurationMinutes({ legs })).toBe(204);
  });

  it('does not count wait time after a pure duration_seconds leg when a timed leg follows', () => {
    const legs = [
      { departure_time: '09:00', arrival_time: '10:00' }, // 60m
      { duration_seconds: 1800 }, // 30m, resets lastTime
      { departure_time: '12:00', arrival_time: '13:00' }, // 60m without 2h wait
    ];
    expect(tourTotalDurationMinutes({ legs })).toBe(150);
  });

  it('sums pure duration_seconds legs without any times', () => {
    const legs = [{ duration_seconds: 6840 }, { duration_seconds: 1800 }];
    // 114m + 30m = 144m
    expect(tourTotalDurationMinutes({ legs })).toBe(144);
  });
});

describe('formatLegDistance', () => {
  it('returns null for null, undefined, zero or negative distance', () => {
    expect(formatLegDistance(null)).toBeNull();
    expect(formatLegDistance(undefined)).toBeNull();
    expect(formatLegDistance(0)).toBeNull();
    expect(formatLegDistance(-100)).toBeNull();
    expect(formatLegDistance(Number.NaN)).toBeNull();
  });

  it('formats distance in meters under 1000m', () => {
    expect(formatLegDistance(450)).toBe('450\u00A0m');
    expect(formatLegDistance(999)).toBe('999\u00A0m');
  });

  it('formats distance in kilometers with 1 decimal between 1km and 10km', () => {
    expect(formatLegDistance(1000)).toBe('1,0\u00A0km');
    expect(formatLegDistance(1100)).toBe('1,1\u00A0km');
    expect(formatLegDistance(1400)).toBe('1,4\u00A0km');
    expect(formatLegDistance(9900)).toBe('9,9\u00A0km');
  });

  it('formats distance in whole kilometers from 10km onwards', () => {
    expect(formatLegDistance(10000)).toBe('10\u00A0km');
    expect(formatLegDistance(46000)).toBe('46\u00A0km');
    expect(formatLegDistance(46450)).toBe('46\u00A0km');
  });
});

describe('normalizeTransportType', () => {
  it('normalizes walking variants', () => {
    expect(normalizeTransportType('zu Fuß')).toBe('zu Fuß');
    expect(normalizeTransportType('Zu Fuß')).toBe('zu Fuß');
    expect(normalizeTransportType('zu fuss')).toBe('zu Fuß');
    expect(normalizeTransportType('fuss')).toBe('zu Fuß');
  });

  it('normalizes car, bicycle and public transit', () => {
    expect(normalizeTransportType('car')).toBe('Auto');
    expect(normalizeTransportType('auto')).toBe('Auto');
    expect(normalizeTransportType('bike')).toBe('Fahrrad');
    expect(normalizeTransportType('tram')).toBe('Straßenbahn');
    expect(normalizeTransportType('bahn')).toBe('Zug');
    expect(normalizeTransportType('metro')).toBe('U-Bahn');
    expect(normalizeTransportType('ferry')).toBe('Fähre');
  });

  it('falls back to Sonstiges for empty or null strings', () => {
    expect(normalizeTransportType(null)).toBe('Sonstiges');
    expect(normalizeTransportType('')).toBe('Sonstiges');
    expect(normalizeTransportType('   ')).toBe('Sonstiges');
  });
});

describe('summarizeTourLegsByTransport', () => {
  it('returns empty array for empty or missing legs', () => {
    expect(summarizeTourLegsByTransport(null)).toEqual([]);
    expect(summarizeTourLegsByTransport([])).toEqual([]);
  });

  it('groups legs by transport type and combines case-insensitive variants', () => {
    const legs = [
      {
        transport_type: 'zu Fuß',
        distance_meters: 600,
        departure_time: '10:00',
        arrival_time: '10:10',
      },
      {
        transport_type: 'Zu Fuß',
        distance_meters: 800,
        duration_seconds: 600,
      },
    ];

    const result = summarizeTourLegsByTransport(legs);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('zu Fuß');
    expect(result[0].distanceMeters).toBe(1400);
    expect(result[0].durationMinutes).toBe(20);
    expect(result[0].formattedPrimary).toBe('1,4\u00A0km');
    expect(result[0].tooltip).toBe('zu Fuß: 1,4\u00A0km (20\u00A0Min.)');
  });

  it('shows distance only as primary when distance is available, with full tooltip', () => {
    const legs = [
      {
        transport_type: 'Auto',
        distance_meters: 46000,
        departure_time: '10:00',
        arrival_time: '10:55',
      },
    ];

    const result = summarizeTourLegsByTransport(legs);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('Auto');
    expect(result[0].formattedPrimary).toBe('46\u00A0km');
    expect(result[0].tooltip).toBe('Auto: 46\u00A0km (55\u00A0Min.)');
  });

  it('shows duration as primary when distance is not available (e.g. Öffis)', () => {
    const legs = [
      {
        transport_type: 'Straßenbahn',
        departure_time: '14:00',
        arrival_time: '14:40',
      },
      {
        transport_type: 'Zug',
        duration_seconds: 4800, // 80 Min. = 1 Std. 20 Min.
      },
    ];

    const result = summarizeTourLegsByTransport(legs);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('Straßenbahn');
    expect(result[0].formattedPrimary).toBe('40\u00A0Min.');
    expect(result[0].tooltip).toBe('Straßenbahn: 40\u00A0Min.');

    expect(result[1].type).toBe('Zug');
    expect(result[1].formattedPrimary).toBe('1\u00A0Std. 20\u00A0Min.');
    expect(result[1].tooltip).toBe('Zug: 1\u00A0Std. 20\u00A0Min.');
  });
});

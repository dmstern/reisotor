import { describe, it, expect } from 'vitest';
import type { TrackPoint } from '../api/types';
import {
  trackDistanceMeters,
  trackDurationMs,
  interpolateTrackPosition,
  formatDurationShort,
  formatDistanceShort,
  trackAverageSpeedKmh,
  formatSpeedShort,
  trackElevation,
  formatElevationShort,
} from './trackGeometry';

function makePoint(
  lat: number,
  lng: number,
  recorded_at = '2026-09-26T10:00:00.000Z',
  altitude?: number | null
): TrackPoint {
  return {
    id: 1,
    track_id: 1,
    lat,
    lng,
    recorded_at,
    accuracy: 5,
    altitude,
  };
}

describe('trackGeometry', () => {
  describe('trackDistanceMeters', () => {
    it('returns 0 for empty or single point array', () => {
      expect(trackDistanceMeters([])).toBe(0);
      expect(trackDistanceMeters([makePoint(47.3769, 8.5417)])).toBe(0);
    });

    it('calculates distance between known GPS coordinates', () => {
      // Zurich to Bern: approx 95 km
      const p1 = makePoint(47.3769, 8.5417);
      const p2 = makePoint(46.948, 7.4474);
      const dist = trackDistanceMeters([p1, p2]);
      expect(dist).toBeGreaterThan(90_000);
      expect(dist).toBeLessThan(105_000);
    });
  });

  describe('trackDurationMs', () => {
    it('returns 0 for fewer than 2 points', () => {
      expect(trackDurationMs([])).toBe(0);
      expect(trackDurationMs([makePoint(0, 0, '2026-09-26T10:00:00.000Z')])).toBe(0);
    });

    it('calculates duration between first and last point', () => {
      const p1 = makePoint(0, 0, '2026-09-26T10:00:00.000Z');
      const p2 = makePoint(0, 0, '2026-09-26T10:15:30.000Z');
      expect(trackDurationMs([p1, p2])).toBe(930_000);
    });
  });

  describe('interpolateTrackPosition', () => {
    it('handles edge cases (empty, progress <= 0, progress >= 1)', () => {
      expect(interpolateTrackPosition([], 0.5)).toBeNull();

      const p1 = makePoint(10, 20, '2026-09-26T10:00:00.000Z');
      const p2 = makePoint(30, 40, '2026-09-26T11:00:00.000Z');

      expect(interpolateTrackPosition([p1, p2], -0.1)).toEqual({ lat: 10, lng: 20 });
      expect(interpolateTrackPosition([p1, p2], 0)).toEqual({ lat: 10, lng: 20 });
      expect(interpolateTrackPosition([p1, p2], 1)).toEqual({ lat: 30, lng: 40 });
      expect(interpolateTrackPosition([p1, p2], 1.5)).toEqual({ lat: 30, lng: 40 });
    });

    it('interpolates intermediate positions linearly in time', () => {
      const p1 = makePoint(10, 20, '2026-09-26T10:00:00.000Z');
      const p2 = makePoint(30, 40, '2026-09-26T11:00:00.000Z');
      const mid = interpolateTrackPosition([p1, p2], 0.5);
      expect(mid?.lat).toBeCloseTo(20, 4);
      expect(mid?.lng).toBeCloseTo(30, 4);
    });
  });

  describe('formatDurationShort & formatDistanceShort', () => {
    it('formats durations in minutes and hours', () => {
      expect(formatDurationShort(45 * 60_000)).toBe('45\u00A0Min.');
      expect(formatDurationShort(120 * 60_000)).toBe('2\u00A0Std. 0\u00A0Min.');
      expect(formatDurationShort(125 * 60_000)).toBe('2\u00A0Std. 5\u00A0Min.');
    });

    it('formats distances in meters and kilometers', () => {
      expect(formatDistanceShort(350)).toBe('350\u00A0m');
      expect(formatDistanceShort(999)).toBe('999\u00A0m');
      expect(formatDistanceShort(1000)).toBe('1.0\u00A0km');
      expect(formatDistanceShort(12_400)).toBe('12.4\u00A0km');
    });
  });

  describe('trackAverageSpeedKmh', () => {
    it('calculates average speed correctly for typical positive values', () => {
      // 10 km in 1 hour -> 10 km/h
      expect(trackAverageSpeedKmh(10_000, 3_600_000)).toBeCloseTo(10, 4);

      // 12.4 km in 1 hour -> 12.4 km/h
      expect(trackAverageSpeedKmh(12_400, 3_600_000)).toBeCloseTo(12.4, 4);

      // 5 km in 30 minutes (1_800_000 ms) -> 10 km/h
      expect(trackAverageSpeedKmh(5_000, 1_800_000)).toBeCloseTo(10, 4);

      // 100 meters in 10 seconds (10_000 ms) -> 36 km/h
      expect(trackAverageSpeedKmh(100, 10_000)).toBeCloseTo(36, 4);
    });

    it('returns null when distance is zero or negative', () => {
      expect(trackAverageSpeedKmh(0, 3_600_000)).toBeNull();
      expect(trackAverageSpeedKmh(-100, 3_600_000)).toBeNull();
    });

    it('returns null when duration is zero or negative', () => {
      expect(trackAverageSpeedKmh(10_000, 0)).toBeNull();
      expect(trackAverageSpeedKmh(10_000, -3_600_000)).toBeNull();
    });

    it('returns null when both distance and duration are zero or negative', () => {
      expect(trackAverageSpeedKmh(0, 0)).toBeNull();
      expect(trackAverageSpeedKmh(-50, -100)).toBeNull();
    });

    it('returns null for NaN or non-finite values', () => {
      expect(trackAverageSpeedKmh(NaN, 3_600_000)).toBeNull();
      expect(trackAverageSpeedKmh(10_000, NaN)).toBeNull();
      expect(trackAverageSpeedKmh(Infinity, 3_600_000)).toBeNull();
      expect(trackAverageSpeedKmh(10_000, Infinity)).toBeNull();
      expect(trackAverageSpeedKmh(-Infinity, 3_600_000)).toBeNull();
      expect(trackAverageSpeedKmh(10_000, -Infinity)).toBeNull();
    });
  });

  describe('formatSpeedShort', () => {
    it('formats positive speed values with one decimal place and non-breaking space', () => {
      expect(formatSpeedShort(12.4)).toBe('12.4\u00A0km/h');
      expect(formatSpeedShort(12)).toBe('12.0\u00A0km/h');
      expect(formatSpeedShort(12.44)).toBe('12.4\u00A0km/h');
      expect(formatSpeedShort(12.46)).toBe('12.5\u00A0km/h');
      expect(formatSpeedShort(0.5)).toBe('0.5\u00A0km/h');
    });

    it('returns empty string for null, undefined or non-positive values', () => {
      expect(formatSpeedShort(null)).toBe('');
      expect(formatSpeedShort(0)).toBe('');
      expect(formatSpeedShort(-5.2)).toBe('');
    });

    it('returns empty string for non-finite values (NaN, Infinity)', () => {
      expect(formatSpeedShort(NaN)).toBe('');
      expect(formatSpeedShort(Infinity)).toBe('');
      expect(formatSpeedShort(-Infinity)).toBe('');
    });

    it('supports an optional custom placeholder if null', () => {
      expect(formatSpeedShort(null, '-')).toBe('-');
      expect(formatSpeedShort(0, '-')).toBe('-');
      expect(formatSpeedShort(12.4, '-')).toBe('12.4\u00A0km/h');
    });
  });

  describe('trackElevation', () => {
    it('returns null for empty, single point, or points without altitude', () => {
      expect(trackElevation([])).toBeNull();
      expect(trackElevation([makePoint(0, 0, undefined, 100)])).toBeNull();
      expect(
        trackElevation([makePoint(0, 0, undefined, null), makePoint(0, 0, undefined, null)])
      ).toBeNull();
      expect(
        trackElevation([
          makePoint(0, 0, undefined, undefined),
          makePoint(0, 0, undefined, undefined),
        ])
      ).toBeNull();
    });

    it('returns null when fewer than 2 valid numeric points exist', () => {
      expect(
        trackElevation([
          makePoint(0, 0, undefined, 100),
          makePoint(0, 0, undefined, null),
          makePoint(0, 0, undefined, undefined),
        ])
      ).toBeNull();

      expect(
        trackElevation([
          makePoint(0, 0, undefined, NaN),
          makePoint(0, 0, undefined, Infinity),
          makePoint(0, 0, undefined, 100),
        ])
      ).toBeNull();
    });

    it('filters out GPS jitter on flat terrain (±1m, ±2m) to 0m climb / 0m descent', () => {
      const flatPoints = [100, 101, 99, 101.5, 98.5, 100, 101, 99.5, 100].map((alt, i) =>
        makePoint(0, i * 0.001, undefined, alt)
      );

      const result = trackElevation(flatPoints);
      expect(result).not.toBeNull();
      expect(result).toEqual({ gain: 0, loss: 0 });
    });

    it('filters out jitter around high altitudes', () => {
      const highFlat = [250, 251, 249, 252, 248.5, 251.2, 250].map((alt, i) =>
        makePoint(0, i * 0.001, undefined, alt)
      );

      const result = trackElevation(highFlat);
      expect(result).toEqual({ gain: 0, loss: 0 });
    });

    it('calculates real climbs exceeding threshold accurately', () => {
      // Monotonic climb from 100m to 120m in 4m steps
      const climbPoints = [100, 104, 108, 112, 116, 120].map((alt, i) =>
        makePoint(0, i * 0.001, undefined, alt)
      );

      expect(trackElevation(climbPoints)).toEqual({ gain: 20, loss: 0 });
    });

    it('calculates real descents exceeding threshold accurately', () => {
      // Monotonic descent from 200m to 180m in 5m steps
      const descentPoints = [200, 195, 190, 185, 180].map((alt, i) =>
        makePoint(0, i * 0.001, undefined, alt)
      );

      expect(trackElevation(descentPoints)).toEqual({ gain: 0, loss: 20 });
    });

    it('correctly tracks climb with small dips below threshold without false descents', () => {
      // Climb from 100 to 120 with minor 1m dips along the way
      const steppedClimb = [100, 105, 104, 110, 109, 115, 114, 120].map((alt, i) =>
        makePoint(0, i * 0.001, undefined, alt)
      );

      expect(trackElevation(steppedClimb)).toEqual({ gain: 20, loss: 0 });
    });

    it('correctly calculates mountain pass with plateau summit (both gain and loss)', () => {
      // Climb from 500 to 600m (+100m), stay at 600m, then descent to 500m (-100m)
      const passPoints = [500, 550, 600, 600, 600, 550, 500].map((alt, i) =>
        makePoint(0, i * 0.001, undefined, alt)
      );

      expect(trackElevation(passPoints)).toEqual({ gain: 100, loss: 100 });
    });

    it('handles mixed points where some points have null or undefined altitude', () => {
      const mixedPoints = [
        makePoint(0, 0, undefined, 100),
        makePoint(0, 0, undefined, null),
        makePoint(0, 0, undefined, 105),
        makePoint(0, 0, undefined, undefined),
        makePoint(0, 0, undefined, 110),
      ];

      expect(trackElevation(mixedPoints)).toEqual({ gain: 10, loss: 0 });
    });

    it('handles negative altitudes (below sea level)', () => {
      const belowSeaPoints = [-50, -45, -40, -35, -30].map((alt, i) =>
        makePoint(0, i * 0.001, undefined, alt)
      );

      expect(trackElevation(belowSeaPoints)).toEqual({ gain: 20, loss: 0 });
    });

    it('supports custom thresholdMeters parameter', () => {
      const points = [makePoint(0, 0, undefined, 100), makePoint(0, 0, undefined, 102)];

      // Default threshold (3m): 2m climb ignored
      expect(trackElevation(points, 3)).toEqual({ gain: 0, loss: 0 });

      // Lower threshold (1m): 2m climb counted
      expect(trackElevation(points, 1)).toEqual({ gain: 2, loss: 0 });
    });
  });

  describe('formatElevationShort', () => {
    it('returns empty string for null, undefined, or missing elevation', () => {
      expect(formatElevationShort(null)).toBe('');
      expect(formatElevationShort(undefined)).toBe('');
    });

    it('formats gain and loss with arrows and non-breaking spaces', () => {
      expect(formatElevationShort({ gain: 340, loss: 120 })).toBe(
        '↗\u00A0340\u00A0m · ↘\u00A0120\u00A0m'
      );
    });

    it('formats zero gain and loss', () => {
      expect(formatElevationShort({ gain: 0, loss: 0 })).toBe('↗\u00A00\u00A0m · ↘\u00A00\u00A0m');
    });

    it('rounds fractional elevation numbers', () => {
      expect(formatElevationShort({ gain: 339.6, loss: 120.4 })).toBe(
        '↗\u00A0340\u00A0m · ↘\u00A0120\u00A0m'
      );
    });
  });
});

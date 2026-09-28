// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import TrackPlayback from './TrackPlayback.vue';
import type { TrackPoint } from '../api/types';
import {
  interpolateTrackPosition,
  trackDistanceMeters,
  trackDurationMs,
  trackAverageSpeedKmh,
  trackElevation,
  formatElevationShort,
} from '../utils/trackGeometry';

describe('TrackPlayback & Geometry Adversarial Stress Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  const basePoints: TrackPoint[] = [
    {
      id: 1,
      track_id: 1,
      lat: 47.0501,
      lng: 8.3093,
      recorded_at: '2026-09-26T10:00:00.000Z',
      accuracy: 5,
      altitude: 400,
    },
    {
      id: 2,
      track_id: 1,
      lat: 47.052,
      lng: 8.3115,
      recorded_at: '2026-09-26T10:07:30.000Z',
      accuracy: 5,
      altitude: 430,
    },
    {
      id: 3,
      track_id: 1,
      lat: 47.0545,
      lng: 8.3142,
      recorded_at: '2026-09-26T10:15:00.000Z',
      accuracy: 5,
      altitude: 460,
    },
    {
      id: 4,
      track_id: 1,
      lat: 47.0565,
      lng: 8.317,
      recorded_at: '2026-09-26T10:22:30.000Z',
      accuracy: 5,
      altitude: 430,
    },
    {
      id: 5,
      track_id: 1,
      lat: 47.0589,
      lng: 8.3198,
      recorded_at: '2026-09-26T10:30:00.000Z',
      accuracy: 5,
      altitude: 400,
    },
  ];

  function mountPlayback(
    options: {
      points?: TrackPoint[];
      progress?: number;
      title?: string | null;
      onUpdateProgress?: (val: number) => void;
      onClose?: () => void;
    } = {}
  ) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const progressRef = ref(options.progress ?? 0);
    const onUpdate =
      options.onUpdateProgress ||
      ((val: number) => {
        progressRef.value = val;
      });

    const app = createApp({
      render: () =>
        h(TrackPlayback, {
          title: options.title,
          points: options.points ?? basePoints,
          progress: progressRef.value,
          'onUpdate:progress': onUpdate,
          onClose: options.onClose,
        }),
    });

    app.mount(container);

    return {
      container,
      progressRef,
      cleanUp: () => {
        app.unmount();
        container.remove();
      },
    };
  }

  // =========================================================================
  // 1. Playback Scrubber Synchronization & Coordinate Interpolation Stress
  // =========================================================================
  describe('Scrubber synchronization & coordinate interpolation', () => {
    it('accurately sweeps 1001 steps from 0.000 to 1.000 without NaN, undefined, or coordinate drift', () => {
      // 50 irregular GPS pings over 2 hours
      const irregularPoints: TrackPoint[] = [];
      const startTime = new Date('2026-09-26T08:00:00.000Z').getTime();
      for (let i = 0; i < 50; i++) {
        // non-uniform time delta between 30s and 300s
        const tOffset = i * 140_000 + (i % 3) * 20_000;
        irregularPoints.push({
          id: i + 1,
          track_id: 99,
          lat: 46.5 + (i / 50) * 0.5 + Math.sin(i / 5) * 0.01,
          lng: 8.0 + (i / 50) * 0.4 + Math.cos(i / 5) * 0.01,
          recorded_at: new Date(startTime + tOffset).toISOString(),
          accuracy: 5,
          altitude: 500 + i * 15,
        });
      }

      for (let step = 0; step <= 1000; step++) {
        const progress = step / 1000;
        const pos = interpolateTrackPosition(irregularPoints, progress);

        expect(pos).not.toBeNull();
        expect(Number.isFinite(pos!.lat)).toBe(true);
        expect(Number.isFinite(pos!.lng)).toBe(true);
        expect(Number.isNaN(pos!.lat)).toBe(false);
        expect(Number.isNaN(pos!.lng)).toBe(false);

        // Coordinates must stay within overall bounding box (+ margin for sin/cos)
        expect(pos!.lat).toBeGreaterThanOrEqual(46.4);
        expect(pos!.lat).toBeLessThanOrEqual(47.1);
        expect(pos!.lng).toBeGreaterThanOrEqual(7.9);
        expect(pos!.lng).toBeLessThanOrEqual(8.5);

        // Boundary equality
        if (progress === 0) {
          expect(pos!.lat).toBeCloseTo(irregularPoints[0].lat, 8);
          expect(pos!.lng).toBeCloseTo(irregularPoints[0].lng, 8);
        }
        if (progress === 1) {
          expect(pos!.lat).toBeCloseTo(irregularPoints[irregularPoints.length - 1].lat, 8);
          expect(pos!.lng).toBeCloseTo(irregularPoints[irregularPoints.length - 1].lng, 8);
        }
      }
    });

    it('handles out-of-bounds, NaN, and extreme progress values safely', () => {
      // Progress < 0 must clamp to points[0]
      const neg = interpolateTrackPosition(basePoints, -0.5);
      expect(neg).toEqual({ lat: basePoints[0].lat, lng: basePoints[0].lng });

      const wayNeg = interpolateTrackPosition(basePoints, -999999);
      expect(wayNeg).toEqual({ lat: basePoints[0].lat, lng: basePoints[0].lng });

      // Progress > 1 must clamp to points[last]
      const posAbove = interpolateTrackPosition(basePoints, 1.5);
      const lastPoint = basePoints[basePoints.length - 1];
      expect(posAbove).toEqual({ lat: lastPoint.lat, lng: lastPoint.lng });

      const wayAbove = interpolateTrackPosition(basePoints, 999999);
      expect(wayAbove).toEqual({ lat: lastPoint.lat, lng: lastPoint.lng });

      // NaN progress must not crash and return last point safely
      const nanPos = interpolateTrackPosition(basePoints, NaN);
      expect(nanPos).toEqual({ lat: lastPoint.lat, lng: lastPoint.lng });
    });

    it('handles degenerate track with identical timestamps without division by zero', () => {
      const sameTimePoints: TrackPoint[] = [
        {
          id: 1,
          track_id: 2,
          lat: 47.1,
          lng: 8.1,
          recorded_at: '2026-09-26T12:00:00.000Z',
          accuracy: 5,
        },
        {
          id: 2,
          track_id: 2,
          lat: 47.2,
          lng: 8.2,
          recorded_at: '2026-09-26T12:00:00.000Z',
          accuracy: 5,
        },
      ];

      const res0 = interpolateTrackPosition(sameTimePoints, 0);
      expect(res0).toEqual({ lat: 47.1, lng: 8.1 });

      const resHalf = interpolateTrackPosition(sameTimePoints, 0.5);
      expect(resHalf).not.toBeNull();
      expect(Number.isFinite(resHalf!.lat)).toBe(true);

      const res1 = interpolateTrackPosition(sameTimePoints, 1);
      expect(res1).toEqual({ lat: 47.2, lng: 8.2 });
    });

    it('handles single point track safely for all progress values', () => {
      const singlePoint: TrackPoint[] = [
        {
          id: 1,
          track_id: 3,
          lat: 47.5,
          lng: 8.5,
          recorded_at: '2026-09-26T12:00:00.000Z',
          accuracy: 5,
        },
      ];

      expect(interpolateTrackPosition(singlePoint, 0)).toEqual({ lat: 47.5, lng: 8.5 });
      expect(interpolateTrackPosition(singlePoint, 0.5)).toEqual({ lat: 47.5, lng: 8.5 });
      expect(interpolateTrackPosition(singlePoint, 1)).toEqual({ lat: 47.5, lng: 8.5 });
      expect(interpolateTrackPosition(singlePoint, -1)).toEqual({ lat: 47.5, lng: 8.5 });
      expect(interpolateTrackPosition(singlePoint, 2)).toEqual({ lat: 47.5, lng: 8.5 });
    });

    it('returns null for empty track array', () => {
      expect(interpolateTrackPosition([], 0)).toBeNull();
      expect(interpolateTrackPosition([], 0.5)).toBeNull();
      expect(interpolateTrackPosition([], 1)).toBeNull();
    });
  });

  // =========================================================================
  // 2. Speed Multipliers & Animation Ticks Stress
  // =========================================================================
  describe('Speed multipliers & tick timing', () => {
    it('advances tick correctly across 1x, 2x, 5x, 10x speeds', async () => {
      let rafCallback: FrameRequestCallback | null = null;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb;
        return 123;
      });
      vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
        rafCallback = null;
      });

      const emittedUpdates: number[] = [];
      const { container, cleanUp } = mountPlayback({
        points: basePoints,
        progress: 0,
        onUpdateProgress: (val) => emittedUpdates.push(val),
      });
      await nextTick();

      const playBtn = container.querySelector<HTMLButtonElement>('.playback-btn')!;
      const speedBtns = container.querySelectorAll<HTMLButtonElement>('.speed-btn');

      // 1x speed: BASE_PLAYBACK_MS = 10,000ms. After dt = 1000ms, progress += 1000*1/10000 = 0.1
      vi.spyOn(performance, 'now').mockReturnValue(1000);
      playBtn.click();
      await nextTick();
      expect(rafCallback).toBeTruthy();

      // Trigger 1 tick after 1000ms
      rafCallback!(2000);
      await nextTick();
      expect(emittedUpdates[emittedUpdates.length - 1]).toBeCloseTo(0.1, 4);

      // Change speed to 2x: click 2x button
      speedBtns[1].click(); // '2x'
      await nextTick();

      // Trigger 1 tick after another 1000ms: delta = 1000 * 2 / 10000 = 0.2 -> progress = 0.3
      rafCallback!(3000);
      await nextTick();
      expect(emittedUpdates[emittedUpdates.length - 1]).toBeCloseTo(0.3, 4);

      // Change speed to 5x: click 5x button
      speedBtns[2].click(); // '5x'
      await nextTick();

      // Trigger 1 tick after 1000ms: delta = 1000 * 5 / 10000 = 0.5 -> progress = 0.8
      rafCallback!(4000);
      await nextTick();
      expect(emittedUpdates[emittedUpdates.length - 1]).toBeCloseTo(0.8, 4);

      // Change speed to 10x: click 10x button
      speedBtns[3].click(); // '10x'
      await nextTick();

      // Trigger 1 tick after 500ms: delta = 500 * 10 / 10000 = 0.5 -> progress = min(1, 0.8 + 0.5) = 1.0
      rafCallback!(4500);
      await nextTick();
      expect(emittedUpdates[emittedUpdates.length - 1]).toBe(1);

      // Should automatically stop at 1.0
      expect(playBtn.getAttribute('title')).toBe('Abspielen');

      cleanUp();
    });

    it('restarts smoothly from beginning when play is clicked at progress = 1', async () => {
      let rafCallback: FrameRequestCallback | null = null;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb;
        return 456;
      });

      const emittedUpdates: number[] = [];
      const { container, cleanUp } = mountPlayback({
        points: basePoints,
        progress: 1.0,
        onUpdateProgress: (val) => emittedUpdates.push(val),
      });
      await nextTick();

      const playBtn = container.querySelector<HTMLButtonElement>('.playback-btn')!;
      vi.spyOn(performance, 'now').mockReturnValue(5000);

      // Click play at progress = 1
      playBtn.click();
      await nextTick();

      // First emitted update should reset progress to 0
      expect(emittedUpdates[0]).toBe(0);

      // Tick advances from 0
      rafCallback!(5500); // dt = 500ms -> delta = 500 * 1 / 10000 = 0.05
      await nextTick();
      expect(emittedUpdates[emittedUpdates.length - 1]).toBeCloseTo(0.05, 4);

      cleanUp();
    });

    it('tolerates backward clock or 0ms frame intervals without NaN or regression', async () => {
      let rafCallback: FrameRequestCallback | null = null;
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
        rafCallback = cb;
        return 789;
      });

      const emittedUpdates: number[] = [];
      const { container, cleanUp } = mountPlayback({
        points: basePoints,
        progress: 0.2,
        onUpdateProgress: (val) => emittedUpdates.push(val),
      });
      await nextTick();

      vi.spyOn(performance, 'now').mockReturnValue(10000);
      container.querySelector<HTMLButtonElement>('.playback-btn')!.click();
      await nextTick();

      // Tick with backward time (e.g. clock sync jitter)
      rafCallback!(9000); // now < lastTickTime
      await nextTick();

      // dt = Math.max(0, 9000 - 10000) = 0 -> progress does not regress
      const last = emittedUpdates[emittedUpdates.length - 1];
      expect(last).toBeGreaterThanOrEqual(0.2);
      expect(Number.isNaN(last)).toBe(false);

      cleanUp();
    });
  });

  // =========================================================================
  // 3. Empty Points, Corrupt Altitude & Extreme Geometry Stress
  // =========================================================================
  describe('Empty points, corrupt altitude & edge cases', () => {
    it('completely disables controls when points array is empty or has 1 point', async () => {
      // Empty points
      const { container: emptyContainer, cleanUp: cleanEmpty } = mountPlayback({ points: [] });
      await nextTick();

      const emptyPlayBtn = emptyContainer.querySelector<HTMLButtonElement>('.playback-btn')!;
      const emptySlider = emptyContainer.querySelector<HTMLInputElement>('.playback-slider')!;
      expect(emptyPlayBtn.disabled).toBe(true);
      expect(emptySlider.disabled).toBe(true);
      expect(emptyContainer.innerHTML).not.toContain('NaN');
      expect(emptyContainer.innerHTML).not.toContain('undefined');
      expect(emptyContainer.querySelector('.track-playback-range')).toBeNull();
      cleanEmpty();

      // 1 point
      const { container: singleContainer, cleanUp: cleanSingle } = mountPlayback({
        points: [basePoints[0]],
      });
      await nextTick();

      const singlePlayBtn = singleContainer.querySelector<HTMLButtonElement>('.playback-btn')!;
      const singleSlider = singleContainer.querySelector<HTMLInputElement>('.playback-slider')!;
      expect(singlePlayBtn.disabled).toBe(true);
      expect(singleSlider.disabled).toBe(true);
      expect(singleContainer.innerHTML).not.toContain('NaN');
      expect(singleContainer.querySelector('.track-playback-range')).toBeNull();
      cleanSingle();
    });

    it('safely filters invalid and extreme altitude values without crashing or producing NaN', async () => {
      const corruptAltPoints: TrackPoint[] = [
        {
          id: 1,
          track_id: 1,
          lat: 47.0,
          lng: 8.0,
          recorded_at: '2026-09-26T10:00:00.000Z',
          accuracy: 5,
          altitude: null,
        },
        {
          id: 2,
          track_id: 1,
          lat: 47.01,
          lng: 8.01,
          recorded_at: '2026-09-26T10:05:00.000Z',
          accuracy: null,
          altitude: undefined,
        },
        {
          id: 3,
          track_id: 1,
          lat: 47.02,
          lng: 8.02,
          recorded_at: '2026-09-26T10:10:00.000Z',
          accuracy: 5,
          altitude: NaN,
        },
        {
          id: 4,
          track_id: 1,
          lat: 47.03,
          lng: 8.03,
          recorded_at: '2026-09-26T10:15:00.000Z',
          accuracy: 5,
          altitude: Infinity,
        },
        {
          id: 5,
          track_id: 1,
          lat: 47.04,
          lng: 8.04,
          recorded_at: '2026-09-26T10:20:00.000Z',
          accuracy: 5,
          altitude: 400,
        },
        {
          id: 6,
          track_id: 1,
          lat: 47.05,
          lng: 8.05,
          recorded_at: '2026-09-26T10:25:00.000Z',
          accuracy: 5,
          altitude: 450,
        },
      ];

      // Only 2 valid altitudes (400, 450), gain = 50, loss = 0
      const elev = trackElevation(corruptAltPoints);
      expect(elev).not.toBeNull();
      expect(elev!.gain).toBe(50);
      expect(elev!.loss).toBe(0);

      const { container, cleanUp } = mountPlayback({ points: corruptAltPoints });
      await nextTick();

      const elevChip = container.querySelector('[data-testid="metric-elevation"]');
      expect(elevChip).toBeTruthy();
      expect(elevChip?.textContent).toContain('50');
      expect(container.innerHTML).not.toContain('NaN');

      cleanUp();
    });

    it('handles negative altitude (Dead Sea / below sea level) correctly', () => {
      const belowSeaLevel: TrackPoint[] = [
        {
          id: 1,
          track_id: 1,
          lat: 31.5,
          lng: 35.4,
          recorded_at: '2026-09-26T10:00:00.000Z',
          accuracy: 5,
          altitude: -430,
        },
        {
          id: 2,
          track_id: 1,
          lat: 31.51,
          lng: 35.41,
          recorded_at: '2026-09-26T10:10:00.000Z',
          accuracy: 5,
          altitude: -410,
        },
        {
          id: 3,
          track_id: 1,
          lat: 31.52,
          lng: 35.42,
          recorded_at: '2026-09-26T10:20:00.000Z',
          accuracy: 5,
          altitude: -400,
        },
      ];

      const elev = trackElevation(belowSeaLevel);
      expect(elev).not.toBeNull();
      expect(elev!.gain).toBe(30);
      expect(elev!.loss).toBe(0);
      expect(formatElevationShort(elev)).toContain('↗\u00A030\u00A0m');
    });

    it('formats multi-hour track duration correctly (hh:mm:ss) without layout corruption', async () => {
      const longPoints: TrackPoint[] = [
        {
          id: 1,
          track_id: 1,
          lat: 47.0,
          lng: 8.0,
          recorded_at: '2026-09-26T06:00:00.000Z',
          accuracy: 5,
        },
        {
          id: 2,
          track_id: 1,
          lat: 47.5,
          lng: 8.5,
          recorded_at: '2026-09-26T18:30:15.000Z', // 12h 30m 15s
          accuracy: 5,
        },
      ];

      const { container, cleanUp } = mountPlayback({ points: longPoints, progress: 0.5 });
      await nextTick();

      const timeLabel = container.querySelector('.playback-time')?.textContent || '';
      // At progress 0.5 of 12:30:15 -> 6:15:07 / 12:30:15
      expect(timeLabel).toMatch(/\d+:\d{2}:\d{2}\s*\/\s*\d+:\d{2}:\d{2}/);
      expect(container.innerHTML).not.toContain('NaN');

      cleanUp();
    });

    it('handles stationary track with 0 distance and 0 speed gracefully', async () => {
      const stationaryPoints: TrackPoint[] = [
        {
          id: 1,
          track_id: 1,
          lat: 47.0,
          lng: 8.0,
          recorded_at: '2026-09-26T10:00:00.000Z',
          accuracy: 5,
          altitude: 500,
        },
        {
          id: 2,
          track_id: 1,
          lat: 47.0,
          lng: 8.0,
          recorded_at: '2026-09-26T10:10:00.000Z',
          accuracy: 5,
          altitude: 500,
        },
      ];

      const dist = trackDistanceMeters(stationaryPoints);
      expect(dist).toBe(0);
      const dur = trackDurationMs(stationaryPoints);
      expect(dur).toBe(600_000);
      const speed = trackAverageSpeedKmh(dist, dur);
      expect(speed).toBeNull();

      const { container, cleanUp } = mountPlayback({ points: stationaryPoints });
      await nextTick();

      // Speed chip should be hidden when speed is null / 0
      const speedChip = container.querySelector('[data-testid="metric-speed"]');
      expect(speedChip).toBeNull();

      // Elevation chip should be hidden when gain=0 & loss=0
      const elevChip = container.querySelector('[data-testid="metric-elevation"]');
      expect(elevChip).toBeNull();

      expect(container.innerHTML).not.toContain('NaN');
      expect(container.innerHTML).not.toContain('Infinity');

      cleanUp();
    });
  });

  // =========================================================================
  // 4. Performance Stress with Large Dataset (5,000 points)
  // =========================================================================
  describe('Performance with large track datasets', () => {
    it('processes 5,000 points in under 100ms for distance, duration, elevation, speed and interpolation', () => {
      const largePoints: TrackPoint[] = [];
      const startTime = new Date('2026-09-26T00:00:00.000Z').getTime();

      for (let i = 0; i < 5000; i++) {
        largePoints.push({
          id: i + 1,
          track_id: 100,
          lat: 46.0 + (i / 5000) * 1.0,
          lng: 8.0 + (i / 5000) * 1.0,
          recorded_at: new Date(startTime + i * 1000).toISOString(),
          accuracy: 5,
          altitude: 400 + Math.sin(i / 10) * 50,
        });
      }

      const t0 = performance.now();
      const dist = trackDistanceMeters(largePoints);
      const dur = trackDurationMs(largePoints);
      const elev = trackElevation(largePoints);
      const spd = trackAverageSpeedKmh(dist, dur);
      const pos = interpolateTrackPosition(largePoints, 0.732);
      const t1 = performance.now();

      expect(dist).toBeGreaterThan(0);
      expect(dur).toBe(4999 * 1000);
      expect(elev).not.toBeNull();
      expect(spd).not.toBeNull();
      expect(pos).not.toBeNull();
      expect(t1 - t0).toBeLessThan(100); // Must be fast and non-blocking
    });
  });
});

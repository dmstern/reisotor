import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useLandingRobot } from './useLandingRobot';

describe('useLandingRobot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default phase "pack"', () => {
    const { robotPhase } = useLandingRobot();
    expect(robotPhase.value).toBe('pack');
  });

  it('initializes with custom initialPhase', () => {
    const { robotPhase } = useLandingRobot({ initialPhase: 'idle' });
    expect(robotPhase.value).toBe('idle');
  });

  it('transitions from "pack" to "idle" on onPackingDone', () => {
    const { robotPhase, onPackingDone } = useLandingRobot();
    expect(robotPhase.value).toBe('pack');
    onPackingDone();
    expect(robotPhase.value).toBe('idle');
  });

  it('transitions from "idle" to "pack" on startPacking', () => {
    const { robotPhase, onPackingDone, startPacking } = useLandingRobot();
    onPackingDone();
    expect(robotPhase.value).toBe('idle');
    startPacking();
    expect(robotPhase.value).toBe('pack');
  });

  it('periodically triggers packing when idle', () => {
    const { robotPhase, onPackingDone, startInterval } = useLandingRobot({
      intervalMs: 10000,
    });
    onPackingDone();
    expect(robotPhase.value).toBe('idle');

    startInterval();
    vi.advanceTimersByTime(9999);
    expect(robotPhase.value).toBe('idle');

    vi.advanceTimersByTime(1);
    expect(robotPhase.value).toBe('pack');
  });

  it('does not interrupt if already packing', () => {
    const { robotPhase, startInterval } = useLandingRobot({ intervalMs: 10000 });
    expect(robotPhase.value).toBe('pack');

    startInterval();
    vi.advanceTimersByTime(10000);
    expect(robotPhase.value).toBe('pack');
  });

  it('stops recurring packing when stopInterval is called', () => {
    const { robotPhase, onPackingDone, startInterval, stopInterval } = useLandingRobot({
      intervalMs: 10000,
    });
    onPackingDone();
    startInterval();
    stopInterval();

    vi.advanceTimersByTime(20000);
    expect(robotPhase.value).toBe('idle');
  });
});

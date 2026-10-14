// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, effectScope, nextTick } from 'vue';
import { useRobotEyeTracking } from './useRobotEyeTracking';

describe('useRobotEyeTracking', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
    vi.restoreAllMocks();
  });

  it('initializes with offset { x: 0, y: 0 }', () => {
    const { pupilOffset } = useRobotEyeTracking();
    expect(pupilOffset.value).toEqual({ x: 0, y: 0 });
  });

  it('does not update offset on mousemove if interactive is false', () => {
    const { pupilOffset, onMouseMove } = useRobotEyeTracking({ interactive: false });

    onMouseMove({ clientX: 800, clientY: 600 } as MouseEvent);
    expect(pupilOffset.value).toEqual({ x: 0, y: 0 });
  });

  it('does not update offset if coveringEyes is true', () => {
    const { pupilOffset, onMouseMove } = useRobotEyeTracking({
      interactive: true,
      coveringEyes: true,
    });

    onMouseMove({ clientX: 800, clientY: 600 } as MouseEvent);
    expect(pupilOffset.value).toEqual({ x: 0, y: 0 });
  });

  it('does not update offset if phase is scanning or done', () => {
    const { pupilOffset: offsetScan, onMouseMove: onMoveScan } = useRobotEyeTracking({
      interactive: true,
      phase: 'scanning',
    });
    onMoveScan({ clientX: 800, clientY: 600 } as MouseEvent);
    expect(offsetScan.value).toEqual({ x: 0, y: 0 });

    const { pupilOffset: offsetDone, onMouseMove: onMoveDone } = useRobotEyeTracking({
      interactive: true,
      phase: 'done',
    });
    onMoveDone({ clientX: 800, clientY: 600 } as MouseEvent);
    expect(offsetDone.value).toEqual({ x: 0, y: 0 });
  });

  it('calculates center offset as (0, 0) when mouse is at screen center', () => {
    const { pupilOffset, onMouseMove } = useRobotEyeTracking({ interactive: true });

    onMouseMove({ clientX: 500, clientY: 400 } as MouseEvent);
    expect(pupilOffset.value).toEqual({ x: 0, y: 0 });
  });

  it('calculates correct offset towards screen borders', () => {
    const { pupilOffset, onMouseMove } = useRobotEyeTracking({
      interactive: true,
      maxShift: 130,
    });

    // clientX = 1000 -> rx = 1.0, clientY = 400 -> ry = 0.0
    onMouseMove({ clientX: 1000, clientY: 400 } as MouseEvent);
    expect(pupilOffset.value.x).toBeCloseTo(130);
    expect(pupilOffset.value.y).toBeCloseTo(0);

    // clientX = 500 -> rx = 0.0, clientY = 0 -> ry = -1.0
    onMouseMove({ clientX: 500, clientY: 0 } as MouseEvent);
    expect(pupilOffset.value.x).toBeCloseTo(0);
    expect(pupilOffset.value.y).toBeCloseTo(-130);
  });

  it('caps diagonal vector length in corners so pupil does not exceed maxShift radius', () => {
    const { pupilOffset, onMouseMove } = useRobotEyeTracking({
      interactive: true,
      maxShift: 130,
    });

    // Corner: clientX = 1000 (rx = 1), clientY = 800 (ry = 1) -> dist = sqrt(2) ~ 1.4142
    onMouseMove({ clientX: 1000, clientY: 800 } as MouseEvent);

    const length = Math.sqrt(
      pupilOffset.value.x * pupilOffset.value.x + pupilOffset.value.y * pupilOffset.value.y
    );
    expect(length).toBeCloseTo(130, 4);
    expect(pupilOffset.value.x).toBeCloseTo(130 / Math.SQRT2, 4);
    expect(pupilOffset.value.y).toBeCloseTo(130 / Math.SQRT2, 4);
  });

  it('resets pupil offset when resetPupilOffset is called', () => {
    const { pupilOffset, onMouseMove, resetPupilOffset } = useRobotEyeTracking({
      interactive: true,
    });

    onMouseMove({ clientX: 900, clientY: 400 } as MouseEvent);
    expect(pupilOffset.value.x).toBeGreaterThan(0);

    resetPupilOffset();
    expect(pupilOffset.value).toEqual({ x: 0, y: 0 });
  });

  it('automatically resets pupil offset via reactive watcher when state changes to disabled', async () => {
    const scope = effectScope();
    const interactive = ref(true);
    const coveringEyes = ref(false);
    const phase = ref<'idle' | 'scanning' | 'done'>('idle');

    let tracking!: ReturnType<typeof useRobotEyeTracking>;

    scope.run(() => {
      tracking = useRobotEyeTracking({
        interactive,
        coveringEyes,
        phase,
      });
    });

    tracking.onMouseMove({ clientX: 1000, clientY: 400 } as MouseEvent);
    expect(tracking.pupilOffset.value.x).toBeGreaterThan(0);

    // Set coveringEyes to true -> should reset
    coveringEyes.value = true;
    await nextTick();
    expect(tracking.pupilOffset.value).toEqual({ x: 0, y: 0 });

    // Enable again, move mouse, then switch phase to scanning
    coveringEyes.value = false;
    await nextTick();
    tracking.onMouseMove({ clientX: 1000, clientY: 400 } as MouseEvent);
    expect(tracking.pupilOffset.value.x).toBeGreaterThan(0);

    phase.value = 'scanning';
    await nextTick();
    expect(tracking.pupilOffset.value).toEqual({ x: 0, y: 0 });

    scope.stop();
  });
});

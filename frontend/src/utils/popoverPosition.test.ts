import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computePopoverPosition } from './popoverPosition';

describe('computePopoverPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 768,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('positions below trigger when ample space is available', () => {
    const rect = {
      left: 100,
      right: 200,
      top: 200,
      bottom: 240,
      width: 100,
      height: 40,
    };

    const result = computePopoverPosition(rect, { menuWidth: 200, menuHeight: 100, offset: 6 });
    expect(result).toEqual({
      top: '246px', // 240 + 6
      left: '100px',
    });
  });

  it('flips above trigger when not enough space below but ample space above', () => {
    const rect = {
      left: 100,
      right: 200,
      top: 680,
      bottom: 720,
      width: 100,
      height: 40,
    };

    // Viewport height: 768.
    // spaceBelow: 768 - 720 - 6 - 8 = 34px < 100px.
    // spaceAbove: 680 - 6 - 8 = 666px > 34px.
    const result = computePopoverPosition(rect, { menuWidth: 200, menuHeight: 100, offset: 6 });
    expect(result).toEqual({
      top: '574px', // 680 - 6 - 100
      left: '100px',
    });
  });

  it('clamps to viewport right edge with padding', () => {
    const rect = {
      left: 950,
      right: 1010,
      top: 200,
      bottom: 240,
      width: 60,
      height: 40,
    };

    // Viewport width: 1024, menuWidth: 200, padding: 8
    // max allowed left: 1024 - 200 - 8 = 816
    const result = computePopoverPosition(rect, { menuWidth: 200, menuHeight: 100 });
    expect(result.left).toBe('816px');
  });

  it('clamps to viewport left edge with padding', () => {
    const rect = {
      left: -20,
      right: 40,
      top: 200,
      bottom: 240,
      width: 60,
      height: 40,
    };

    const result = computePopoverPosition(rect, {
      menuWidth: 200,
      menuHeight: 100,
      viewportPadding: 8,
    });
    expect(result.left).toBe('8px');
  });

  it('clamps vertical position if neither above nor below fits completely', () => {
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 200,
    });
    const rect = {
      left: 100,
      right: 200,
      top: 10,
      bottom: 40,
      width: 100,
      height: 30,
    };

    const result = computePopoverPosition(rect, {
      menuWidth: 200,
      menuHeight: 150,
      viewportPadding: 8,
    });
    // Viewport height: 200, menuHeight: 150, padding: 8
    // max top: 200 - 150 - 8 = 42px
    expect(result.top).toBe('42px');
  });

  it('allows overriding viewport via options', () => {
    const rect = {
      left: 50,
      top: 350,
      bottom: 390,
    };

    const result = computePopoverPosition(rect, {
      viewport: { width: 500, height: 400 },
      menuWidth: 150,
      menuHeight: 100,
      offset: 5,
    });

    // Viewport height: 400. Bottom space: 400 - 390 - 5 - 8 = -3. Top space: 350 - 5 - 8 = 337.
    // Flips above: 350 - 5 - 100 = 245
    expect(result.top).toBe('245px');
    expect(result.left).toBe('50px');
  });
});

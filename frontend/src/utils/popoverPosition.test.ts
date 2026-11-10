import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computePopoverPosition, observePopoverPosition } from './popoverPosition';

describe('computePopoverPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      innerWidth: 1024,
      innerHeight: 768,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
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
      maxHeight: '752px', // 768 - 16
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
    // spaceAbove: 680 - 6 - 8 = 666px >= 100px.
    const result = computePopoverPosition(rect, { menuWidth: 200, menuHeight: 100, offset: 6 });
    expect(result).toEqual({
      top: '574px', // 680 - 6 - 100
      left: '100px',
      maxHeight: '752px',
    });
  });

  it('shifts tall menu upwards so bottom edge stays inside viewport when neither side fits completely', () => {
    const rect = {
      left: 100,
      right: 200,
      top: 260,
      bottom: 300,
      width: 100,
      height: 40,
    };

    // Viewport height: 768, menuHeight: 600, padding: 8
    // Starts at 300 + 6 = 306, clamped to 768 - 600 - 8 = 160px
    const result = computePopoverPosition(rect, { menuWidth: 240, menuHeight: 600, offset: 6 });
    expect(result.top).toBe('160px');
    expect(result.maxHeight).toBe('752px');
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

  it('aligns to right edge of trigger when align is right', () => {
    const rect = {
      left: 500,
      right: 540,
      top: 200,
      bottom: 240,
      width: 40,
      height: 40,
    };

    // menuWidth: 200. rect.right: 540. Target left = 540 - 200 = 340.
    const result = computePopoverPosition(rect, {
      menuWidth: 200,
      menuHeight: 100,
      align: 'right',
    });
    expect(result.left).toBe('340px');
  });

  it('clamps right-aligned popover to left viewport padding if it exceeds left edge', () => {
    const rect = {
      left: 20,
      right: 60,
      top: 200,
      bottom: 240,
      width: 40,
      height: 40,
    };

    // menuWidth: 200. rect.right: 60. Target left = 60 - 200 = -140 -> clamped to padding 8
    const result = computePopoverPosition(rect, {
      menuWidth: 200,
      menuHeight: 100,
      align: 'right',
      viewportPadding: 8,
    });
    expect(result.left).toBe('8px');
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
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
    expect(result.maxHeight).toBe('384px');
  });

  it('observes menu dimensions and updates coordinates dynamically', () => {
    const triggerEl = {
      getBoundingClientRect: () => ({
        left: 200,
        right: 240,
        top: 300,
        bottom: 340,
        width: 40,
        height: 40,
      }),
    } as unknown as HTMLElement;

    let currentMenuHeight = 200;
    const menuEl = {
      getBoundingClientRect: () => ({
        left: 0,
        right: 240,
        top: 0,
        bottom: currentMenuHeight,
        width: 240,
        height: currentMenuHeight,
      }),
    } as unknown as HTMLElement;

    let resizeCallback: (() => void) | null = null;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
      }
    );

    const updates: Array<{ top: string; left: string; maxHeight: string }> = [];
    const cleanup = observePopoverPosition({
      getTrigger: () => triggerEl,
      getMenu: () => menuEl,
      align: 'right',
      offset: 6,
      onUpdate: (coords) => updates.push(coords),
    });

    expect(updates).toHaveLength(1);
    expect(updates[0].top).toBe('346px'); // 340 + 6 (fits below in 768px viewport)

    // Menu grows to 550px (e.g. sections expanded) -> overflows bottom at 346 + 550 = 896 > 760
    currentMenuHeight = 550;
    resizeCallback!();

    expect(updates).toHaveLength(2);
    expect(updates[1].top).toBe('210px'); // Clamped to 768 - 550 - 8 = 210px

    cleanup();
  });
});

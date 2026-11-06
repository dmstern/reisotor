import { describe, it, expect } from 'vitest';
import { BREAKPOINTS, BREAKPOINTS_PX, MEDIA_QUERIES } from './breakpoints';

describe('breakpoints token constants', () => {
  it('defines all required breakpoint tokens with ascending order', () => {
    expect(BREAKPOINTS.mobileCompact).toBe(360);
    expect(BREAKPOINTS.mobileSm).toBe(420);
    expect(BREAKPOINTS.mobile).toBe(480);
    expect(BREAKPOINTS.tabletSm).toBe(600);
    expect(BREAKPOINTS.tablet).toBe(700);
    expect(BREAKPOINTS.desktopSm).toBe(800);
    expect(BREAKPOINTS.desktopMd).toBe(900);
    expect(BREAKPOINTS.desktop).toBe(1024);
    expect(BREAKPOINTS.pageMax).toBe(1400);
    expect(BREAKPOINTS.wqhd).toBe(2200);
    expect(BREAKPOINTS.ultraWide).toBe(3200);

    const values = Object.values(BREAKPOINTS);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('matches pixel formatted strings in BREAKPOINTS_PX', () => {
    for (const [key, val] of Object.entries(BREAKPOINTS)) {
      expect(BREAKPOINTS_PX[key as keyof typeof BREAKPOINTS_PX]).toBe(`${val}px`);
    }
  });

  it('provides media query strings matching token values', () => {
    expect(MEDIA_QUERIES.mobile).toBe(`(max-width: ${BREAKPOINTS.mobile}px)`);
    expect(MEDIA_QUERIES.desktop).toBe(`(min-width: ${BREAKPOINTS.desktop}px)`);
  });
});

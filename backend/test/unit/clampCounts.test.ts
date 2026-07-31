import { describe, expect, it } from 'vitest';
import { clampCounts } from '../../src/routes/packing.js';

describe('clampCounts', () => {
  it('defaults quantity to 1 when undefined', () => {
    expect(clampCounts(undefined, undefined, undefined)).toEqual({ quantity: 1, laidOut: 0, packed: 0 });
  });

  it('clamps quantity to a minimum of 1 for zero/negative input', () => {
    expect(clampCounts(0, undefined, undefined).quantity).toBe(1);
    expect(clampCounts(-5, undefined, undefined).quantity).toBe(1);
  });

  it('rounds fractional quantity to the nearest integer', () => {
    expect(clampCounts(2.6, undefined, undefined).quantity).toBe(3);
  });

  it('clamps packed down to quantity when it exceeds it', () => {
    expect(clampCounts(2, undefined, 5).packed).toBe(2);
  });

  it('clamps negative packed up to 0', () => {
    expect(clampCounts(2, undefined, -3).packed).toBe(0);
  });

  it('raises laidOut to at least packed (packed implies laid out)', () => {
    const result = clampCounts(5, 1, 3);
    expect(result.laidOut).toBe(3);
    expect(result.laidOut).toBeGreaterThanOrEqual(result.packed);
  });

  it('clamps laidOut down to quantity when it exceeds it', () => {
    expect(clampCounts(2, 10, 1).laidOut).toBe(2);
  });
});

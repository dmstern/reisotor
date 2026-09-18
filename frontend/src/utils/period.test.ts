import { describe, expect, it } from 'vitest';
import { computePeriod, PERIOD_META } from './period';

describe('period utils', () => {
  const trip = { start_date: '2026-09-01', end_date: '2026-09-10' };

  it('provides correct labels in PERIOD_META', () => {
    expect(PERIOD_META.before).toBe('Vor dem Urlaub');
    expect(PERIOD_META.during).toBe('Während des Urlaubs');
  });

  it('computes "before" when due date is before trip start date', () => {
    expect(computePeriod('2026-08-31', trip)).toBe('before');
  });

  it('computes "during" when due date is on trip start date or before end date', () => {
    expect(computePeriod('2026-09-01', trip)).toBe('during');
    expect(computePeriod('2026-09-05', trip)).toBe('during');
    expect(computePeriod('2026-09-10', trip)).toBe('during');
  });

  it('computes null when due date is after trip end date or missing', () => {
    expect(computePeriod('2026-09-11', trip)).toBeNull();
    expect(computePeriod(null, trip)).toBeNull();
    expect(computePeriod(undefined, trip)).toBeNull();
  });

  it('returns null when trip or start_date is missing', () => {
    expect(computePeriod('2026-09-05', null)).toBeNull();
    expect(computePeriod('2026-09-05', {})).toBeNull();
  });
});

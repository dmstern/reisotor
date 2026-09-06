import { describe, it, expect } from 'vitest';
import { sanitizeNavEntries, type NavConfigEntry } from './navConfig';

describe('navConfig', () => {
  it('adds travel as visible: false when missing in stored entries', () => {
    const legacyEntries: NavConfigEntry[] = [
      { key: 'listen', visible: true },
      { key: 'excursions', visible: true },
      { key: 'budget', visible: true },
    ];
    const sanitized = sanitizeNavEntries(legacyEntries);
    const travelEntry = sanitized.find((e) => e.key === 'travel');
    expect(travelEntry).toBeDefined();
    expect(travelEntry?.visible).toBe(false);
  });

  it('preserves travel entry if explicitly set by user', () => {
    const userEntries: NavConfigEntry[] = [
      { key: 'travel', visible: true },
      { key: 'listen', visible: true },
    ];
    const sanitized = sanitizeNavEntries(userEntries);
    const travelEntry = sanitized.find((e) => e.key === 'travel');
    expect(travelEntry).toBeDefined();
    expect(travelEntry?.visible).toBe(true);
  });
});

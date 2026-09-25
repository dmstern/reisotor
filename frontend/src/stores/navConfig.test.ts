// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { sanitizeNavEntries, useNavConfigStore, type NavConfigEntry } from './navConfig';

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

  it('adds accommodation as visible: false when missing in stored entries', () => {
    const legacyEntries: NavConfigEntry[] = [
      { key: 'listen', visible: true },
      { key: 'excursions', visible: true },
    ];
    const sanitized = sanitizeNavEntries(legacyEntries);
    const accEntry = sanitized.find((e) => e.key === 'accommodation');
    expect(accEntry).toBeDefined();
    expect(accEntry?.visible).toBe(false);
  });

  it('preserves accommodation entry if explicitly set by user', () => {
    const userEntries: NavConfigEntry[] = [
      { key: 'accommodation', visible: true },
      { key: 'listen', visible: true },
    ];
    const sanitized = sanitizeNavEntries(userEntries);
    const accEntry = sanitized.find((e) => e.key === 'accommodation');
    expect(accEntry).toBeDefined();
    expect(accEntry?.visible).toBe(true);
  });
});

describe('useNavConfigStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('defaults to customMobile: false and returns entries for both desktop and mobile', () => {
    const store = useNavConfigStore();
    expect(store.customMobile).toBe(false);
    expect(store.getEffectiveEntries(true)).toEqual(store.entries);
    expect(store.getEffectiveEntries(false)).toEqual(store.entries);
  });

  it('returns mobileEntries for mobile only when customMobile is true', () => {
    const store = useNavConfigStore();
    store.customMobile = true;

    // Change visibility on mobile only
    store.setVisible('notes', false, 'mobile');
    expect(store.mobileEntries.find((e) => e.key === 'notes')?.visible).toBe(false);
    expect(store.entries.find((e) => e.key === 'notes')?.visible).toBe(true);

    // Desktop still sees global/desktop entries
    expect(store.getEffectiveEntries(true).find((e) => e.key === 'notes')?.visible).toBe(true);
    // Mobile sees mobile entries
    expect(store.getEffectiveEntries(false).find((e) => e.key === 'notes')?.visible).toBe(false);
  });

  it('supports moving items up and down for mobile independently', () => {
    const store = useNavConfigStore();
    store.customMobile = true;

    const initialFirstMobile = store.mobileEntries[0].key;
    const initialSecondMobile = store.mobileEntries[1].key;

    store.moveDown(initialFirstMobile, 'mobile');
    expect(store.mobileEntries[0].key).toBe(initialSecondMobile);
    expect(store.mobileEntries[1].key).toBe(initialFirstMobile);

    // Desktop order remains unchanged
    expect(store.entries[0].key).toBe(initialFirstMobile);

    // Move back up
    store.moveUp(initialFirstMobile, 'mobile');
    expect(store.mobileEntries[0].key).toBe(initialFirstMobile);
  });

  it('resets both desktop and mobile configs and disables customMobile on reset()', () => {
    const store = useNavConfigStore();
    store.customMobile = true;
    store.setVisible('notes', false, 'mobile');
    store.setVisible('budget', false, 'desktop');

    store.reset();
    expect(store.customMobile).toBe(false);
    expect(store.entries.find((e) => e.key === 'budget')?.visible).toBe(true);
    expect(store.mobileEntries.find((e) => e.key === 'notes')?.visible).toBe(true);
  });

  it('initializes mobileEntries from current entries when enabling custom mobile via setCustomMobile', () => {
    const store = useNavConfigStore();
    store.setVisible('listen', false, 'desktop');
    store.moveDown('budget', 'desktop');

    store.setCustomMobile(true);
    expect(store.customMobile).toBe(true);
    expect(store.mobileEntries.find((e) => e.key === 'listen')?.visible).toBe(false);
  });
});

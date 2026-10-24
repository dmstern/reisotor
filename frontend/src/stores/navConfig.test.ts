// @vitest-environment jsdom
import { beforeEach, describe, it, expect } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { sanitizeNavEntries, useNavConfigStore, type NavConfigEntry } from './navConfig';

describe('navConfig', () => {
  it('adds travel as visible: true on desktop and false on mobile when missing in stored entries', () => {
    const legacyEntries: NavConfigEntry[] = [
      { key: 'listen', visible: true },
      { key: 'excursions', visible: true },
      { key: 'budget', visible: true },
    ];
    const sanitizedDesktop = sanitizeNavEntries(legacyEntries, 'desktop');
    const travelDesktop = sanitizedDesktop.find((e) => e.key === 'travel');
    expect(travelDesktop).toBeDefined();
    expect(travelDesktop?.visible).toBe(true);

    const sanitizedMobile = sanitizeNavEntries(legacyEntries, 'mobile');
    const travelMobile = sanitizedMobile.find((e) => e.key === 'travel');
    expect(travelMobile).toBeDefined();
    expect(travelMobile?.visible).toBe(false);
  });

  it('preserves travel entry if explicitly set by user', () => {
    const userEntries: NavConfigEntry[] = [
      { key: 'travel', visible: false },
      { key: 'listen', visible: true },
    ];
    const sanitized = sanitizeNavEntries(userEntries);
    const travelEntry = sanitized.find((e) => e.key === 'travel');
    expect(travelEntry).toBeDefined();
    expect(travelEntry?.visible).toBe(false);
  });

  it('adds accommodation as visible: true on desktop and false on mobile when missing in stored entries', () => {
    const legacyEntries: NavConfigEntry[] = [
      { key: 'listen', visible: true },
      { key: 'excursions', visible: true },
    ];
    const sanitizedDesktop = sanitizeNavEntries(legacyEntries, 'desktop');
    const accDesktop = sanitizedDesktop.find((e) => e.key === 'accommodation');
    expect(accDesktop).toBeDefined();
    expect(accDesktop?.visible).toBe(true);

    const sanitizedMobile = sanitizeNavEntries(legacyEntries, 'mobile');
    const accMobile = sanitizedMobile.find((e) => e.key === 'accommodation');
    expect(accMobile).toBeDefined();
    expect(accMobile?.visible).toBe(false);
  });

  it('preserves accommodation entry if explicitly set by user', () => {
    const userEntries: NavConfigEntry[] = [
      { key: 'accommodation', visible: false },
      { key: 'listen', visible: true },
    ];
    const sanitized = sanitizeNavEntries(userEntries);
    const accEntry = sanitized.find((e) => e.key === 'accommodation');
    expect(accEntry).toBeDefined();
    expect(accEntry?.visible).toBe(false);
  });
});

describe('useNavConfigStore', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it('defaults to customMobile: true and returns separate entries for desktop and mobile', () => {
    const store = useNavConfigStore();
    expect(store.customMobile).toBe(true);
    expect(store.getEffectiveEntries(true)).toEqual(store.entries);
    expect(store.getEffectiveEntries(false)).toEqual(store.mobileEntries);
    expect(store.getEffectiveEntries(true).find((e) => e.key === 'travel')?.visible).toBe(true);
    expect(store.getEffectiveEntries(false).find((e) => e.key === 'travel')?.visible).toBe(false);
    expect(store.getEffectiveEntries(true).find((e) => e.key === 'notes')?.visible).toBe(true);
    expect(store.getEffectiveEntries(false).find((e) => e.key === 'notes')?.visible).toBe(false);
  });

  it('returns desktop entries for mobile when customMobile is set to false', () => {
    const store = useNavConfigStore();
    store.customMobile = false;

    expect(store.getEffectiveEntries(true)).toEqual(store.entries);
    expect(store.getEffectiveEntries(false)).toEqual(store.entries);
  });

  it('supports moving items up and down for mobile independently', () => {
    const store = useNavConfigStore();

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

  it('resets both desktop and mobile configs and resets customMobile to true on reset()', () => {
    const store = useNavConfigStore();
    store.customMobile = false;
    store.setVisible('notes', true, 'mobile');
    store.setVisible('budget', false, 'desktop');

    store.reset();
    expect(store.customMobile).toBe(true);
    expect(store.entries.find((e) => e.key === 'budget')?.visible).toBe(true);
    expect(store.entries.find((e) => e.key === 'travel')?.visible).toBe(true);
    expect(store.mobileEntries.find((e) => e.key === 'notes')?.visible).toBe(false);
    expect(store.mobileEntries.find((e) => e.key === 'travel')?.visible).toBe(false);
  });

  it('initializes mobileEntries when enabling custom mobile via setCustomMobile', () => {
    const store = useNavConfigStore();
    store.customMobile = false;
    localStorage.removeItem('reisotor-nav-config-mobile');

    store.setCustomMobile(true);
    expect(store.customMobile).toBe(true);
    expect(store.mobileEntries.find((e) => e.key === 'travel')?.visible).toBe(false);
    expect(store.mobileEntries.find((e) => e.key === 'listen')?.visible).toBe(true);
  });
});

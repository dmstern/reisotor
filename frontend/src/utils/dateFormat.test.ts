import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { endOfWeek, formatDate, formatDateTime, formatWeekdayDate, startOfWeek } from './dateFormat';
import { useCalendarSettingsStore } from '../stores/calendarSettings';

// Testumgebung ist 'node' (vite.config.ts), es gibt daher kein globales localStorage – ein
// minimaler In-Memory-Stub reicht, calendarSettings.ts braucht nur getItem/setItem.
function createLocalStorageStub(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

// formatDate()/startOfWeek() lesen calendarSettings über Pinia – jeder Test braucht eine frische,
// aktive Pinia-Instanz (sonst würde ein in einem früheren Test gesetzter Store-Wert nachwirken).
beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageStub());
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatDate', () => {
  it('formats as DD.MM.YYYY by default (deutsches Format)', () => {
    expect(formatDate('2026-03-05')).toBe('05.03.2026');
  });

  it('formats as YYYY-MM-DD when dateFormat is "iso"', () => {
    useCalendarSettingsStore().dateFormat = 'iso';
    expect(formatDate('2026-03-05')).toBe('2026-03-05');
  });

  it('formats as MM/DD/YYYY when dateFormat is "us"', () => {
    useCalendarSettingsStore().dateFormat = 'us';
    expect(formatDate('2026-03-05')).toBe('03/05/2026');
  });

  it('omits the year when includeYear is false', () => {
    expect(formatDate('2026-03-05', { includeYear: false })).toBe('05.03');
    useCalendarSettingsStore().dateFormat = 'iso';
    expect(formatDate('2026-03-05', { includeYear: false })).toBe('03-05');
  });
});

describe('formatDateTime', () => {
  it('appends HH:mm regardless of dateFormat', () => {
    expect(formatDateTime('2026-03-05T14:30:00')).toBe('05.03.2026 14:30');
  });
});

describe('formatWeekdayDate', () => {
  it('combines the (always-German) short weekday name with the numeric date', () => {
    // 2026-03-05 ist ein Donnerstag.
    expect(formatWeekdayDate('2026-03-05')).toBe('Do, 05.03');
  });
});

describe('startOfWeek', () => {
  // 2026-03-04 ist ein Mittwoch. Lokale Zeit (kein "Z"/ISO-UTC) statt new Date(dateOnlyString),
  // damit der Test unabhängig von der Zeitzone des Testrunners exakt Mittwoch 12 Uhr lokal trifft.
  const wednesday = new Date(2026, 2, 4, 12, 0, 0);

  it('returns the preceding Monday by default', () => {
    const result = startOfWeek(wednesday);
    expect(result.getDay()).toBe(1);
    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 2, 2]);
  });

  it('returns the preceding Sunday when weekStart is "sunday"', () => {
    useCalendarSettingsStore().weekStart = 'sunday';
    const result = startOfWeek(wednesday);
    expect(result.getDay()).toBe(0);
    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 2, 1]);
  });
});

describe('endOfWeek', () => {
  const wednesday = new Date(2026, 2, 4, 12, 0, 0);

  it('returns the following Sunday by default (Monday-start week)', () => {
    const result = endOfWeek(wednesday);
    expect(result.getDay()).toBe(0);
    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 2, 8]);
  });

  it('returns the following Saturday when weekStart is "sunday"', () => {
    useCalendarSettingsStore().weekStart = 'sunday';
    const result = endOfWeek(wednesday);
    expect(result.getDay()).toBe(6);
    expect([result.getFullYear(), result.getMonth(), result.getDate()]).toEqual([2026, 2, 7]);
  });
});

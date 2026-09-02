import { describe, it, expect } from 'vitest';
import { isAutoCreatedUnmodifiedScheduleItem } from './scheduleSpotUnlink';
import type { ScheduleItem } from '../api/types';

function createMockItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 1,
    trip_id: 1,
    date: '2026-08-31',
    end_date: null,
    time: null,
    end_time: null,
    title: 'Eiffelturm',
    note: null,
    location: null,
    maps_link: null,
    lat: null,
    lng: null,
    category: 'other',
    spot_id: 10,
    idea_id: null,
    ...overrides,
  };
}

describe('isAutoCreatedUnmodifiedScheduleItem', () => {
  it('returns true for an untouched auto-created schedule item', () => {
    const item = createMockItem({ title: 'Eiffelturm' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(true);
  });

  it('handles case-insensitive and trimmed title comparison', () => {
    const item = createMockItem({ title: '  Eiffelturm  ' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'eiffelturm')).toBe(true);
  });

  it('returns false if title has been customized', () => {
    const item = createMockItem({ title: 'Eiffelturm mit Guide' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(false);
  });

  it('returns false if a time is specified', () => {
    const item = createMockItem({ time: '14:00' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(false);
  });

  it('returns false if an end_time is specified', () => {
    const item = createMockItem({ end_time: '16:00' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(false);
  });

  it('returns false if end_date spans across multiple days', () => {
    const item = createMockItem({ date: '2026-08-31', end_date: '2026-09-02' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(false);
  });

  it('returns true if end_date equals start date', () => {
    const item = createMockItem({ date: '2026-08-31', end_date: '2026-08-31' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(true);
  });

  it('returns false if a non-empty note is present', () => {
    const item = createMockItem({ note: '<p>Tickets bereit halten</p>' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(false);
  });

  it('returns true if note is empty or only empty HTML tags', () => {
    const item = createMockItem({ note: '<p>   </p>' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(true);
  });

  it('returns false if a custom location is entered', () => {
    const item = createMockItem({ location: 'Ost-Eingang' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(false);
  });

  it('returns false if a custom maps_link is entered', () => {
    const item = createMockItem({ maps_link: 'https://maps.google.com/xyz' });
    expect(isAutoCreatedUnmodifiedScheduleItem(item, 'Eiffelturm')).toBe(false);
  });
});

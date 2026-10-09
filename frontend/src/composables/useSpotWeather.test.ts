// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useSpotWeather } from './useSpotWeather';
import { useScheduleStore } from '../stores/schedule';
import type { ScheduleItem, Spot } from '../api/types';
import * as weatherUtils from '../utils/weather';
import type { DailyWeather } from '../utils/weather';

function createMockSpot(partial: Partial<Spot>): Spot {
  return {
    id: 1,
    trip_id: 10,
    title: 'Test Spot',
    category: 'Aktivität',
    lat: 48.2082,
    lng: 16.3738,
    done: 0,
    ...partial,
  } as Spot;
}

function createMockScheduleItem(partial: Partial<ScheduleItem>): ScheduleItem {
  return partial as unknown as ScheduleItem;
}

function createMockDailyWeather(partial: Partial<DailyWeather>): DailyWeather {
  return partial as unknown as DailyWeather;
}

describe('useSpotWeather', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('aggregiert geplante Tage aus dem ScheduleStore (inkl. Datumsbereiche)', () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [
      createMockScheduleItem({
        id: 101,
        trip_id: 10,
        spot_id: 1,
        date: '2026-06-10',
        title: 'Spot Besuch 1',
        done: 0,
      }),
      createMockScheduleItem({
        id: 102,
        trip_id: 10,
        spot_id: 1,
        date: '2026-06-12',
        end_date: '2026-06-14',
        title: 'Spot Besuch 2',
        done: 0,
      }),
      createMockScheduleItem({
        id: 103,
        trip_id: 10,
        spot_id: 2, // fremder Spot
        date: '2026-06-15',
        title: 'Anderer Spot',
        done: 0,
      }),
    ];

    const spot = ref(createMockSpot({ id: 1 }));
    const scheduledDate = ref<string | null>('2026-06-10');
    const expanded = ref(false);

    const { scheduledDatesForSpot, scheduledDaysCount, plannedDateLabel } = useSpotWeather({
      spot,
      scheduledDate,
      expanded,
    });

    expect(scheduledDaysCount.value).toBe(4); // 2026-06-10, 2026-06-12, 2026-06-13, 2026-06-14
    expect(scheduledDatesForSpot.value.has('2026-06-10')).toBe(true);
    expect(scheduledDatesForSpot.value.has('2026-06-13')).toBe(true);
    expect(plannedDateLabel.value).toContain('10.06');
  });

  it('bestimmt weatherDate korrekt abhängig von Terminanzahl und expanded', () => {
    const scheduleStore = useScheduleStore();
    scheduleStore.items = [];

    const spot = ref(createMockSpot({ id: 1, done: 0 }));
    const scheduledDate = ref<string | null>(null);
    const expanded = ref(false);

    const { weatherDate } = useSpotWeather({
      spot,
      scheduledDate,
      expanded,
    });

    // Weder geplantes Datum noch expanded -> kein Wetter
    expect(weatherDate.value).toBeNull();

    // Expanded -> heutiges Wetter für ungeplanten Spot
    expanded.value = true;
    expect(weatherDate.value).toBeTruthy();

    // Geplantes Datum vorhanden -> geplantes Datum
    scheduledDate.value = '2026-07-01';
    expect(weatherDate.value).toBe('2026-07-01');

    // Mehr als ein geplanter Tag -> kein einzelnes Wetterdatum (null)
    scheduleStore.items = [
      createMockScheduleItem({ id: 1, spot_id: 1, date: '2026-07-01', trip_id: 10 }),
      createMockScheduleItem({ id: 2, spot_id: 1, date: '2026-07-02', trip_id: 10 }),
    ];
    expect(weatherDate.value).toBeNull();
  });

  it('lädt Wetterdaten per fetchMergedWeather', async () => {
    const fetchSpy = vi.spyOn(weatherUtils, 'fetchMergedWeather').mockResolvedValueOnce([
      createMockDailyWeather({
        date: '2026-07-01',
        tempMax: 25,
        tempMin: 15,
        weatherCode: 1,
        precipitationProbability: 0,
      }),
    ]);

    const spot = ref(createMockSpot({ id: 1, lat: 48.2, lng: 16.3 }));
    const scheduledDate = ref<string | null>('2026-07-01');
    const expanded = ref(true);

    const { dayWeather } = useSpotWeather({
      spot,
      scheduledDate,
      expanded,
    });

    await vi.waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    expect(dayWeather.value?.tempMax).toBe(25);
  });
});

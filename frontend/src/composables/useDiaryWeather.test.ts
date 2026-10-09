// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useDiaryWeather } from './useDiaryWeather';
import type { DiaryEntry, Trip } from '../api/types';

vi.mock('../utils/weather', () => ({
  fetchMergedWeather: vi.fn(),
  weatherCodeMeta: vi.fn(),
}));

import { fetchMergedWeather } from '../utils/weather';

describe('useDiaryWeather', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('weatherForEntry returns null before loading', () => {
    const trip = ref<Trip | null>({
      id: 1,
      lat: 52.5,
      lng: 13.4,
    } as Trip);

    const { weatherForEntry } = useDiaryWeather({ trip, tripId: 1 });
    const entry: DiaryEntry = {
      id: 1,
      trip_id: 1,
      author_id: 1,
      date: '2026-07-01',
      title: 'Tag 1',
      content: 'Text',
      content_format: 'html',
      images: [],
      excursion_ids: [],
      spot_ids: [],
      editor_ids: [],
      is_draft: 0,
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-01T10:00:00Z',
    };

    expect(weatherForEntry(entry)).toBeNull();
  });

  it('loads weather and matches entry by date', async () => {
    const trip = ref<Trip | null>({
      id: 1,
      lat: 52.5,
      lng: 13.4,
    } as Trip);

    const mockWeatherDays = [
      { date: '2026-07-01', weatherCode: 0, tempMax: 25, tempMin: 15 },
      { date: '2026-07-02', weatherCode: 1, tempMax: 24, tempMin: 14 },
    ];

    vi.mocked(fetchMergedWeather).mockResolvedValueOnce(
      mockWeatherDays as unknown as Awaited<ReturnType<typeof fetchMergedWeather>>
    );

    const { loadDiaryWeather, weatherForEntry } = useDiaryWeather({ trip, tripId: 1 });
    await loadDiaryWeather();

    const entry1: DiaryEntry = {
      id: 1,
      trip_id: 1,
      author_id: 1,
      date: '2026-07-01',
      title: 'Tag 1',
      content: 'Text',
      content_format: 'html',
      images: [],
      excursion_ids: [],
      spot_ids: [],
      editor_ids: [],
      is_draft: 0,
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-01T10:00:00Z',
    };

    const entry3: DiaryEntry = {
      ...entry1,
      date: '2026-07-03',
    };

    expect(weatherForEntry(entry1)).toEqual(mockWeatherDays[0]);
    expect(weatherForEntry(entry3)).toBeNull();
  });
});

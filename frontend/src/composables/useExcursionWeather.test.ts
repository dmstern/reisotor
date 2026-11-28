// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, nextTick, ref } from 'vue';
import { useExcursionWeather } from './useExcursionWeather';
import * as weatherUtils from '../utils/weather';
import type { Excursion } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return {
    id: 1,
    trip_id: 10,
    title: 'Tour A',
    date: '2026-07-20',
    spot_ids: [1],
    ...partial,
  } as unknown as Excursion;
}

function createMockStation(partial: Partial<ExcursionStation>): ExcursionStation {
  return {
    key: 'spot:1',
    kind: 'spot',
    id: 1,
    title: 'Station 1',
    lat: 48.208,
    lng: 16.373,
    ...partial,
  } as unknown as ExcursionStation;
}

describe('useExcursionWeather', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('formatiert statusDateLabel korrekt', () => {
    const excursion = ref(createMockExcursion({ date: '2026-07-20' }));
    const resolvedStations = ref<ExcursionStation[]>([]);

    const { statusDateLabel } = useExcursionWeather({
      excursion,
      resolvedStations,
    });

    expect(statusDateLabel.value).toBe('20.07');
  });

  it('gibt leeren Datums-String zurück wenn kein Datum vorhanden', () => {
    const excursion = ref(createMockExcursion({ date: null }));
    const resolvedStations = ref<ExcursionStation[]>([]);

    const { statusDateLabel } = useExcursionWeather({
      excursion,
      resolvedStations,
    });

    expect(statusDateLabel.value).toBe('');
  });

  it('lädt und fasst Wetter für alle kartierten Stationen zusammen', async () => {
    vi.spyOn(weatherUtils, 'fetchMergedWeather').mockImplementation(async (_tripId, lat) => {
      const tempMax = lat > 48.25 ? 30 : 25;
      return [
        {
          date: '2026-07-20',
          weatherCode: 0,
          tempMax,
          tempMin: 18,
          precipitationProbability: 0,
        },
      ];
    });

    const excursion = ref(createMockExcursion({ date: '2026-07-20' }));
    const resolvedStations = ref<ExcursionStation[]>(
      [1, 2, 3].map((id) =>
        createMockStation({
          id,
          lat: id === 3 ? null : id === 2 ? 48.3 : 48.208,
          lng: id === 3 ? null : id === 2 ? 16.4 : 16.373,
        })
      )
    );

    const {
      mappedStations,
      weatherSummary,
      primaryWeatherDay,
      primaryWeatherDays,
      primaryWeatherLocation,
    } = useExcursionWeather({
      excursion,
      resolvedStations,
    });

    expect(mappedStations.value).toHaveLength(2);

    // Warte auf asynchrones watch
    await vi.waitFor(() => {
      expect(weatherSummary.value).not.toBeNull();
    });

    expect(weatherSummary.value?.weatherCode).toBe(0);
    expect(weatherSummary.value?.tempLabel).toBe('25°–30°');
    expect(primaryWeatherDay.value?.date).toBe('2026-07-20');
    expect(primaryWeatherDays.value).toHaveLength(1);
    expect(primaryWeatherLocation.value).toEqual({
      lat: 48.208,
      lng: 16.373,
      label: 'Station 1',
    });
  });

  it('lädt das Wetter nicht neu, wenn sich nur done oder die Array-Referenz der Stationen ändert', async () => {
    const fetchSpy = vi.spyOn(weatherUtils, 'fetchMergedWeather').mockResolvedValue([
      {
        date: '2026-07-20',
        weatherCode: 0,
        tempMax: 24,
        tempMin: 16,
        precipitationProbability: 0,
      },
    ]);

    const excursion = ref(createMockExcursion({ date: '2026-07-20', done: 0 }));
    // Simuliert useExcursionStations: erzeugt bei neuem excursion-Objekt ein frisches Array
    const resolvedStations = computed(() =>
      excursion.value.spot_ids.map((id) => createMockStation({ id }))
    );

    const { weatherSummary } = useExcursionWeather({
      excursion,
      resolvedStations,
    });

    await vi.waitFor(() => {
      expect(weatherSummary.value).not.toBeNull();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    excursion.value = { ...excursion.value, done: 1 } as unknown as Excursion;
    await nextTick();

    expect(weatherSummary.value?.tempLabel).toBe('24°');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

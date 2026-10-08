// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useDashboardWeather } from './useDashboardWeather';
import type { Trip } from '../api/types';
import type { DailyWeather } from '../utils/weather';

describe('useDashboardWeather', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const baseTrip: Trip = {
    id: 1,
    name: 'Sommerurlaub',
    destination: 'Mallorca',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    maps_link: null,
    image_url: null,
    packing_category_required: 0,
    weather_model: 'best_match',
    lat: 39.5,
    lng: 2.6,
    owner_restricted: false,
  };

  it('computes destination labels correctly', () => {
    const trip = ref<Trip | null>(baseTrip);
    const weather = useDashboardWeather({ trip });

    expect(weather.destinationName.value).toBe('Mallorca');
    expect(weather.destinationLocationLabel.value).toContain('Mallorca');
  });

  it('opens weather day dialog with correct defaults', () => {
    const trip = ref<Trip | null>(baseTrip);
    const weather = useDashboardWeather({ trip });

    const sampleDay: DailyWeather = {
      date: '2026-07-05',
      weatherCode: 0,
      tempMax: 30,
      tempMin: 20,
      precipitationProbability: null,
    };

    weather.openWeatherDayDialog(sampleDay);

    expect(weather.weatherDayDialogOpen.value).toBe(true);
    expect(weather.selectedWeatherDay.value).toEqual(sampleDay);
    expect(weather.selectedWeatherLocation.value).toEqual({
      lat: 39.5,
      lng: 2.6,
      label: 'Mallorca',
    });
  });

  it('filters forecast days to the trip dates', () => {
    const trip = ref<Trip | null>(baseTrip);
    const weather = useDashboardWeather({ trip });

    weather.weatherDays.value = [
      {
        date: '2026-06-30',
        weatherCode: 0,
        tempMax: 25,
        tempMin: 18,
        precipitationProbability: 10,
      },
      { date: '2026-07-01', weatherCode: 0, tempMax: 28, tempMin: 19, precipitationProbability: 5 },
      { date: '2026-07-10', weatherCode: 1, tempMax: 32, tempMin: 21, precipitationProbability: 0 },
      {
        date: '2026-07-16',
        weatherCode: 2,
        tempMax: 27,
        tempMin: 17,
        precipitationProbability: 20,
      },
    ];

    expect(weather.vacationForecastDays.value.map((d) => d.date)).toEqual([
      '2026-07-01',
      '2026-07-10',
    ]);
  });
});

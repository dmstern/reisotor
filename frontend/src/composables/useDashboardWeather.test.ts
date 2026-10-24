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

  it('selects home location and matches days when opening home weather', () => {
    const trip = ref<Trip | null>(baseTrip);
    const weather = useDashboardWeather({ trip });

    const vacationDay: DailyWeather = {
      date: '2026-07-05',
      weatherCode: 0,
      tempMax: 30,
      tempMin: 20,
      precipitationProbability: null,
    };
    const homeDay: DailyWeather = {
      date: '2026-07-05',
      weatherCode: 3,
      tempMax: 22,
      tempMin: 14,
      precipitationProbability: 40,
    };

    weather.weatherDays.value = [vacationDay];
    weather.homeWeatherDays.value = [homeDay];

    weather.openWeatherDayDialog(homeDay, {
      lat: 52.52,
      lng: 13.4,
      label: 'Berlin',
      type: 'home',
    });

    expect(weather.weatherDayDialogOpen.value).toBe(true);
    expect(weather.selectedWeatherLocationType.value).toBe('home');
    expect(weather.selectedVacationDay.value).toEqual(vacationDay);
    expect(weather.selectedHomeDay.value).toEqual(homeDay);
  });

  it('provides allWeatherDays bridging forecast days and trip days continuously', () => {
    const trip = ref<Trip | null>({
      ...baseTrip,
      start_date: '2026-07-10',
      end_date: '2026-07-12',
    });
    const weather = useDashboardWeather({ trip });

    weather.weatherDays.value = [
      {
        date: '2026-07-08',
        weatherCode: 0,
        tempMax: 26,
        tempMin: 18,
        precipitationProbability: 0,
      },
      {
        date: '2026-07-09',
        weatherCode: 1,
        tempMax: 27,
        tempMin: 19,
        precipitationProbability: 10,
      },
      {
        date: '2026-07-10',
        weatherCode: 2,
        tempMax: 28,
        tempMin: 20,
        precipitationProbability: 20,
      },
    ];

    const allDates = weather.allWeatherDays.value.map((d) => d.date);
    // Should include weatherDays (07-08, 07-09, 07-10) and bridge to end of trip (07-11, 07-12)
    expect(allDates).toEqual([
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });
});

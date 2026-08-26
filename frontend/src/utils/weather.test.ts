import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { detectWeatherAlerts, type DailyWeather } from './weather';
import { toLocalDateString } from './dateFormat';

describe('detectWeatherAlerts', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    setActivePinia(createPinia());
  });

  const mockToday = toLocalDateString(new Date());

  it('erkennt Hitze-Warnungen (>= 31°C und >= 35°C)', () => {
    const forecast: DailyWeather[] = [
      {
        date: mockToday,
        tempMax: 32,
        tempMin: 20,
        weatherCode: 0,
        precipitationProbability: null,
      },
      {
        date: mockToday,
        tempMax: 36,
        tempMin: 22,
        weatherCode: 0,
        precipitationProbability: null,
      },
    ];

    const alertsWarning = detectWeatherAlerts([forecast[0]]);
    expect(alertsWarning).toHaveLength(1);
    expect(alertsWarning[0].severity).toBe('warning');
    expect(alertsWarning[0].title).toBe('Hitze-Warnung');

    const alertsDanger = detectWeatherAlerts([forecast[1]]);
    expect(alertsDanger).toHaveLength(1);
    expect(alertsDanger[0].severity).toBe('danger');
    expect(alertsDanger[0].title).toBe('Extreme Hitze-Warnung');
  });

  it('erkennt Unwetter- / Starkregen- / Schneefall-Warnungen anhand von WMO Code', () => {
    const stormDay: DailyWeather = {
      date: mockToday,
      tempMax: 20,
      tempMin: 15,
      weatherCode: 95, // Gewitter
      precipitationProbability: 80,
    };
    const rainDay: DailyWeather = {
      date: mockToday,
      tempMax: 18,
      tempMin: 12,
      weatherCode: 82, // Starkregen
      precipitationProbability: 90,
    };

    expect(detectWeatherAlerts([stormDay])[0].severity).toBe('danger');
    expect(detectWeatherAlerts([rainDay])[0].severity).toBe('warning');
  });

  it('ignoriert vergangene Tage', () => {
    const pastDay: DailyWeather = {
      date: '2000-01-01',
      tempMax: 40,
      tempMin: 25,
      weatherCode: 95,
      precipitationProbability: 90,
    };

    expect(detectWeatherAlerts([pastDay])).toHaveLength(0);
  });
});

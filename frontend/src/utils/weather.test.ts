import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  detectWeatherAlerts,
  formatWeatherTemp,
  formatWeatherTempRange,
  getWeatherUnknownExplanation,
  isWeatherUnknown,
  weatherCodeMeta,
  type DailyWeather,
} from './weather';
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

  it('behandelt Tage mit null-Werten sicher ohne Exception', () => {
    const emptyDay: DailyWeather = {
      date: mockToday,
      tempMax: null,
      tempMin: null,
      weatherCode: null,
      precipitationProbability: null,
    };

    expect(detectWeatherAlerts([emptyDay])).toHaveLength(0);
  });
});

describe('weather helpers and formatting', () => {
  it('weatherCodeMeta handles null and undefined as UNKNOWN_META', () => {
    expect(weatherCodeMeta(null).label).toBe('Unbekannt');
    expect(weatherCodeMeta(undefined).label).toBe('Unbekannt');
    expect(weatherCodeMeta(0).label).toBe('Klar');
  });

  it('formatWeatherTemp formats true 0° correctly and null as dash', () => {
    expect(formatWeatherTemp(0)).toBe('0°');
    expect(formatWeatherTemp(21.4)).toBe('21°');
    expect(formatWeatherTemp(-3)).toBe('-3°');
    expect(formatWeatherTemp(null)).toBe('–');
    expect(formatWeatherTemp(undefined)).toBe('–');
  });

  it('formatWeatherTempRange handles nulls and true 0° correctly', () => {
    expect(formatWeatherTempRange(0, -3)).toBe('0° / -3°');
    expect(formatWeatherTempRange(null, null)).toBe('–');
    expect(formatWeatherTempRange(22, null)).toBe('22°');
    expect(formatWeatherTempRange(null, 15)).toBe('15°');
  });

  it('isWeatherUnknown identifies days without data', () => {
    expect(
      isWeatherUnknown({
        date: '2026-11-08',
        weatherCode: null,
        tempMax: null,
        tempMin: null,
        precipitationProbability: null,
      })
    ).toBe(true);

    expect(
      isWeatherUnknown({
        date: '2026-11-08',
        weatherCode: 0,
        tempMax: 0,
        tempMin: 0,
        precipitationProbability: null,
      })
    ).toBe(false);
  });

  it('getWeatherUnknownExplanation returns future vs past reasons', () => {
    const futureExplanation = getWeatherUnknownExplanation('2099-01-01');
    expect(futureExplanation).toContain('zu weit in der Zukunft');

    const pastExplanation = getWeatherUnknownExplanation('2000-01-01');
    expect(pastExplanation).toContain('keine gespeicherten Wetteraufzeichnungen');
  });
});

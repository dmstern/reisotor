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

describe('fetchWeatherForecast & fetchHourlyForecast (Backend-Proxy #538)', () => {
  const pastDate = '2024-08-04';
  const futureDate = '2099-08-04';
  let storageMap: Map<string, string>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    storageMap = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k: string) => storageMap.get(k) ?? null),
      setItem: vi.fn((k: string, v: string) => storageMap.set(k, v)),
      removeItem: vi.fn((k: string) => storageMap.delete(k)),
    });
    vi.stubGlobal('navigator', { onLine: true });
    setActivePinia(createPinia());
    const { resetWeatherCache } = await import('./weather');
    resetWeatherCache();
  });

  it('fetchWeatherForecast nutzt /api/weather mit gerundeten Koordinaten, Session-Cache und localStorage-Offline-Cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        daily: {
          time: ['2026-08-14'],
          weathercode: [0],
          temperature_2m_max: [28],
          temperature_2m_min: [19],
          precipitation_probability_max: [5],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchWeatherForecast } = await import('./weather');
    const first = await fetchWeatherForecast(38.7223, -9.1393, 'ecmwf_ifs025');
    expect(first).toEqual([
      {
        date: '2026-08-14',
        weatherCode: 0,
        tempMax: 28,
        tempMin: 19,
        precipitationProbability: 5,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/weather?');
    expect(calledUrl).toContain('lat=38.72');
    expect(calledUrl).toContain('lng=-9.14');
    expect(calledUrl).not.toContain('open-meteo.com');

    // Zweiter Aufruf mit leicht abweichenden Koordinaten (gleiche 2-Dezimalstellen-Rundung) trifft Session-Cache
    const second = await fetchWeatherForecast(38.7241, -9.136, 'ecmwf_ifs025');
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Antwort wurde für den Offline-Modus in localStorage gecacht (api/offline.ts)
    const cacheKeys = [...storageMap.keys()].filter((k) =>
      k.startsWith('reisotor-cache:/weather?')
    );
    expect(cacheKeys).toHaveLength(1);
  });

  it('ruft für vergangene Tage den Backend-Proxy mit source=archive auf', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hourly: {
          time: [
            `${pastDate}T06:00`,
            `${pastDate}T09:00`,
            `${pastDate}T12:00`,
            `${pastDate}T15:00`,
            `${pastDate}T18:00`,
            `${pastDate}T21:00`,
          ],
          temperature_2m: [18.4, 21.2, 26.8, 28.5, 25.1, 22.0],
          weathercode: [0, 1, 2, 1, 0, 0],
          precipitation_probability: [0, 0, 10, 0, 0, 0],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchHourlyForecast } = await import('./weather');
    const result = await fetchHourlyForecast(38.7223, -9.1393, pastDate, 'ecmwf_ifs025');

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/weather?');
    expect(calledUrl).toContain('source=archive');
    expect(calledUrl).toContain('lat=38.72');
    expect(calledUrl).toContain('lng=-9.14');
    expect(calledUrl).toContain(`start_date=${pastDate}`);
    expect(calledUrl).not.toContain('open-meteo.com');
    expect(result).toHaveLength(6);
    expect(result[0]).toEqual({
      time: '06:00',
      temp: 18,
      weatherCode: 0,
      precipitationProbability: 0,
    });
    expect(result[3]).toEqual({
      time: '15:00',
      temp: 29,
      weatherCode: 1,
      precipitationProbability: 0,
    });
  });

  it('behält die Fallback-Reihenfolge (archive mit Modell -> archive ohne Modell -> forecast) bei', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Failed' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          hourly: {
            time: [`${pastDate}T12:00`],
            temperature_2m: [null],
            weathercode: [null],
            precipitation_probability: [null],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          hourly: {
            time: [`${pastDate}T12:00`],
            temperature_2m: [22.4],
            weathercode: [1],
            precipitation_probability: [10],
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchHourlyForecast } = await import('./weather');
    const result = await fetchHourlyForecast(38.72, -9.14, pastDate, 'ecmwf_ifs025');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toContain('source=archive');
    expect(fetchMock.mock.calls[0][0]).toContain('models=ecmwf_ifs025');
    expect(fetchMock.mock.calls[1][0]).toContain('source=archive');
    expect(fetchMock.mock.calls[1][0]).not.toContain('models=');
    expect(fetchMock.mock.calls[2][0]).toContain('source=forecast');
    expect(result).toEqual([
      {
        time: '12:00',
        temp: 22,
        weatherCode: 1,
        precipitationProbability: 10,
      },
    ]);
  });

  it('wandelt null-Werte bei unvollständigen Daten NIEMALS in 0° um', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hourly: {
          time: [
            `${pastDate}T06:00`,
            `${pastDate}T09:00`,
            `${pastDate}T12:00`,
            `${pastDate}T15:00`,
            `${pastDate}T18:00`,
            `${pastDate}T21:00`,
          ],
          temperature_2m: [null, null, null, null, null, null],
          weathercode: [null, null, null, null, null, null],
          precipitation_probability: [null, null, null, null, null, null],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchHourlyForecast } = await import('./weather');
    const result = await fetchHourlyForecast(38.72, -9.14, pastDate, 'ecmwf_ifs025');

    // Darf keine 0°-Objekte mit null-Weathercode enthalten
    expect(result).toHaveLength(0);
  });

  it('behält echte 0°C-Temperaturen im Winter korrekt bei', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hourly: {
          time: [`${pastDate}T12:00`],
          temperature_2m: [0.0],
          weathercode: [71],
          precipitation_probability: [20],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchHourlyForecast } = await import('./weather');
    const result = await fetchHourlyForecast(38.72, -9.14, pastDate);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      time: '12:00',
      temp: 0,
      weatherCode: 71,
      precipitationProbability: 20,
    });
  });

  it('ruft für zukünftige Tage den Backend-Proxy mit source=forecast auf', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        hourly: {
          time: [`${futureDate}T12:00`],
          temperature_2m: [25.0],
          weathercode: [0],
          precipitation_probability: [5],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchHourlyForecast } = await import('./weather');
    const result = await fetchHourlyForecast(38.72, -9.14, futureDate, 'ecmwf_ifs025');

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/weather?');
    expect(calledUrl).toContain('source=forecast');
    expect(calledUrl).not.toContain('open-meteo.com');
    expect(result).toHaveLength(1);
    expect(result[0].temp).toBe(25);
  });
});

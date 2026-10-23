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

describe('fetchHourlyForecast', () => {
  const pastDate = '2024-08-04';
  const futureDate = '2099-08-04';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('ruft für vergangene Tage die Archive-API von Open-Meteo auf', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
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
    const result = await fetchHourlyForecast(38.72, -9.14, pastDate, 'ecmwf_ifs025');

    expect(fetchMock).toHaveBeenCalled();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('https://archive-api.open-meteo.com/v1/archive');
    expect(calledUrl).toContain(`start_date=${pastDate}`);
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

  it('wandelt null-Werte bei unvollständigen Daten NIEMALS in 0° um', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
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

  it('ruft für zukünftige Tage die Forecast-API auf', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
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
    expect(calledUrl).toContain('https://api.open-meteo.com/v1/forecast');
    expect(result).toHaveLength(1);
    expect(result[0].temp).toBe(25);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import WeatherDayDetailDialog from './WeatherDayDetailDialog.vue';
import type { DailyWeather } from '../utils/weather';

vi.mock('../utils/weather', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/weather')>();
  return {
    ...actual,
    fetchHourlyForecast: vi.fn(),
  };
});

vi.mock('vue', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue')>();
  return {
    ...actual,
    Transition: (
      _props: unknown,
      { slots }: { slots: Record<string, (() => unknown) | undefined> }
    ) => slots.default?.(),
  };
});

describe('WeatherDayDetailDialog', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    document.body.innerHTML = '';
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mountComponent(props: any) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const app = createApp({
      render: () => h(WeatherDayDetailDialog, props),
    });
    app.use(pinia);
    app.mount(container);
    return {
      cleanUp: () => {
        app.unmount();
        container.remove();
        document.body.innerHTML = '';
      },
    };
  }

  async function flushAsync() {
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
  }

  const vacationDay: DailyWeather = {
    date: '2026-08-06',
    weatherCode: 0,
    tempMax: 37,
    tempMin: 17,
    precipitationProbability: 0,
  };

  const homeDay: DailyWeather = {
    date: '2026-08-06',
    weatherCode: 3,
    tempMax: 23,
    tempMin: 14,
    precipitationProbability: 35,
  };

  it('renders without toggle button when no home location is configured', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const { cleanUp } = mountComponent({
      modelValue: true,
      day: vacationDay,
      lat: 38.72,
      lng: -9.13,
      locationLabel: 'Lissabon, Portugal',
    });
    await flushAsync();

    expect(document.querySelector('.location-toggle-wrap')).toBeNull();
    expect(document.querySelector('.location-badge')?.textContent).toContain('Lissabon, Portugal');
    expect(document.querySelector('.temp-max')?.textContent).toBe('37°');

    cleanUp();
  });

  it('renders toggle button when home location is configured and toggles between vacation and home', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const { cleanUp } = mountComponent({
      modelValue: true,
      date: '2026-08-06',
      vacationDay,
      vacationLat: 38.72,
      vacationLng: -9.13,
      vacationLocationLabel: 'Lissabon, Portugal',
      homeDay,
      homeLat: 52.52,
      homeLng: 13.4,
      homeLocationLabel: 'Berlin',
      initialLocation: 'vacation',
    });
    await flushAsync();

    const toggleWrap = document.querySelector('.location-toggle-wrap');
    expect(toggleWrap).not.toBeNull();

    const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.segmented-option'));
    expect(options.length).toBe(2);
    expect(options[0].textContent).toContain('Urlaubsort');
    expect(options[1].textContent).toContain('Heimatort');

    // Initially vacation
    expect(document.querySelector('.location-badge')?.textContent).toContain('Lissabon, Portugal');
    expect(document.querySelector('.temp-max')?.textContent).toBe('37°');

    // Click Heimatort
    options[1].click();
    await flushAsync();

    expect(document.querySelector('.location-badge')?.textContent).toContain('Berlin');
    expect(document.querySelector('.temp-max')?.textContent).toBe('23°');
    expect(document.querySelector('.temp-min')?.textContent).toBe('14°');
    expect(document.querySelector('.rain-val')?.textContent).toContain('35%');

    // Click Urlaubsort again
    options[0].click();
    await flushAsync();

    expect(document.querySelector('.location-badge')?.textContent).toContain('Lissabon, Portugal');
    expect(document.querySelector('.temp-max')?.textContent).toBe('37°');

    cleanUp();
  });

  it('respects initialLocation="home"', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const { cleanUp } = mountComponent({
      modelValue: true,
      date: '2026-08-06',
      vacationDay,
      vacationLat: 38.72,
      vacationLng: -9.13,
      vacationLocationLabel: 'Lissabon, Portugal',
      homeDay,
      homeLat: 52.52,
      homeLng: 13.4,
      homeLocationLabel: 'Berlin',
      initialLocation: 'home',
    });
    await flushAsync();

    expect(document.querySelector('.location-badge')?.textContent).toContain('Berlin');
    expect(document.querySelector('.temp-max')?.textContent).toBe('23°');

    cleanUp();
  });

  it('does not display 0° on missing weather data and displays clear explanation', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const unknownDay: DailyWeather = {
      date: '2099-11-08',
      weatherCode: null,
      tempMax: null,
      tempMin: null,
      precipitationProbability: null,
    };

    const { cleanUp } = mountComponent({
      modelValue: true,
      date: '2099-11-08',
      day: unknownDay,
      lat: 38.72,
      lng: -9.13,
      locationLabel: 'Lissabon, Portugal',
    });
    await flushAsync();

    expect(document.querySelector('.temp-max')).toBeNull();
    expect(document.querySelector('.temp-unavailable')?.textContent).toBe('–');
    expect(document.querySelector('.unknown-explanation')?.textContent).toContain(
      'zu weit in der Zukunft'
    );

    cleanUp();
  });

  it('correctly displays 0° when temperature is genuinely 0°C', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const freezingDay: DailyWeather = {
      date: '2026-12-15',
      weatherCode: 71,
      tempMax: 0,
      tempMin: -4,
      precipitationProbability: 40,
    };

    const { cleanUp } = mountComponent({
      modelValue: true,
      date: '2026-12-15',
      day: freezingDay,
      lat: 47.37,
      lng: 8.54,
      locationLabel: 'Zürich',
    });
    await flushAsync();

    expect(document.querySelector('.temp-max')?.textContent).toBe('0°');
    expect(document.querySelector('.temp-min')?.textContent).toBe('-4°');
    expect(document.querySelector('.unknown-explanation')).toBeNull();

    cleanUp();
  });

  it('zeigt für vergangene Tage ohne Verlaufsdaten den passenden Hinweis', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const pastDay: DailyWeather = {
      date: '2024-08-04',
      weatherCode: 0,
      tempMax: 30,
      tempMin: 18,
      precipitationProbability: 0,
    };

    const { cleanUp } = mountComponent({
      modelValue: true,
      day: pastDay,
      lat: 38.72,
      lng: -9.14,
    });

    await flushAsync();

    const emptyMsg = document.querySelector('.hourly-empty');
    expect(emptyMsg?.textContent?.trim()).toBe(
      'Für diesen vergangenen Tag sind keine stündlichen Verlaufsdaten verfügbar.'
    );

    cleanUp();
  });

  it('zeigt für zukünftige Tage ohne Verlaufsdaten den Standard-Hinweis', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const futureDay: DailyWeather = {
      date: '2099-08-04',
      weatherCode: 0,
      tempMax: 30,
      tempMin: 18,
      precipitationProbability: 0,
    };

    const { cleanUp } = mountComponent({
      modelValue: true,
      day: futureDay,
      lat: 38.72,
      lng: -9.14,
    });

    await flushAsync();

    const emptyMsg = document.querySelector('.hourly-empty');
    expect(emptyMsg?.textContent?.trim()).toBe(
      'Kein stündlicher Verlauf verfügbar (Tag liegt zu weit in der Zukunft).'
    );

    cleanUp();
  });

  it('rendert geladene stündliche Wetterdaten', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([
      { time: '06:00', temp: 19, weatherCode: 0, precipitationProbability: null },
      { time: '12:00', temp: 28, weatherCode: 1, precipitationProbability: 10 },
    ]);

    const pastDay: DailyWeather = {
      date: '2024-08-04',
      weatherCode: 0,
      tempMax: 30,
      tempMin: 18,
      precipitationProbability: 0,
    };

    const { cleanUp } = mountComponent({
      modelValue: true,
      day: pastDay,
      lat: 38.72,
      lng: -9.14,
    });

    await flushAsync();

    const items = document.querySelectorAll('.hourly-item.loaded-item');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('06:00');
    expect(items[0].textContent).toContain('19°');
    expect(items[1].textContent).toContain('12:00');
    expect(items[1].textContent).toContain('28°');

    cleanUp();
  });
});

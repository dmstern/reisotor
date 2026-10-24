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

  it('renders day pager buttons when multiple days are provided and disables prev on first day', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const day1: DailyWeather = {
      date: '2026-08-06',
      weatherCode: 0,
      tempMax: 30,
      tempMin: 18,
      precipitationProbability: 0,
    };
    const day2: DailyWeather = {
      date: '2026-08-07',
      weatherCode: 1,
      tempMax: 28,
      tempMin: 17,
      precipitationProbability: 20,
    };
    const day3: DailyWeather = {
      date: '2026-08-08',
      weatherCode: 3,
      tempMax: 24,
      tempMin: 15,
      precipitationProbability: 60,
    };

    const onNavigateDay = vi.fn();
    const onUpdateDate = vi.fn();

    const { cleanUp } = mountComponent({
      modelValue: true,
      date: '2026-08-06',
      vacationDays: [day1, day2, day3],
      lat: 38.72,
      lng: -9.14,
      locationLabel: 'Lissabon',
      'onNavigate-day': onNavigateDay,
      'onUpdate:date': onUpdateDate,
    });

    await flushAsync();

    const pager = document.querySelector('.weather-pager');
    expect(pager).not.toBeNull();

    const buttons = pager?.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons).toHaveLength(2);

    const prevBtn = buttons?.[0];
    const nextBtn = buttons?.[1];

    // Day 1 is first: prev disabled, next enabled
    expect(prevBtn?.disabled).toBe(true);
    expect(nextBtn?.disabled).toBe(false);
    expect(document.querySelector('h2')?.textContent).toContain('06.08');
    expect(document.querySelector('.temp-max')?.textContent).toBe('30°');

    // Click next button -> Day 2
    nextBtn?.click();
    await flushAsync();

    expect(onUpdateDate).toHaveBeenCalledWith('2026-08-07');
    expect(onNavigateDay).toHaveBeenCalledWith(day2);
    expect(document.querySelector('h2')?.textContent).toContain('07.08');
    expect(document.querySelector('.temp-max')?.textContent).toBe('28°');
    expect(prevBtn?.disabled).toBe(false);
    expect(nextBtn?.disabled).toBe(false);

    // Click next button -> Day 3 (last day)
    nextBtn?.click();
    await flushAsync();

    expect(document.querySelector('h2')?.textContent).toContain('08.08');
    expect(document.querySelector('.temp-max')?.textContent).toBe('24°');
    expect(prevBtn?.disabled).toBe(false);
    expect(nextBtn?.disabled).toBe(true);

    // Click prev button -> Day 2 again
    prevBtn?.click();
    await flushAsync();

    expect(document.querySelector('h2')?.textContent).toContain('07.08');
    expect(document.querySelector('.temp-max')?.textContent).toBe('28°');

    cleanUp();
  });

  it('supports keyboard navigation via ArrowLeft and ArrowRight', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const day1: DailyWeather = {
      date: '2026-08-06',
      weatherCode: 0,
      tempMax: 30,
      tempMin: 18,
      precipitationProbability: 0,
    };
    const day2: DailyWeather = {
      date: '2026-08-07',
      weatherCode: 1,
      tempMax: 28,
      tempMin: 17,
      precipitationProbability: 20,
    };

    const { cleanUp } = mountComponent({
      modelValue: true,
      date: '2026-08-06',
      vacationDays: [day1, day2],
      lat: 38.72,
      lng: -9.14,
    });

    await flushAsync();
    expect(document.querySelector('h2')?.textContent).toContain('06.08');

    // ArrowRight to next day
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await flushAsync();
    expect(document.querySelector('h2')?.textContent).toContain('07.08');

    // ArrowLeft back to first day
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    await flushAsync();
    expect(document.querySelector('h2')?.textContent).toContain('06.08');

    cleanUp();
  });

  it('preserves navigated date when toggling between vacation and home location', async () => {
    const { fetchHourlyForecast } = await import('../utils/weather');
    vi.mocked(fetchHourlyForecast).mockResolvedValue([]);

    const vac1: DailyWeather = {
      date: '2026-08-06',
      weatherCode: 0,
      tempMax: 35,
      tempMin: 22,
      precipitationProbability: 0,
    };
    const vac2: DailyWeather = {
      date: '2026-08-07',
      weatherCode: 1,
      tempMax: 32,
      tempMin: 20,
      precipitationProbability: 10,
    };
    const home1: DailyWeather = {
      date: '2026-08-06',
      weatherCode: 3,
      tempMax: 20,
      tempMin: 12,
      precipitationProbability: 40,
    };
    const home2: DailyWeather = {
      date: '2026-08-07',
      weatherCode: 61,
      tempMax: 18,
      tempMin: 11,
      precipitationProbability: 80,
    };

    const { cleanUp } = mountComponent({
      modelValue: true,
      date: '2026-08-06',
      vacationDays: [vac1, vac2],
      vacationLat: 38.72,
      vacationLng: -9.14,
      vacationLocationLabel: 'Lissabon',
      homeDays: [home1, home2],
      homeLat: 52.52,
      homeLng: 13.4,
      homeLocationLabel: 'Berlin',
    });

    await flushAsync();

    // Advance to day 2 (07.08)
    const nextBtn = document.querySelectorAll<HTMLButtonElement>('.weather-pager button')[1];
    nextBtn.click();
    await flushAsync();

    expect(document.querySelector('h2')?.textContent).toContain('07.08');
    expect(document.querySelector('.location-badge')?.textContent).toContain('Lissabon');
    expect(document.querySelector('.temp-max')?.textContent).toBe('32°');

    // Toggle to Heimatort
    const toggleOptions = document.querySelectorAll<HTMLButtonElement>('.segmented-option');
    toggleOptions[1].click();
    await flushAsync();

    // Still on 07.08, but home weather is shown
    expect(document.querySelector('h2')?.textContent).toContain('07.08');
    expect(document.querySelector('.location-badge')?.textContent).toContain('Berlin');
    expect(document.querySelector('.temp-max')?.textContent).toBe('18°');

    cleanUp();
  });
});

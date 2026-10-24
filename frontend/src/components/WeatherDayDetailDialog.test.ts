// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, h, nextTick, type Component } from 'vue';
import { createPinia } from 'pinia';
import WeatherDayDetailDialog from './WeatherDayDetailDialog.vue';
import type { DailyWeather } from '../utils/weather';

function mountTestApp(rootComponent: Component, props: Record<string, unknown> = {}) {
  const pinia = createPinia();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(rootComponent, props),
  });
  app.use(pinia);
  const vm = app.mount(container);
  return {
    app,
    container,
    vm,
    cleanUp: () => {
      app.unmount();
      container.remove();
      document.body.innerHTML = '';
    },
  };
}

describe('WeatherDayDetailDialog', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    // Mock fetch for hourly weather
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hourly: {
          time: [
            '2026-08-06T06:00',
            '2026-08-06T09:00',
            '2026-08-06T12:00',
            '2026-08-06T15:00',
            '2026-08-06T18:00',
            '2026-08-06T21:00',
          ],
          weathercode: [0, 0, 1, 1, 0, 0],
          temperature_2m: [18, 24, 32, 36, 34, 27],
          precipitation_probability: [0, 0, 5, 10, 0, 0],
        },
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

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
    const { cleanUp } = mountTestApp(WeatherDayDetailDialog, {
      modelValue: true,
      day: vacationDay,
      lat: 38.72,
      lng: -9.13,
      locationLabel: 'Lissabon, Portugal',
    });
    await nextTick();

    expect(document.querySelector('.location-toggle-wrap')).toBeNull();
    expect(document.querySelector('.location-badge')?.textContent).toContain('Lissabon, Portugal');
    expect(document.querySelector('.temp-max')?.textContent).toBe('37°');

    cleanUp();
  });

  it('renders toggle button when home location is configured and toggles between vacation and home', async () => {
    const { cleanUp } = mountTestApp(WeatherDayDetailDialog, {
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
    await nextTick();

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
    await nextTick();

    expect(document.querySelector('.location-badge')?.textContent).toContain('Berlin');
    expect(document.querySelector('.temp-max')?.textContent).toBe('23°');
    expect(document.querySelector('.temp-min')?.textContent).toBe('14°');
    expect(document.querySelector('.rain-val')?.textContent).toContain('35%');

    // Click Urlaubsort again
    options[0].click();
    await nextTick();

    expect(document.querySelector('.location-badge')?.textContent).toContain('Lissabon, Portugal');
    expect(document.querySelector('.temp-max')?.textContent).toBe('37°');

    cleanUp();
  });

  it('respects initialLocation="home"', async () => {
    const { cleanUp } = mountTestApp(WeatherDayDetailDialog, {
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
    await nextTick();

    expect(document.querySelector('.location-badge')?.textContent).toContain('Berlin');
    expect(document.querySelector('.temp-max')?.textContent).toBe('23°');

    cleanUp();
  });

  it('does not display 0° on missing weather data and displays clear explanation', async () => {
    const unknownDay: DailyWeather = {
      date: '2099-11-08',
      weatherCode: null,
      tempMax: null,
      tempMin: null,
      precipitationProbability: null,
    };

    const { cleanUp } = mountTestApp(WeatherDayDetailDialog, {
      modelValue: true,
      date: '2099-11-08',
      day: unknownDay,
      lat: 38.72,
      lng: -9.13,
      locationLabel: 'Lissabon, Portugal',
    });
    await nextTick();

    // No 0° in temp elements
    expect(document.querySelector('.temp-max')).toBeNull();
    expect(document.querySelector('.temp-unavailable')?.textContent).toBe('–');
    expect(document.querySelector('.unknown-explanation')?.textContent).toContain(
      'zu weit in der Zukunft'
    );

    cleanUp();
  });

  it('correctly displays 0° when temperature is genuinely 0°C', async () => {
    const freezingDay: DailyWeather = {
      date: '2026-12-15',
      weatherCode: 71,
      tempMax: 0,
      tempMin: -4,
      precipitationProbability: 40,
    };

    const { cleanUp } = mountTestApp(WeatherDayDetailDialog, {
      modelValue: true,
      date: '2026-12-15',
      day: freezingDay,
      lat: 47.37,
      lng: 8.54,
      locationLabel: 'Zürich',
    });
    await nextTick();

    expect(document.querySelector('.temp-max')?.textContent).toBe('0°');
    expect(document.querySelector('.temp-min')?.textContent).toBe('-4°');
    expect(document.querySelector('.unknown-explanation')).toBeNull();

    cleanUp();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  function mountComponent(props: {
    modelValue: boolean;
    day: DailyWeather | null;
    lat?: number | null;
    lng?: number | null;
    locationLabel?: string;
  }) {
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
    expect(emptyMsg?.textContent?.trim()).toBe('Kein stündlicher Verlauf verfügbar.');

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

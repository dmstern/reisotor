// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h, type Component } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import DashboardWeatherDayItem from './DashboardWeatherDayItem.vue';
import DashboardWeatherTodayRow from './DashboardWeatherTodayRow.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import type { DailyWeather } from '../../utils/weather';

describe('Dashboard Weather Components', () => {
  function renderWeatherComponent(component: Component, props: Record<string, unknown>) {
    const app = createApp({
      render: () => h(component, props as never),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  const sampleDay: DailyWeather = {
    date: '2026-07-05',
    weatherCode: 0,
    tempMax: 28.4,
    tempMin: 18.2,
    precipitationProbability: 10,
  };

  describe('DashboardWeatherDayItem', () => {
    it('renders weekday date, temperature and rain probability', async () => {
      const html = await renderWeatherComponent(DashboardWeatherDayItem, {
        day: sampleDay,
        dateLabel: 'So., 5. Juli',
      });
      expect(html).toContain('So., 5. Juli');
      expect(html).toContain('28° / 18°');
      expect(html).toContain('10%');
      expect(html).toContain('weather-day');
    });

    it('renders past class when isPast is true', async () => {
      const html = await renderWeatherComponent(DashboardWeatherDayItem, {
        day: sampleDay,
        dateLabel: 'So., 5. Juli',
        isPast: true,
      });
      expect(html).toContain('weather-day');
      expect(html).toContain('past');
    });

    it('renders alert badge when alert is present', async () => {
      const html = await renderWeatherComponent(DashboardWeatherDayItem, {
        day: sampleDay,
        dateLabel: 'So., 5. Juli',
        alert: {
          id: 'alert-1',
          type: 'rain',
          severity: 'warning',
          title: 'Starkregen',
          description: 'Starker Regen erwartet',
          date: '2026-07-05',
        },
      });
      expect(html).toContain('weather-alert-badge');
      expect(html).toContain('warning');
    });
  });

  describe('DashboardWeatherTodayRow', () => {
    it('renders today weather row with label and temps', async () => {
      const html = await renderWeatherComponent(DashboardWeatherTodayRow, {
        weather: sampleDay,
        label: 'Heute Palma',
        icon: ACTION_ICONS.vacation,
      });
      expect(html).toContain('Heute Palma');
      expect(html).toContain('28° / 18°');
      expect(html).toContain('10%');
      expect(html).toContain('weather-today');
    });
  });
});

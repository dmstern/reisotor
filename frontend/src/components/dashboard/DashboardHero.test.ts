// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import DashboardHero from './DashboardHero.vue';
import type { Trip } from '../../api/types';

describe('DashboardHero', () => {
  function renderHero(props: Record<string, unknown> = {}) {
    const app = createApp({
      render: () => h(DashboardHero, props as never),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  const sampleTrip: Trip = {
    id: 1,
    name: 'Sommerurlaub 2026',
    destination: 'Mallorca',
    start_date: '2026-07-01',
    end_date: '2026-07-15',
    maps_link: null,
    lat: 39.5,
    lng: 2.6,
    image_url: 'https://example.com/banner.jpg',
    packing_category_required: 0,
    weather_model: 'best_match',
  };

  it('renders trip name and destination', async () => {
    const html = await renderHero({
      trip: sampleTrip,
    });
    expect(html).toContain('Sommerurlaub 2026');
    expect(html).toContain('Mallorca');
    expect(html).toContain('Bearbeiten');
  });

  it('renders countdown when departure countdown is in days', async () => {
    const html = await renderHero({
      trip: sampleTrip,
      departureCountdown: { phase: 'days', days: 5 },
    });
    expect(html).toContain('Noch');
    expect(html).toContain('5\u00A0Tage');
    expect(html).toContain('bis zur Abreise');
  });

  it('renders vacationPhase when ongoing', async () => {
    const html = await renderHero({
      trip: sampleTrip,
      vacationPhase: { phase: 'ongoing', daysLeft: 7 },
      showVacationCountdown: true,
    });
    expect(html).toContain('Noch');
    expect(html).toContain('7\u00A0Tage');
    expect(html).toContain('Urlaub');
  });

  it('renders isTripOver message when trip is over', async () => {
    const html = await renderHero({
      trip: sampleTrip,
      isTripOver: true,
    });
    expect(html).toContain('Der Urlaub ist vorbei');
  });
});

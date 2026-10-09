// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import ExcursionRouteMeta from './ExcursionRouteMeta.vue';

describe('ExcursionRouteMeta', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountComponent(props: {
    routeLabel?: string | null;
    stationsSummaryText?: string | null;
    effectiveDepartureTime?: string | null;
    effectiveArrivalTime?: string | null;
    travelDuration?: string | null;
  }) {
    const app = createApp({
      render: () => h(ExcursionRouteMeta, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders route label when provided', async () => {
    const html = await mountComponent({
      routeLabel: 'München → Salzburg',
    });
    expect(html).toContain('tour-route-line');
    expect(html).toContain('München → Salzburg');
  });

  it('renders stations summary text if no route label is provided', async () => {
    const html = await mountComponent({
      stationsSummaryText: 'Station A → Station B',
    });
    expect(html).toContain('tour-route-line');
    expect(html).toContain('Station A → Station B');
  });

  it('renders departure and arrival times with duration', async () => {
    const html = await mountComponent({
      effectiveDepartureTime: '08:30',
      effectiveArrivalTime: '10:45',
      travelDuration: '2 Std. 15 Min.',
    });
    expect(html).toContain('08:30');
    expect(html).toContain('10:45');
    expect(html).toContain('2 Std. 15 Min.');
  });
});

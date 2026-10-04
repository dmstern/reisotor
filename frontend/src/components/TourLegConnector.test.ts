import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import TourLegConnector from './TourLegConnector.vue';
import type { Spot, ExcursionLeg } from '../api/types';

describe('TourLegConnector', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const dummyFromSpot: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Start Ort',
    category: 'Strand',
    created_by: 1,
    is_home: 0,
  } as unknown as Spot;

  const dummyToSpot: Spot = {
    id: 2,
    trip_id: 1,
    title: 'Ziel Ort',
    category: 'Restaurant',
    created_by: 1,
    is_home: 0,
  } as unknown as Spot;

  const dummyLeg: ExcursionLeg = {
    position: 0,
    from_spot_id: 1,
    to_spot_id: 2,
    transport_type: 'Zug',
    departure_time: '10:00',
    arrival_time: '11:15',
    amount: 14.5,
  };

  function render(props: any) {
    const app = createApp({
      render: () => h(TourLegConnector, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders horizontal connector with existing leg details', async () => {
    const html = await render({
      variant: 'horizontal',
      fromSpot: dummyFromSpot,
      toSpot: dummyToSpot,
      leg: dummyLeg,
    });

    expect(html).toContain('tour-leg-connector');
    expect(html).toContain('tour-leg-pill');
    expect(html).toContain('is-horizontal-leg');
    expect(html).toContain('10:00–11:15');
    expect(html).toContain('14,50');
  });

  it('renders horizontal add button when leg does not exist', async () => {
    const html = await render({
      variant: 'horizontal',
      fromSpot: dummyFromSpot,
      toSpot: dummyToSpot,
      leg: null,
    });

    expect(html).toContain('tour-leg-connector');
    expect(html).toContain('tour-leg-add-btn');
    expect(html).toContain('Teilstrecke');
  });

  it('renders row-break connector with existing leg details', async () => {
    const html = await render({
      variant: 'row-break',
      fromSpot: dummyFromSpot,
      toSpot: dummyToSpot,
      leg: dummyLeg,
      alignSide: 'right',
    });

    expect(html).toContain('tour-row-break');
    expect(html).toContain('align-right');
    expect(html).toContain('is-row-break');
    expect(html).toContain('Zug');
    expect(html).toContain('14,50');
  });

  it('renders row-break add button when leg does not exist', async () => {
    const html = await render({
      variant: 'row-break',
      fromSpot: dummyFromSpot,
      toSpot: dummyToSpot,
      leg: null,
      alignSide: 'left',
      singleCol: true,
    });

    expect(html).toContain('tour-row-break');
    expect(html).toContain('align-left');
    expect(html).toContain('single-col');
    expect(html).toContain('tour-leg-add-btn');
    expect(html).toContain('Teilstrecke erfassen');
  });
});

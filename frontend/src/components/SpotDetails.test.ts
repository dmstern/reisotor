// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createApp, h } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { renderToString } from 'vue/server-renderer';
import SpotDetails from './SpotDetails.vue';
import type { Spot } from '../api/types';

describe('SpotDetails', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const baseSpot: Spot = {
    id: 1,
    trip_id: 1,
    title: 'Grand Hotel',
    category: 'Unterkunft',
    lat: 52.5,
    lng: 13.4,
    created_by: 1,
    is_home: 0,
  } as Spot;

  function mountComponent(props: {
    spot: Spot;
    expanded: boolean;
    isAccommodation: boolean;
    payerLabel?: string | null;
    hasMultipleMembers?: boolean;
  }) {
    const app = createApp({
      render: () => h(SpotDetails, props),
    });
    app.use(createPinia());
    return renderToString(app);
  }

  it('renders nothing when spot is not accommodation and has no address', async () => {
    const html = await mountComponent({
      spot: { ...baseSpot, category: 'Aktivität', address: null },
      expanded: false,
      isAccommodation: false,
    });
    expect(html).toBe('<!--v-if-->');
  });

  it('renders address detail row when spot has an address', async () => {
    const html = await mountComponent({
      spot: { ...baseSpot, category: 'Aktivität', address: 'Alexanderplatz 1' },
      expanded: true,
      isAccommodation: false,
    });
    expect(html).toContain('spot-accordion');
    expect(html).toContain('is-expanded');
    expect(html).toContain('Adresse');
    expect(html).toContain('Alexanderplatz 1');
  });

  it('renders accommodation details including dates, checkin, contact and cost', async () => {
    const accommodationSpot: Spot = {
      ...baseSpot,
      start_date: '2026-07-01',
      end_date: '2026-07-05',
      checkin: '15:00',
      checkout: '11:00',
      contact: '+49 30 123456',
      amount: 450,
      paid_by_user_id: 2,
    };

    const html = await mountComponent({
      spot: accommodationSpot,
      expanded: true,
      isAccommodation: true,
      payerLabel: 'Sarah',
      hasMultipleMembers: true,
    });

    expect(html).toContain('Zeitraum');
    expect(html).toContain('01.07.2026');
    expect(html).toContain('05.07.2026');
    expect(html).toContain('Check-in/-out');
    expect(html).toContain('15:00 · 11:00');
    expect(html).toContain('Kontakt');
    expect(html).toContain('tel:+4930123456');
    expect(html).toContain('Kosten');
    expect(html).toContain('450.00');
    expect(html).toContain('bezahlt von Sarah');
  });
});

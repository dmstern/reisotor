// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useRegionInfo } from './useRegionInfo';
import type { Trip } from '../api/types';

describe('useRegionInfo', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  const baseTrip: Trip = {
    id: 10,
    name: 'Norwegen',
    destination: 'Oslo',
    start_date: '2026-08-01',
    end_date: '2026-08-15',
    maps_link: null,
    image_url: null,
    packing_category_required: 0,
    weather_model: 'best_match',
    lat: 59.9,
    lng: 10.7,
    owner_restricted: false,
  };

  it('computes empty source parts when regionInfo is null', () => {
    const trip = ref<Trip | null>(baseTrip);
    const { regionSourceParts, regionShowsExchange } = useRegionInfo(trip);

    expect(regionSourceParts.value).toEqual([]);
    expect(regionShowsExchange.value).toBe(false);
  });

  it('computes correct source parts and exchange status when data is present', () => {
    const trip = ref<Trip | null>(baseTrip);
    const composable = useRegionInfo(trip);

    composable.regionInfo.value = {
      countryName: 'Norwegen',
      languages: ['Norwegisch'],
      currency: { code: 'NOK', name: 'Norwegische Krone' },
      exchangeRate: 11.5,
      advisory: { message: 'Keine Reisewarnung', score: 1.2 },
    };

    expect(composable.regionShowsExchange.value).toBe(true);
    expect(composable.regionSourceParts.value).toEqual([
      'REST Countries',
      'open.er-api.com',
      'travel-advisory.info',
    ]);
  });

  it('omits exchange rate source when exchangeRate is null', () => {
    const trip = ref<Trip | null>(baseTrip);
    const composable = useRegionInfo(trip);

    composable.regionInfo.value = {
      countryName: 'Norwegen',
      languages: ['Norwegisch'],
      currency: { code: 'NOK', name: 'Norwegische Krone' },
      exchangeRate: null,
      advisory: null,
    };

    expect(composable.regionShowsExchange.value).toBe(false);
    expect(composable.regionSourceParts.value).toEqual(['REST Countries']);
  });
});

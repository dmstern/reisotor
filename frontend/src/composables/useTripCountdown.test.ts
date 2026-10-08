// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useTripCountdown } from './useTripCountdown';
import type { Trip } from '../api/types';

describe('useTripCountdown', () => {
  const baseTrip: Trip = {
    id: 1,
    name: 'Sommerurlaub',
    destination: 'Mallorca',
    start_date: '2099-07-01',
    end_date: '2099-07-15',
    maps_link: null,
    image_url: null,
    packing_category_required: 0,
    weather_model: 'best_match',
    lat: 39.5,
    lng: 2.6,
    owner_restricted: false,
  };

  it('calculates departure countdown for a future trip', () => {
    const trip = ref<Trip | null>({ ...baseTrip, start_date: '2099-08-01' });
    const { departureCountdown, isTripOver } = useTripCountdown(trip);

    expect(departureCountdown.value).not.toBeNull();
    expect(departureCountdown.value?.phase).toBe('days');
    expect(isTripOver.value).toBe(false);
  });

  it('detects when a trip is over in the past', () => {
    const trip = ref<Trip | null>({
      ...baseTrip,
      start_date: '2020-01-01',
      end_date: '2020-01-10',
    });
    const { departureCountdown, vacationPhase, isTripOver } = useTripCountdown(trip);

    expect(departureCountdown.value?.phase).toBe('departed');
    expect(vacationPhase.value?.phase).toBe('over');
    expect(isTripOver.value).toBe(true);
  });

  it('handles null trip gracefully', () => {
    const trip = ref<Trip | null>(null);
    const { departureCountdown, vacationPhase, isTripOver } = useTripCountdown(trip);

    expect(departureCountdown.value).toBeNull();
    expect(vacationPhase.value).toBeNull();
    expect(isTripOver.value).toBe(false);
  });

  it('provides a valid todayStr in YYYY-MM-DD format', () => {
    const trip = ref<Trip | null>(baseTrip);
    const { todayStr } = useTripCountdown(trip);

    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

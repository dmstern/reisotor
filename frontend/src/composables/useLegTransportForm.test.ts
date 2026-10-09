import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import type { ExcursionLeg, Spot } from '../api/types';
import { emptyLegFormData, buildLegPayload, useLegTransportForm } from './useLegTransportForm';

describe('useLegTransportForm', () => {
  const dummyFromSpot: Spot = {
    id: 10,
    trip_id: 1,
    title: 'Spot A',
    lat: 48.1,
    lng: 11.5,
    category: 'sightseeing',
  } as Spot;

  const dummyToSpot: Spot = {
    id: 20,
    trip_id: 1,
    title: 'Spot B',
    lat: 48.2,
    lng: 11.6,
    category: 'food',
  } as Spot;

  it('initializes with default empty form values', () => {
    const { form, departureLabel, extendedConfig, showsSeatField, hasExtendedData, canDelete } =
      useLegTransportForm();

    expect(form.value.transport_type).toBe('zu Fuß');
    expect(form.value.departure_time).toBe('');
    expect(departureLabel.value).toBe('Losgehen');
    expect(extendedConfig.value.showsSeat).toBe(false);
    expect(showsSeatField.value).toBe(false);
    expect(hasExtendedData.value).toBe(false);
    expect(canDelete.value).toBe(false);
  });

  it('populates from an existing leg and correctly sets canDelete', () => {
    const existingLeg: ExcursionLeg = {
      id: 99,
      position: 0,
      from_spot_id: 10,
      to_spot_id: 20,
      transport_type: 'Auto',
      departure_time: '10:00',
      arrival_time: '11:00',
      checkin_info: 'Gate 2',
      seat: 'Row 3',
      luggage: '2 suitcases',
      ticket_link: 'https://tickets.example.com',
      note: 'Stop for gas',
      amount: 45.5,
      paid_by_user_id: 2,
    };

    const legRef = ref<ExcursionLeg | null>(existingLeg);
    const { form, populateFromLeg, canDelete, departureLabel, showsSeatField, hasExtendedData } =
      useLegTransportForm({ leg: legRef });

    populateFromLeg(existingLeg);

    expect(form.value.transport_type).toBe('Auto');
    expect(form.value.departure_time).toBe('10:00');
    expect(form.value.amount).toBe('45.5');
    expect(departureLabel.value).toBe('Abfahrt');
    expect(showsSeatField.value).toBe(true);
    expect(hasExtendedData.value).toBe(true);
    expect(canDelete.value).toBe(true);
  });

  it('resets form back to default state', () => {
    const { form, resetForm, populateFromLeg } = useLegTransportForm();

    populateFromLeg({
      id: 1,
      position: 0,
      from_spot_id: 10,
      to_spot_id: 20,
      transport_type: 'Flug',
      seat: '12A',
    });

    expect(form.value.seat).toBe('12A');

    resetForm();

    expect(form.value).toEqual(emptyLegFormData());
  });

  it('buildLegPayload correctly builds payload with exact route and empty strings sanitized to null', () => {
    const form = emptyLegFormData();
    form.transport_type = 'Auto';
    form.departure_time = '09:00';
    form.arrival_time = '10:00';
    form.checkin_info = '  P1 Parkplatz  ';
    form.seat = '';
    form.amount = '25.0';
    form.paid_by_user_id = '3';

    const payload = buildLegPayload(form, {
      fromSpot: dummyFromSpot,
      toSpot: dummyToSpot,
      leg: { id: 5, position: 0, from_spot_id: 10, to_spot_id: 20, budget_expense_id: 77 },
      isExactRoute: true,
      routeGeometry: 'abc_encoded_polyline',
      distanceMeters: 15000,
      durationSeconds: 3600,
      routingProfile: 'driving-car',
    });

    expect(payload).toEqual({
      id: 5,
      position: 0,
      from_spot_id: 10,
      to_spot_id: 20,
      transport_type: 'Auto',
      departure_time: '09:00',
      arrival_time: '10:00',
      checkin_info: 'P1 Parkplatz',
      seat: null,
      luggage: null,
      ticket_link: null,
      note: null,
      amount: 25.0,
      paid_by_user_id: 3,
      budget_expense_id: 77,
      route_geometry: 'abc_encoded_polyline',
      distance_meters: 15000,
      duration_seconds: 3600,
      routing_profile: 'driving-car',
    });
  });

  it('buildLegPayload omits exact route when isExactRoute is false', () => {
    const form = emptyLegFormData();
    form.transport_type = 'zu Fuß';

    const payload = buildLegPayload(form, {
      fromSpot: dummyFromSpot,
      toSpot: dummyToSpot,
      isExactRoute: false,
      routeGeometry: 'abc_encoded_polyline',
      distanceMeters: 15000,
      durationSeconds: 3600,
    });

    expect(payload.route_geometry).toBeNull();
    expect(payload.distance_meters).toBeNull();
    expect(payload.duration_seconds).toBeNull();
    expect(payload.routing_profile).toBeNull();
  });
});

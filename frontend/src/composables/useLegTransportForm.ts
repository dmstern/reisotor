import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { ExcursionLeg, Spot } from '../api/types';
import {
  getDepartureLabel,
  getExtendedFieldsConfig,
  type ExtendedFieldsConfig,
} from '../utils/legTransportConfig';

export interface LegFormData {
  transport_type: string;
  departure_time: string;
  arrival_time: string;
  checkin_info: string;
  seat: string;
  luggage: string;
  ticket_link: string;
  note: string;
  amount: string;
  paid_by_user_id: string;
}

export function emptyLegFormData(): LegFormData {
  return {
    transport_type: 'zu Fuß',
    departure_time: '',
    arrival_time: '',
    checkin_info: '',
    seat: '',
    luggage: '',
    ticket_link: '',
    note: '',
    amount: '',
    paid_by_user_id: '',
  };
}

export interface BuildLegPayloadOptions {
  fromSpot: Spot;
  toSpot: Spot;
  leg?: ExcursionLeg | null;
  isExactRoute?: boolean;
  routeGeometry?: string | null;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  routingProfile?: string | null;
}

export function buildLegPayload(form: LegFormData, options: BuildLegPayloadOptions): ExcursionLeg {
  const {
    fromSpot,
    toSpot,
    leg,
    isExactRoute,
    routeGeometry,
    distanceMeters,
    durationSeconds,
    routingProfile,
  } = options;

  return {
    id: leg?.id,
    position: leg?.position ?? 0,
    from_spot_id: fromSpot.id,
    to_spot_id: toSpot.id,
    transport_type: form.transport_type || null,
    departure_time: form.departure_time || null,
    arrival_time: form.arrival_time || null,
    checkin_info: form.checkin_info.trim() || null,
    seat: form.seat.trim() || null,
    luggage: form.luggage.trim() || null,
    ticket_link: form.ticket_link.trim() || null,
    note: form.note.trim() || null,
    amount: form.amount ? Number(form.amount) : null,
    paid_by_user_id: form.amount && form.paid_by_user_id ? Number(form.paid_by_user_id) : null,
    budget_expense_id: leg?.budget_expense_id,
    route_geometry: isExactRoute ? (routeGeometry ?? null) : null,
    distance_meters: isExactRoute ? (distanceMeters ?? null) : null,
    duration_seconds: isExactRoute ? (durationSeconds ?? null) : null,
    routing_profile: isExactRoute ? (routingProfile ?? null) : null,
  };
}

export interface UseLegTransportFormOptions {
  leg?: Ref<ExcursionLeg | null | undefined> | ComputedRef<ExcursionLeg | null | undefined>;
}

export function useLegTransportForm(options: UseLegTransportFormOptions = {}) {
  const form = ref<LegFormData>(emptyLegFormData());
  const isLegUploadingAttachments = ref(false);

  const departureLabel = computed(() => getDepartureLabel(form.value.transport_type));
  const extendedConfig = computed<ExtendedFieldsConfig>(() =>
    getExtendedFieldsConfig(form.value.transport_type)
  );
  const showsSeatField = computed(
    () => extendedConfig.value.showsSeat || Boolean(form.value.seat?.trim())
  );

  const hasExtendedData = computed(() => {
    return Boolean(
      form.value.checkin_info ||
      form.value.seat ||
      form.value.luggage ||
      form.value.ticket_link ||
      form.value.amount ||
      form.value.note
    );
  });

  const canDelete = computed(() => {
    const legVal = options.leg?.value;
    return (
      legVal != null ||
      Boolean(
        form.value.departure_time ||
        form.value.arrival_time ||
        form.value.checkin_info ||
        form.value.seat ||
        form.value.luggage ||
        form.value.ticket_link ||
        form.value.note ||
        form.value.amount
      )
    );
  });

  function resetForm() {
    Object.assign(form.value, emptyLegFormData());
  }

  function populateFromLeg(leg: ExcursionLeg) {
    Object.assign(form.value, {
      transport_type: leg.transport_type || 'zu Fuß',
      departure_time: leg.departure_time || '',
      arrival_time: leg.arrival_time || '',
      checkin_info: leg.checkin_info || '',
      seat: leg.seat || '',
      luggage: leg.luggage || '',
      ticket_link: leg.ticket_link || '',
      note: leg.note || '',
      amount: leg.amount != null ? String(leg.amount) : '',
      paid_by_user_id: leg.paid_by_user_id != null ? String(leg.paid_by_user_id) : '',
    });
  }

  return {
    form,
    isLegUploadingAttachments,
    departureLabel,
    extendedConfig,
    showsSeatField,
    hasExtendedData,
    canDelete,
    resetForm,
    populateFromLeg,
    buildLegPayload,
  };
}

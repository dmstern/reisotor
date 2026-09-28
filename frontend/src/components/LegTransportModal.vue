<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { DirectionsResponse, ExcursionLeg, RouteResult, Spot, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Button from './primitives/Button.vue';
import Select from './primitives/Select.vue';
import Input from './primitives/Input.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import AppIcon from './AppIcon.vue';
import FileAttachments from './FileAttachments.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import LegMiniMap from './LegMiniMap.vue';
import { IconRoute2, IconLineDashed } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIcon, travelTypeIconDef } from '../utils/travelTypeIcon';
import { spotCategoryMeta } from '../utils/spotCategory';
import { parseRouteGeometry } from '../utils/mapRoute';
import { api } from '../api/client';

const TRANSPORT_MODE_OPTIONS = [
  {
    value: 'zu Fuß',
    label: 'Zu Fuß',
    icon: travelTypeIconDef('zu Fuß'),
  },
  {
    value: 'Auto',
    label: 'Auto',
    icon: travelTypeIconDef('Auto'),
  },
  {
    value: 'Fahrrad',
    label: 'Fahrrad',
    icon: travelTypeIconDef('Fahrrad'),
  },
  {
    value: 'ÖPNV',
    label: 'ÖPNV',
    icon: travelTypeIconDef('ÖPNV'),
  },
];

const DEFAULT_TRANSIT_OPTIONS = [
  'Zug',
  'Bus',
  'Straßenbahn',
  'U-Bahn',
  'Fähre',
  'Flug',
  'Sonstiges',
];

type TransportCategory = 'zu Fuß' | 'Auto' | 'Fahrrad' | 'ÖPNV';

function getCategoryFromType(type?: string | null): TransportCategory {
  if (!type) return 'zu Fuß';
  const lower = type.trim().toLowerCase();
  if (lower === 'zu fuß' || lower === 'zu fuss' || lower === 'fuss' || lower === 'fuß') {
    return 'zu Fuß';
  }
  if (lower === 'auto' || lower === 'car') {
    return 'Auto';
  }
  if (lower === 'fahrrad' || lower === 'rad' || lower === 'bike') {
    return 'Fahrrad';
  }
  return 'ÖPNV';
}

const props = defineProps<{
  modelValue: boolean;
  fromSpot?: Spot | null;
  toSpot?: Spot | null;
  leg?: ExcursionLeg | null;
  users: User[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', leg: ExcursionLeg): void;
  (e: 'delete'): void;
}>();

const isLegUploadingAttachments = ref(false);
const isCalculatingRoute = ref(false);
const routeCalculationError = ref<string | null>(null);
const calculatedDistanceMeters = ref<number | null>(null);
const calculatedDurationSeconds = ref<number | null>(null);
const routeGeometry = ref<string | null>(null);
const routingProfile = ref<string | null>(null);

const ROUTE_MODE_OPTIONS: {
  value: 'exact' | 'direct';
  label: string;
  icon: IconDef;
}[] = [
  {
    value: 'exact',
    label: 'Exakte Route',
    icon: { id: 'route-exact', emoji: '🗺️', outline: IconRoute2 },
  },
  {
    value: 'direct',
    label: 'Luftlinie',
    icon: { id: 'route-direct', emoji: '〰️', outline: IconLineDashed },
  },
];

const ROUTE_PREFERENCE_OPTIONS: {
  value: 'fastest' | 'shortest';
  label: string;
  icon: IconDef;
}[] = [
  {
    value: 'fastest',
    label: 'Schnellste Route',
    icon: ACTION_ICONS.duration,
  },
  {
    value: 'shortest',
    label: 'Kürzeste Strecke',
    icon: ACTION_ICONS.distance,
  },
];

const routePreference = ref<'fastest' | 'shortest'>('fastest');
const calculatedRoutes = ref<RouteResult[]>([]);
const selectedRouteIndex = ref<number>(0);

const fastestRouteIndex = computed(() => {
  if (!calculatedRoutes.value.length) return -1;
  let minDur = Infinity;
  let idx = 0;
  calculatedRoutes.value.forEach((r, i) => {
    if (r.duration_seconds < minDur) {
      minDur = r.duration_seconds;
      idx = i;
    }
  });
  return idx;
});

const shortestRouteIndex = computed(() => {
  if (!calculatedRoutes.value.length) return -1;
  let minDist = Infinity;
  let idx = 0;
  calculatedRoutes.value.forEach((r, i) => {
    if (r.distance_meters < minDist) {
      minDist = r.distance_meters;
      idx = i;
    }
  });
  return idx;
});

const suggestedRouteIndex = computed(() => {
  return routePreference.value === 'shortest' ? shortestRouteIndex.value : fastestRouteIndex.value;
});

const routeDisplayMode = ref<'exact' | 'direct'>('exact');
const cachedExactRoute = ref<{
  geometry: string | null;
  distance: number | null;
  duration: number | null;
  profile: string | null;
} | null>(null);

const hasExactRoute = computed(() => {
  return (
    (routeGeometry.value != null || cachedExactRoute.value?.geometry != null) &&
    (calculatedDistanceMeters.value != null || cachedExactRoute.value?.distance != null)
  );
});

const isArrivalAutoCalculated = ref(false);

function selectRoute(idx: number) {
  if (!calculatedRoutes.value[idx]) return;
  selectedRouteIndex.value = idx;
  const selected = calculatedRoutes.value[idx];
  calculatedDistanceMeters.value = selected.distance_meters;
  calculatedDurationSeconds.value = selected.duration_seconds;
  routeGeometry.value = JSON.stringify(selected.coordinates);
  routingProfile.value = selected.profile;
  cachedExactRoute.value = {
    geometry: JSON.stringify(selected.coordinates),
    distance: selected.distance_meters,
    duration: selected.duration_seconds,
    profile: selected.profile,
  };
  routeDisplayMode.value = 'exact';
  if (form.value.departure_time && (!form.value.arrival_time || isArrivalAutoCalculated.value)) {
    updateArrivalTimeFromDuration();
  }
}

function onPreferenceToggle(val: string) {
  const pref = val as 'fastest' | 'shortest';
  routePreference.value = pref;
  if (calculatedRoutes.value.length > 1) {
    const targetIdx = pref === 'shortest' ? shortestRouteIndex.value : fastestRouteIndex.value;
    if (targetIdx >= 0) {
      selectRoute(targetIdx);
    }
  }
}

function onRouteModeChange(val: string) {
  routeDisplayMode.value = val as 'exact' | 'direct';
  routeCalculationError.value = null;
  if (val === 'exact' && cachedExactRoute.value) {
    routeGeometry.value = cachedExactRoute.value.geometry;
    calculatedDistanceMeters.value = cachedExactRoute.value.distance;
    calculatedDurationSeconds.value = cachedExactRoute.value.duration;
    routingProfile.value = cachedExactRoute.value.profile;
  }
}

function resetToDirectLine() {
  routeGeometry.value = null;
  calculatedDistanceMeters.value = null;
  calculatedDurationSeconds.value = null;
  routingProfile.value = null;
  cachedExactRoute.value = null;
  calculatedRoutes.value = [];
  selectedRouteIndex.value = 0;
  routeDisplayMode.value = 'exact';
  routeCalculationError.value = null;
}

function formatDistance(meters?: number | null): string {
  if (meters == null) return '';
  if (meters < 1000) return `${meters} m`;
  const km = (meters / 1000).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${km} km`;
}

function formatDuration(seconds?: number | null): string {
  if (seconds == null) return '';
  const totalMin = Math.round(seconds / 60);
  if (totalMin < 60) return `${totalMin} Min.`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours} Std. ${mins} Min.` : `${hours} Std.`;
}

function formatDiffDuration(diffSeconds: number): string {
  if (diffSeconds < 60) return '< 1 Min.';
  return formatDuration(diffSeconds);
}

const transportCategory = ref<TransportCategory>('zu Fuß');
const selectedTransitType = ref('Zug');

const transitOptions = computed(() => {
  const current = form.value.transport_type;
  if (
    current &&
    !['zu Fuß', 'Zu Fuß', 'Auto', 'Fahrrad'].includes(current) &&
    !DEFAULT_TRANSIT_OPTIONS.includes(current)
  ) {
    return [...DEFAULT_TRANSIT_OPTIONS, current];
  }
  return DEFAULT_TRANSIT_OPTIONS;
});

function onCategorySelect(cat: string) {
  transportCategory.value = cat as TransportCategory;
  if (cat === 'ÖPNV') {
    form.value.transport_type = selectedTransitType.value || 'Zug';
  } else {
    form.value.transport_type = cat;
  }
  routeCalculationError.value = null;
}

function onTransitSelect(val: string) {
  selectedTransitType.value = val;
  if (transportCategory.value === 'ÖPNV') {
    form.value.transport_type = val;
  }
}

const form = ref({
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
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    routeCalculationError.value = null;
    isArrivalAutoCalculated.value = false;
    if (props.leg) {
      const initialType = props.leg.transport_type || 'zu Fuß';
      const cat = getCategoryFromType(initialType);
      transportCategory.value = cat;
      if (cat === 'ÖPNV') {
        selectedTransitType.value = initialType === 'ÖPNV' ? 'Zug' : initialType;
        form.value.transport_type = selectedTransitType.value;
      } else {
        selectedTransitType.value = 'Zug';
        form.value.transport_type = cat;
      }
      form.value.departure_time = props.leg.departure_time || '';
      form.value.arrival_time = props.leg.arrival_time || '';
      form.value.checkin_info = props.leg.checkin_info || '';
      form.value.seat = props.leg.seat || '';
      form.value.luggage = props.leg.luggage || '';
      form.value.ticket_link = props.leg.ticket_link || '';
      form.value.note = props.leg.note || '';
      form.value.amount = props.leg.amount != null ? String(props.leg.amount) : '';
      form.value.paid_by_user_id =
        props.leg.paid_by_user_id != null ? String(props.leg.paid_by_user_id) : '';
      calculatedDistanceMeters.value = props.leg.distance_meters ?? null;
      calculatedDurationSeconds.value = props.leg.duration_seconds ?? null;
      routeGeometry.value = props.leg.route_geometry ?? null;
      routingProfile.value = props.leg.routing_profile ?? null;
      if (props.leg.route_geometry) {
        cachedExactRoute.value = {
          geometry: props.leg.route_geometry,
          distance: props.leg.distance_meters ?? null,
          duration: props.leg.duration_seconds ?? null,
          profile: props.leg.routing_profile ?? null,
        };
        const parsedCoords = parseRouteGeometry(props.leg.route_geometry);
        if (parsedCoords) {
          calculatedRoutes.value = [
            {
              coordinates: parsedCoords,
              distance_meters: props.leg.distance_meters ?? 0,
              duration_seconds: props.leg.duration_seconds ?? 0,
              profile: props.leg.routing_profile ?? '',
            },
          ];
          selectedRouteIndex.value = 0;
        } else {
          calculatedRoutes.value = [];
          selectedRouteIndex.value = 0;
        }
        routeDisplayMode.value = 'exact';
      } else {
        cachedExactRoute.value = null;
        calculatedRoutes.value = [];
        selectedRouteIndex.value = 0;
        routeDisplayMode.value = 'exact';
      }
    } else {
      transportCategory.value = 'zu Fuß';
      selectedTransitType.value = 'Zug';
      form.value = {
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
      calculatedDistanceMeters.value = null;
      calculatedDurationSeconds.value = null;
      routeGeometry.value = null;
      routingProfile.value = null;
      cachedExactRoute.value = null;
      calculatedRoutes.value = [];
      selectedRouteIndex.value = 0;
      routeDisplayMode.value = 'exact';
    }
  },
  { immediate: true }
);

const modalTitle = computed(() => {
  const fromName = props.fromSpot?.title || 'Start';
  const toName = props.toSpot?.title || 'Ziel';
  return `Teilstrecke: ${fromName} → ${toName}`;
});

const hasCoordinates = computed(() => {
  return (
    props.fromSpot?.lat != null &&
    props.fromSpot?.lng != null &&
    props.toSpot?.lat != null &&
    props.toSpot?.lng != null
  );
});

const isRoutable = computed(() => {
  if (!hasCoordinates.value) return false;
  const t = (form.value.transport_type || '').toLowerCase();
  return t === 'auto' || t === 'fahrrad' || t === 'zu fuß' || t === 'zu fuss';
});

function updateArrivalTimeFromDuration() {
  if (!form.value.departure_time || !calculatedDurationSeconds.value) return;
  const [hours, minutes] = form.value.departure_time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return;
  const departureTotalMinutes = hours * 60 + minutes;
  const durationMinutes = Math.round(calculatedDurationSeconds.value / 60);
  const arrivalTotalMinutes = (departureTotalMinutes + durationMinutes) % (24 * 60);
  const arrHours = Math.floor(arrivalTotalMinutes / 60);
  const arrMinutes = arrivalTotalMinutes % 60;
  form.value.arrival_time = `${String(arrHours).padStart(2, '0')}:${String(arrMinutes).padStart(2, '0')}`;
  isArrivalAutoCalculated.value = true;
}

async function calculateRoute() {
  if (!props.fromSpot || !props.toSpot || !hasCoordinates.value) return;
  isCalculatingRoute.value = true;
  routeCalculationError.value = null;

  try {
    const tripId = props.fromSpot.trip_id || props.toSpot.trip_id;
    const res = await api.post<DirectionsResponse>(`/trips/${tripId}/routes/directions`, {
      from_lat: props.fromSpot.lat,
      from_lng: props.fromSpot.lng,
      to_lat: props.toSpot.lat,
      to_lng: props.toSpot.lng,
      transport_type: form.value.transport_type,
      preference: routePreference.value,
    });

    if (!res.supported || !res.routes?.length) {
      routeCalculationError.value = res.reason || 'Keine Route gefunden';
      return;
    }

    calculatedRoutes.value = res.routes.slice(0, 3);
    const suggestedIdx = suggestedRouteIndex.value >= 0 ? suggestedRouteIndex.value : 0;
    selectRoute(suggestedIdx);
  } catch (err: unknown) {
    routeCalculationError.value =
      err instanceof Error ? err.message : 'Fehler beim Abrufen der Route';
  } finally {
    isCalculatingRoute.value = false;
  }
}

const hasExtendedData = computed(() => {
  return !!(
    form.value.checkin_info ||
    form.value.seat ||
    form.value.luggage ||
    form.value.ticket_link ||
    form.value.amount ||
    form.value.note
  );
});

const canDelete = computed(() => {
  return (
    props.leg != null ||
    !!(
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

function onSave() {
  if (!props.fromSpot || !props.toSpot || isLegUploadingAttachments.value) return;
  const isExact = isRoutable.value && routeDisplayMode.value === 'exact' && !!routeGeometry.value;
  const legData: ExcursionLeg = {
    id: props.leg?.id,
    position: props.leg?.position ?? 0,
    from_spot_id: props.fromSpot.id,
    to_spot_id: props.toSpot.id,
    transport_type: form.value.transport_type || null,
    departure_time: form.value.departure_time || null,
    arrival_time: form.value.arrival_time || null,
    checkin_info: form.value.checkin_info.trim() || null,
    seat: form.value.seat.trim() || null,
    luggage: form.value.luggage.trim() || null,
    ticket_link: form.value.ticket_link.trim() || null,
    note: form.value.note.trim() || null,
    amount: form.value.amount ? Number(form.value.amount) : null,
    paid_by_user_id:
      form.value.amount && form.value.paid_by_user_id ? Number(form.value.paid_by_user_id) : null,
    budget_expense_id: props.leg?.budget_expense_id,
    route_geometry: isExact ? routeGeometry.value : null,
    distance_meters: isExact ? calculatedDistanceMeters.value : null,
    duration_seconds: isExact ? calculatedDurationSeconds.value : null,
    routing_profile: isExact ? routingProfile.value : null,
  };
  emit('save', legData);
  emit('update:modelValue', false);
}

function onDelete() {
  if (isLegUploadingAttachments.value) return;
  emit('delete');
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    size="md"
    full-height
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <form class="leg-form" @submit.prevent="onSave">
      <div class="route-summary" v-if="fromSpot && toSpot">
        <span class="spot-pill">
          <AppIcon
            :icon="spotCategoryMeta(fromSpot.category).tabler"
            :size="14"
            group="categories"
          />
          {{ fromSpot.title }}
        </span>
        <span class="arrow">→</span>
        <span class="spot-pill">
          <AppIcon :icon="spotCategoryMeta(toSpot.category).tabler" :size="14" group="categories" />
          {{ toSpot.title }}
        </span>
      </div>

      <SegmentedToggle
        class="transport-toggle"
        :model-value="transportCategory"
        :options="TRANSPORT_MODE_OPTIONS"
        aria-label="Fortbewegungsart"
        @update:model-value="onCategorySelect"
      />

      <!-- Öffi-Detail-Dropdown (nur wenn ÖPNV ausgewählt ist) -->
      <div
        class="transit-dropdown-wrapper"
        :class="{ 'is-expanded': transportCategory === 'ÖPNV' }"
        :inert="transportCategory !== 'ÖPNV' ? true : undefined"
      >
        <div class="transit-dropdown-inner">
          <FormField icon="category" label="Verkehrsmittel">
            <Select
              :model-value="selectedTransitType"
              class="transit-select"
              @update:model-value="onTransitSelect"
            >
              <option v-for="t in transitOptions" :key="t" :value="t">
                {{ travelTypeIcon(t) }} {{ t }}
              </option>
            </Select>
          </FormField>
          <p class="transit-hint">
            ℹ️ Für ÖPNV ist aktuell noch keine exakte Routenberechnung möglich – bitte trage die
            Routendetails daher selbst ein.
          </p>
        </div>
      </div>

      <!-- Exakte Routen-Berechnung & Luftlinie-Umschalter -->
      <div
        class="route-calc-wrapper"
        :class="{ 'is-expanded': isRoutable }"
        :inert="!isRoutable ? true : undefined"
      >
        <div class="route-calc-inner">
          <div class="route-calc-section" :class="{ 'has-route': hasExactRoute }">
            <!-- Zustand 1: Noch keine Route berechnet -> Aufforderung zur Berechnung -->
            <div v-if="!hasExactRoute" class="route-calc-header">
              <div class="route-calc-info">
                <span class="route-calc-title">🗺️ Exakte Route</span>
                <div class="route-calc-detail">
                  <span class="route-calc-hint">
                    Echte Wegeroute, Distanz und Fahrzeit für {{ form.transport_type }} berechnen.
                  </span>
                </div>
              </div>
              <div class="route-calc-init-controls">
                <SegmentedToggle
                  class="route-preference-toggle"
                  :model-value="routePreference"
                  :options="ROUTE_PREFERENCE_OPTIONS"
                  aria-label="Routenpräferenz"
                  @update:model-value="onPreferenceToggle"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="btn-calc-route"
                  :loading="isCalculatingRoute"
                  @click="calculateRoute"
                >
                  Route berechnen
                </Button>
              </div>
            </div>

            <!-- Zustand 2: Route liegt vor -> Mini-Map, Alternativen & Umschalter -->
            <div v-else class="route-calc-active">
              <div class="route-calc-header-mode">
                <div class="route-calc-heading-row">
                  <div class="route-calc-title-group">
                    <span class="route-calc-title">🗺️ Routenführung</span>
                    <span
                      class="route-calc-badge"
                      :class="{ 'route-calc-badge--dashed': routeDisplayMode === 'direct' }"
                    >
                      {{ routeDisplayMode === 'exact' ? 'Exakte Route aktiv' : 'Luftlinie aktiv' }}
                    </span>
                  </div>
                </div>

                <SegmentedToggle
                  class="route-mode-toggle"
                  :model-value="routeDisplayMode"
                  :options="ROUTE_MODE_OPTIONS"
                  aria-label="Routenführung auf der Karte"
                  @update:model-value="onRouteModeChange"
                />
              </div>

              <!-- Mini-Map der Teilstrecke mit Start-, Ziel-Pins und gerouteten Alternativen -->
              <div class="route-mini-map-container">
                <LegMiniMap
                  :from-spot="fromSpot"
                  :to-spot="toSpot"
                  :routes="calculatedRoutes"
                  :selected-route-index="selectedRouteIndex"
                  :transport-type="form.transport_type"
                  :route-display-mode="routeDisplayMode"
                  @select-route="selectRoute"
                />
              </div>

              <div class="route-calc-body">
                <!-- Wenn Exakte Route aktiv ist -->
                <template v-if="routeDisplayMode === 'exact'">
                  <!-- Präferenz-Umschalter (Schnellste vs Kürzeste) -->
                  <div class="route-preference-row">
                    <span class="route-preference-label">Bevorzugen:</span>
                    <SegmentedToggle
                      class="route-preference-toggle"
                      :model-value="routePreference"
                      :options="ROUTE_PREFERENCE_OPTIONS"
                      aria-label="Routenpräferenz"
                      @update:model-value="onPreferenceToggle"
                    />
                  </div>

                  <!-- Mehrere Routenalternativen (bis zu 3) als interaktive Liste -->
                  <div
                    v-if="calculatedRoutes.length > 1"
                    class="route-alternatives-list"
                    role="radiogroup"
                    aria-label="Verfügbare Routenalternativen"
                  >
                    <button
                      v-for="(r, idx) in calculatedRoutes"
                      :key="idx"
                      type="button"
                      class="route-alt-card"
                      :class="{ 'is-selected': idx === selectedRouteIndex }"
                      role="radio"
                      :aria-checked="idx === selectedRouteIndex"
                      @click="selectRoute(idx)"
                    >
                      <div class="route-alt-radio" aria-hidden="true">
                        <span v-if="idx === selectedRouteIndex" class="route-alt-radio-dot"></span>
                      </div>
                      <div class="route-alt-content">
                        <div class="route-alt-title-row">
                          <span class="route-alt-name">Route {{ idx + 1 }}</span>
                          <div class="route-alt-badges">
                            <span
                              v-if="idx === fastestRouteIndex"
                              class="route-alt-badge badge-fastest"
                              title="Schnellste Reisedauer"
                            >
                              ⚡ Schnellste
                            </span>
                            <span
                              v-if="idx === shortestRouteIndex"
                              class="route-alt-badge badge-shortest"
                              title="Kürzeste Fahrtstrecke"
                            >
                              📏 Kürzeste
                            </span>
                            <span
                              v-if="idx === suggestedRouteIndex"
                              class="route-alt-badge badge-suggested"
                              title="Empfehlung anhand gewählter Präferenz"
                            >
                              ⭐ Vorschlag
                            </span>
                          </div>
                        </div>
                        <div class="route-alt-stats">
                          <span class="route-alt-duration">{{
                            formatDuration(r.duration_seconds)
                          }}</span>
                          <span class="route-alt-sep">•</span>
                          <span class="route-alt-distance">{{
                            formatDistance(r.distance_meters)
                          }}</span>
                          <span
                            v-if="
                              idx !== fastestRouteIndex &&
                              fastestRouteIndex >= 0 &&
                              calculatedRoutes[fastestRouteIndex] &&
                              r.duration_seconds >
                                calculatedRoutes[fastestRouteIndex].duration_seconds
                            "
                            class="route-alt-diff"
                          >
                            (+{{
                              formatDiffDuration(
                                r.duration_seconds -
                                  calculatedRoutes[fastestRouteIndex].duration_seconds
                              )
                            }})
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>

                  <!-- Nur 1 Route vorhanden -> Kompakte Anzeige -->
                  <div v-else class="route-calc-detail">
                    <span class="route-calc-stats">
                      {{ formatDistance(calculatedDistanceMeters) }} •
                      {{ formatDuration(calculatedDurationSeconds) }}
                    </span>
                  </div>
                </template>

                <!-- Wenn Luftlinie aktiv ist -->
                <div v-else class="route-calc-detail">
                  <span class="route-calc-hint">
                    Gestrichelte Verbindung auf der Karte (ungefähre Luftlinie).
                  </span>
                </div>

                <div class="route-calc-actions">
                  <Button
                    v-if="routeDisplayMode === 'exact'"
                    type="button"
                    variant="secondary"
                    size="sm"
                    class="btn-calc-route"
                    :loading="isCalculatingRoute"
                    @click="calculateRoute"
                  >
                    <AppIcon :icon="ACTION_ICONS.refresh" :size="13" group="actions" />
                    Neu berechnen
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="btn-reset-route"
                    :title="
                      routeDisplayMode === 'exact'
                        ? 'Exakte Route verwerfen und auf Luftlinie zurücksetzen'
                        : 'Route verwerfen'
                    "
                    @click="resetToDirectLine"
                  >
                    <AppIcon :icon="ACTION_ICONS.restore" :size="13" group="actions" />
                    {{
                      routeDisplayMode === 'exact'
                        ? 'Auf Luftlinie zurücksetzen'
                        : 'Route verwerfen'
                    }}
                  </Button>
                </div>
              </div>
            </div>

            <p v-if="routeCalculationError" class="route-calc-error">
              ⚠️ {{ routeCalculationError }}
            </p>

            <div class="route-calc-footer">
              <a
                href="https://openrouteservice.org/"
                target="_blank"
                rel="noopener noreferrer"
                class="route-source-link"
              >
                Quelle: OpenRouteService
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <FormField icon="time" label="Abfahrt / Abflug">
          <Input v-model="form.departure_time" type="time" />
        </FormField>
        <FormField icon="time" label="Ankunft">
          <div class="arrival-time-wrapper">
            <Input
              v-model="form.arrival_time"
              type="time"
              @input="isArrivalAutoCalculated = false"
            />
            <Button
              v-if="
                form.departure_time && calculatedDurationSeconds && routeDisplayMode === 'exact'
              "
              type="button"
              variant="ghost"
              size="sm"
              class="btn-calc-arrival"
              title="Ankunftszeit aus Reisedauer berechnen"
              @click="updateArrivalTimeFromDuration"
            >
              ⏱️ Berechnen
            </Button>
          </div>
        </FormField>
      </div>

      <CollapsibleFieldset label="Erweiterte Angaben" :open-initial="hasExtendedData">
        <FormField icon="note" label="Vorher da sein / Treffpunkt">
          <Input
            v-model="form.checkin_info"
            type="text"
            placeholder="z. B. Gleis 4 / 2 Std. vorher am Flughafen"
          />
        </FormField>

        <div class="row">
          <FormField icon="note" label="Sitzplatz">
            <Input v-model="form.seat" type="text" placeholder="z. B. Wagen 21, Platz 44" />
          </FormField>
          <FormField icon="note" label="Gepäck">
            <Input
              v-model="form.luggage"
              type="text"
              placeholder="z. B. 1x Koffer 23kg, Handgepäck"
            />
          </FormField>
        </div>

        <FormField icon="link" label="Buchungslink / Ticket-URL">
          <Input v-model="form.ticket_link" type="url" placeholder="https://..." />
        </FormField>

        <div class="row">
          <FormField icon="amount" label="Ticketkosten (€)">
            <Input
              v-model="form.amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="z. B. 49.90"
            />
          </FormField>
          <FormField v-if="users.length > 1" icon="shared" label="Bezahlt von">
            <Select v-model="form.paid_by_user_id">
              <option value="">– wählen –</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">
                {{ u.avatar }} {{ u.username }}
              </option>
            </Select>
          </FormField>
        </div>
        <p v-if="users.length > 1 && form.amount && !form.paid_by_user_id" class="hint">
          Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
        </p>

        <FormField icon="note" label="Notiz zur Teilstrecke">
          <Input
            v-model="form.note"
            type="text"
            placeholder="Tipps zum Umstieg, Buchungscode etc."
          />
        </FormField>
      </CollapsibleFieldset>

      <FileAttachments
        v-if="leg?.id"
        domain="excursion_legs"
        :entity-id="leg.id"
        v-model:uploading="isLegUploadingAttachments"
      />
      <p v-else class="attachments-hint">
        Anhänge (Tickets, Buchungsbestätigungen etc.) können hochgeladen werden, sobald die Tour
        gespeichert wurde.
      </p>

      <div class="actions-row">
        <Button
          v-if="canDelete"
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          :disabled="isLegUploadingAttachments"
          @click="onDelete"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button
          type="button"
          variant="ghost"
          class="btn-cancel"
          :disabled="isLegUploadingAttachments"
          @click="emit('update:modelValue', false)"
        >
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" :disabled="isLegUploadingAttachments">
          Übernehmen
        </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.leg-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.route-summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-hover);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.9rem;
  font-weight: 500;
}

.spot-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.arrow {
  color: var(--color-text-muted);
  font-weight: 700;
  flex-shrink: 0;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.attachments-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.spacer {
  flex: 1;
}

.transport-toggle {
  width: 100%;
}

.transport-toggle :deep(.segmented-option) {
  padding: 6px 8px;
}

.transit-dropdown-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  margin-top: calc(-1 * var(--space-3));
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.25s ease,
    visibility 0s linear 0.35s;
}

.transit-dropdown-wrapper.is-expanded {
  grid-template-rows: 1fr;
  margin-top: 0;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s ease,
    visibility 0s linear 0s;
}

.transit-dropdown-inner {
  min-height: 0;
  overflow: hidden;
  padding: 4px;
  margin: -4px;
}

.transit-dropdown-wrapper:not(.is-expanded) .transit-dropdown-inner {
  transform: translateY(-6px);
  opacity: 0;
  pointer-events: none;
}

.transit-dropdown-wrapper.is-expanded .transit-dropdown-inner {
  transform: translateY(0);
  opacity: 1;
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.transit-hint {
  margin: var(--space-2) 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.route-calc-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  margin-top: calc(-1 * var(--space-3));
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s ease,
    visibility 0s linear 0.38s;
}

.route-calc-wrapper.is-expanded {
  grid-template-rows: 1fr;
  margin-top: 0;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.38s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.32s ease,
    visibility 0s linear 0s;
}

.route-calc-inner {
  min-height: 0;
  overflow: hidden;
  /* Reserviert Platz für Outline-Fokus (z. B. Button-Fokus-Ring) */
  padding: 4px;
  margin: -4px;
}

.route-calc-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-surface-subtle, var(--color-hover));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    transform 0.38s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}

.route-calc-wrapper:not(.is-expanded) .route-calc-section {
  transform: translateY(-8px) scale(0.99);
  opacity: 0;
  pointer-events: none;
}

.route-calc-wrapper.is-expanded .route-calc-section {
  transform: translateY(0) scale(1);
  opacity: 1;
}

.route-calc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.route-calc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 40px;
  justify-content: center;
}

.route-calc-detail {
  display: flex;
  min-height: 1.25rem;
  align-items: center;
}

.route-calc-title {
  font-weight: 600;
  font-size: 0.875rem;
}

.route-calc-stats {
  font-weight: 700;
  color: var(--color-primary);
  font-size: 0.9375rem;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-calc-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.btn-calc-route {
  flex-shrink: 0;
  min-width: 125px;
  justify-content: center;
}

.route-calc-active {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.route-calc-header-mode {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.route-calc-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.route-calc-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.route-calc-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: 999px;
  background: var(--color-primary-tint);
  color: var(--color-primary);
  line-height: 1.2;
}

.route-calc-badge--dashed {
  background: var(--color-hover);
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
}

.route-mode-toggle {
  width: 100%;
}

.route-calc-init-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.route-mini-map-container {
  width: 100%;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
}

.route-preference-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.route-preference-toggle {
  flex: 1;
  max-width: 320px;
}

.route-preference-toggle :deep(.segmented-option) {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.route-alternatives-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-alt-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
  width: 100%;
}

.route-alt-card:hover {
  border-color: var(--color-primary-light, #93c5fd);
  background: var(--color-hover);
}

.route-alt-card.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-tint, #eff6ff);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.route-alt-radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.15s ease;
}

.route-alt-card.is-selected .route-alt-radio {
  border-color: var(--color-primary);
}

.route-alt-radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.route-alt-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.route-alt-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.route-alt-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.route-alt-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.route-alt-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 999px;
  line-height: 1.3;
}

.badge-fastest {
  background: #e0f2fe;
  color: #0369a1;
}

.badge-shortest {
  background: #f0fdf4;
  color: #15803d;
}

.badge-suggested {
  background: #fef3c7;
  color: #b45309;
}

:root[data-theme='dark'] .badge-fastest {
  background: rgba(3, 105, 161, 0.25);
  color: #7dd3fc;
}

:root[data-theme='dark'] .badge-shortest {
  background: rgba(21, 128, 61, 0.25);
  color: #86efac;
}

:root[data-theme='dark'] .badge-suggested {
  background: rgba(180, 83, 9, 0.25);
  color: #fde68a;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .badge-fastest {
    background: rgba(3, 105, 161, 0.25);
    color: #7dd3fc;
  }
  :root:not([data-theme='light']) .badge-shortest {
    background: rgba(21, 128, 61, 0.25);
    color: #86efac;
  }
  :root:not([data-theme='light']) .badge-suggested {
    background: rgba(180, 83, 9, 0.25);
    color: #fde68a;
  }
}

.route-alt-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.route-alt-duration {
  font-weight: 600;
  color: var(--color-text);
}

.route-alt-card.is-selected .route-alt-duration {
  color: var(--color-primary);
}

.route-alt-diff {
  color: var(--color-text-muted);
  font-style: italic;
}

.route-calc-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.route-calc-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: 4px;
}

.btn-reset-route {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  padding: 4px 8px;
  white-space: nowrap;
}

.btn-reset-route:hover {
  color: var(--color-danger, #ef4444);
}

.route-calc-error {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-danger, #ef4444);
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-calc-footer {
  display: flex;
  margin-top: 2px;
}

.route-source-link {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  text-decoration: underline;
  text-decoration-style: dotted;
  transition: color 0.15s ease;
  font-family: inherit;
}

.route-source-link:hover {
  color: var(--color-primary-dark);
}

@keyframes route-content-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.arrival-time-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.arrival-time-wrapper :deep(input) {
  flex: 1;
}

.btn-calc-arrival {
  flex-shrink: 0;
  white-space: nowrap;
  animation: btn-arrival-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes btn-arrival-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .transit-dropdown-wrapper,
  .transit-dropdown-inner,
  .route-calc-wrapper,
  .route-calc-section,
  .route-calc-stats,
  .route-calc-hint,
  .route-calc-error,
  .btn-calc-arrival {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}

@media (max-width: 600px) {
  .row {
    grid-template-columns: 1fr;
  }

  .route-calc-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .route-calc-init-controls {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .route-preference-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .route-preference-toggle {
    max-width: 100%;
    width: 100%;
  }

  .route-calc-body {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .route-calc-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

@media (max-width: 480px) {
  .transport-toggle :deep(.segmented-option),
  .route-mode-toggle :deep(.segmented-option) {
    padding: 6px 4px;
    font-size: 0.8rem;
    gap: 4px;
  }
}
</style>

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import type { ExcursionLeg, Spot, User } from '../api/types';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import Alert from './primitives/Alert.vue';
import FileAttachments from './FileAttachments.vue';
import LegMiniMap from './LegMiniMap.vue';
import LegRouteAlternatives from './LegRouteAlternatives.vue';
import LegExtendedDetails from './LegExtendedDetails.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import AppIcon from './AppIcon.vue';
import { IconLink, IconLinkOff, IconMapRoute } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIcon } from '../utils/travelTypeIcon';
import { spotCategoryMeta } from '../utils/spotCategory';
import { formatDuration } from '../utils/formatRoute';
import {
  TRANSPORT_MODE_OPTIONS,
  DEFAULT_TRANSIT_OPTIONS,
  ROUTE_MODE_OPTIONS,
  ROUTE_PREFERENCE_OPTIONS,
  getCategoryFromType,
  getDepartureLabel,
  getExtendedFieldsConfig,
  type TransportCategory,
} from '../utils/legTransportConfig';
import { useLegTimeSync, calcElapsedMinutes } from '../composables/useLegTimeSync';
import { useRouteCalculation } from '../composables/useRouteCalculation';

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
const transportCategory = ref<TransportCategory>('zu Fuß');
const selectedTransitType = ref('Zug');

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

const departureLabel = computed(() => getDepartureLabel(form.value.transport_type));
const extendedConfig = computed(() => getExtendedFieldsConfig(form.value.transport_type));
const showsSeatField = computed(
  () => extendedConfig.value.showsSeat || Boolean(form.value.seat?.trim())
);

const fromCoords = computed(() => ({
  lat: props.fromSpot?.lat,
  lng: props.fromSpot?.lng,
}));

const toCoords = computed(() => ({
  lat: props.toSpot?.lat,
  lng: props.toSpot?.lng,
}));

const tripId = computed(() => props.fromSpot?.trip_id || props.toSpot?.trip_id);

const transportTypeRef = computed(() => form.value.transport_type);

const {
  isCalculatingRoute,
  routeCalculationError,
  calculatedDistanceMeters,
  calculatedDurationSeconds,
  routeGeometry,
  routingProfile,
  routePreference,
  calculatedRoutes,
  selectedRouteIndex,
  fastestRouteIndex,
  shortestRouteIndex,
  suggestedRouteIndex,
  routeDisplayMode,
  hasExactRoute,
  hasCoordinates,
  isRoutable,
  calculateRoute,
  selectRoute,
  onPreferenceToggle,
  onRouteModeChange,
  setInitialRoute,
} = useRouteCalculation({
  tripId,
  fromCoords,
  toCoords,
  transportType: transportTypeRef,
  onRouteSelected: (selected) => {
    if (isTimeLinked.value || !form.value.arrival_time || !form.value.departure_time) {
      syncTimesWithDuration(selected.duration_seconds);
    }
  },
});

const isRoutingOpen = ref(true);

const isRoutingDisabled = computed(() => !isRoutable.value);

const routingDisabledTitle = computed(() => {
  if (transportCategory.value === 'ÖPNV') {
    return 'Für ÖPNV ist aktuell noch keine Routenberechnung möglich – bitte trage die Routendetails daher selbst ein.';
  }
  if (!hasCoordinates.value) {
    return 'Für diese Teilstrecke liegen keine Koordinaten für Start oder Ziel vor.';
  }
  return undefined;
});

watch(isRoutingDisabled, (disabled) => {
  if (disabled) {
    isRoutingOpen.value = false;
  }
});

const activeDurationSeconds = computed<number | null>(() => {
  if (
    routeDisplayMode.value === 'exact' &&
    calculatedDurationSeconds.value != null &&
    calculatedDurationSeconds.value > 0
  ) {
    return calculatedDurationSeconds.value;
  }
  return null;
});

const departureTimeRef = toRef(form.value, 'departure_time');
const arrivalTimeRef = toRef(form.value, 'arrival_time');

const {
  lastModifiedTimeField,
  isTimeLinked,
  isCalculatingDepartureSparkle,
  isCalculatingArrivalSparkle,
  canCalcArrival,
  canCalcDeparture,
  arrivalSparkleTitle,
  departureSparkleTitle,
  canToggleLink,
  timeLinkTitle,
  timeDurationStatus,
  syncTimesWithDuration,
  onDepartureInput,
  onArrivalInput,
  calcArrivalFromDeparture,
  calcDepartureFromArrival,
  toggleTimeLink,
  applySuggestedTime,
} = useLegTimeSync({
  departureTime: departureTimeRef,
  arrivalTime: arrivalTimeRef,
  activeDurationSeconds,
  departureLabel,
});

const timeDurationInfo = computed<{ label: string; duration: string } | null>(() => {
  if (
    timeDurationStatus.value?.type === 'mismatch' ||
    timeDurationStatus.value?.type === 'suggest'
  ) {
    return null;
  }

  if (activeDurationSeconds.value && activeDurationSeconds.value > 0) {
    const durStr = formatDuration(activeDurationSeconds.value);
    let label = 'Reisedauer';
    const cat = transportCategory.value;
    if (cat === 'zu Fuß') label = 'Gehzeit';
    else if (cat === 'Auto' || cat === 'Fahrrad') label = 'Fahrzeit';
    else if (form.value.transport_type === 'Flugzeug') label = 'Flugdauer';
    return { label, duration: durStr };
  }

  if (form.value.departure_time && form.value.arrival_time) {
    const elapsed = calcElapsedMinutes(form.value.departure_time, form.value.arrival_time);
    if (elapsed != null && elapsed > 0) {
      let label = 'Reisedauer';
      const cat = transportCategory.value;
      if (cat === 'zu Fuß') label = 'Gehzeit';
      else if (cat === 'Auto' || cat === 'Fahrrad' || cat === 'ÖPNV') label = 'Fahrzeit';
      else if (form.value.transport_type === 'Flugzeug') label = 'Flugdauer';
      return { label, duration: formatDuration(elapsed * 60) };
    }
  }

  return null;
});

const timeLinkedIconDef: IconDef = {
  id: 'link',
  emoji: '🔗',
  outline: IconLink,
};

const timeUnlinkedIconDef: IconDef = {
  id: 'link-off',
  emoji: '🔓',
  outline: IconLinkOff,
};

const routeHeadingIconDef: IconDef = {
  id: 'map-route',
  emoji: '🗺️',
  outline: IconMapRoute,
};

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
    isRoutingOpen.value = false;
    // Wenn von Auto/Fahrrad/zu Fuß auf ÖPNV gewechselt wird:
    // Aktive Routenberechnung leeren, damit die alte Auto-/Gehzeit nicht im ÖPNV verbleibt
    calculatedDurationSeconds.value = null;
    calculatedDistanceMeters.value = null;
    routeGeometry.value = null;
    calculatedRoutes.value = [];
    if (isTimeLinked.value) {
      if (lastModifiedTimeField.value === 'departure' && form.value.arrival_time) {
        form.value.arrival_time = '';
      } else if (lastModifiedTimeField.value === 'arrival' && form.value.departure_time) {
        form.value.departure_time = '';
      }
    }
  } else {
    form.value.transport_type = cat;
    if (hasCoordinates.value) {
      isRoutingOpen.value = true;
    }
  }
  routeCalculationError.value = null;
}

function onTransitSelect(val: string) {
  selectedTransitType.value = val;
  if (transportCategory.value === 'ÖPNV') {
    form.value.transport_type = val;
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    routeCalculationError.value = null;
    if (props.leg) {
      const initialType = props.leg.transport_type || 'zu Fuß';
      const cat = getCategoryFromType(initialType);
      transportCategory.value = cat;
      if (cat === 'ÖPNV') {
        selectedTransitType.value = initialType === 'ÖPNV' ? 'Zug' : initialType;
        form.value.transport_type = selectedTransitType.value;
        isRoutingOpen.value = false;
      } else {
        selectedTransitType.value = 'Zug';
        form.value.transport_type = cat;
        isRoutingOpen.value = isRoutable.value;
      }
      form.value.departure_time = props.leg.departure_time || '';
      form.value.arrival_time = props.leg.arrival_time || '';
      if (form.value.arrival_time && !form.value.departure_time) {
        lastModifiedTimeField.value = 'arrival';
      } else {
        lastModifiedTimeField.value = 'departure';
      }
      if (form.value.departure_time && form.value.arrival_time && props.leg.duration_seconds) {
        const elapsed = calcElapsedMinutes(form.value.departure_time, form.value.arrival_time);
        const durMins = Math.round(props.leg.duration_seconds / 60);
        isTimeLinked.value = elapsed != null && Math.abs(elapsed - durMins) <= 1;
      } else {
        isTimeLinked.value = true;
      }
      form.value.checkin_info = props.leg.checkin_info || '';
      form.value.seat = props.leg.seat || '';
      form.value.luggage = props.leg.luggage || '';
      form.value.ticket_link = props.leg.ticket_link || '';
      form.value.note = props.leg.note || '';
      form.value.amount = props.leg.amount != null ? String(props.leg.amount) : '';
      form.value.paid_by_user_id =
        props.leg.paid_by_user_id != null ? String(props.leg.paid_by_user_id) : '';

      setInitialRoute(
        props.leg.route_geometry,
        props.leg.distance_meters,
        props.leg.duration_seconds,
        props.leg.routing_profile
      );
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
      lastModifiedTimeField.value = 'departure';
      isTimeLinked.value = true;
      isRoutingOpen.value = isRoutable.value;
      setInitialRoute(null, null, null, null);
    }
  },
  { immediate: true }
);

const modalTitle = computed(() => {
  const fromName = props.fromSpot?.title || 'Start';
  const toName = props.toSpot?.title || 'Ziel';
  return `Teilstrecke: ${fromName} → ${toName}`;
});

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
    <template #title>
      <span class="leg-modal-title">
        <span>Teilstrecke:</span>
        <span class="leg-modal-spot">
          <AppIcon
            v-if="fromSpot"
            :icon="spotCategoryMeta(fromSpot.category).tabler"
            :size="18"
            group="categories"
          />
          <span class="leg-modal-spot-name">{{ fromSpot?.title || 'Start' }}</span>
        </span>
        <span class="leg-modal-arrow" aria-hidden="true">→</span>
        <span class="leg-modal-spot">
          <AppIcon
            v-if="toSpot"
            :icon="spotCategoryMeta(toSpot.category).tabler"
            :size="18"
            group="categories"
          />
          <span class="leg-modal-spot-name">{{ toSpot?.title || 'Ziel' }}</span>
        </span>
      </span>
    </template>

    <form class="leg-form" @submit.prevent="onSave">
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
        </div>
      </div>

      <!-- Exakte Routen-Berechnung & Luftlinie-Umschalter -->
      <CollapsibleFieldset
        v-model="isRoutingOpen"
        label="Routenführung"
        :icon="routeHeadingIconDef"
        :disabled="isRoutingDisabled"
        :title="routingDisabledTitle"
        class="route-calc-fieldset"
      >
        <template v-if="!isRoutingDisabled && isCalculatingRoute" #badge>
          <span class="route-calc-badge route-calc-badge--loading">
            <AppIcon
              :icon="ACTION_ICONS.refresh"
              :size="12"
              group="actions"
              class="route-calc-spinner"
            />
            Route wird berechnet…
          </span>
        </template>

        <!-- Zustand 1: Noch keine Route berechnet -> Aufforderung zur Berechnung -->
        <div v-if="!hasExactRoute" class="route-calc-header">
          <div class="route-calc-info">
            <span class="route-calc-hint">
              Exakte Route, Distanz und Fahrzeit für {{ form.transport_type }} berechnen.
            </span>
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
          <SegmentedToggle
            class="route-mode-toggle"
            :model-value="routeDisplayMode"
            :options="ROUTE_MODE_OPTIONS"
            aria-label="Routenführung auf der Karte"
            @update:model-value="onRouteModeChange"
          />

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
            <!-- Exakte Route: Routenberechnung & Alternativen -->
            <div
              class="route-mode-pane route-mode-pane--exact"
              :class="{ 'is-active': routeDisplayMode === 'exact' }"
              :inert="routeDisplayMode !== 'exact' ? true : undefined"
            >
              <div class="route-mode-pane-inner">
                <LegRouteAlternatives
                  :routes="calculatedRoutes"
                  :selected-route-index="selectedRouteIndex"
                  :route-preference="routePreference"
                  :fastest-route-index="fastestRouteIndex"
                  :shortest-route-index="shortestRouteIndex"
                  :suggested-route-index="suggestedRouteIndex"
                  :calculated-distance-meters="calculatedDistanceMeters"
                  :calculated-duration-seconds="calculatedDurationSeconds"
                  @select-route="selectRoute"
                  @update:route-preference="onPreferenceToggle"
                />
              </div>
            </div>

            <!-- Luftlinie: Info-Hinweis -->
            <div
              class="route-mode-pane route-mode-pane--direct"
              :class="{ 'is-active': routeDisplayMode === 'direct' }"
              :inert="routeDisplayMode !== 'direct' ? true : undefined"
            >
              <div class="route-mode-pane-inner">
                <div class="route-calc-detail">
                  <span class="route-calc-hint">
                    Gestrichelte Verbindung auf der Karte (ungefähre Luftlinie).
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p v-if="routeCalculationError" class="route-calc-error">
          <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
          <span>{{ routeCalculationError }}</span>
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
      </CollapsibleFieldset>

      <div class="time-section">
        <div class="time-row">
          <FormField icon="time" :label="departureLabel" class="time-field time-field--departure">
            <div
              class="time-input-wrap departure-time-wrapper"
              :class="{ 'has-sparkle': canCalcDeparture }"
            >
              <Input
                v-model="form.departure_time"
                type="time"
                @input="onDepartureInput"
                @change="onDepartureInput"
              />
              <button
                v-if="canCalcDeparture"
                type="button"
                class="time-sparkle-btn departure-sparkle-btn"
                :class="{ 'sparkle-spin': isCalculatingDepartureSparkle }"
                :title="departureSparkleTitle"
                :aria-label="departureSparkleTitle"
                data-testid="departure-sparkle-btn"
                @mousedown.prevent
                @click="calcDepartureFromArrival"
              >
                <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
              </button>
            </div>
          </FormField>

          <!-- Kettensegment-Koppel-Button zwischen Abfahrt und Ankunft (Photoshop/Gimp-Stil) -->
          <div
            class="time-link-connector"
            :class="{ 'is-linked': isTimeLinked, 'is-disabled': !canToggleLink }"
          >
            <button
              type="button"
              class="time-link-btn"
              :class="{ 'is-linked': isTimeLinked }"
              :disabled="!canToggleLink"
              :title="timeLinkTitle"
              :aria-label="timeLinkTitle"
              data-testid="time-link-toggle"
              @click="toggleTimeLink"
            >
              <AppIcon
                :icon="isTimeLinked ? timeLinkedIconDef : timeUnlinkedIconDef"
                :size="15"
                group="actions"
              />
            </button>
          </div>

          <FormField icon="time" label="Ankunft" class="time-field time-field--arrival">
            <div
              class="time-input-wrap arrival-time-wrapper"
              :class="{ 'has-sparkle': canCalcArrival }"
            >
              <Input
                v-model="form.arrival_time"
                type="time"
                @input="onArrivalInput"
                @change="onArrivalInput"
              />
              <button
                v-if="canCalcArrival"
                type="button"
                class="time-sparkle-btn arrival-sparkle-btn"
                :class="{ 'sparkle-spin': isCalculatingArrivalSparkle }"
                :title="arrivalSparkleTitle"
                :aria-label="arrivalSparkleTitle"
                data-testid="arrival-sparkle-btn"
                @mousedown.prevent
                @click="calcArrivalFromDeparture"
              >
                <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
              </button>
            </div>
          </FormField>
        </div>

        <!-- Diskreter Dauer-Chip (wenn Zeiten synchron oder bekannt) -->
        <div v-if="timeDurationInfo" class="time-meta-row" data-testid="time-duration-chip">
          <span class="time-duration-chip" :class="{ 'is-linked': isTimeLinked }">
            <AppIcon :icon="ACTION_ICONS.duration" :size="13" group="actions" />
            <span>
              {{ timeDurationInfo.label }}:
              <strong>{{ timeDurationInfo.duration }}</strong>
            </span>
          </span>
        </div>

        <!-- Warnhinweis nur bei Mismatch (Zeiten weichen von Reisedauer ab) -->
        <Alert
          v-if="timeDurationStatus?.type === 'mismatch'"
          class="time-sync-bar time-sync-bar--mismatch"
          variant="warning"
          :icon="ACTION_ICONS.warning"
          size="sm"
          data-testid="time-sync-bar"
        >
          <span class="time-sync-message">
            Zeitfenster:
            <strong>{{ formatDuration((timeDurationStatus.elapsedMinutes ?? 0) * 60) }}</strong>
            (Reisedauer: {{ formatDuration(activeDurationSeconds) }},
            {{
              (timeDurationStatus.diffMinutes ?? 0) > 0
                ? `+${formatDuration((timeDurationStatus.diffMinutes ?? 0) * 60)} Puffer`
                : `-${formatDuration(Math.abs(timeDurationStatus.diffMinutes ?? 0) * 60)}`
            }})
          </span>

          <template #actions>
            <Button type="button" size="sm" variant="secondary" @click="syncTimesWithDuration()">
              Anpassen
            </Button>
          </template>
        </Alert>

        <!-- Übernahme-Vorschlag wenn nur ein Zeitfeld befüllt und Zeiten entkoppelt -->
        <Alert
          v-else-if="timeDurationStatus?.type === 'suggest'"
          class="time-sync-bar time-sync-bar--suggest"
          variant="info"
          :icon="ACTION_ICONS.sparkles"
          size="sm"
          data-testid="time-sync-bar"
        >
          <span class="time-sync-message">
            {{ timeDurationStatus.text }}
          </span>

          <template #actions>
            <Button
              type="button"
              size="sm"
              variant="primary"
              :icon="ACTION_ICONS.sparkles"
              data-testid="time-apply-btn"
              @click="applySuggestedTime(timeDurationStatus.field!, timeDurationStatus.target)"
            >
              Übernehmen
            </Button>
          </template>
        </Alert>
      </div>

      <LegExtendedDetails
        v-model:checkin-info="form.checkin_info"
        v-model:seat="form.seat"
        v-model:luggage="form.luggage"
        v-model:ticket-link="form.ticket_link"
        v-model:amount="form.amount"
        v-model:paid-by-user-id="form.paid_by_user_id"
        v-model:note="form.note"
        :extended-config="extendedConfig"
        :shows-seat-field="showsSeatField"
        :users="users"
        :has-extended-data="hasExtendedData"
      />

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

.leg-modal-title {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
}

.leg-modal-spot {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.leg-modal-spot-name {
  word-break: break-word;
}

.leg-modal-arrow {
  color: var(--color-text-muted);
  font-weight: 700;
  flex-shrink: 0;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
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

.route-calc-badge--loading {
  gap: var(--space-1);
  background: var(--color-primary-tint);
  color: var(--color-primary);
}

.route-calc-spinner {
  animation: route-spin 1s linear infinite;
}

@keyframes route-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
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

.route-calc-body {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
}

.route-mode-pane {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0s linear 0.35s;
}

.route-mode-pane.is-active {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1) 0.06s,
    visibility 0s linear 0s;
}

.route-mode-pane-inner {
  min-height: 0;
  overflow: hidden;
  transform: translateY(-4px);
  opacity: 0;
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.route-mode-pane.is-active .route-mode-pane-inner {
  transform: translateY(0);
  opacity: 1;
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.route-calc-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-danger);
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

.time-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.time-input-wrap :deep(.input) {
  width: 100%;
}

.time-input-wrap.has-sparkle :deep(input) {
  padding-right: 56px;
}

.time-sparkle-btn {
  position: absolute;
  right: 30px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  transition:
    transform 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
  z-index: 2;
}

.time-sparkle-btn:hover {
  background-color: var(--color-surface-hover, var(--color-hover));
  color: var(--color-primary-hover, var(--color-primary-dark));
  transform: translateY(-50%) scale(1.15);
}

.time-sparkle-btn:active {
  transform: translateY(-50%) scale(0.92);
}

.time-sparkle-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

@keyframes sparkleRotate {
  0% {
    transform: translateY(-50%) rotate(0deg) scale(0.9);
  }
  50% {
    transform: translateY(-50%) rotate(180deg) scale(1.2);
  }
  100% {
    transform: translateY(-50%) rotate(360deg) scale(1);
  }
}

.sparkle-spin {
  animation: sparkleRotate 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.time-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.time-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: flex-end;
  gap: var(--space-2);
  position: relative;
}

.time-field {
  min-width: 0;
}

.time-link-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  position: relative;
  padding: 0 4px;
}

.time-link-connector::before,
.time-link-connector::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 8px;
  height: 1.5px;
  background: var(--color-border-strong);
  transition: background-color 0.18s ease;
  pointer-events: none;
}

.time-link-connector::before {
  right: 100%;
}

.time-link-connector::after {
  left: 100%;
}

.time-link-connector.is-linked::before,
.time-link-connector.is-linked::after {
  background: var(--color-primary);
}

.time-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm-squircle, 8px);
  corner-shape: squircle;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
  padding: 0;
  z-index: 2;
}

.time-link-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-surface-hover, var(--color-hover));
  transform: scale(1.1);
  box-shadow: var(--shadow-sm);
}

.time-link-btn:active:not(:disabled) {
  transform: scale(0.94);
}

.time-link-btn.is-linked {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
  color: var(--color-primary);
}

.time-link-btn.is-linked:hover:not(:disabled) {
  background: var(--color-primary-tint);
  border-color: var(--color-primary-hover, var(--color-primary-dark));
  color: var(--color-primary-hover, var(--color-primary-dark));
}

.time-link-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.time-link-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.time-meta-row {
  display: flex;
  justify-content: center;
  animation: route-content-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.time-duration-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.time-duration-chip.is-linked {
  color: var(--color-primary-dark, var(--color-primary));
  background: var(--color-primary-tint);
  border-color: transparent;
}

.time-sync-bar {
  margin-top: calc(-1 * var(--space-1));
}

.time-sync-message {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .transit-dropdown-wrapper,
  .transit-dropdown-inner,
  .route-mode-pane,
  .route-mode-pane-inner,
  .route-calc-hint,
  .route-calc-error,
  .sparkle-spin,
  .time-link-btn,
  .time-link-connector::before,
  .time-link-connector::after,
  .time-duration-chip,
  .time-meta-row {
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

  .route-calc-body {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }
}

@media (max-width: 480px) {
  .transport-toggle :deep(.segmented-option),
  .route-mode-toggle :deep(.segmented-option) {
    padding: 6px 4px;
    font-size: 0.8rem;
    gap: var(--space-1);
  }
}
</style>

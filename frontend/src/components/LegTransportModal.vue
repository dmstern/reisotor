<script setup lang="ts">
import { computed, toRef, watch } from 'vue';
import type { ExcursionLeg, Spot, User } from '../api/types';
import Modal from './Modal.vue';
import Button from './primitives/Button.vue';
import FileAttachments from './FileAttachments.vue';
import LegModalHeader from './LegModalHeader.vue';
import LegTransportModeSelector from './LegTransportModeSelector.vue';
import LegRouteSection from './LegRouteSection.vue';
import LegTimeSection from './LegTimeSection.vue';
import LegExtendedDetails from './LegExtendedDetails.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { TransportCategory } from '../utils/legTransportConfig';
import { useLegTransportForm } from '../composables/useLegTransportForm';
import { useLegTransportMode } from '../composables/useLegTransportMode';
import { useLegRoutingAccordion } from '../composables/useLegRoutingAccordion';
import { useLegTimeSync } from '../composables/useLegTimeSync';
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

const legPropRef = toRef(props, 'leg');
const {
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
} = useLegTransportForm({ leg: legPropRef });

const transportTypeRef = computed({
  get: () => form.value.transport_type,
  set: (val: string) => {
    form.value.transport_type = val;
  },
});

const fromCoords = computed(() => ({
  lat: props.fromSpot?.lat,
  lng: props.fromSpot?.lng,
}));

const toCoords = computed(() => ({
  lat: props.toSpot?.lat,
  lng: props.toSpot?.lng,
}));

const tripId = computed(() => props.fromSpot?.trip_id || props.toSpot?.trip_id);

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
  setInitialRoute,
  clearRoute,
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

const {
  transportCategory,
  selectedTransitType,
  transitOptions,
  selectCategory,
  selectTransit,
  initTransportMode,
} = useLegTransportMode({
  transportType: transportTypeRef,
});

const { isRoutingOpen, isRoutingDisabled, routingDisabledTitle, openRouting, closeRouting } =
  useLegRoutingAccordion({
    isRoutable,
    hasCoordinates,
    transportCategory,
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

const departureTimeRef = computed({
  get: () => form.value.departure_time,
  set: (val: string) => {
    form.value.departure_time = val;
  },
});

const arrivalTimeRef = computed({
  get: () => form.value.arrival_time,
  set: (val: string) => {
    form.value.arrival_time = val;
  },
});

const {
  isTimeLinked,
  canToggleLink,
  timeLinkTitle,
  timeDurationStatus,
  timeDurationInfo,
  syncTimesWithDuration,
  onDepartureInput,
  onArrivalInput,
  toggleTimeLink,
  applySuggestedTime,
  clearLinkedTimes,
  initTimeState,
} = useLegTimeSync({
  departureTime: departureTimeRef,
  arrivalTime: arrivalTimeRef,
  activeDurationSeconds,
  departureLabel,
  transportCategory,
  transportType: transportTypeRef,
});

function onCategorySelect(cat: string) {
  selectCategory(cat as TransportCategory, {
    onÖpnvSelected: () => {
      closeRouting();
      clearRoute();
      clearLinkedTimes();
    },
    onRoutableCategorySelected: () => {
      if (hasCoordinates.value) {
        openRouting();
      }
    },
  });
}

function onTransitSelect(val: string) {
  selectTransit(val);
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    routeCalculationError.value = null;
    if (props.leg) {
      populateFromLeg(props.leg);
      const cat = initTransportMode(props.leg.transport_type);
      if (cat === 'ÖPNV') {
        closeRouting();
      } else {
        if (isRoutable.value) openRouting();
      }
      initTimeState(props.leg.departure_time, props.leg.arrival_time, props.leg.duration_seconds);
      setInitialRoute(
        props.leg.route_geometry,
        props.leg.distance_meters,
        props.leg.duration_seconds,
        props.leg.routing_profile
      );
    } else {
      resetForm();
      initTransportMode('zu Fuß');
      initTimeState(null, null, null);
      if (isRoutable.value) openRouting();
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

function onSave() {
  if (!props.fromSpot || !props.toSpot || isLegUploadingAttachments.value) return;
  const isExact = isRoutable.value && routeDisplayMode.value === 'exact' && !!routeGeometry.value;
  const legData = buildLegPayload(form.value, {
    fromSpot: props.fromSpot,
    toSpot: props.toSpot,
    leg: props.leg,
    isExactRoute: isExact,
    routeGeometry: routeGeometry.value,
    distanceMeters: calculatedDistanceMeters.value,
    durationSeconds: calculatedDurationSeconds.value,
    routingProfile: routingProfile.value,
  });
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
      <LegModalHeader :from-spot="fromSpot" :to-spot="toSpot" />
    </template>

    <form class="leg-form" @submit.prevent="onSave">
      <LegTransportModeSelector
        :category="transportCategory"
        :transit-type="selectedTransitType"
        :transit-options="transitOptions"
        @select-category="onCategorySelect"
        @select-transit="onTransitSelect"
      />

      <LegRouteSection
        v-model:is-open="isRoutingOpen"
        v-model:route-preference="routePreference"
        v-model:route-display-mode="routeDisplayMode"
        :is-disabled="isRoutingDisabled"
        :disabled-title="routingDisabledTitle"
        :is-calculating-route="isCalculatingRoute"
        :has-exact-route="hasExactRoute"
        :route-calculation-error="routeCalculationError"
        :transport-type="form.transport_type"
        :from-spot="fromSpot"
        :to-spot="toSpot"
        :calculated-routes="calculatedRoutes"
        :selected-route-index="selectedRouteIndex"
        :fastest-route-index="fastestRouteIndex"
        :shortest-route-index="shortestRouteIndex"
        :suggested-route-index="suggestedRouteIndex"
        :calculated-distance-meters="calculatedDistanceMeters"
        :calculated-duration-seconds="calculatedDurationSeconds"
        @calculate-route="calculateRoute"
        @select-route="selectRoute"
      />

      <LegTimeSection
        v-model:departure-time="form.departure_time"
        v-model:arrival-time="form.arrival_time"
        :departure-label="departureLabel"
        :is-time-linked="isTimeLinked"
        :can-toggle-link="canToggleLink"
        :time-link-title="timeLinkTitle"
        :time-duration-info="timeDurationInfo"
        :time-duration-status="timeDurationStatus"
        :active-duration-seconds="activeDurationSeconds"
        @departure-input="onDepartureInput"
        @arrival-input="onArrivalInput"
        @toggle-time-link="toggleTimeLink"
        @sync-times="syncTimesWithDuration"
        @apply-suggested-time="applySuggestedTime"
      />

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
          variant="secondary"
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
  container-type: inline-size;
  container-name: leg-modal;
}

.attachments-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.spacer {
  flex: 1;
}
</style>

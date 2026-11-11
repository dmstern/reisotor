<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Excursion, Spot } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDiaryEntityLinks } from '../composables/useDiaryEntityLinks';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { formatDate } from '../utils/dateFormat';
import AppIcon from './AppIcon.vue';
import Alert from './primitives/Alert.vue';
import Checkbox from './primitives/Checkbox.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';

const props = defineProps<{
  date: string;
}>();

const excursionIds = defineModel<number[]>('excursionIds', { default: () => [] });
const spotIds = defineModel<number[]>('spotIds', { default: () => [] });

const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const links = useDiaryEntityLinks();

const showExcursionPicker = ref(excursionIds.value.length > 0);
const showSpotPicker = ref(spotIds.value.length > 0);

// Wenn initial IDs vorhanden sind (z. B. beim Bearbeiten), Fieldsets automatisch öffnen
watch(
  () => excursionIds.value.length,
  (len) => {
    if (len > 0) {
      showExcursionPicker.value = true;
    }
  }
);
watch(
  () => spotIds.value.length,
  (len) => {
    if (len > 0) {
      showSpotPicker.value = true;
    }
  }
);

const excursions = computed(() => links.pickerExcursions(props.date));
const spots = computed(() => links.pickerSpots(props.date));

function formatSpotScheduled(spotId: number): string {
  const dates = links.getSpotScheduledDates(spotId);

  if (dates.length === 1) {
    return `Geplant am ${formatDate(dates[0])}`;
  }

  if (dates.length === 2) {
    return `Geplant (${formatDate(dates[0], { includeYear: false })}, ${formatDate(dates[1], { includeYear: false })})`;
  }

  if (dates.length > 2) {
    return `Geplant (${formatDate(dates[0], { includeYear: false })}, ${formatDate(dates[1], { includeYear: false })}, +${dates.length - 2})`;
  }

  return '';
}

function formatSpotScheduledFull(spotId: number): string {
  const dates = links.getSpotScheduledDates(spotId);

  if (dates.length === 1) {
    return `Geplant am ${formatDate(dates[0])}`;
  }

  if (dates.length > 1) {
    return `Geplant (${dates.map((entryDate) => formatDate(entryDate, { includeYear: false })).join(', ')})`;
  }

  return '';
}

const mismatchedExcursions = computed(() => {
  if (!props.date) {
    return [];
  }

  return excursionIds.value
    .map((id) => excursionsStore.excursions.find((e) => e.id === id))
    .filter((e): e is Excursion => !!e && links.excursionDateMismatch(e, props.date));
});

const mismatchedSpots = computed(() => {
  if (!props.date) {
    return [];
  }

  return spotIds.value
    .map((id) => spotsStore.spots.find((spot) => spot.id === id))
    .filter((spot): spot is Spot => !!spot && links.spotDateMismatch(spot.id, props.date));
});

const hasDateMismatch = computed(() => {
  return mismatchedExcursions.value.length > 0 || mismatchedSpots.value.length > 0;
});
</script>

<template>
  <div class="diary-entity-pickers">
    <CollapsibleFieldset
      v-if="excursionsStore.excursions.length"
      v-model="showExcursionPicker"
      label="Touren zuordnen"
      :count="excursionIds.length ? `(${excursionIds.length} ausgewählt)` : undefined"
      :icon="SECTION_ICON_DEFS.excursions"
      icon-group="navigation"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
      <label
        :for="`diary-excursion-${ex.id}`"
        v-for="ex in excursions"
        :key="ex.id"
        class="diary-picker-option excursion-option"
      >
        <Checkbox :id="`diary-excursion-${ex.id}`" :value="ex.id" v-model="excursionIds" />
        <span class="diary-picker-option-content">
          <span class="diary-picker-option-title excursion-option-title">
            <span class="diary-picker-option-name">{{ ex.title }}</span>
          </span>
          <span
            v-if="ex.date === date"
            class="diary-picker-badge excursion-option-badge recommended"
          >
            <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" />
            <span class="diary-picker-badge-text">Empfohlen – an diesem Tag geplant</span>
          </span>
          <span
            v-else-if="links.excursionDateMismatch(ex, date)"
            class="diary-picker-badge excursion-option-badge warning"
          >
            <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
            <span class="diary-picker-badge-text">Geplant am {{ formatDate(ex.date!) }}</span>
          </span>
        </span>
      </label>
    </CollapsibleFieldset>

    <CollapsibleFieldset
      v-if="spotsStore.spots.length"
      v-model="showSpotPicker"
      label="Spots zuordnen"
      :count="spotIds.length ? `(${spotIds.length} ausgewählt)` : undefined"
      :icon="FORM_FIELD_ICONS.location"
      icon-group="formFields"
    >
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
      <label
        v-for="spot in spots"
        :key="spot.id"
        :for="`diary-spot-${spot.id}`"
        class="diary-picker-option excursion-option spot-option-item spot-option-btn"
      >
        <Checkbox :id="`diary-spot-${spot.id}`" :value="spot.id" v-model="spotIds" />
        <span class="diary-picker-option-content">
          <span class="diary-picker-option-title excursion-option-title">
            <AppIcon :icon="spotCategoryMeta(spot.category).tabler" :size="14" group="categories" />
            <span class="diary-picker-option-name">{{ spot.title }}</span>
          </span>
          <span
            v-if="links.spotAlreadyPlanned(spot.id, date)"
            class="diary-picker-badge excursion-option-badge recommended"
          >
            <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" />
            <span class="diary-picker-badge-text">Empfohlen – an diesem Tag geplant</span>
          </span>
          <span
            v-else-if="links.spotDateMismatch(spot.id, date)"
            class="diary-picker-badge excursion-option-badge warning"
            :title="formatSpotScheduledFull(spot.id)"
          >
            <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
            <span class="diary-picker-badge-text">{{ formatSpotScheduled(spot.id) }}</span>
          </span>
        </span>
      </label>
    </CollapsibleFieldset>

    <Alert
      v-if="hasDateMismatch"
      variant="warning"
      size="sm"
      :icon="ACTION_ICONS.warning"
      class="diary-mismatch-alert"
      data-testid="diary-date-mismatch-alert"
    >
      <div class="mismatch-alert-content">
        <span class="mismatch-alert-header"
          >Folgende ausgewählte Elemente sind für andere Tage geplant:</span
        >
        <ul class="mismatch-list">
          <li v-for="ex in mismatchedExcursions" :key="`ex-${ex.id}`">
            <strong>{{ ex.title }}</strong> (geplant am {{ formatDate(ex.date!) }})
          </li>
          <li v-for="spot in mismatchedSpots" :key="`spot-${spot.id}`">
            <strong>{{ spot.title }}</strong> ({{ formatSpotScheduledFull(spot.id) }})
          </li>
        </ul>
      </div>
    </Alert>
  </div>
</template>

<style scoped>
.diary-entity-pickers {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.diary-picker-option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  user-select: none;
  font-size: var(--font-size-sm);
  font-weight: 400;
  transition: background-color var(--transition-fast);
}

.diary-picker-option:hover {
  background-color: var(--color-hover);
}

.diary-picker-option:focus-within {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.diary-picker-option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

@container (min-width: 480px) {
  .diary-picker-option-content {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }
}

.diary-picker-option-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  max-width: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  line-height: 1.4;
  min-height: 24px;
}

.diary-picker-option-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diary-picker-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  max-width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  width: fit-content;
}

.diary-picker-badge-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diary-picker-badge.recommended {
  background: var(--color-primary-tint);
  color: var(--color-text);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  corner-shape: round;
  font-weight: 600;
}

.diary-picker-badge.warning {
  background: var(--color-warning-tint);
  color: var(--color-warning-dark);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  corner-shape: round;
  font-weight: 600;
}

.diary-mismatch-alert {
  margin-top: var(--space-1);
}

.mismatch-alert-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
}

.mismatch-alert-header {
  font-weight: 600;
}

.mismatch-list {
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>

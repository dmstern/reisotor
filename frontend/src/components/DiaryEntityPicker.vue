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
import Button from './primitives/Button.vue';
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

function toggleSpot(spotId: number) {
  const current = [...spotIds.value];
  const idx = current.indexOf(spotId);

  if (idx === -1) {
    current.push(spotId);
  } else {
    current.splice(idx, 1);
  }

  spotIds.value = current;
}
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
        class="excursion-option"
      >
        <Checkbox :id="`diary-excursion-${ex.id}`" :value="ex.id" v-model="excursionIds" />
        <span class="excursion-option-title">{{ ex.title }}</span>
        <span v-if="ex.date === date" class="excursion-option-badge recommended">
          <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
          diesem Tag geplant
        </span>
        <span
          v-else-if="links.excursionDateMismatch(ex, date)"
          class="excursion-option-badge warning"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" /> Geplant am
          {{ formatDate(ex.date!) }}
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
      <Button
        v-for="spot in spots"
        :key="spot.id"
        type="button"
        class="excursion-option spot-option-btn"
        @click="toggleSpot(spot.id)"
      >
        <span class="excursion-option-title">
          <AppIcon :icon="spotCategoryMeta(spot.category).tabler" :size="14" group="categories" />
          {{ spot.title }}
        </span>
        <span
          v-if="spotIds.includes(spot.id) && links.spotDateMismatch(spot.id, date)"
          class="excursion-option-badge warning"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
          {{ formatSpotScheduled(spot.id) }}
        </span>
        <span v-else-if="spotIds.includes(spot.id)" class="excursion-option-badge">
          <AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt
        </span>
        <span
          v-else-if="links.spotAlreadyPlanned(spot.id, date)"
          class="excursion-option-badge recommended"
        >
          <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
          diesem Tag geplant
        </span>
        <span
          v-else-if="links.spotDateMismatch(spot.id, date)"
          class="excursion-option-badge warning"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
          {{ formatSpotScheduled(spot.id) }}
        </span>
      </Button>
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
            <strong>{{ spot.title }}</strong> ({{ formatSpotScheduled(spot.id) }})
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

.excursion-option {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  row-gap: var(--space-1);
  column-gap: var(--space-2);
  font-size: var(--font-size-sm);
  font-weight: 400;
  width: 100%;
  cursor: pointer;
}

.excursion-option-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spot-option-btn {
  background: none;
  border: none;
  box-shadow: none;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
  min-height: 36px;
}

.spot-option-btn:hover {
  background: var(--color-hover);
}

.spot-option-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.spot-option-btn:active {
  box-shadow: none;
}

.excursion-option-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-success);
  white-space: nowrap;
  flex-shrink: 0;
}

.excursion-option-badge.recommended {
  background: var(--color-primary-tint);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  corner-shape: round;
  font-weight: 600;
}

.excursion-option-badge.warning {
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

@container (max-width: 360px) {
  label.excursion-option .excursion-option-badge {
    margin-left: calc(20px + var(--space-2));
  }
}
</style>

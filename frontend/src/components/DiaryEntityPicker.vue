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
import Badge from './primitives/Badge.vue';
import Checkbox from './primitives/Checkbox.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';

const BADGE_ICON_SIZE = 13;
const SPOT_ICON_SIZE = 14;

const props = defineProps<{
  date: string;
}>();

const excursionIds = defineModel<number[]>('excursionIds', { default: () => [] });
const spotIds = defineModel<number[]>('spotIds', { default: () => [] });
const moveSpotIds = defineModel<number[]>('moveSpotIds', { default: () => [] });

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
watch(
  () => spotIds.value,
  (currentSpotIds) => {
    if (moveSpotIds.value.some((id) => !currentSpotIds.includes(id))) {
      moveSpotIds.value = moveSpotIds.value.filter((id) => currentSpotIds.includes(id));
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

function toggleId(list: number[], id: number, checked: boolean): number[] {
  if (checked) {
    return list.includes(id) ? list : [...list, id];
  }

  return list.filter((item) => item !== id);
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
      <div class="diary-picker-list">
        <DropdownMenuItem
          v-for="ex in excursions"
          :key="ex.id"
          multiselect
          :input-id="`diary-excursion-${ex.id}`"
          :checked="excursionIds.includes(ex.id)"
          :active="excursionIds.includes(ex.id)"
          :value="ex.id"
          :label="ex.title"
          class="excursion-option"
          @update:checked="excursionIds = toggleId(excursionIds, ex.id, $event)"
        >
          <template #trailing>
            <Badge
              v-if="ex.date === date"
              variant="primary"
              size="sm"
              class="excursion-option-badge recommended"
            >
              <AppIcon :icon="ACTION_ICONS.recommended" :size="BADGE_ICON_SIZE" group="actions" />
              Empfohlen – an diesem Tag geplant
            </Badge>
            <Badge
              v-else-if="links.excursionDateMismatch(ex, date)"
              variant="warning"
              size="sm"
              class="excursion-option-badge warning"
            >
              <AppIcon :icon="ACTION_ICONS.warning" :size="BADGE_ICON_SIZE" group="actions" />
              Geplant am {{ formatDate(ex.date!) }}
            </Badge>
          </template>
        </DropdownMenuItem>
      </div>
    </CollapsibleFieldset>

    <CollapsibleFieldset
      v-if="spotsStore.spots.length"
      v-model="showSpotPicker"
      label="Spots zuordnen"
      :count="spotIds.length ? `(${spotIds.length} ausgewählt)` : undefined"
      :icon="FORM_FIELD_ICONS.location"
      icon-group="formFields"
    >
      <div class="diary-picker-list">
        <DropdownMenuItem
          v-for="spot in spots"
          :key="spot.id"
          multiselect
          :input-id="`diary-spot-${spot.id}`"
          :icon="spotCategoryMeta(spot.category).tabler"
          icon-group="categories"
          :icon-size="SPOT_ICON_SIZE"
          :checked="spotIds.includes(spot.id)"
          :active="spotIds.includes(spot.id)"
          :value="spot.id"
          :label="spot.title"
          class="excursion-option spot-option-item spot-option-btn"
          @update:checked="spotIds = toggleId(spotIds, spot.id, $event)"
        >
          <template #trailing>
            <Badge
              v-if="links.spotAlreadyPlanned(spot.id, date)"
              variant="primary"
              size="sm"
              class="excursion-option-badge recommended"
            >
              <AppIcon :icon="ACTION_ICONS.recommended" :size="BADGE_ICON_SIZE" group="actions" />
              Empfohlen – an diesem Tag geplant
            </Badge>
            <Badge
              v-else-if="links.spotDateMismatch(spot.id, date)"
              variant="warning"
              size="sm"
              class="excursion-option-badge warning"
              :title="formatSpotScheduledFull(spot.id)"
            >
              <AppIcon :icon="ACTION_ICONS.warning" :size="BADGE_ICON_SIZE" group="actions" />
              {{ formatSpotScheduled(spot.id) }}
            </Badge>
          </template>
        </DropdownMenuItem>
      </div>
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
          <li v-for="spot in mismatchedSpots" :key="`spot-${spot.id}`" class="mismatch-spot-item">
            <div class="mismatch-spot-info">
              <strong>{{ spot.title }}</strong> ({{ formatSpotScheduledFull(spot.id) }})
            </div>
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label :for="`diary-move-spot-${spot.id}`" class="mismatch-opt-in-label">
              <Checkbox
                :id="`diary-move-spot-${spot.id}`"
                :value="spot.id"
                v-model="moveSpotIds"
                size="sm"
              />
              <span class="mismatch-opt-in-text">
                Geplantes Datum im Reiseplan auf den {{ formatDate(date) }} verschieben
              </span>
            </label>
          </li>
        </ul>
      </div>
    </Alert>
  </div>
</template>

<style lang="scss" scoped>
.diary-entity-pickers {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
  max-width: 100%;
}

.diary-picker-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
}

.diary-mismatch-alert {
  margin: 0;
}

.mismatch-alert-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
}

.mismatch-alert-header {
  font-weight: 600;
}

.mismatch-list {
  margin: 0;
  padding-left: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.mismatch-spot-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.mismatch-opt-in-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  user-select: none;
  margin-top: var(--space-2xs);
}

@include can-hover {
  .mismatch-opt-in-label:hover {
    color: var(--color-text);
  }
}

.mismatch-opt-in-text {
  line-height: var(--line-height-snug);
}
</style>

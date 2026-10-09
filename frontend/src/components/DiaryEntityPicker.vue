<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDiaryEntityLinks } from '../composables/useDiaryEntityLinks';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import AppIcon from './AppIcon.vue';
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
    if (len > 0) showExcursionPicker.value = true;
  }
);
watch(
  () => spotIds.value.length,
  (len) => {
    if (len > 0) showSpotPicker.value = true;
  }
);

const excursions = computed(() => links.pickerExcursions(props.date));
const spots = computed(() => links.pickerSpots(props.date));

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
        <span v-if="spotIds.includes(spot.id)" class="excursion-option-badge">
          <AppIcon :icon="ACTION_ICONS.done" :size="13" group="actions" /> hinzugefügt
        </span>
        <span
          v-else-if="links.spotAlreadyPlanned(spot.id, date)"
          class="excursion-option-badge recommended"
        >
          <AppIcon :icon="ACTION_ICONS.recommended" :size="13" group="actions" /> Empfohlen – an
          diesem Tag geplant
        </span>
      </Button>
    </CollapsibleFieldset>
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
  padding: var(--space-1) 0;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: var(--color-text);
  min-height: 36px;
}

.spot-option-btn:hover {
  background: var(--color-hover);
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

@container (max-width: 360px) {
  label.excursion-option .excursion-option-badge {
    margin-left: calc(20px + var(--space-2));
  }
}
</style>

<script setup lang="ts">
import { ref } from 'vue';
import Combobox from './Combobox.vue';
import AppIcon from './AppIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

// Schneller Weg, um einen Spot einer oder mehreren Touren zuzuordnen, direkt im Spot-Formular
// (ExcursionsView.vue) statt im Touren-Formular – Gegenstück zu SpotOrderPicker.vue (das ordnet
// umgekehrt Spots einer Tour zu, inkl. Reihenfolge). Arbeitet mit Tour-TITELN statt
// -Ids: passt ein getippter Titel zu keiner bestehenden Tour, entsteht beim Speichern eine neue
// (siehe ExcursionsView.vue's syncSpotTours()) – "creatable" wie die Kategorie-Combobox.
const props = defineProps<{
  modelValue: string[];
  tourOptions: string[];
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const pendingTitle = ref('');

function addTour() {
  const title = pendingTitle.value.trim();
  if (!title) return;
  if (!props.modelValue.some((t) => t.toLowerCase() === title.toLowerCase())) {
    emit('update:modelValue', [...props.modelValue, title]);
  }
  pendingTitle.value = '';
}

function removeTour(title: string) {
  emit('update:modelValue', props.modelValue.filter((t) => t !== title));
}
</script>

<template>
  <div class="tour-assign-picker">
    <div class="tour-chips" v-if="modelValue.length">
      <span v-for="title in modelValue" :key="title" class="tour-chip">
        <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="13" group="navigation" /> {{ title }}
        <button type="button" class="remove-btn" @click="removeTour(title)" aria-label="Von Tour entfernen">
          <AppIcon :icon="ACTION_ICONS.close" :size="13" group="actions" />
        </button>
      </span>
    </div>
    <div class="tour-add-row">
      <Combobox v-model="pendingTitle" :options="tourOptions" placeholder="Tour zuordnen (neu oder bestehend)" @keydown.enter.prevent="addTour" />
      <button type="button" class="secondary" @click="addTour">Hinzufügen</button>
    </div>
  </div>
</template>

<style scoped>
.tour-assign-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.tour-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tour-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border-radius: 999px;
  padding: 2px 6px 2px 10px;
  font-size: 0.82rem;
}

.remove-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.8rem;
}

.remove-btn:hover {
  color: var(--color-danger);
}

.tour-add-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}
</style>

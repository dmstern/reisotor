<script setup lang="ts">
import { computed, ref } from 'vue';
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
  category?: string;
  isHome?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

const pendingTitle = ref('');
const combobox = ref<InstanceType<typeof Combobox> | null>(null);

const suggestedTours = computed(() => {
  const isHomeOrZuhause = props.isHome || props.category?.trim().toLowerCase() === 'zuhause';
  if (!isHomeOrZuhause) return [];
  const defaults = ['Anreise', 'Heimreise'];
  // Bestehende Touren bevorzugen oder Standardwerte vorschlagen
  const candidates = new Set<string>();
  for (const opt of props.tourOptions) {
    if (/anreise/i.test(opt) || /heimreise/i.test(opt) || /abreise/i.test(opt)) {
      candidates.add(opt);
    }
  }
  for (const d of defaults) {
    if (![...candidates].some((c) => c.toLowerCase() === d.toLowerCase())) {
      candidates.add(d);
    }
  }
  return [...candidates].filter((c) => !props.modelValue.some((m) => m.toLowerCase() === c.toLowerCase()));
});

function addTour() {
  const title = pendingTitle.value.trim();
  if (!title) return;
  if (!props.modelValue.some((t) => t.toLowerCase() === title.toLowerCase())) {
    emit('update:modelValue', [...props.modelValue, title]);
  }
  pendingTitle.value = '';
  // Ohne den (jetzt entfernten) separaten "Hinzufügen"-Button verliert das Eingabefeld nach dem
  // Übernehmen (Enter/Auswahl) nicht mehr den Fokus - die Dropdown-Liste aktiv schließen, sonst
  // zeigt sie wegen des zurückgesetzten leeren Texts sofort wieder ungefiltert alle Touren an und
  // überdeckt darunterliegende Elemente (z. B. den Formular-Submit-Button).
  combobox.value?.close();
}

function addSuggestedTour(title: string) {
  if (!props.modelValue.some((t) => t.toLowerCase() === title.toLowerCase())) {
    emit('update:modelValue', [...props.modelValue, title]);
  }
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

    <div v-if="suggestedTours.length" class="tour-suggestions">
      <span class="suggestion-label">Vorschlag:</span>
      <button
        v-for="sug in suggestedTours"
        :key="sug"
        type="button"
        class="suggestion-chip"
        @click="addSuggestedTour(sug)"
      >
        + {{ sug }}
      </button>
    </div>

    <Combobox
      ref="combobox"
      v-model="pendingTitle"
      :options="tourOptions"
      placeholder="Tour zuordnen (neu oder bestehend)"
      @keydown.enter.prevent="addTour"
      @select="addTour"
    />

    <p class="tour-info-hint">
      <AppIcon :icon="ACTION_ICONS.info" :size="12" group="actions" />
      Touren eignen sich auch, um Anreise- oder Heimreise-Routen mit Zwischenstopps zu planen.
    </p>
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

.tour-suggestions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 0.78rem;
}

.suggestion-label {
  color: var(--color-text-muted);
  font-weight: 500;
}

.suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.suggestion-chip:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.tour-info-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
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
</style>

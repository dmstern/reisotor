<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';

// Ersetzt (#106) den früheren "Auf Tour ziehen"-Anfasser in der Spots-Kategorie-Gruppierung: seit
// dem Zurückbau des Touren-Drawers gibt es dort keine Tour-Karten mehr, auf die sich ein Spot per
// Drag&Drop ablegen ließe. Listet stattdessen direkt alle bestehenden Touren auf und ordnet den
// Spot per Klick sofort zu (kein Formular/Speichern-Schritt nötig) - anders als
// TourAssignPicker.vue (Mehrfachauswahl per Chips, "creatable", lebt im Anlege-/Bearbeiten-
// Formular) bleibt das hier bewusst eine einzelne Sofort-Aktion direkt auf der Karte. In der
// Touren-Gruppierung erscheint dieses Dropdown zusätzlich neben dem weiterhin nutzbaren
// Drag-Anfasser (siehe SpotCard.vue), da dort echte Tour-Karten als Drop-Ziele sichtbar sind.
defineProps<{ options: string[] }>();
const emit = defineEmits<{ (e: 'select', title: string): void }>();

const open = ref(false);

function pick(title: string) {
  open.value = false;
  emit('select', title);
}

function onBlur() {
  // Verzögert schließen: mousedown auf einer Option feuert vor blur, ohne Verzögerung würde die
  // Liste verschwinden, bevor der Klick registriert wird (gleiches Muster wie Combobox.vue).
  window.setTimeout(() => {
    open.value = false;
  }, 150);
}
</script>

<template>
  <div class="tour-assign-dropdown" @click.stop>
    <button type="button" class="tour-assign-btn" @click="open = !open" @blur="onBlur">
      <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" /> Tour zuordnen
    </button>
    <ul class="options" v-if="open">
      <li v-if="!options.length" class="empty">Noch keine Touren</li>
      <li v-for="title in options" :key="title" @mousedown.prevent="pick(title)">{{ title }}</li>
    </ul>
  </div>
</template>

<style scoped>
.tour-assign-dropdown {
  position: relative;
  display: inline-flex;
}

/* Gleicher Chip-Grundstil wie die Anfasser/Toggles daneben (SpotCard.vue), für optische
   Konsistenz innerhalb von .card-actions. */
.tour-assign-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  corner-shape: round;
  padding: 3px 10px 3px 8px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.options {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 20;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  min-width: 160px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
}

.options li {
  padding: 6px 10px;
  font-size: 0.85rem;
  cursor: pointer;
}

.options li:hover {
  background: var(--color-hover);
}

.options li.empty {
  color: var(--color-text-muted);
  cursor: default;
}
</style>

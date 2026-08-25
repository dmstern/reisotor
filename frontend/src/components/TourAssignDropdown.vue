<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

export interface TourItem {
  id: number;
  title: string;
  assigned: boolean;
}

// Verschmilzt (#226, #227) den früheren "Auf Tour ziehen"-Drag-Anfasser und das "Tour zuordnen"-
// Dropdown in ein einziges Steuerelement: Klick öffnet die Touren-Checkliste (zeigt alle Touren mit
// Checkbox an, Anhaken fügt den Spot hinzu, Abhaken entfernt ihn), Ziehen startet wie gewohnt den
// Drag&Drop-Vorgang auf eine Tour-Karte.
defineProps<{
  tours: TourItem[];
}>();

const emit = defineEmits<{
  (e: 'toggle-tour', excursionId: number): void;
  (e: 'create-tour', title: string): void;
  (e: 'dragstart', event: DragEvent): void;
}>();

const open = ref(false);
const newTourTitle = ref('');

function handleToggle(id: number) {
  emit('toggle-tour', id);
}

function handleCreate() {
  const t = newTourTitle.value.trim();
  if (!t) return;
  emit('create-tour', t);
  newTourTitle.value = '';
}

function onDragStart(event: DragEvent) {
  emit('dragstart', event);
}
</script>

<template>
  <div class="tour-assign-dropdown" @click.stop>
    <button
      type="button"
      class="tour-assign-btn"
      draggable="true"
      :aria-expanded="open"
      title="Klicken zum Zuordnen / Auf Tour ziehen"
      aria-label="Tour zuordnen oder auf eine Tour ziehen"
      @click="open = !open"
      @dragstart="onDragStart"
    >
      <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" /> Tour zuordnen
    </button>
    <div class="options-backdrop" v-if="open" @click="open = false" />
    <div class="options-popup" v-if="open">
      <div class="popup-head">
        <span class="popup-title">Touren zuordnen</span>
      </div>
      <ul class="tour-list">
        <li v-if="!tours.length" class="empty">Noch keine Touren angelegt</li>
        <li
          v-for="tour in tours"
          :key="tour.id"
          class="tour-item"
          :class="{ selected: tour.assigned }"
          @click="handleToggle(tour.id)"
        >
          <input
            type="checkbox"
            :checked="tour.assigned"
            @click.stop
            @change="handleToggle(tour.id)"
          />
          <span class="tour-name">{{ tour.title }}</span>
        </li>
      </ul>
      <form class="create-tour-form" @submit.prevent="handleCreate">
        <input v-model="newTourTitle" type="text" placeholder="Neue Tour…" @click.stop />
        <button
          type="submit"
          class="create-btn"
          :disabled="!newTourTitle.trim()"
          title="Neue Tour erstellen & Spot zuordnen"
          aria-label="Neue Tour erstellen"
          @click.stop
        >
          <AppIcon :icon="ACTION_ICONS.add" :size="13" group="actions" />
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.tour-assign-dropdown {
  position: relative;
  display: inline-flex;
}

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
  cursor: grab;
  user-select: none;
}

.tour-assign-btn:active {
  cursor: grabbing;
}

.options-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.options-popup {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  min-width: 200px;
  max-width: 280px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.popup-head {
  padding: 2px 4px 4px;
  border-bottom: 1px solid var(--color-border);
}

.popup-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.tour-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 180px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tour-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 5px 6px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.85rem;
  cursor: pointer;
}

.tour-item:hover {
  background: var(--color-hover);
}

.tour-item input[type='checkbox'] {
  cursor: pointer;
  margin: 0;
}

.tour-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  color: var(--color-text-muted);
  font-size: 0.82rem;
  padding: 6px 4px;
  cursor: default;
}

.create-tour-form {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--color-border);
}

.create-tour-form input {
  flex: 1;
  min-width: 0;
  font-size: 0.8rem;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-bg);
}

.create-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  flex-shrink: 0;
}

.create-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

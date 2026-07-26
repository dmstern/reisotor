<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';

const props = defineProps<{ modelValue: number[]; spots: Spot[]; likeCount: (spotId: number) => number }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: number[]): void }>();

// Schreibbarer Computed statt einzelner add/remove-Emits: die Checkboxen der "weitere Spots"-Liste
// nutzen dadurch dasselbe v-model-Array-Muster wie vorher, ohne dass die Elternkomponente eigene
// add/remove-Handler bräuchte.
const selected = computed<number[]>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// Reihenfolge der geplanten Spots entspricht der Abklapper-Reihenfolge während des Ausflugs (und
// bestimmt auch die auf der Karte gezeichnete Route, siehe MapView.vue) – deshalb hier nach
// modelValue-Reihenfolge, NICHT nach Likes sortiert.
const plannedSpots = computed(() =>
  props.modelValue.map((id) => props.spots.find((s) => s.id === id)).filter((s): s is Spot => !!s),
);

const remainingSpots = computed(() =>
  [...props.spots]
    .filter((s) => !props.modelValue.includes(s.id))
    .sort((a, b) => props.likeCount(b.id) - props.likeCount(a.id) || a.title.localeCompare(b.title)),
);

function removeSpot(id: number) {
  selected.value = selected.value.filter((sid) => sid !== id);
}

// Drag&Drop-Umsortierung innerhalb der geplanten Liste – rein lokal (kein Component-übergreifendes
// dataTransfer-Format nötig, anders als beim Ziehen von SpotCard auf ExcursionCard). setData mit
// leerem Wert ist trotzdem nötig, manche Browser starten sonst gar keinen Drag.
const draggedIndex = ref<number | null>(null);

function onDragStart(event: DragEvent, index: number) {
  draggedIndex.value = index;
  event.dataTransfer?.setData('text/plain', '');
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onDrop(index: number) {
  if (draggedIndex.value === null || draggedIndex.value === index) return;
  const next = [...selected.value];
  const [moved] = next.splice(draggedIndex.value, 1);
  next.splice(index, 0, moved);
  selected.value = next;
  draggedIndex.value = null;
}

function onDragEnd() {
  draggedIndex.value = null;
}
</script>

<template>
  <div class="spot-order-picker">
    <fieldset v-if="plannedSpots.length" class="planned-box">
      <legend>📋 Ausflugsreihenfolge</legend>
      <p class="order-hint">
        In dieser Reihenfolge werden die Spots während des Ausflugs abgeklappert (bestimmt auch die
        eingezeichnete Route auf der Karte) – zum Sortieren ziehen.
      </p>
      <div
        v-for="(spot, index) in plannedSpots"
        :key="spot.id"
        class="planned-row"
        :class="{ dragging: draggedIndex === index }"
        draggable="true"
        @dragstart="onDragStart($event, index)"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
        @dragend="onDragEnd"
      >
        <span class="order-num">{{ index + 1 }}.</span>
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <span class="spot-title">{{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}</span>
        <button type="button" class="remove-btn" @click="removeSpot(spot.id)" aria-label="Aus Ausflug entfernen">
          ✕
        </button>
      </div>
    </fieldset>

    <fieldset v-if="remainingSpots.length" class="spot-picker">
      <legend>Weitere Spots hinzufügen – nach Likes sortiert</legend>
      <label v-for="spot in remainingSpots" :key="spot.id" class="spot-option">
        <input type="checkbox" :value="spot.id" v-model="selected" />
        <span class="spot-option-title">{{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}</span>
        <span class="spot-option-likes">❤️ {{ likeCount(spot.id) }}</span>
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.spot-order-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.planned-box,
.spot-picker {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.planned-box {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.planned-box legend,
.spot-picker legend {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  padding: 0 4px;
}

.order-hint {
  margin: 0 0 var(--space-1);
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.planned-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 8px;
  background: var(--color-surface);
  border-radius: var(--radius-sm);
  cursor: grab;
}

.planned-row:active {
  cursor: grabbing;
}

.planned-row.dragging {
  opacity: 0.4;
}

.order-num {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-primary-dark);
  flex-shrink: 0;
}

.drag-handle {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.spot-title {
  flex: 1;
  font-size: 0.9rem;
}

.remove-btn {
  background: none;
  border: none;
  padding: 2px 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.remove-btn:hover {
  color: var(--color-danger);
}

.spot-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  font-weight: 400;
}

.spot-option-title {
  flex: 1;
}

.spot-option-likes {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem } from '../api/types';
import DeleteButton from './DeleteButton.vue';
import EditButton from './EditButton.vue';

const props = defineProps<{ item: PackingItem }>();
const emit = defineEmits<{
  (e: 'update-counts', item: PackingItem, laidOutCount: number, packedCount: number): void;
  (e: 'remove', id: number): void;
  (e: 'edit', item: PackingItem): void;
}>();

const isFullyPacked = computed(() => props.item.packed_count >= props.item.quantity);

// Bei Anzahl 1 (die meisten Gegenstände) reicht ein einzelner Klick-Zyklus statt zweier
// Zähler-Zeilen: ungepackt → rausgelegt → eingepackt → wieder ungepackt. Behält dieselbe
// Häkchen-Optik wie überall sonst (style.css), zeigt den Zwischenzustand "rausgelegt" zusätzlich
// über eine eigene Klasse an, da input[type=checkbox] selbst nur zwei Zustände kennt.
type SingleState = 'none' | 'laidOut' | 'packed';
const singleState = computed<SingleState>(() => {
  if (props.item.packed_count >= 1) return 'packed';
  if (props.item.laid_out_count >= 1) return 'laidOut';
  return 'none';
});

function cycleSingleState() {
  const next: Record<SingleState, [number, number]> = {
    none: [1, 0],
    laidOut: [1, 1],
    packed: [0, 0],
  };
  const [laidOut, packed] = next[singleState.value];
  emit('update-counts', props.item, laidOut, packed);
}

function adjustLaidOut(delta: number) {
  const laidOut = Math.min(props.item.quantity, Math.max(props.item.packed_count, props.item.laid_out_count + delta));
  emit('update-counts', props.item, laidOut, props.item.packed_count);
}

function adjustPacked(delta: number) {
  const packed = Math.min(props.item.quantity, Math.max(0, props.item.packed_count + delta));
  const laidOut = Math.max(props.item.laid_out_count, packed);
  emit('update-counts', props.item, laidOut, packed);
}
</script>

<template>
  <li class="row">
    <div class="main">
      <button
        v-if="item.quantity <= 1"
        type="button"
        class="state-toggle"
        :class="singleState"
        role="checkbox"
        :aria-checked="singleState === 'packed'"
        :aria-label="`${item.label}: ${singleState === 'none' ? 'ungepackt' : singleState === 'laidOut' ? 'rausgelegt' : 'eingepackt'}`"
        :title="singleState === 'none' ? 'Ungepackt – klicken für rausgelegt' : singleState === 'laidOut' ? 'Rausgelegt – klicken für eingepackt' : 'Eingepackt – klicken zum Zurücksetzen'"
        @click="cycleSingleState"
      >
        <span v-if="singleState === 'laidOut'" class="laid-out-mark">•</span>
      </button>
      <span class="label" :class="{ done: isFullyPacked }">
        {{ item.label }}
        <span v-if="item.quantity > 1" class="qty">×{{ item.quantity }}</span>
      </span>
    </div>

    <div v-if="item.quantity > 1" class="trackers">
      <div class="tracker" title="Rausgelegt">
        <span class="tracker-icon">🧺</span>
        <button type="button" class="stepper-btn" :disabled="item.laid_out_count <= item.packed_count" @click="adjustLaidOut(-1)">−</button>
        <span class="tracker-count">{{ item.laid_out_count }}/{{ item.quantity }}</span>
        <button type="button" class="stepper-btn" :disabled="item.laid_out_count >= item.quantity" @click="adjustLaidOut(1)">+</button>
      </div>
      <div class="tracker" title="Eingepackt">
        <span class="tracker-icon">🧳</span>
        <button type="button" class="stepper-btn" :disabled="item.packed_count <= 0" @click="adjustPacked(-1)">−</button>
        <span class="tracker-count">{{ item.packed_count }}/{{ item.quantity }}</span>
        <button type="button" class="stepper-btn" :disabled="item.packed_count >= item.quantity" @click="adjustPacked(1)">+</button>
      </div>
    </div>

    <div class="row-actions">
      <EditButton small @click="emit('edit', item)" />
      <DeleteButton small @click="emit('remove', item.id)" />
    </div>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.row:last-child {
  border-bottom: none;
}

.main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 140px;
}

/* Gleiche Grundoptik wie die globale input[type=checkbox]-Häkchen-Regel (style.css), als eigener
   <button> statt echter Checkbox, da hier drei statt zwei Zustände dargestellt werden müssen
   (ungepackt/rausgelegt/eingepackt). */
.state-toggle {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.state-toggle:hover {
  border-color: var(--color-primary);
}

.state-toggle.laidOut {
  border-color: var(--color-accent);
  background: var(--color-highlight);
}

.laid-out-mark {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
}

.state-toggle.packed {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.state-toggle.packed::after {
  content: '';
  width: 5px;
  height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) translate(-1px, -1px);
}

.state-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.qty {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin-left: 2px;
}

.done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.trackers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tracker {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-hover);
  border-radius: var(--radius-sm);
  padding: 2px 4px;
}

.tracker-icon {
  font-size: 0.85rem;
}

.tracker-count {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  min-width: 34px;
  text-align: center;
}

.stepper-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  line-height: 1;
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  background: var(--color-border);
}

.row-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}
</style>

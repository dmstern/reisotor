<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem } from '../api/types';
import { isFullyPacked as isFullyPackedItem } from '../utils/packing';
import EditButton from './EditButton.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import CheckableListItem from './primitives/CheckableListItem.vue';

const props = defineProps<{ item: PackingItem; highlighted?: boolean }>();
const emit = defineEmits<{
  (e: 'update-counts', item: PackingItem, laidOutCount: number, packedCount: number): void;
  (e: 'edit', item: PackingItem): void;
}>();

const isFullyPacked = computed(() => isFullyPackedItem(props.item));

// Sind bei Anzahl > 1 bereits alle Exemplare rausgelegt (aber noch nicht eingepackt), zeigt der
// Hochzähl-Button statt des Plus-Icons denselben Punkt wie bei Anzahl 1 kurz vor dem Einpacken –
// signalisiert "nichts mehr zum Rauslegen übrig, nächster Klick packt ein" statt "weiter hochzählen".
const allLaidOut = computed(
  () => !isFullyPacked.value && props.item.laid_out_count >= props.item.quantity
);

// Bei Anzahl 1 (die meisten Gegenstände) reicht ein einzelner Klick-Zyklus statt einer Strichliste:
// ungepackt → rausgelegt → eingepackt → wieder ungepackt. Behält dieselbe Häkchen-Optik wie überall
// sonst (style.css), zeigt den Zwischenzustand "rausgelegt" zusätzlich über eine eigene Klasse an,
// da input[type=checkbox] selbst nur zwei Zustände kennt.
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

// Bei Anzahl > 1 zusätzlich zur Strichliste (unten) ein einzelnes Häkchen, das alle Exemplare in
// einem Schritt (un-)packt, unabhängig vom bisherigen Zwischenstand - für optische Konsistenz mit
// Gegenständen mit Anzahl 1 (dieselbe .state-toggle-Optik links vom Label).
function toggleAllPacked() {
  if (isFullyPacked.value) {
    emit('update-counts', props.item, 0, 0);
  } else {
    emit('update-counts', props.item, props.item.quantity, props.item.quantity);
  }
}

// Bei Anzahl > 1: ein Klick zählt die rausgelegten Exemplare einzeln als Strichliste hoch (wie von
// Hand auf einem Zettel abgehakt); sind alle Exemplare rausgelegt, packt der nächste Klick alle auf
// einmal ein (das ganze Element gilt danach als erledigt, genau wie bei Anzahl 1) – kein separates
// Hochzählen beim Einpacken selbst nötig, das entspricht eher dem tatsächlichen Vorgang (erst alles
// zusammensuchen, dann in einem Rutsch in den Koffer). Nochmaliges Klicken danach setzt zurück.
function incrementMulti() {
  if (props.item.laid_out_count < props.item.quantity) {
    emit('update-counts', props.item, props.item.laid_out_count + 1, props.item.packed_count);
  } else if (props.item.packed_count < props.item.quantity) {
    emit('update-counts', props.item, props.item.quantity, props.item.quantity);
  } else {
    emit('update-counts', props.item, 0, 0);
  }
}

// Korrigiert einen Fehlklick einen Schritt zurück, ohne den ganzen Zyklus erneut durchlaufen zu
// müssen: aus "eingepackt" wird wieder "alle rausgelegt, nicht eingepackt", danach ein rausgelegtes
// Exemplar nach dem anderen zurück.
function decrementMulti() {
  if (props.item.packed_count > 0) {
    emit('update-counts', props.item, props.item.laid_out_count, 0);
  } else if (props.item.laid_out_count > 0) {
    emit('update-counts', props.item, props.item.laid_out_count - 1, 0);
  }
}

// Strichliste in 5er-Gruppen (4 Striche + ein diagonaler 5.), wie von Hand auf einem Zettel
// abgehakt – zeigt den Rausgelegt-Fortschritt an, solange noch nicht alles eingepackt ist.
const tallyGroups = computed<number[]>(() => {
  const groups: number[] = [];
  let remaining = props.item.laid_out_count;
  while (remaining > 0) {
    const size = Math.min(5, remaining);
    groups.push(size);
    remaining -= size;
  }
  return groups;
});

function handleMainClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button, a, input, select')) return;
  if (props.item.quantity <= 1) {
    cycleSingleState();
  } else {
    toggleAllPacked();
  }
}
</script>

<template>
  <CheckableListItem :done="isFullyPacked" :highlighted="highlighted">
    <div class="item-main">
      <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
      <div class="main" @click="handleMainClick">
        <button
          v-if="item.quantity <= 1"
          type="button"
          class="state-toggle"
          :class="singleState"
          role="checkbox"
          :aria-checked="singleState === 'packed'"
          :aria-label="`${item.label}: ${singleState === 'none' ? 'ungepackt' : singleState === 'laidOut' ? 'rausgelegt' : 'eingepackt'}`"
          :title="
            singleState === 'none'
              ? 'Ungepackt – klicken für rausgelegt'
              : singleState === 'laidOut'
                ? 'Rausgelegt – klicken für eingepackt'
                : 'Eingepackt – klicken zum Zurücksetzen'
          "
          @click="cycleSingleState"
        >
          <span v-if="singleState === 'laidOut'" class="laid-out-mark"></span>
        </button>
        <button
          v-else
          type="button"
          class="state-toggle"
          :class="{ packed: isFullyPacked }"
          role="checkbox"
          :aria-checked="isFullyPacked"
          :aria-label="`${item.label}: alle ${item.quantity} Exemplare ${isFullyPacked ? 'eingepackt – klicken zum Zurücksetzen' : 'auf einmal einpacken'}`"
          :title="
            isFullyPacked
              ? 'Alle eingepackt – klicken zum Zurücksetzen'
              : 'Alle auf einmal einpacken'
          "
          @click="toggleAllPacked"
        ></button>
        <span
          class="label"
          :class="{ 'row__text--done': isFullyPacked, 'text-done': isFullyPacked }"
        >
          {{ item.label }}
          <span v-if="item.quantity > 1" class="qty">×{{ item.quantity }}</span>
        </span>
        <PendingSyncBadge v-if="item._pending" />
      </div>

      <div v-if="item.quantity > 1" class="tally-control">
        <button
          type="button"
          class="tally-pill"
          :class="{ laidOut: !isFullyPacked && item.laid_out_count > 0, packed: isFullyPacked }"
          role="checkbox"
          :aria-checked="isFullyPacked"
          :aria-label="
            isFullyPacked
              ? `${item.label}: eingepackt – klicken zum Zurücksetzen`
              : `${item.label}: ${item.laid_out_count}/${item.quantity} rausgelegt`
          "
          :title="
            isFullyPacked
              ? 'Eingepackt – klicken zum Zurücksetzen'
              : item.laid_out_count < item.quantity
                ? 'Nächstes Exemplar rausgelegt'
                : 'Alle rausgelegt – klicken zum Einpacken'
          "
          @click="incrementMulti"
        >
          <template v-if="!isFullyPacked">
            <span class="tally-marks">
              <span class="tally-group" v-for="(size, i) in tallyGroups" :key="i">
                <span class="tally-stroke" v-for="n in Math.min(size, 4)" :key="n"></span>
                <span class="tally-stroke tally-diagonal" v-if="size === 5"></span>
              </span>
              <span v-if="!tallyGroups.length" class="tally-empty">–</span>
            </span>
            <span class="tally-count">{{ item.laid_out_count }}/{{ item.quantity }}</span>
            <span v-if="allLaidOut" class="tally-ready-icon" aria-hidden="true">✓</span>
            <span v-else class="tally-plus" aria-hidden="true">+</span>
          </template>
          <template v-else>
            <span class="tally-check" aria-hidden="true">✓</span>
            <span class="tally-count">{{ item.quantity }}/{{ item.quantity }}</span>
          </template>
        </button>
        <button
          v-if="item.laid_out_count > 0 || item.packed_count > 0"
          type="button"
          class="tally-minus"
          aria-label="Einen Schritt zurück"
          title="Einen Schritt zurück"
          @click="decrementMulti"
        >
          −
        </button>
      </div>
    </div>

    <template #actions>
      <EditButton small @click="emit('edit', item)" />
    </template>
  </CheckableListItem>
</template>

<style scoped>
.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  flex: 1 1 auto;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}

.state-toggle {
  appearance: none;
  -webkit-appearance: none;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin: 0;
  margin-top: 1.5px;
  padding: 0;
  border: 2px solid var(--color-border);
  border-radius: 6px;
  corner-shape: squircle;
  background: var(--color-surface);
  cursor: pointer;
  position: relative;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.state-toggle:hover {
  border-color: var(--color-primary);
}

.state-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.state-toggle.laidOut {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
}

.laid-out-mark {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--color-primary);
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

.label {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--color-text);
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: pretty;
  hyphens: auto;
  cursor: pointer;
}

.qty {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin-left: 2px;
  white-space: nowrap;
}

.tally-control {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.tally-pill {
  appearance: none;
  -webkit-appearance: none;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 28px;
  padding: 0 10px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-pill);
  corner-shape: round;
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.82rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
  user-select: none;
  white-space: nowrap;
}

.tally-pill:hover {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
}

.tally-pill:active {
  transform: scale(0.96);
}

.tally-pill:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.tally-pill.laidOut {
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
}

.tally-pill.laidOut:hover {
  background: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface));
  border-color: var(--color-primary);
}

.tally-pill.packed {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-primary) 35%, transparent);
}

.tally-pill.packed:hover {
  background: color-mix(in srgb, var(--color-primary) 88%, #000);
  border-color: color-mix(in srgb, var(--color-primary) 88%, #000);
}

.tally-marks {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 14px;
}

.tally-group {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 2.5px;
}

/* Gedecktes Grau statt Volltonfarbe: die Striche sollen als Fortschrittsanzeige lesbar, aber nicht
   kontrastreicher als der übrige Zeilentext wirken. */
.tally-stroke {
  width: 2px;
  height: 13px;
  background: var(--color-text-muted);
  border-radius: 1px;
}

.tally-pill.laidOut .tally-stroke {
  background: color-mix(in srgb, var(--color-primary) 70%, var(--color-text-muted));
}

/* Der 5. Strich der Gruppe: diagonal über die vorherigen 4, exakt wie eine handgeschriebene
   Strichliste ("IIII" mit einem Querstrich). Vertikal mittig zentriert (statt am oberen Rand
   ansetzend) und mit flacherem Winkel, damit der Querstrich wirklich alle 4 Striche mittig kreuzt. */
.tally-diagonal {
  position: absolute;
  left: -2px;
  top: 50%;
  width: 18px;
  height: 2px;
  background: var(--color-text-muted);
  transform: translateY(-50%) rotate(-22deg);
}

.tally-pill.laidOut .tally-diagonal {
  background: color-mix(in srgb, var(--color-primary) 70%, var(--color-text-muted));
}

.tally-empty {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.tally-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.tally-pill.laidOut .tally-count {
  color: var(--color-primary);
}

.tally-pill.packed .tally-count {
  color: #ffffff;
}

.tally-check {
  font-weight: 700;
  font-size: 0.85rem;
  color: #ffffff;
  line-height: 1;
}

.tally-ready-icon {
  font-weight: 700;
  font-size: 0.85rem;
  color: var(--color-primary);
  line-height: 1;
}

.tally-plus {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--color-primary);
  line-height: 1;
}

.tally-minus {
  appearance: none;
  -webkit-appearance: none;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-full);
  corner-shape: round;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-family: inherit;
  font-weight: 700;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease,
    transform 0.1s ease;
}

.tally-minus:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
}

.tally-minus:active {
  transform: scale(0.92);
}

.tally-minus:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>

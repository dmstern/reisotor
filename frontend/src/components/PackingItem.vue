<script setup lang="ts">
import { computed } from 'vue';
import type { PackingItem } from '../api/types';
import { isFullyPacked as isFullyPackedItem } from '../utils/packing';
import DeleteButton from './DeleteButton.vue';
import EditButton from './EditButton.vue';

const props = defineProps<{ item: PackingItem; highlighted?: boolean }>();
const emit = defineEmits<{
  (e: 'update-counts', item: PackingItem, laidOutCount: number, packedCount: number): void;
  (e: 'remove', id: number): void;
  (e: 'edit', item: PackingItem): void;
}>();

const isFullyPacked = computed(() => isFullyPackedItem(props.item));

// Sind bei Anzahl > 1 bereits alle Exemplare rausgelegt (aber noch nicht eingepackt), zeigt der
// Hochzähl-Button statt des Plus-Icons denselben Punkt wie bei Anzahl 1 kurz vor dem Einpacken –
// signalisiert "nichts mehr zum Rauslegen übrig, nächster Klick packt ein" statt "weiter hochzählen".
const allLaidOut = computed(() => !isFullyPacked.value && props.item.laid_out_count >= props.item.quantity);

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
</script>

<template>
  <li class="row" :class="{ 'row-done': isFullyPacked, 'new-highlight': highlighted }">
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
        :title="isFullyPacked ? 'Alle eingepackt – klicken zum Zurücksetzen' : 'Alle auf einmal einpacken'"
        @click="toggleAllPacked"
      ></button>
      <span class="label" :class="{ 'text-done': isFullyPacked }">
        {{ item.label }}
        <span v-if="item.quantity > 1" class="qty">×{{ item.quantity }}</span>
      </span>
    </div>

    <div v-if="item.quantity > 1" class="tally-control">
      <button
        type="button"
        class="tally-pill"
        :class="{ laidOut: !isFullyPacked && item.laid_out_count > 0, packed: isFullyPacked }"
        role="checkbox"
        :aria-checked="isFullyPacked"
        :aria-label="isFullyPacked ? `${item.label}: eingepackt – klicken zum Zurücksetzen` : `${item.label}: ${item.laid_out_count}/${item.quantity} rausgelegt`"
        :title="isFullyPacked ? 'Eingepackt – klicken zum Zurücksetzen' : item.laid_out_count < item.quantity ? 'Nächstes Exemplar rausgelegt' : 'Alle rausgelegt – klicken zum Einpacken'"
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
          <span v-if="allLaidOut" class="laid-out-mark" aria-hidden="true"></span>
          <span v-else class="tally-plus" aria-hidden="true">+</span>
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

/* .state-toggle (Anzahl 1) teilt sich Grundform, Zustandsfarben und Häkchen-Optik jetzt mit der
   globalen input[type=checkbox]-Regel (style.css) statt sie lokal zu duplizieren – hier bleibt nur
   noch die Flex-Zentrierung für die Häkchen-Positionierung (echte Checkboxen positionieren ihr
   Häkchen absolut, dieser Button zentriert es stattdessen über den Elterncontainer). .tally-pill
   (Anzahl > 1) hat eine eigene, breitere Pillenform und bleibt deshalb im Ruhezustand lokal
   definiert; nur ihr "eingepackt"-Endzustand (Farben + Häkchen-Form) teilt sich mit .state-toggle
   denselben globalen Regelsatz, damit Gegenstände mit Anzahl 1 und Anzahl > 1 optisch als derselbe
   Zustandsautomat erkennbar bleiben statt wie zwei unabhängige UI-Muster zu wirken. */
.state-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tally-pill {
  border: 2px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.tally-pill:hover {
  border-color: var(--color-primary);
}

.state-toggle.laidOut,
.tally-pill.laidOut {
  border-color: var(--color-accent);
  background: var(--color-highlight);
}

.laid-out-mark {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
}

/* Häkchen-Farben/-Form global (style.css) – hier nur noch der Positionierungs-Feinschliff, den die
   Flex-Zentrierung dieser Buttons braucht (echte Checkboxen positionieren stattdessen absolut). */
.state-toggle.packed::after,
.tally-pill.packed::after {
  transform: rotate(45deg) translate(-1px, -1px);
}

.tally-pill.packed {
  min-width: 20px;
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tally-pill:focus-visible {
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

.tally-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tally-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
}

.tally-marks {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 14px;
}

.tally-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
}

/* Gedecktes Grau statt Volltonfarbe: die Striche sollen als Fortschrittsanzeige lesbar, aber nicht
   kontrastreicher als der übrige Zeilentext wirken. */
.tally-stroke {
  width: 2px;
  height: 14px;
  background: var(--color-text-muted);
  border-radius: 1px;
}

/* Der 5. Strich der Gruppe: diagonal über die vorherigen 4, exakt wie eine handgeschriebene
   Strichliste ("IIII" mit einem Querstrich). Vertikal mittig zentriert (statt am oberen Rand
   ansetzend) und mit flacherem Winkel, damit der Querstrich wirklich alle 4 Striche mittig kreuzt. */
.tally-diagonal {
  position: absolute;
  left: -2px;
  top: 50%;
  width: 20px;
  height: 2px;
  background: var(--color-text-muted);
  transform: translateY(-50%) rotate(-22deg);
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
}

.tally-plus {
  font-weight: 700;
  color: var(--color-primary);
  line-height: 1;
}

.tally-minus {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  corner-shape: round;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.tally-minus:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.tally-minus:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.row-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}
</style>

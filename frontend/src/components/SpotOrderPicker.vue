<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Spot } from '../api/types';
import type { DerivedLocation } from '../utils/derivedLocation';
import { spotCategoryMeta } from '../utils/spotCategory';

const props = withDefaults(
  defineProps<{
    /** Stationsreihenfolge als generische Schlüssel (siehe Excursion.station_keys/
     *  utils/excursionStations.ts) – kann sowohl echte Spots als auch Unterkunft-/Reise-Orte
     *  enthalten (loc.key ist bereits der fertige Schlüssel, wird nicht mehr zu einem Spot
     *  aufgelöst). */
    modelValue: string[];
    spots: Spot[];
    likeCount: (spotId: number) => number;
    /** Unterkunft-/Reise-Orte – wählbar wie ein Spot, ohne dafür einen anzulegen. */
    derivedLocations?: DerivedLocation[];
  }>(),
  { derivedLocations: () => [] },
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
  (e: 'pick-derived-location', location: DerivedLocation): void;
}>();

// Schreibbarer Computed statt einzelner add/remove-Emits: die Checkboxen der "weitere Spots"-Liste
// nutzen dadurch dasselbe v-model-Array-Muster wie vorher, ohne dass die Elternkomponente eigene
// add/remove-Handler bräuchte.
const selected = computed<string[]>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// Reihenfolge der geplanten Stationen entspricht der Abklapper-Reihenfolge während des Ausflugs
// (und bestimmt auch die auf der Karte gezeichnete Route, siehe TripMap.vue) – deshalb hier nach
// modelValue-Reihenfolge, NICHT nach Likes sortiert. Löst jeden Key lokal auf: 'spot-*' gegen
// props.spots, alles andere (Unterkunft/Reise) gegen props.derivedLocations – kein Bedarf an einem
// vollen ExcursionStation-Resolver hier, beide Quellen bringen Titel/Icon schon fertig mit.
const plannedStations = computed(() =>
  props.modelValue
    .map((key) => {
      if (key.startsWith('spot-')) {
        const spot = props.spots.find((s) => s.id === Number(key.slice('spot-'.length)));
        return spot ? { key, title: spot.title, icon: spotCategoryMeta(spot.category).icon } : null;
      }
      const loc = props.derivedLocations.find((l) => l.key === key);
      return loc ? { key, title: loc.title, icon: loc.icon } : null;
    })
    .filter((s): s is { key: string; title: string; icon: string } => !!s),
);

// Bewusst NICHT mehr gefiltert auf "noch nicht eingeplant" – für einen Rundgang muss derselbe Spot
// mehrfach in der Reihenfolge stehen können (z. B. Start UND Ende an der Unterkunft), Klick fügt
// deshalb immer eine weitere Station hinzu statt (wie ein Checkbox-Häkchen) nur ein einziges Mal
// umschaltbar zu sein.
const addableSpots = computed(() =>
  [...props.spots].sort((a, b) => props.likeCount(b.id) - props.likeCount(a.id) || a.title.localeCompare(b.title)),
);

function addSpot(id: number) {
  selected.value = [...selected.value, `spot-${id}`];
}

function removeSpotAt(index: number) {
  const next = [...selected.value];
  next.splice(index, 1);
  selected.value = next;
}

// Drag&Drop-Umsortierung innerhalb der geplanten Liste – rein lokal (kein Component-übergreifendes
// dataTransfer-Format nötig, anders als beim Ziehen von SpotCard auf ExcursionCard). setData mit
// leerem Wert ist trotzdem nötig, manche Browser starten sonst gar keinen Drag.
const draggedIndex = ref<number | null>(null);
// Index in plannedSpots, VOR dem die Drop-Line gerade eingezeichnet wird (index === Länge des
// Arrays => Line nach dem letzten Eintrag) – wird bei jedem dragover anhand der Cursor-Position
// relativ zur Mitte der jeweiligen Zeile neu bestimmt, damit man sichtbar zwischen zwei Zeilen
// (statt nur "auf" einer Zeile) ablegen kann.
const dropIndicatorIndex = ref<number | null>(null);

function onDragStart(event: DragEvent, index: number) {
  draggedIndex.value = index;
  event.dataTransfer?.setData('text/plain', '');
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}

function onRowDragOver(event: DragEvent, index: number) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const before = event.clientY < rect.top + rect.height / 2;
  dropIndicatorIndex.value = before ? index : index + 1;
}

function onDrop() {
  if (draggedIndex.value === null || dropIndicatorIndex.value === null) return;
  let targetIndex = dropIndicatorIndex.value;
  // Ziel-Index bezieht sich auf das Array VOR dem Entfernen des gezogenen Eintrags – liegt die
  // Zeile davor, verschiebt das Herausnehmen alle nachfolgenden Indizes um eins nach vorn.
  if (draggedIndex.value < targetIndex) targetIndex--;
  if (targetIndex !== draggedIndex.value) {
    const next = [...selected.value];
    const [moved] = next.splice(draggedIndex.value, 1);
    next.splice(targetIndex, 0, moved);
    selected.value = next;
  }
  draggedIndex.value = null;
  dropIndicatorIndex.value = null;
}

function onDragEnd() {
  draggedIndex.value = null;
  dropIndicatorIndex.value = null;
}
</script>

<template>
  <div class="spot-order-picker">
    <fieldset v-if="plannedStations.length" class="planned-box">
      <legend>📋 Ausflugsreihenfolge</legend>
      <p class="order-hint">
        In dieser Reihenfolge werden die Stationen während des Ausflugs abgeklappert (bestimmt auch
        die eingezeichnete Route auf der Karte) – zum Sortieren ziehen.
      </p>
      <template v-for="(station, index) in plannedStations" :key="index">
        <div class="drop-line" v-if="draggedIndex !== null && dropIndicatorIndex === index"></div>
        <div
          class="planned-row"
          :class="{ dragging: draggedIndex === index }"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover.prevent="onRowDragOver($event, index)"
          @drop.prevent="onDrop"
          @dragend="onDragEnd"
        >
          <span class="order-num">{{ index + 1 }}.</span>
          <span class="drag-handle" aria-hidden="true">⠿</span>
          <span class="spot-title">{{ station.icon }} {{ station.title }}</span>
          <button type="button" class="remove-btn" @click="removeSpotAt(index)" aria-label="Aus Ausflug entfernen">
            ✕
          </button>
        </div>
      </template>
      <div class="drop-line" v-if="draggedIndex !== null && dropIndicatorIndex === plannedStations.length"></div>
    </fieldset>

    <fieldset v-if="addableSpots.length" class="spot-picker">
      <legend>Spots hinzufügen – nach Likes sortiert (auch mehrfach möglich, z. B. Start &amp; Ende)</legend>
      <button v-for="spot in addableSpots" :key="spot.id" type="button" class="derived-option" @click="addSpot(spot.id)">
        <span class="spot-option-title">{{ spotCategoryMeta(spot.category).icon }} {{ spot.title }}</span>
        <span class="spot-option-likes">❤️ {{ likeCount(spot.id) }}</span>
        <span class="derived-add" aria-hidden="true">+</span>
      </button>
    </fieldset>

    <fieldset v-if="derivedLocations.length" class="spot-picker">
      <legend>🛏️🛫 Unterkunft &amp; Reise-Orte (auch mehrfach möglich)</legend>
      <button
        v-for="loc in derivedLocations"
        :key="loc.key"
        type="button"
        class="derived-option"
        @click="emit('pick-derived-location', loc)"
      >
        <span class="spot-option-title">{{ loc.icon }} {{ loc.title }}</span>
        <span class="derived-add" aria-hidden="true">+</span>
      </button>
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

.drop-line {
  height: 2px;
  border-radius: 1px;
  background: var(--color-primary);
  margin: 0 8px;
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

.spot-option-title {
  flex: 1;
}

.spot-option-likes {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.derived-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  background: none;
  border: none;
  padding: 4px 2px;
  cursor: pointer;
  color: var(--color-text);
  width: 100%;
  text-align: left;
}

.derived-option:hover {
  color: var(--color-primary-dark);
}

.derived-add {
  color: var(--color-primary);
  font-weight: 700;
  flex-shrink: 0;
}
</style>

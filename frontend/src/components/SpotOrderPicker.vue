<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ExcursionLeg, Spot, User } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIcon } from '../utils/travelTypeIcon';
import { formatTravelDuration, travelDurationMinutes } from '../utils/travelDuration';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import LegTransportModal from './LegTransportModal.vue';

// Drag&Drop-Reihenfolge-Editor fürs Touren-Formular (ExcursionsView.vue) – TourAssignPicker.vue
// bietet daneben im Spot-Formular einen schnelleren Weg, einen Spot ohne Reihenfolge einer Tour
// zuzuordnen. Eine Tour-Station ist seit der Verschmelzung von Unterkunft/Reise-Orten in Spots
// (siehe Migrationskommentar in db/index.ts) immer ein echter Spot.
// Issue #361: Unterstützt zusätzlich Teilstrecken (legs) zwischen je zwei aufeinanderfolgenden
// Stationen mit individuellen Verkehrsmitteln, Zeiten, Sitzplatz, Kosten und Umsteigedauer.
const props = withDefaults(
  defineProps<{
    modelValue: number[];
    spots: Spot[];
    likeCount: (spotId: number) => number;
    legs?: ExcursionLeg[];
    users?: User[];
  }>(),
  {
    legs: () => [],
    users: () => [],
  }
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: number[]): void;
  (e: 'update:legs', value: ExcursionLeg[]): void;
}>();

// Schreibbarer Computed statt einzelner add/remove-Emits: die Checkboxen der "weitere Spots"-Liste
// nutzen dadurch dasselbe v-model-Array-Muster wie vorher, ohne dass die Elternkomponente eigene
// add/remove-Handler bräuchte.
const selected = computed<number[]>({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

// Reihenfolge der geplanten Stationen entspricht der Abklapper-Reihenfolge während des Ausflugs
// (und bestimmt auch die auf der Karte gezeichnete Route, siehe TripMap.vue) – deshalb hier nach
// modelValue-Reihenfolge, NICHT nach Likes sortiert.
const plannedStations = computed(() =>
  props.modelValue
    .map((spotId) => {
      const spot = props.spots.find((s) => s.id === spotId);
      return spot
        ? {
            id: spotId,
            spot,
            title: spot.title,
            icon: spotCategoryMeta(spot.category).icon,
            tabler: spotCategoryMeta(spot.category).tabler,
          }
        : null;
    })
    .filter(
      (s): s is { id: number; spot: Spot; title: string; icon: string; tabler: IconDef } => !!s
    )
);

// Bewusst NICHT mehr gefiltert auf "noch nicht eingeplant" – für einen Rundgang muss derselbe Spot
// mehrfach in der Reihenfolge stehen können (z. B. Start UND Ende an der Unterkunft), Klick fügt
// deshalb immer eine weitere Station hinzu statt (wie ein Checkbox-Häkchen) nur ein einziges Mal
// umschaltbar zu sein.
const addableSpots = computed(() =>
  [...props.spots].sort(
    (a, b) => props.likeCount(b.id) - props.likeCount(a.id) || a.title.localeCompare(b.title)
  )
);

function addSpot(id: number) {
  selected.value = [...selected.value, id];
}

function cleanupLegsForSpots(newSpotIds: number[]) {
  const adjacentPairs = new Set<string>();
  for (let i = 0; i < newSpotIds.length - 1; i++) {
    adjacentPairs.add(`${newSpotIds[i]}-${newSpotIds[i + 1]}`);
  }
  const updated = (props.legs || [])
    .filter((leg) => adjacentPairs.has(`${leg.from_spot_id}-${leg.to_spot_id}`))
    .map((leg, idx) => ({ ...leg, position: idx }));
  emit('update:legs', updated);
}

function removeSpotAt(index: number) {
  const next = [...selected.value];
  next.splice(index, 1);
  selected.value = next;
  cleanupLegsForSpots(next);
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
    cleanupLegsForSpots(next);
  }
  draggedIndex.value = null;
  dropIndicatorIndex.value = null;
}

function onDragEnd() {
  draggedIndex.value = null;
  dropIndicatorIndex.value = null;
}

// --- Teilstrecken-Verkehrsmittel Modal-Verwaltung (Issue #361) ---
const editingLegFromIndex = ref<number | null>(null);
const showLegModal = ref(false);

function getLegBetween(fromId: number, toId: number): ExcursionLeg | undefined {
  return props.legs.find((l) => l.from_spot_id === fromId && l.to_spot_id === toId);
}

function getLegDuration(fromId: number, toId: number): string | null {
  const leg = getLegBetween(fromId, toId);
  if (!leg?.departure_time || !leg?.arrival_time) return null;
  const mins = travelDurationMinutes(leg.departure_time, leg.arrival_time);
  return mins != null ? formatTravelDuration(mins) : null;
}

function getLayover(index: number): number | null {
  if (index <= 0 || index >= plannedStations.value.length - 1) return null;
  const prevSpotId = plannedStations.value[index - 1].id;
  const currSpotId = plannedStations.value[index].id;
  const nextSpotId = plannedStations.value[index + 1].id;
  const inLeg = getLegBetween(prevSpotId, currSpotId);
  const outLeg = getLegBetween(currSpotId, nextSpotId);
  if (!inLeg?.arrival_time || !outLeg?.departure_time) return null;
  return travelDurationMinutes(inLeg.arrival_time, outLeg.departure_time);
}

const currentModalFromSpot = computed(() => {
  if (editingLegFromIndex.value == null) return null;
  return plannedStations.value[editingLegFromIndex.value]?.spot ?? null;
});

const currentModalToSpot = computed(() => {
  if (editingLegFromIndex.value == null) return null;
  return plannedStations.value[editingLegFromIndex.value + 1]?.spot ?? null;
});

const currentModalLeg = computed(() => {
  if (!currentModalFromSpot.value || !currentModalToSpot.value) return null;
  return getLegBetween(currentModalFromSpot.value.id, currentModalToSpot.value.id) ?? null;
});

function openLegModal(index: number) {
  editingLegFromIndex.value = index;
  showLegModal.value = true;
}

function onSaveLeg(savedLeg: ExcursionLeg) {
  const nextLegs = [...props.legs];
  const idx = nextLegs.findIndex(
    (l) => l.from_spot_id === savedLeg.from_spot_id && l.to_spot_id === savedLeg.to_spot_id
  );
  if (idx !== -1) {
    nextLegs[idx] = savedLeg;
  } else {
    nextLegs.push(savedLeg);
  }
  emit('update:legs', nextLegs);
}

function onDeleteLeg() {
  if (editingLegFromIndex.value == null) return;
  const fromId = props.modelValue[editingLegFromIndex.value];
  const toId = props.modelValue[editingLegFromIndex.value + 1];
  const nextLegs = props.legs.filter((l) => !(l.from_spot_id === fromId && l.to_spot_id === toId));
  emit('update:legs', nextLegs);
}
</script>

<template>
  <div class="spot-order-picker">
    <fieldset v-if="plannedStations.length" class="planned-box">
      <legend>
        <AppIcon :icon="ACTION_ICONS.order" :size="14" group="actions" /> Tourreihenfolge
      </legend>
      <p class="order-hint">
        In dieser Reihenfolge werden die Stationen während der Tour abgeklappert (bestimmt auch die
        eingezeichnete Route auf der Karte) – zum Sortieren ziehen.
      </p>
      <template v-for="(station, index) in plannedStations" :key="index">
        <div class="drop-line" v-if="draggedIndex !== null && dropIndicatorIndex === index"></div>
        <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
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
          <span class="spot-title">
            <AppIcon :icon="station.tabler" :size="14" group="categories" />
            {{ station.title }}
          </span>
          <span
            v-if="getLayover(index) != null"
            class="layover-badge"
            title="Aufenthalts-/Umsteigezeit"
          >
            ⏱️ {{ formatTravelDuration(getLayover(index)!) }} Umstiegszeit
          </span>
          <button
            type="button"
            class="remove-btn"
            @click="removeSpotAt(index)"
            aria-label="Aus Tour entfernen"
          >
            <AppIcon :icon="ACTION_ICONS.close" :size="14" group="actions" />
          </button>
        </div>

        <!-- Teilstrecken-Verbinder zwischen zwei Stationen (Issue #361) -->
        <div v-if="index < plannedStations.length - 1" class="leg-connector">
          <div class="leg-connector-line"></div>
          <button
            type="button"
            class="leg-btn"
            :class="{
              'has-data': !!getLegBetween(station.id, plannedStations[index + 1].id),
            }"
            @click="openLegModal(index)"
          >
            <template v-if="getLegBetween(station.id, plannedStations[index + 1].id)">
              <span class="leg-pill">
                {{
                  travelTypeIcon(
                    getLegBetween(station.id, plannedStations[index + 1].id)!.transport_type ?? null
                  )
                }}
                <span class="leg-type">
                  {{
                    getLegBetween(station.id, plannedStations[index + 1].id)!.transport_type ||
                    'Verkehrsmittel'
                  }}
                </span>
                <span
                  v-if="
                    getLegBetween(station.id, plannedStations[index + 1].id)!.departure_time ||
                    getLegBetween(station.id, plannedStations[index + 1].id)!.arrival_time
                  "
                  class="leg-times"
                >
                  {{
                    getLegBetween(station.id, plannedStations[index + 1].id)!.departure_time || '?'
                  }}–{{
                    getLegBetween(station.id, plannedStations[index + 1].id)!.arrival_time || '?'
                  }}
                  <span
                    v-if="getLegDuration(station.id, plannedStations[index + 1].id)"
                    class="leg-duration"
                  >
                    ({{ getLegDuration(station.id, plannedStations[index + 1].id) }})
                  </span>
                </span>
                <span
                  v-if="getLegBetween(station.id, plannedStations[index + 1].id)!.amount"
                  class="leg-cost"
                >
                  ·
                  {{
                    getLegBetween(station.id, plannedStations[index + 1].id)!
                      .amount!.toFixed(2)
                      .replace('.', ',')
                  }}
                  €
                </span>
              </span>
            </template>
            <template v-else>
              <span class="leg-empty">
                <AppIcon :icon="ACTION_ICONS.recordStart" :size="12" group="actions" /> +
                Verkehrsmittel
              </span>
            </template>
          </button>
          <div class="leg-connector-line"></div>
        </div>
      </template>
      <div
        class="drop-line"
        v-if="draggedIndex !== null && dropIndicatorIndex === plannedStations.length"
      ></div>
    </fieldset>

    <fieldset v-if="addableSpots.length" class="spot-picker">
      <legend>
        Spots hinzufügen – nach Likes sortiert (auch mehrfach möglich, z. B. Start &amp; Ende)
      </legend>
      <button
        v-for="spot in addableSpots"
        :key="spot.id"
        type="button"
        class="derived-option"
        @click="addSpot(spot.id)"
      >
        <span class="spot-option-title">
          <AppIcon :icon="spotCategoryMeta(spot.category).tabler" :size="14" group="categories" />
          {{ spot.title }}
        </span>
        <span class="spot-option-likes">
          <AppIcon :icon="ACTION_ICONS.sortLikes" :size="13" group="actions" />
          {{ likeCount(spot.id) }}
        </span>
        <span class="derived-add" aria-hidden="true">+</span>
      </button>
    </fieldset>

    <LegTransportModal
      v-model="showLegModal"
      :from-spot="currentModalFromSpot"
      :to-spot="currentModalToSpot"
      :leg="currentModalLeg"
      :users="props.users"
      @save="onSaveLeg"
      @delete="onDeleteLeg"
    />
  </div>
</template>

<style scoped>
.spot-order-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.leg-connector {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 2px 0 2px 28px;
}

.leg-connector-line {
  flex: 0 0 12px;
  height: 1px;
  background: var(--color-primary-dark, #ccc);
  opacity: 0.3;
}

.leg-btn {
  display: inline-flex;
  align-items: center;
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 3px 8px;
  font-size: 0.78rem;
  color: var(--color-text-muted);
  cursor: pointer;
  box-shadow: none;
  transition: all 0.15s ease;
}

.leg-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  background: var(--color-surface);
}

.leg-btn.has-data {
  border-style: solid;
  border-color: var(--color-primary);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
}

.leg-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.leg-type {
  font-weight: 600;
}

.leg-times {
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.leg-duration {
  color: var(--color-text-subtle);
  font-size: 0.72rem;
}

.leg-cost {
  font-weight: 600;
  color: var(--color-scheduled);
}

.leg-empty {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.layover-badge {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.05));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 2px 6px;
  margin-left: auto;
  white-space: nowrap;
}

.planned-box,
.spot-picker {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
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
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
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
  /* #207: der globale `button`-Basisstil (style.css) setzt box-shadow: var(--shadow-sm) - ohne
     Reset klebten in dieser dichten Liste die Einzelschatten benachbarter Zeilen aneinander und
     wirkten buggy, statt wie ein einzelnes, flaches Listenelement auszusehen. */
  box-shadow: none;
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

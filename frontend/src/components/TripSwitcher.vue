<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTripStore, type TripFormData } from '../stores/trip';
import type { Trip } from '../api/types';
import Modal from './Modal.vue';
import TripForm from './TripForm.vue';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';

const tripStore = useTripStore();
const open = ref(false);
const showForm = ref(false);
const editingTrip = ref<Trip | null>(null);

// Sprungziel für Fremdobjekte (z. B. Urlaub-Einträge im Kalender): öffnet das Edit-Modal
// des aktuellen Urlaubs, ohne dass die einbettende Sicht selbst editieren muss.
watch(
  () => tripStore.editTripRequestId,
  (id) => {
    if (id > 0 && tripStore.currentTrip) {
      openEdit(tripStore.currentTrip);
    }
  },
);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function selectAndClose(id: number) {
  tripStore.selectTrip(id);
  close();
}

function openCreate() {
  editingTrip.value = null;
  showForm.value = true;
  close();
}

function openEdit(trip: Trip) {
  editingTrip.value = trip;
  showForm.value = true;
  close();
}

function closeForm() {
  showForm.value = false;
  editingTrip.value = null;
}

async function onSubmit(data: TripFormData) {
  if (editingTrip.value) {
    await tripStore.updateTrip(editingTrip.value.id, data);
  } else {
    await tripStore.createTrip(data);
  }
  closeForm();
}

async function onDelete(trip: Trip) {
  const confirmed = window.confirm(
    `Urlaub "${trip.name}" wirklich löschen? Alle zugehörigen Daten (Kalender, Packliste, Ausflüge, Unterkunft, Budget, ...) werden unwiderruflich gelöscht.`,
  );
  if (!confirmed) return;
  await tripStore.deleteTrip(trip.id);
}
</script>

<template>
  <div class="trip-switcher">
    <button type="button" class="switcher-btn" @click="toggle">
      <span class="trip-name">{{ tripStore.currentTrip?.name ?? 'Urlaub wählen' }}</span>
      <span class="caret">▾</span>
    </button>

    <template v-if="open">
      <div class="backdrop" @click="close"></div>
      <div class="dropdown">
        <div
          v-for="trip in tripStore.trips"
          :key="trip.id"
          class="trip-row"
          :class="{ active: trip.id === tripStore.currentTripId }"
        >
          <button type="button" class="trip-select" @click="selectAndClose(trip.id)">{{ trip.name }}</button>
          <div class="row-actions">
            <EditButton small @click="openEdit(trip)" />
            <DeleteButton small @click="onDelete(trip)" />
          </div>
        </div>
        <p v-if="!tripStore.trips.length" class="empty">Noch keine Urlaube.</p>
        <button type="button" class="new-trip-btn" @click="openCreate">+ Neuer Urlaub</button>
      </div>
    </template>

    <Modal
      :model-value="showForm"
      :title="editingTrip ? 'Urlaub bearbeiten' : 'Neuen Urlaub anlegen'"
      @update:model-value="(v) => !v && closeForm()"
    >
      <TripForm
        :initial="
          editingTrip
            ? {
                name: editingTrip.name,
                destination: editingTrip.destination ?? '',
                start_date: editingTrip.start_date,
                end_date: editingTrip.end_date,
                maps_link: editingTrip.maps_link ?? '',
                image_url: editingTrip.image_url ?? '',
              }
            : undefined
        "
        @submit="onSubmit"
      />
    </Modal>
  </div>
</template>

<style scoped>
.trip-switcher {
  position: relative;
}

.switcher-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-primary-tint);
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  cursor: pointer;
  max-width: 40vw;
}

.trip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  flex-shrink: 0;
  font-size: 0.7rem;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trip-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-sm);
}

.trip-row.active .trip-select {
  color: var(--color-primary-dark);
  font-weight: 700;
}

.trip-select {
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  padding: 6px 8px;
  font-size: 0.9rem;
  color: var(--color-text);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.trip-select:hover {
  background: var(--color-hover);
}

.row-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.empty {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  padding: 6px 8px;
}

.new-trip-btn {
  margin-top: 4px;
  text-align: left;
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  font-size: 0.85rem;
  color: var(--color-primary-dark);
  cursor: pointer;
}

.new-trip-btn:hover {
  background: var(--color-primary-tint);
}
</style>

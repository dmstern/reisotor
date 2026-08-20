<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useTripEditor } from '../composables/useTripEditor';
import type { Trip } from '../api/types';
import Modal from '../components/Modal.vue';
import TripForm from '../components/TripForm.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import TripMembersDialog from '../components/TripMembersDialog.vue';
import AppIcon from '../components/AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

const router = useRouter();
const tripStore = useTripStore();
const auth = useAuthStore();
const showMembers = ref(false);
const membersTrip = ref<Trip | null>(null);
const { showForm, editingTrip, tripFormLocationError, openCreate, openEdit, closeForm, onSubmit, onDelete } =
  useTripEditor();
// Issue #96: restricted-Nutzer:innen dürfen nur einen selbst angelegten Urlaub haben - bereits
// eingeladene Urlaube zählen nicht mit (siehe registrationConfig.ts's countTripsCreatedBy), das
// Frontend kennt diese Unterscheidung aber nicht, deshalb konservativ ab dem ersten Urlaub sperren.
const tripCreationBlocked = () => !!auth.user?.restricted && tripStore.trips.length > 0;

function selectTrip(id: number) {
  tripStore.selectTrip(id);
  router.push('/');
}

function openMembers(trip: Trip) {
  membersTrip.value = trip;
  showMembers.value = true;
}
</script>

<template>
  <div class="page">
    <div class="header">
      <h1>Meine Urlaube</h1>
      <button v-if="tripStore.trips.length > 0 && !tripCreationBlocked()" @click="openCreate">+ Neuer Urlaub</button>
      <p v-else-if="tripCreationBlocked()" class="restricted-hint">Eingeschränkter Modus - Nur ein Urlaub pro Nutzer</p>
    </div>

    <div v-if="tripStore.trips.length > 0" class="trip-list">
      <div v-for="trip in tripStore.trips" :key="trip.id" class="card trip-card">
        <button type="button" class="trip-select" @click="selectTrip(trip.id)">{{ trip.name }}</button>
        <div class="row-actions">
          <button
            type="button"
            class="secondary members-btn"
            title="Mitglieder verwalten"
            aria-label="Mitglieder verwalten"
            @click="openMembers(trip)"
          >
            <AppIcon :icon="FORM_FIELD_ICONS.visibility" :size="15" group="formFields" />
          </button>
          <EditButton small @click="openEdit(trip)" />
          <DeleteButton small @click="onDelete(trip)" />
        </div>
      </div>
    </div>

    <div v-else class="card empty-state">
      <h2>Willkommen bei Reisotor!</h2>
      <p class="empty">Du bist noch keinem Urlaub zugeordnet.</p>
      <TripForm submit-label="Urlaub anlegen" @submit="onSubmit" />
      <p class="invite-hint">
        Alternativ kann dich ein bestehendes Mitglied eines Urlaubs über die Mitglieder-Verwaltung
        (Symbol <AppIcon :icon="FORM_FIELD_ICONS.visibility" :size="14" group="formFields" /> im
        Urlaubs-Menü) per Nutzername einladen.
      </p>
    </div>

    <Modal
      :model-value="showForm"
      :title="editingTrip ? 'Urlaub bearbeiten' : 'Neuen Urlaub anlegen'"
      @update:model-value="(v) => !v && closeForm()"
    >
      <TripForm
        :location-error="tripFormLocationError"
        :initial="
          editingTrip
            ? {
                name: editingTrip.name,
                destination: editingTrip.destination ?? '',
                start_date: editingTrip.start_date,
                end_date: editingTrip.end_date,
                maps_link: editingTrip.maps_link ?? '',
                image_url: editingTrip.image_url ?? '',
                packing_category_required: editingTrip.packing_category_required !== 0,
              }
            : undefined
        "
        @submit="onSubmit"
      />
    </Modal>

    <TripMembersDialog v-model="showMembers" :trip="membersTrip" />
  </div>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.restricted-hint {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 0;
}

.trip-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.trip-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.trip-select {
  flex: 1;
  text-align: left;
  background: none;
  border: none;
  padding: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
}

.row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.members-btn {
  padding: 4px 8px;
  font-size: 0.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.empty-state {
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.empty-state h2 {
  margin: 0;
}

.invite-hint {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin-top: var(--space-2);
}
</style>

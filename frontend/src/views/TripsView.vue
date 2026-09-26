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
import TripMembersDialog from '../components/TripMembersDialog.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Card from '../components/primitives/Card.vue';
import IconButton from '../components/primitives/IconButton.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

const router = useRouter();
const tripStore = useTripStore();
const auth = useAuthStore();
const showMembers = ref(false);
const membersTrip = ref<Trip | null>(null);
const {
  showForm,
  editingTrip,
  tripFormLocationError,
  openCreate,
  openEdit,
  closeForm,
  onSubmit,
  onDelete,
} = useTripEditor();
// Issue #96: restricted-Nutzer:innen dürfen nur einen selbst angelegten Urlaub haben - bereits
// eingeladene Urlaube zählen nicht mit (siehe registrationConfig.ts's countTripsCreatedBy), das
// Frontend kennt diese Unterscheidung aber nicht, deshalb konservativ ab dem ersten Urlaub sperren.
const tripCreationBlocked = () => !!auth.user?.restricted && tripStore.trips.length > 0;

function selectTrip(id: number) {
  tripStore.selectTrip(id);
  router.push(`/trip/${id}`);
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
      <Button v-if="tripStore.trips.length > 0 && !tripCreationBlocked()" @click="openCreate">
        <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Neuer Urlaub
      </Button>
      <p v-else-if="tripCreationBlocked()" class="restricted-hint">
        Eingeschränkter Modus - Nur ein Urlaub pro Nutzer
      </p>
    </div>

    <div v-if="tripStore.trips.length > 0" class="trip-list">
      <Card
        v-for="(trip, index) in tripStore.trips"
        :key="trip.id"
        class="trip-card animate-cascade"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
      >
        <button type="button" class="trip-select" @click="selectTrip(trip.id)">
          {{ trip.name }}
        </button>
        <div class="row-actions">
          <IconButton
            size="md"
            :icon="FORM_FIELD_ICONS.visibility"
            title="Mitglieder verwalten"
            aria-label="Mitglieder verwalten"
            @click="openMembers(trip)"
          />
          <EditButton @click="openEdit(trip)" />
        </div>
      </Card>
    </div>

    <Card v-else class="empty-state">
      <h2>Willkommen bei Reisotor!</h2>
      <p class="empty">Du hast noch keinen Urlaub geplant.</p>
      <TripForm submit-label="Urlaub anlegen" @submit="onSubmit" />
      <p class="invite-hint">
        Alternativ kann dich ein bestehendes Mitglied eines Urlaubs über die Mitglieder-Verwaltung
        (Symbol <AppIcon :icon="FORM_FIELD_ICONS.visibility" :size="14" group="formFields" /> im
        Urlaubs-Menü) per Nutzername einladen.
      </p>
    </Card>

    <Modal
      :model-value="showForm"
      :title="editingTrip ? 'Urlaub bearbeiten' : 'Neuen Urlaub anlegen'"
      full-height
      @update:model-value="(v) => !v && closeForm()"
    >
      <TripForm
        :trip-id="editingTrip?.id"
        :location-error="tripFormLocationError"
        :initial-tab="tripStore.editTripInitialTab"
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
                weather_model: editingTrip.weather_model ?? 'ecmwf_ifs025',
              }
            : undefined
        "
        @submit="onSubmit"
        @delete="onDelete"
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
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.trip-card:hover {
  border-color: var(--color-border-strong);
}

.trip-select {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: none;
  padding: 4px 6px;
  margin: -4px -6px;
  border-radius: var(--radius-xs-squircle);
  corner-shape: squircle;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

.trip-select:hover {
  color: var(--color-primary);
}

.trip-select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.row-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.empty-state {
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: calc(100dvh - var(--app-header-height, 56px) - var(--space-4) * 2 - 36px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
  overscroll-behavior: contain;
}

.empty-state::-webkit-scrollbar {
  width: 6px;
}

.empty-state::-webkit-scrollbar-track {
  background: transparent;
}

.empty-state::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: var(--radius-pill);
}

.empty-state::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
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

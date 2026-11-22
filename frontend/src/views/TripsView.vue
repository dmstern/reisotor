<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useTripEditor } from '../composables/useTripEditor';
import Modal from '../components/Modal.vue';
import TripForm from '../components/TripForm.vue';
import TripCard from '../components/TripCard.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Card from '../components/primitives/Card.vue';
import PremiumBadge from '../components/PremiumBadge.vue';
import { useAccountTierModal } from '../composables/useAccountTierModal';
import { ACTION_ICONS } from '../utils/actionIcons';

const CARD_STAGGER_DELAY_MS = 60;

const router = useRouter();
const tripStore = useTripStore();
const auth = useAuthStore();
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
// eingeladene Urlaube zählen nicht mit (siehe registrationConfig.ts's countTripsCreatedBy).
const tripCreationBlocked = () =>
  !!auth.user?.restricted && tripStore.trips.some((trip) => trip.created_by_me !== false);
const { openAccountTierModal } = useAccountTierModal();

function handleCreateTrip() {
  if (tripCreationBlocked()) {
    openAccountTierModal('trips');
    return;
  }

  openCreate();
}

function selectTrip(id: number) {
  tripStore.selectTrip(id);
  router.push(`/trip/${id}`);
}
</script>

<template>
  <div class="page">
    <div class="header">
      <h1>Meine Urlaube</h1>
      <Button
        v-if="tripStore.trips.length > 0"
        :variant="tripCreationBlocked() ? 'secondary' : 'primary'"
        @click="handleCreateTrip"
      >
        <AppIcon :icon="ACTION_ICONS.mapPlus" :size="14" group="actions" /> Neuer Urlaub
        <PremiumBadge v-if="tripCreationBlocked()" feature="trips" as="span" :stop="false" />
      </Button>
    </div>

    <div v-if="tripStore.trips.length > 0" class="trip-grid">
      <TripCard
        v-for="(trip, index) in tripStore.trips"
        :key="trip.id"
        :trip="trip"
        :active="trip.id === tripStore.currentTripId"
        class="animate-cascade"
        :style="{ '--stagger-delay': `${index * CARD_STAGGER_DELAY_MS}ms` }"
        @select="selectTrip"
        @edit="openEdit"
      />
    </div>

    <Card v-else class="empty-state">
      <h2>Willkommen bei Reisotor!</h2>
      <p class="empty">Du hast noch keinen Urlaub geplant.</p>
      <TripForm submit-label="Urlaub anlegen" @submit="onSubmit" />
      <p class="invite-hint">
        Alternativ kann dich ein bestehendes Mitglied eines Urlaubs über „Urlaub bearbeiten“ (Tab
        „Zugriffsberechtigungen“) per Nutzername einladen.
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
        :initial-category-type="tripStore.editTripInitialCategoryType"
        :initial="
          editingTrip
            ? {
                name: editingTrip.name,
                destination: editingTrip.destination ?? '',
                start_date: editingTrip.start_date,
                end_date: editingTrip.end_date,
                maps_link: editingTrip.maps_link ?? '',
                lat: editingTrip.lat ?? undefined,
                lng: editingTrip.lng ?? undefined,
                image_url: editingTrip.image_url ?? '',
                packing_category_required: editingTrip.packing_category_required !== 0,
                weather_model: editingTrip.weather_model ?? 'ecmwf_ifs025',
              }
            : undefined
        "
        @submit="onSubmit"
        @delete="onDelete"
        @cancel="closeForm()"
        @navigate="closeForm()"
      />
    </Modal>
  </div>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.header h1 {
  margin: 0;
  min-width: 0;
}

@include container-app-main-down('mobile') {
  .header {
    flex-direction: column;
    align-items: stretch;
  }

  .header :deep(button) {
    width: 100%;
    justify-content: center;
  }
}

.trip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: var(--space-lg);
  align-items: stretch;
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

.empty-state h2 {
  margin: 0;
}

.invite-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-top: var(--space-2);
}
</style>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useTripEditor } from '../composables/useTripEditor';
import type { Trip } from '../api/types';
import Modal from './Modal.vue';
import TripForm from './TripForm.vue';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import TripMembersDialog from './TripMembersDialog.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

const tripStore = useTripStore();
const auth = useAuthStore();
const open = ref(false);
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
// Issue #96: siehe TripsView.vue's tripCreationBlocked() - dieselbe Regel, hier gedoppelt statt
// geteilt, weil beide Komponenten bereits unabhängige useTripEditor()-Instanzen halten.
const tripCreationBlocked = () => !!auth.user?.restricted && tripStore.trips.length > 0;

// Sprungziel für Fremdobjekte (z. B. Urlaub-Einträge im Kalender): öffnet das Edit-Modal
// des aktuellen Urlaubs, ohne dass die einbettende Sicht selbst editieren muss.
watch(
  () => tripStore.editTripRequestId,
  (id) => {
    if (id > 0 && tripStore.currentTrip) {
      openEdit(tripStore.currentTrip);
      close();
    }
  }
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

function openMembers(trip: Trip) {
  membersTrip.value = trip;
  showMembers.value = true;
  close();
}
</script>

<template>
  <div class="trip-switcher">
    <button type="button" class="switcher-btn" @click="toggle">
      <span class="trip-name">{{ tripStore.currentTrip?.name ?? 'Urlaub wählen' }}</span>
      <AppIcon :icon="ACTION_ICONS.chevronDown" :size="12" group="actions" class="caret" />
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
          <DropdownItem
            :label="trip.name"
            :active="trip.id === tripStore.currentTripId"
            class="trip-select"
            @click="selectAndClose(trip.id)"
          />
          <div class="row-actions">
            <IconButton
              variant="ghost"
              size="sm"
              :icon="FORM_FIELD_ICONS.visibility"
              title="Mitglieder verwalten"
              aria-label="Mitglieder verwalten"
              @click="openMembers(trip)"
            />
            <EditButton
              small
              @click="
                () => {
                  openEdit(trip);
                  close();
                }
              "
            />
            <DeleteButton small @click="onDelete(trip)" />
          </div>
        </div>
        <p v-if="!tripStore.trips.length" class="empty">Noch keine Urlaube.</p>
        <Button
          v-if="!tripCreationBlocked()"
          type="button"
          variant="ghost"
          class="new-trip-btn"
          @click="
            () => {
              openCreate();
              close();
            }
          "
        >
          + Neuer Urlaub
        </Button>
        <p v-else class="empty">Eingeschränkter Modus - Nur ein Urlaub pro Nutzer</p>
        <router-link to="/trips" class="manage-trips-btn" @click="close"
          >Alle Urlaube verwalten</router-link
        >
      </div>
    </template>

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
.trip-switcher {
  position: relative;
}

.switcher-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-primary-tint);
  border: none;
  border-radius: var(--radius-sm-squircle);
  padding: 6px 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  cursor: pointer;
  max-width: 40vw;
  /* Ohne min-width:0 verweigert der Button als Flex-Kind von .switcher (AppHeader.vue) das
     Schrumpfen unter die Content-Breite von .trip-name (white-space:nowrap) - max-width:40vw
     greift dann nicht mehr zuverlässig, sobald .switcher selbst (flex:1) durch weitere Header-Icons
     (z. B. NotificationInbox.vue's Glocke) auf schmalen Viewports enger wird, wodurch der Button
     sichtbar über seine eigene Box hinaus in die Nachbar-Icons hineinragte (#97-Regression in
     layout-overlap.spec.ts). min-width:0 lässt .trip-name's Ellipsis (siehe dort) stattdessen wie
     vorgesehen greifen. */
  min-width: 0;
}

.trip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  flex-shrink: 0;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.dropdown {
  position: absolute;
  top: calc(100% + 6px);
  /* Der Switcher-Wrapper ist über die von AppHeader.vue übergebene .switcher-Klasse (flex:1)
     deutlich breiter als der Button selbst und zentriert diesen nur per justify-content – ein
     "left:0" würde das Dropdown daher am Wrapper-Rand statt unter dem Button positionieren. */
  left: 50%;
  transform: translateX(-50%);
  min-width: 240px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
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
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

/* #193: der globale `button`-Basisstil (style.css) setzt box-shadow: var(--shadow-sm) - der
   Dropdown-Container selbst trägt bereits --shadow-md (siehe .dropdown oben), ein zusätzlicher
   Schatten je Listenzeile/Aktions-Button (Trip-Auswahl, Mitglieder/Bearbeiten/Löschen, "+ Neuer
   Urlaub") wirkte dadurch doppelt erhoben und "doof" (Issue #193). Trifft dank Vues Vererbung des
   Scope-Attributs an Kind-Komponenten-Root-Elementen auch EditButton.vue/DeleteButton.vue, deren
   <button> jeweils das Root-Element ist. */
.dropdown button {
  box-shadow: none;
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
  border-radius: var(--radius-sm-squircle);
}

.trip-select:hover {
  background: var(--color-hover);
}

.row-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.members-btn {
  padding: 4px 8px;
  font-size: 0.8rem;
  line-height: 1;
  flex-shrink: 0;
}

.empty {
  font-size: 0.85rem;
  padding: 6px 8px;
}

.new-trip-btn {
  margin-top: 4px;
  text-align: left;
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm-squircle);
  padding: 6px 8px;
  font-size: 0.85rem;
  color: var(--color-primary-dark);
  cursor: pointer;
}

.new-trip-btn:hover {
  background: var(--color-primary-tint);
}

.manage-trips-btn {
  display: block;
  text-align: left;
  background: none;
  border: none;
  border-radius: var(--radius-sm-squircle);
  padding: 6px 8px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: pointer;
}

.manage-trips-btn:hover {
  background: var(--color-hover);
}
</style>

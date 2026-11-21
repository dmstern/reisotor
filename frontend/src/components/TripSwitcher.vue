<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick, type ComponentPublicInstance } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useTripEditor } from '../composables/useTripEditor';
import Modal from './Modal.vue';
import TripForm from './TripForm.vue';
import EditButton from './EditButton.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import PremiumBadge from './PremiumBadge.vue';
import { useAccountTierModal } from '../composables/useAccountTierModal';
import { ACTION_ICONS } from '../utils/actionIcons';

const DEFAULT_MENU_WIDTH = 260;
const VIEWPORT_PADDING = 8;
const MENU_OFFSET = 6;

const props = withDefaults(
  defineProps<{
    docked?: boolean;
  }>(),
  {
    docked: false,
  }
);

const tripStore = useTripStore();
const auth = useAuthStore();
const open = ref(false);
const switcherBtnRef = ref<ComponentPublicInstance | null>(null);
const dropdownRef = ref<InstanceType<typeof PickerMenu> | null>(null);
const dropdownStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });
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
const tripCreationBlocked = () =>
  !!auth.user?.restricted && tripStore.trips.some((trip) => trip.created_by_me !== false);
const { openAccountTierModal } = useAccountTierModal();

function handleCreateTrip() {
  close();

  if (tripCreationBlocked()) {
    openAccountTierModal('trips');
    return;
  }

  openCreate();
}

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

const router = useRouter();
const route = useRoute();

function updateDropdownPosition() {
  const btnEl = switcherBtnRef.value?.$el as HTMLElement | undefined;

  if (!btnEl) {
    return;
  }

  const rect = btnEl.getBoundingClientRect();
  const menuWidth = dropdownRef.value?.el?.getBoundingClientRect().width || DEFAULT_MENU_WIDTH;
  const viewportWidth = window.innerWidth;

  const triggerCenter = rect.left + rect.width / 2;
  let left = triggerCenter - menuWidth / 2;
  left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - menuWidth - VIEWPORT_PADDING));

  const top = rect.bottom + MENU_OFFSET;

  dropdownStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  };
}

async function toggle() {
  if (open.value) {
    close();
    return;
  }

  updateDropdownPosition();
  open.value = true;
  await nextTick();
  updateDropdownPosition();
}

function close() {
  open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('resize', close, { passive: true });
  } else {
    window.removeEventListener('resize', close);
  }
});

watch(
  () => route.fullPath,
  () => {
    close();
    closeForm();
  }
);

onUnmounted(() => {
  window.removeEventListener('resize', close);
});

function selectAndClose(id: number) {
  tripStore.selectTrip(id);
  close();

  if (route.params.tripId) {
    router.push({
      name: route.name ?? undefined,
      params: { ...route.params, tripId: id },
      query: route.query,
      hash: route.hash,
    });
  } else {
    router.push(`/trip/${id}`);
  }
}
</script>

<template>
  <div class="trip-switcher" :class="{ 'is-docked': props.docked }">
    <Button
      ref="switcherBtnRef"
      variant="tonal"
      shape="pill"
      :size="props.docked ? 'xs' : 'sm'"
      class="switcher-btn"
      title="Urlaub wechseln"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="toggle"
    >
      <span class="trip-name">{{ tripStore.currentTrip?.name ?? 'Urlaub wählen' }}</span>
      <AppIcon :icon="ACTION_ICONS.chevronDown" :size="12" group="actions" class="caret" />
    </Button>

    <Teleport to="body">
      <PickerMenu
        v-if="open"
        ref="dropdownRef"
        class="dropdown trip-switcher-dropdown"
        :style="dropdownStyle"
        aria-label="Urlaube"
        @close="close"
      >
        <div
          v-for="trip in tripStore.trips"
          :key="trip.id"
          class="trip-row"
          :class="{ active: trip.id === tripStore.currentTripId }"
        >
          <DropdownMenuItem
            :label="trip.name"
            :active="trip.id === tripStore.currentTripId"
            class="trip-select"
            @click="selectAndClose(trip.id)"
          />
          <div class="row-actions">
            <EditButton
              small
              @click="
                () => {
                  openEdit(trip);
                  close();
                }
              "
            />
          </div>
        </div>
        <p v-if="!tripStore.trips.length" class="empty">Noch keine Urlaube.</p>
        <Button type="button" variant="ghost" class="new-trip-btn" @click="handleCreateTrip">
          <span class="new-trip-label">
            <AppIcon :icon="ACTION_ICONS.mapPlus" :size="14" group="actions" />
            <span>Neuer Urlaub</span>
          </span>
          <PremiumBadge v-if="tripCreationBlocked()" feature="trips" as="span" :stop="false" />
        </Button>
        <router-link to="/trips" class="manage-trips-btn" @click="close"
          >Alle Urlaube verwalten</router-link
        >
      </PickerMenu>
    </Teleport>

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
.trip-switcher {
  position: relative;
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
}

.switcher-btn {
  max-width: min(100%, 280px);
  /* Ohne min-width:0 verweigert der Button als Flex-Kind das
     Schrumpfen unter die Content-Breite von .trip-name (white-space:nowrap) - max-width
     greift dann nicht mehr zuverlässig, sobald .switcher selbst durch weitere Header-Icons
     auf schmalen Viewports enger wird. min-width:0 lässt .trip-name's Ellipsis wie
     vorgesehen greifen. */
  min-width: 0;
}

@include media-down('mobile') {
  .switcher-btn {
    padding: 5px 10px;
    gap: 4px;
    font-size: var(--font-size-xs);
  }
}

.trip-switcher.is-docked {
  margin: 0 var(--space-2);
}

.trip-switcher.is-docked .switcher-btn {
  max-width: 180px;
}

.trip-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  flex-shrink: 0;
}

.dropdown {
  min-width: 240px;
  max-width: min(340px, calc(100vw - 16px));
  max-height: min(70vh, 480px);
  gap: 4px;
}

.trip-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.trip-select {
  flex: 1;
  min-width: 0;
}

.row-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.empty {
  font-size: 0.85rem;
  padding: 6px 8px;
}

.new-trip-btn {
  margin-top: var(--space-1);
  text-align: left;
  border: 1px dashed var(--color-border-divider);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px 8px;
  font-size: 0.85rem;
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.new-trip-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.manage-trips-btn {
  display: flex;
  align-items: center;
  min-height: 44px;
  text-align: left;
  background: none;
  border: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px 8px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: pointer;
}

.manage-trips-btn:hover {
  background: var(--color-hover);
}

.manage-trips-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}
</style>

<script setup lang="ts">
import { useMapToolMenus } from '../composables/useMapToolMenus';
import { useMapTrackRecording } from '../composables/useMapTrackRecording';
import { MAP_TOOL_ICONS } from '../utils/mapToolIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import IconButton from './primitives/IconButton.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import TrackRecordingWarningModal from './TrackRecordingWarningModal.vue';

interface Props {
  filteredPointsCount: number;
  vacationPointsCount: number;
  accommodationPointsCount: number;
  totalAccommodationsCount: number;
  hasExcursions: boolean;
  excursionPointsCount: number;
  allTripPhotosLoaded: boolean;
  allTripPhotoPointsCount: number;
  hasOwnPosition: boolean;
  userAvatar?: string | null;
  otherMembers?: Array<{ id: number; username: string; avatar: string }>;
  isMemberOnline?: (id: number) => boolean;
  hasMemberPosition?: (id: number) => boolean;
  mapOrientationMode?: 'north' | 'heading';
  tileDownloadState?: 'idle' | 'downloading' | 'done';
}

withDefaults(defineProps<Props>(), {
  userAvatar: '📍',
  otherMembers: () => [],
  isMemberOnline: () => false,
  hasMemberPosition: () => false,
  mapOrientationMode: 'north',
  tileDownloadState: 'idle',
});

const emit = defineEmits<{
  (e: 'fit-all'): void;
  (e: 'fit-vacation'): void;
  (e: 'fit-accommodations'): void;
  (e: 'fit-excursions'): void;
  (e: 'focus-all-photos'): void;
  (e: 'open-focus-menu'): void;
  (e: 'jump-my-location'): void;
  (e: 'jump-member-location', memberId: number): void;
  (e: 'set-orientation-mode', mode: 'north' | 'heading'): void;
  (e: 'download-offline-map'): void;
}>();

const {
  focusMenuOpen,
  focusButtonRef,
  focusMenuStyle,
  toggleFocusMenu,
  selectFocus,
  locationMenuOpen,
  locationButtonRef,
  locationMenuStyle,
  toggleLocationMenu,
  selectLocation,
  shareMenuOpen,
  shareButtonRef,
  shareMenuStyle,
  shareDurationLabel,
  toggleShareMenu,
  chooseShareDuration,
  locationSharing,
} = useMapToolMenus({
  onFocusMenuOpen: () => emit('open-focus-menu'),
});

const {
  showTrackRecordingWarningModal,
  isMapRecordingActive,
  toggleRecord,
  startRecordingConfirmed,
} = useMapTrackRecording();
</script>

<template>
  <!-- Fasst "Alle anzeigen"/"Nur Urlaubsort"/"Nur Unterkünfte"/"Nur Tourziele" hinter einem Popover zusammen -->
  <IconButton
    ref="focusButtonRef"
    variant="floating"
    shape="circle"
    class="fit-btn focus-btn"
    title="Kartenausschnitt fokussieren"
    aria-label="Kartenausschnitt fokussieren"
    :disabled="!filteredPointsCount"
    :icon="MAP_TOOL_ICONS.focusGroup"
    @click="toggleFocusMenu($event)"
  />

  <!-- Fasst "Zu meinem Standort springen" und den Ausrichtungs-Umschalter hinter einem Popover zusammen -->
  <IconButton
    ref="locationButtonRef"
    variant="floating"
    shape="circle"
    class="fit-btn location-btn"
    title="Standort & Ausrichtung"
    aria-label="Standort & Ausrichtung"
    :icon="MAP_TOOL_ICONS.locationGroup"
    @click="toggleLocationMenu($event)"
  />

  <IconButton
    variant="floating"
    shape="circle"
    class="fit-btn offline-download-btn"
    title="Sichtbaren Kartenausschnitt für die Offline-Nutzung herunterladen"
    aria-label="Sichtbaren Kartenausschnitt für die Offline-Nutzung herunterladen"
    :disabled="tileDownloadState === 'downloading'"
    :icon="ACTION_ICONS.download"
    @click="emit('download-offline-map')"
  />

  <!-- Standort-Freigabe (stores/locationSharing.ts) -->
  <IconButton
    ref="shareButtonRef"
    variant="floating"
    shape="circle"
    class="fit-btn share-location-btn"
    :active="locationSharing.activeDuration !== 'off'"
    :title="shareDurationLabel"
    :aria-label="shareDurationLabel"
    :icon="ACTION_ICONS.shareLocation"
    @click="toggleShareMenu($event)"
  />

  <!-- Standort-Aufzeichnung (stores/trackRecording.ts) -->
  <IconButton
    variant="floating"
    shape="circle"
    class="fit-btn record-btn"
    :active="isMapRecordingActive"
    :title="isMapRecordingActive ? 'Aufzeichnung beenden' : 'Standort aufzeichnen'"
    :aria-label="isMapRecordingActive ? 'Aufzeichnung beenden' : 'Standort aufzeichnen'"
    :icon="isMapRecordingActive ? ACTION_ICONS.recordStop : ACTION_ICONS.recordStart"
    @click="toggleRecord"
  />

  <Teleport to="body">
    <template v-if="focusMenuOpen">
      <PickerMenu wide :style="focusMenuStyle" @close="focusMenuOpen = false">
        <DropdownItem
          :disabled="!filteredPointsCount"
          :title="
            !filteredPointsCount
              ? 'Keine eingetragenen Orte vorhanden'
              : 'Alle eingetragenen Orte auf der Karte anzeigen'
          "
          :icon="MAP_TOOL_ICONS.fitAll"
          label="Alle eingetragenen Orte anzeigen"
          @click="selectFocus(() => emit('fit-all'))"
        />
        <DropdownItem
          :disabled="!vacationPointsCount"
          :title="
            !vacationPointsCount ? 'Kein Urlaubsort eingetragen' : 'Auf den Urlaubsort fokussieren'
          "
          :icon="MAP_TOOL_ICONS.vacation"
          label="Nur Urlaubsort"
          @click="selectFocus(() => emit('fit-vacation'))"
        />
        <DropdownItem
          :disabled="!accommodationPointsCount"
          :title="
            !accommodationPointsCount
              ? totalAccommodationsCount > 0
                ? 'Unterkünfte haben keinen Standort auf der Karte (Standort im Spot per Maps-Link oder Pin festlegen)'
                : 'Keine Unterkünfte für diesen Urlaub eingetragen'
              : accommodationPointsCount === 1
                ? 'Auf die Unterkunft fokussieren'
                : 'Auf die Unterkünfte fokussieren'
          "
          :icon="MAP_TOOL_ICONS.accommodation"
          label="Nur Unterkünfte"
          @click="selectFocus(() => emit('fit-accommodations'))"
        />
        <DropdownItem
          v-if="hasExcursions"
          :disabled="!excursionPointsCount"
          :title="
            !excursionPointsCount
              ? 'Keine Tourziele mit Koordinaten vorhanden'
              : 'Auf Tourziele fokussieren'
          "
          :icon="MAP_TOOL_ICONS.excursions"
          label="Nur Tourziele"
          @click="selectFocus(() => emit('fit-excursions'))"
        />
        <DropdownItem
          :disabled="allTripPhotosLoaded && !allTripPhotoPointsCount"
          :title="
            !allTripPhotosLoaded
              ? 'Fotos werden geladen...'
              : !allTripPhotoPointsCount
                ? 'Keine Fotos mit Standortinformationen im Urlaub hinterlegt'
                : allTripPhotoPointsCount === 1
                  ? '1 Foto mit Standort auf der Karte anzeigen'
                  : `${allTripPhotoPointsCount} Fotos mit Standort auf der Karte anzeigen`
          "
          :icon="MAP_TOOL_ICONS.photos"
          label="Alle Fotos mit Standort"
          @click="selectFocus(() => emit('focus-all-photos'))"
        />
      </PickerMenu>
    </template>
    <template v-if="locationMenuOpen">
      <PickerMenu wide :style="locationMenuStyle" @close="locationMenuOpen = false">
        <DropdownItem
          :disabled="!hasOwnPosition"
          @click="selectLocation(() => emit('jump-my-location'))"
        >
          <span class="picker-item-emoji" aria-hidden="true">{{ userAvatar || '📍' }}</span>
          Zu meinem Standort springen
        </DropdownItem>
        <DropdownItem
          v-for="member in otherMembers"
          :key="member.id"
          :disabled="!hasMemberPosition(member.id)"
          :title="`${member.username} teilt gerade ${hasMemberPosition(member.id) ? '' : 'keinen '}Standort`"
          @click="selectLocation(() => emit('jump-member-location', member.id))"
        >
          <span
            class="picker-item-emoji"
            :class="{ offline: !isMemberOnline(member.id) }"
            aria-hidden="true"
          >
            {{ member.avatar }}
            <span v-if="isMemberOnline(member.id)" class="online-dot" aria-hidden="true" />
          </span>
          Zu Standort von {{ member.username }} springen
        </DropdownItem>
        <DropdownItem
          :active="mapOrientationMode === 'north'"
          :icon="MAP_TOOL_ICONS.orientationNorth"
          label="Norden oben"
          @click="selectLocation(() => emit('set-orientation-mode', 'north'))"
        />
        <DropdownItem
          :active="mapOrientationMode === 'heading'"
          :icon="MAP_TOOL_ICONS.orientationHeading"
          label="Fahrtrichtung oben"
          @click="selectLocation(() => emit('set-orientation-mode', 'heading'))"
        />
      </PickerMenu>
    </template>
    <template v-if="shareMenuOpen">
      <PickerMenu :style="shareMenuStyle" @close="shareMenuOpen = false">
        <DropdownItem
          :active="locationSharing.activeDuration === 'off'"
          :icon="ACTION_ICONS.off"
          label="Nicht teilen"
          @click="chooseShareDuration('off')"
        />
        <DropdownItem
          :active="locationSharing.activeDuration === 'day'"
          :icon="FORM_FIELD_ICONS.date"
          icon-group="formFields"
          label="Für einen Tag"
          @click="chooseShareDuration('day')"
        />
        <DropdownItem
          :active="locationSharing.activeDuration === 'week'"
          :icon="FORM_FIELD_ICONS.period"
          icon-group="formFields"
          label="Für eine Woche"
          @click="chooseShareDuration('week')"
        />
        <DropdownItem
          :active="locationSharing.activeDuration === 'forever'"
          :icon="ACTION_ICONS.forever"
          label="Dauerhaft"
          @click="chooseShareDuration('forever')"
        />
      </PickerMenu>
    </template>
  </Teleport>

  <TrackRecordingWarningModal
    v-model="showTrackRecordingWarningModal"
    @confirm="startRecordingConfirmed"
  />
</template>

<style scoped>
.fit-btn {
  position: absolute;
  top: var(--fit-btn-top-inset, var(--fit-btn-inset));
  right: var(--fit-btn-right-inset, var(--fit-btn-inset));
  z-index: 1000;
  width: var(--fit-btn-size) !important;
  height: var(--fit-btn-size) !important;
  min-width: var(--fit-btn-size) !important;
  min-height: var(--fit-btn-size) !important;
  padding: 0;
  border-radius: 50%;
  corner-shape: round;
  background: var(--color-surface);
  border: 2px solid rgba(0, 0, 0, 0.25);
  color: var(--color-text);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

.fit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.location-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + var(--fit-btn-step));
}

.offline-download-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + 2 * var(--fit-btn-step));
}

.share-location-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + 3 * var(--fit-btn-step));
}

.record-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + 4 * var(--fit-btn-step));
}

.share-location-btn.active,
.record-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.picker-item-emoji {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
}

.picker-item-emoji.offline {
  filter: grayscale(1);
  opacity: 0.6;
}

.picker-item-emoji .online-dot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
  border: 2px solid var(--color-surface);
}

@media (min-width: 1024px) {
  .fit-btn {
    font-size: 1.2rem;
  }
}
</style>

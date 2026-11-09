<script setup lang="ts">
import { computed } from 'vue';
import { useMapToolMenus } from '../composables/useMapToolMenus';
import { useMapTrackRecording } from '../composables/useMapTrackRecording';
import { MAP_TOOL_ICONS } from '../utils/mapToolIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import IconButton from './primitives/IconButton.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import TrackRecordingWarningModal from './TrackRecordingWarningModal.vue';

interface Props {
  filteredPointsCount: number;
  vacationPointsCount: number;
  homePointsCount: number;
  accommodationPointsCount: number;
  totalAccommodationsCount: number;
  allTripPhotosLoaded: boolean;
  allTripPhotoPointsCount: number;
  hasOwnPosition: boolean;
  userAvatar?: string | null;
  otherMembers?: Array<{ id: number; username: string; avatar: string }>;
  isMemberOnline?: (id: number) => boolean;
  hasMemberPosition?: (id: number) => boolean;
  mapOrientationMode?: 'north' | 'heading';
}

const props = withDefaults(defineProps<Props>(), {
  userAvatar: '📍',
  otherMembers: () => [],
  isMemberOnline: () => false,
  hasMemberPosition: () => false,
  mapOrientationMode: 'north',
});

const emit = defineEmits<{
  (e: 'fit-all'): void;
  (e: 'fit-vacation'): void;
  (e: 'fit-home'): void;
  (e: 'fit-accommodations'): void;
  (e: 'focus-all-photos'): void;
  (e: 'open-focus-menu'): void;
  (e: 'jump-my-location'): void;
  (e: 'jump-member-location', memberId: number): void;
  (e: 'set-orientation-mode', mode: 'north' | 'heading'): void;
}>();

const activeMembersWithPosition = computed(() =>
  props.otherMembers.filter((member) => props.hasMemberPosition(member.id))
);

const {
  focusMenuOpen,
  focusButtonRef,
  focusMenuStyle,
  toggleFocusMenu,
  selectFocus,
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
  <!-- Fasst Kartenausschnitts-Sprünge (Orte, Fotos, Live-Standorte) und Kartenausrichtung hinter einem Popover zusammen -->
  <IconButton
    ref="focusButtonRef"
    variant="floating"
    shape="circle"
    class="fit-btn focus-btn"
    title="Kartenausschnitt & Ausrichtung"
    aria-label="Kartenausschnitt & Ausrichtung"
    :icon="MAP_TOOL_ICONS.focusGroup"
    @click="toggleFocusMenu($event)"
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
      <PickerMenu
        wide
        class="focus-picker-menu"
        :style="focusMenuStyle"
        @close="focusMenuOpen = false"
      >
        <DropdownMenuItem
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
        <DropdownMenuItem
          :disabled="!vacationPointsCount"
          :title="
            !vacationPointsCount ? 'Kein Urlaubsort eingetragen' : 'Auf den Urlaubsort fokussieren'
          "
          :icon="MAP_TOOL_ICONS.vacation"
          label="Nur Urlaubsort"
          @click="selectFocus(() => emit('fit-vacation'))"
        />
        <DropdownMenuItem
          :disabled="!homePointsCount"
          :title="
            !homePointsCount ? 'Keine Heimatorte eingetragen' : 'Auf die Heimatorte fokussieren'
          "
          :icon="MAP_TOOL_ICONS.home"
          label="Nur Heimatorte"
          @click="selectFocus(() => emit('fit-home'))"
        />
        <DropdownMenuItem
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
        <DropdownMenuItem
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

        <hr class="picker-divider" />

        <DropdownMenuItem
          :disabled="!hasOwnPosition"
          :title="
            !hasOwnPosition
              ? 'Kein eigener Standort verfügbar'
              : 'Auf meinen aktuellen Standort zentrieren'
          "
          @click="selectFocus(() => emit('jump-my-location'))"
        >
          <span class="picker-item-emoji" aria-hidden="true">{{ userAvatar || '📍' }}</span>
          Zu meinem Standort springen
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="member in activeMembersWithPosition"
          :key="member.id"
          :title="`${member.username} teilt gerade den Standort`"
          @click="selectFocus(() => emit('jump-member-location', member.id))"
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
        </DropdownMenuItem>

        <hr class="picker-divider" />

        <DropdownMenuItem
          :active="mapOrientationMode === 'north'"
          :icon="MAP_TOOL_ICONS.orientationNorth"
          label="Norden oben"
          @click="selectFocus(() => emit('set-orientation-mode', 'north'))"
        />
        <DropdownMenuItem
          :active="mapOrientationMode === 'heading'"
          :icon="MAP_TOOL_ICONS.orientationHeading"
          label="Fahrtrichtung oben"
          @click="selectFocus(() => emit('set-orientation-mode', 'heading'))"
        />
      </PickerMenu>
    </template>
    <template v-if="shareMenuOpen">
      <PickerMenu :style="shareMenuStyle" @close="shareMenuOpen = false">
        <DropdownMenuItem
          :active="locationSharing.activeDuration === 'off'"
          :icon="ACTION_ICONS.off"
          label="Nicht teilen"
          @click="chooseShareDuration('off')"
        />
        <DropdownMenuItem
          :active="locationSharing.activeDuration === 'day'"
          :icon="FORM_FIELD_ICONS.date"
          icon-group="formFields"
          label="Für einen Tag"
          @click="chooseShareDuration('day')"
        />
        <DropdownMenuItem
          :active="locationSharing.activeDuration === 'week'"
          :icon="FORM_FIELD_ICONS.period"
          icon-group="formFields"
          label="Für eine Woche"
          @click="chooseShareDuration('week')"
        />
        <DropdownMenuItem
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
  width: var(--fit-btn-size);
  height: var(--fit-btn-size);
  min-width: var(--fit-btn-size);
  min-height: var(--fit-btn-size);
  padding: 0;
  border-radius: var(--radius-full);
  corner-shape: round;
  background-color: var(--color-surface);
  background-image: var(--gradient-control-3d);
  border: 1.5px solid var(--color-border-strong);
  box-shadow:
    inset 0 1px 0 var(--shadow-control-highlight),
    var(--shadow-sm);
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s cubic-bezier(0.2, 0.8, 0.4, 1),
    translate 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);
}

.fit-btn:hover:not(:disabled) {
  background-color: var(--color-hover);
  border-color: var(--color-primary-dark);
  box-shadow:
    inset 0 1px 0 var(--shadow-control-highlight-strong),
    var(--shadow-md);
  translate: 0 -1px;
}

.fit-btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.985);
  translate: 0 0;
  background-color: var(--color-hover);
  box-shadow:
    inset 0 1.5px 3px rgba(0, 0, 0, 0.16),
    var(--shadow-sm);
}

.fit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
  translate: 0 0;
}

.share-location-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + var(--fit-btn-step));
}

.record-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + 2 * var(--fit-btn-step));
}

.share-location-btn.active,
.record-btn.active,
.share-location-btn.is-active,
.record-btn.is-active {
  background-color: var(--color-primary);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.16) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  border-color: var(--color-primary-dark);
  color: var(--color-primary-contrast, #ffffff);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.35),
    var(--shadow-sm);
}

.share-location-btn.active:hover:not(:disabled),
.record-btn.active:hover:not(:disabled),
.share-location-btn.is-active:hover:not(:disabled),
.record-btn.is-active:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.4),
    var(--shadow-md);
  translate: 0 -1px;
}

.share-location-btn.active:active:not(:disabled),
.record-btn.active:active:not(:disabled),
.share-location-btn.is-active:active:not(:disabled),
.record-btn.is-active:active:not(:disabled) {
  transform: translateY(1px) scale(0.985);
  translate: 0 0;
  box-shadow:
    inset 0 1.5px 3px rgba(0, 0, 0, 0.25),
    var(--shadow-sm);
}

@media (prefers-reduced-motion: reduce) {
  .fit-btn {
    transition: none !important;
    transform: none !important;
    translate: none !important;
  }
}

:global(.focus-picker-menu) {
  max-height: calc(100dvh - 80px);
  overflow-y: auto;
}

.picker-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-1) 0;
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
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-success);
  border: 2px solid var(--color-surface);
}

@container trip-map (min-width: 720px) {
  .fit-btn {
    font-size: var(--font-size-lg);
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
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
  vacationDays?: string[];
  activeDate?: string | null;
  dayHasContent?: (date: string) => boolean;
  formatDate?: (date: string) => string;
  showDayFilterButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  userAvatar: '📍',
  otherMembers: () => [],
  isMemberOnline: () => false,
  hasMemberPosition: () => false,
  mapOrientationMode: 'north',
  vacationDays: () => [],
  activeDate: null,
  showDayFilterButton: false,
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
  (e: 'select-day', date: string): void;
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
  dayMenuOpen,
  dayButtonRef,
  dayMenuStyle,
  toggleDayMenu,
} = useMapToolMenus({
  onFocusMenuOpen: () => emit('open-focus-menu'),
});

const {
  showTrackRecordingWarningModal,
  isMapRecordingActive,
  toggleRecord,
  startRecordingConfirmed,
} = useMapTrackRecording();

const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  return new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
}

function formatWeekday(dateStr: string): string {
  const d = parseDate(dateStr);
  if (!d) return '';
  return weekdayFormatter.format(d).replace('.', '');
}

function formatDayNum(dateStr: string): number | string {
  const d = parseDate(dateStr);
  if (!d) return '';
  return d.getDate();
}

function getDayTitle(dateStr: string): string {
  if (props.formatDate) {
    return props.formatDate(dateStr);
  }
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function onSelectDayFromMenu(day: string) {
  emit('select-day', day);
  dayMenuOpen.value = false;
}

function onClearDayFilter() {
  if (props.activeDate) {
    emit('select-day', props.activeDate);
  }
  dayMenuOpen.value = false;
}
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

  <!-- Tages-Filter auf schmalen Layouts (#684) -->
  <IconButton
    v-if="showDayFilterButton && vacationDays && vacationDays.length"
    ref="dayButtonRef"
    variant="floating"
    shape="circle"
    class="fit-btn day-filter-btn"
    :active="!!activeDate"
    :title="
      activeDate && formatDate
        ? `Gefiltert nach ${formatDate(activeDate)}`
        : 'Nach Urlaubstag filtern'
    "
    :aria-label="
      activeDate && formatDate
        ? `Gefiltert nach ${formatDate(activeDate)}`
        : 'Nach Urlaubstag filtern'
    "
    :icon="FORM_FIELD_ICONS.date"
    @click="toggleDayMenu($event)"
  />

  <Teleport to="body">
    <template v-if="focusMenuOpen">
      <PickerMenu
        wide
        class="focus-picker-menu"
        :style="focusMenuStyle"
        @close="focusMenuOpen = false"
      >
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
          :disabled="!homePointsCount"
          :title="
            !homePointsCount ? 'Keine Heimatorte eingetragen' : 'Auf die Heimatorte fokussieren'
          "
          :icon="MAP_TOOL_ICONS.home"
          label="Nur Heimatorte"
          @click="selectFocus(() => emit('fit-home'))"
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

        <DropdownItem
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
        </DropdownItem>
        <DropdownItem
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
        </DropdownItem>

        <hr class="picker-divider" />

        <DropdownItem
          :active="mapOrientationMode === 'north'"
          :icon="MAP_TOOL_ICONS.orientationNorth"
          label="Norden oben"
          @click="selectFocus(() => emit('set-orientation-mode', 'north'))"
        />
        <DropdownItem
          :active="mapOrientationMode === 'heading'"
          :icon="MAP_TOOL_ICONS.orientationHeading"
          label="Fahrtrichtung oben"
          @click="selectFocus(() => emit('set-orientation-mode', 'heading'))"
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
    <template v-if="dayMenuOpen && vacationDays && vacationDays.length">
      <PickerMenu
        class="day-picker-menu"
        :style="dayMenuStyle"
        origin="top-right"
        @close="dayMenuOpen = false"
      >
        <div class="day-picker-header">
          <span class="day-picker-title">Urlaubstag wählen</span>
          <button
            type="button"
            class="day-picker-clear-btn"
            :class="{ 'is-active': !activeDate }"
            :title="activeDate ? 'Filter zurücksetzen' : 'Alle Tage aktiv'"
            @click="onClearDayFilter"
          >
            Alle Tage
          </button>
        </div>
        <div class="day-picker-grid" role="group" aria-label="Urlaubstage">
          <button
            v-for="day in vacationDays"
            :key="day"
            type="button"
            class="day-grid-chip"
            :class="{
              'is-active': activeDate === day,
              'has-content': dayHasContent ? dayHasContent(day) : false,
            }"
            :data-date="day"
            :title="getDayTitle(day)"
            :aria-label="getDayTitle(day)"
            :aria-pressed="activeDate === day"
            @click="onSelectDayFromMenu(day)"
          >
            <span class="day-grid-weekday">{{ formatWeekday(day) }}</span>
            <span class="day-grid-num">{{ formatDayNum(day) }}</span>
            <span
              v-if="dayHasContent && dayHasContent(day)"
              class="day-grid-dot"
              aria-hidden="true"
            />
          </button>
        </div>
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
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-sm);
  color: var(--color-text);
  font-size: var(--font-size-md);
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.fit-btn:hover:not(:disabled) {
  background: var(--color-hover);
  box-shadow: var(--shadow-md);
}

.fit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.share-location-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + var(--fit-btn-step));
}

.record-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + 2 * var(--fit-btn-step));
}

.day-filter-btn {
  top: calc(var(--fit-btn-top-inset, var(--fit-btn-inset)) + 3 * var(--fit-btn-step));
}

.share-location-btn.active,
.record-btn.active,
.day-filter-btn.active,
.share-location-btn.is-active,
.record-btn.is-active,
.day-filter-btn.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary-dark);
  color: var(--color-primary-contrast, #ffffff);
}

.share-location-btn.active:hover:not(:disabled),
.record-btn.active:hover:not(:disabled),
.day-filter-btn.active:hover:not(:disabled),
.share-location-btn.is-active:hover:not(:disabled),
.record-btn.is-active:hover:not(:disabled),
.day-filter-btn.is-active:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

:global(.focus-picker-menu) {
  max-height: calc(100dvh - 80px);
  overflow-y: auto;
}

:global(.day-picker-menu) {
  width: fit-content;
  max-width: min(340px, calc(100vw - 24px));
  padding: var(--space-2);
  box-sizing: border-box;
}

.day-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 2px 4px var(--space-2);
  margin-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}

.day-picker-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.day-picker-clear-btn {
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 3px 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.day-picker-clear-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
  color: var(--color-primary);
}

.day-picker-clear-btn.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary-dark);
  color: var(--color-primary-contrast, #ffffff);
}

.day-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
  padding: 2px;
}

.day-grid-chip {
  position: relative;
  flex: 0 0 42px;
  width: 42px;
  height: 44px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-hover);
  color: var(--color-text);
  cursor: pointer;
  outline: none;
  user-select: none;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.day-grid-chip:hover {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}

.day-grid-chip:active {
  transform: scale(0.96);
}

.day-grid-chip:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--color-focus-ring);
  outline-offset: 1px;
}

.day-grid-chip.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary-dark);
  color: var(--color-primary-contrast, #ffffff);
}

.day-grid-weekday {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
  color: var(--color-text-muted);
}

.day-grid-chip.is-active .day-grid-weekday {
  color: rgba(255, 255, 255, 0.85);
}

.day-grid-num {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.1;
  margin-top: 1px;
  color: var(--color-text);
}

.day-grid-chip.is-active .day-grid-num {
  color: var(--color-primary-contrast, #ffffff);
}

.day-grid-dot {
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 4px;
  height: 4px;
  border-radius: var(--radius-pill);
  corner-shape: round;
  background: var(--color-primary);
}

.day-grid-chip.is-active .day-grid-dot {
  background: var(--color-primary-contrast, #ffffff);
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

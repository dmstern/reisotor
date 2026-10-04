<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import type { Excursion, ScheduleItem, User } from '../api/types';
import AttachmentPreviewModal, { type AttachmentPreviewItem } from './AttachmentPreviewModal.vue';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useTracksStore } from '../stores/tracks';
import { useAuthStore } from '../stores/auth';
import { useLiveSyncStore } from '../stores/liveSync';
import { spotCategoryMeta } from '../utils/spotCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { MAP_TOOL_ICONS } from '../utils/mapToolIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { useIsDesktop } from '../composables/useIsDesktop';
import { useMapOfflineDownload } from '../composables/useMapOfflineDownload';
import { useMapTrackRecording } from '../composables/useMapTrackRecording';
import { useMapToolMenus } from '../composables/useMapToolMenus';
import { useMapPhotos } from '../composables/useMapPhotos';
import { useMapPoints, type MapPoint } from '../composables/useMapPoints';
import { useMapLiveLocation } from '../composables/useMapLiveLocation';
import { useLeafletTripMap } from '../composables/useLeafletTripMap';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import TravelDetailDialog from './TravelDetailDialog.vue';
import DayStrip from './DayStrip.vue';
import TrackPlayback from './TrackPlayback.vue';
import AppIcon from './AppIcon.vue';
import TrackRecordingWarningModal from './TrackRecordingWarningModal.vue';

const props = defineProps<{
  categoryFilter?: string[];
  statusFilter?: ('planned' | 'unplanned' | 'done')[];
  tourRoleFilter?: string[];
  coveredBottomPx?: number;
  coveredLeftPx?: number;
  sheetOverlayMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'focus-spot', spotId: number): void;
  (e: 'focus-excursion', excursionId: number): void;
  (e: 'edit-excursion', excursion: Excursion): void;
}>();

const router = useRouter();
const isDesktop = useIsDesktop();
const drawers = useDrawersStore();
const tripStore = useTripStore();
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
const tracksStore = useTracksStore();
const auth = useAuthStore();
const liveSync = useLiveSyncStore();

const formatDate = formatDateShared;

const calendarOffset = computed(() => {
  return isDesktop.value && drawers.calendarOpen ? drawers.calendarWidth : 0;
});

const calendarMargin = computed(() => {
  return isDesktop.value && drawers.calendarOpen
    ? 'calc(var(--space-4) * 2)'
    : 'var(--drawer-tab-width)';
});

const isNarrowLayout = computed(() => props.sheetOverlayMode ?? !isDesktop.value);

const teleportReady = ref(false);
function updateTeleportReady() {
  teleportReady.value =
    typeof document !== 'undefined' && !!document.getElementById('map-focus-dock');
}

const canTeleportToDock = computed(() => isNarrowLayout.value && teleportReady.value);

const travelItems = computed(() => deriveTravelItems(excursionsStore.excursions, spotsStore.spots));
const scheduleItems = ref<ScheduleItem[]>([]);
const users = ref<User[]>([]);

const mapEl = ref<HTMLDivElement | null>(null);
const isFocusBannerExpanded = ref(false);
const trackPlaybackProgress = ref(0);

// Travel dialog state
const openTravelId = ref<number | null>(null);
const travelDialogOpen = ref(false);
const openTravel = computed(
  () => travelItems.value.find((t) => t.id === openTravelId.value) ?? null
);

function onTravelDialogUpdate(v: boolean) {
  travelDialogOpen.value = v;
  if (!v) drawers.mapFocusKey = null;
}

function editOpenTravel() {
  const id = openTravelId.value;
  travelDialogOpen.value = false;
  router.push(`/excursions#excursion-${id}`);
}

function payerLabelFor(userId: number | null) {
  if (userId == null) return null;
  const u = users.value.find((u) => u.id === userId);
  return u ? `${u.avatar} ${u.username}` : null;
}

function trackAuthorUser(userId: number | undefined) {
  if (userId == null) return null;
  return users.value.find((u) => u.id === userId) ?? (auth.user?.id === userId ? auth.user : null);
}

// 1. Photos composable
const photos = useMapPhotos({
  onPhotosUpdated: () => leafletTripMap.renderMarkers(),
});
const {
  excursionPhotoPoints,
  allTripPhotoPoints,
  allTripPhotosLoaded,
  photoPreviewOpen,
  photoPreviewIndex,
  photoPreviewAttachments,
  openPhotoPreview,
  loadAllTripPhotos,
  loadExcursionPhotoPoints,
} = photos;

// 2. Map Points & filtering composable
const mapPoints = useMapPoints({
  travelItems,
  scheduleItems,
  excursionPhotoPoints,
  allTripPhotoPoints,
  categoryFilter: toRef(props, 'categoryFilter'),
  statusFilter: toRef(props, 'statusFilter'),
  tourRoleFilter: toRef(props, 'tourRoleFilter'),
});
const {
  focusedExcursion,
  focusedSpot,
  focusedTrack,
  focusedTrackPoints,
  focusedDateStations,
  points,
  filteredPoints,
  vacationPoints,
  visiblePoints,
  vacationDays,
  dayHasContent,
  toggleDayFocus,
  totalAccommodationsCount,
  accommodationPoints,
  excursionPoints,
} = mapPoints;

// 3. Offline Download composable
const offlineDownload = useMapOfflineDownload();
const { tileDownloadState, tileDownloadProgress, tileDownloadResult, dismissTileDownloadResult } =
  offlineDownload;

function downloadOfflineMap() {
  offlineDownload.downloadOfflineMap(() => leafletTripMap.getBounds());
}

// 4. Track Recording composable
const mapTrackRecording = useMapTrackRecording();
const {
  trackRecording,
  showTrackRecordingWarningModal,
  isMapRecordingActive,
  toggleRecord,
  startRecordingConfirmed,
} = mapTrackRecording;

// 5. Tool Menus composable
const toolMenus = useMapToolMenus({
  onFocusMenuOpen: () => loadAllTripPhotos(),
});
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
} = toolMenus;

// 6. Live Location composable
const liveLocation = useMapLiveLocation({
  users,
  onPositionUpdate: () => leafletTripMap.renderPositions(),
  setMapBearing: (bearing) => leafletTripMap.setBearing(bearing),
  centerOnPoint: (latlng, zoom) => leafletTripMap.centerOnPoint(latlng, zoom),
  onClearFocus: () => clearFocus(),
});
const {
  ownPosition,
  mapOrientation,
  otherMembers,
  setMapOrientationMode,
  isMemberOnline,
  hasMemberPosition,
  jumpToMemberLocation,
  jumpToMyLocation,
} = liveLocation;

// 7. Leaflet Map composable
const leafletTripMap = useLeafletTripMap({
  coveredBottomPx: toRef(props, 'coveredBottomPx'),
  coveredLeftPx: toRef(props, 'coveredLeftPx'),
  tourRoleFilter: toRef(props, 'tourRoleFilter'),
  travelItems,
  points,
  filteredPoints,
  vacationPoints,
  visiblePoints,
  accommodationPoints,
  excursionPoints,
  focusedExcursion,
  focusedTrack,
  focusedTrackPoints,
  focusedDateStations,
  excursionPhotoPoints,
  allTripPhotoPoints,
  ownPosition,
  ownHeading: liveLocation.ownHeading,
  currentBearing: liveLocation.currentBearing,
  users,
  trackPlaybackProgress,
  onPointClick: handlePointClick,
});

const { fitAll, fitVacation, fitAccommodations, fitExcursions, focusCategory } = leafletTripMap;

defineExpose({ focusCategory });

function handlePointClick(point: MapPoint) {
  if (point.origin === 'location') {
    drawers.mapFocusKey = point.key;
    if (point.gallery) {
      openPhotoPreview(
        point.gallery.attachments as AttachmentPreviewItem[],
        point.gallery.initialIndex
      );
    } else {
      openPhotoPreview();
    }
    return;
  }
  drawers.mapFocusLocation = null;
  if (point.origin === 'spot') {
    const spotId = Number(point.key.slice('spot-'.length));
    drawers.mapFocusKey = point.key;
    emit('focus-spot', spotId);
  } else {
    const isFrom = point.key.startsWith('travel-from-');
    openTravelId.value = Number(point.key.slice((isFrom ? 'travel-from-' : 'travel-to-').length));
    travelDialogOpen.value = true;
    drawers.mapFocusKey = point.key;
  }
}

async function focusAllPhotos() {
  drawers.openMapForAllPhotos();
  if (!allTripPhotosLoaded.value) {
    await loadAllTripPhotos();
  }
  leafletTripMap.fitAllPhotos();
}

function clearFocus() {
  if (focusedTrack.value) {
    drawers.mapFocusTrackId = null;
  } else if (focusedExcursion.value) {
    drawers.mapFocusExcursionId = null;
  } else if (drawers.mapFocusDate) {
    drawers.mapFocusDate = null;
  } else if (drawers.mapFocusLocation) {
    drawers.mapFocusLocation = null;
    drawers.mapFocusKey = null;
  } else if (drawers.mapFocusKey) {
    drawers.mapFocusKey = null;
  }
  if (drawers.mapFocusAllPhotos) {
    drawers.mapFocusAllPhotos = false;
  }
  isFocusBannerExpanded.value = false;
}

function clearTrackFocus() {
  drawers.mapFocusTrackId = null;
  trackPlaybackProgress.value = 0;
  leafletTripMap.clearTrackLayers();
}

async function loadAll() {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  const [items] = await Promise.all([
    api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
    loadAllTripPhotos(),
  ]);
  scheduleItems.value = items;
}

onMounted(async () => {
  updateTeleportReady();
  if (!teleportReady.value) {
    nextTick(updateTeleportReady);
  }

  const [, , usersRes] = await Promise.all([
    loadAll(),
    spotsStore.load(),
    api.get<User[]>(`/trips/${tripStore.currentTripId}/members`),
  ]);
  users.value = usersRes;
  photos.setupPhotoListeners();

  if (mapEl.value) {
    leafletTripMap.initMap(mapEl.value);
  }

  liveLocation.startLocationWatch();
  liveLocation.initCompassAuto();
});

onUnmounted(() => {
  photos.cleanupPhotoListeners();
  liveLocation.stopLocationWatch();
  leafletTripMap.destroyMap();
});

watch(isNarrowLayout, () => {
  if (isNarrowLayout.value && !teleportReady.value) {
    updateTeleportReady();
  }
});

watch(
  () => tripStore.currentTripId,
  async () => {
    await loadAll();
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
  }
);

watch(
  () => drawers.mapFocusKey,
  () => leafletTripMap.renderMarkers()
);

watch(
  () => drawers.mapFocusExcursionId,
  () => {
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
  }
);

watch(
  () => drawers.mapFocusDate,
  () => {
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
  }
);

watch(
  () => drawers.mapFocusLocation,
  () => {
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
  },
  { deep: true }
);

watch(
  () => drawers.mapFocusAllPhotos,
  () => {
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
  }
);

watch(allTripPhotoPoints, () => {
  leafletTripMap.renderMarkers();
});

watch(excursionPhotoPoints, () => {
  leafletTripMap.renderMarkers();
});

watch(
  () => drawers.focusVersion,
  () => {
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
    if (focusedTrackPoints.value.length >= 2) {
      leafletTripMap.renderTracks();
    }
    if (drawers.mapFocusAllPhotos) {
      leafletTripMap.fitAllPhotos();
    }
  }
);

watch(
  () => [props.categoryFilter, props.statusFilter, props.tourRoleFilter],
  () => {
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
  },
  { deep: true }
);

watch(
  () => [props.coveredBottomPx, props.coveredLeftPx],
  () => {
    leafletTripMap.renderMarkers();
    if (focusedTrackPoints.value.length >= 2) {
      leafletTripMap.renderTracks();
    }
  }
);

watch(
  () => excursionsStore.excursions,
  () => {
    leafletTripMap.renderRoutes();
    if (drawers.mapFocusExcursionId != null) {
      loadExcursionPhotoPoints(drawers.mapFocusExcursionId);
    }
  },
  { deep: true }
);

watch(
  () => drawers.locationsVersion,
  async () => {
    await loadAll();
    leafletTripMap.renderMarkers();
    leafletTripMap.renderRoutes();
  }
);

watch(
  () => liveSync.memberPositions,
  () => leafletTripMap.renderPositions(),
  { deep: true }
);

watch(
  focusedTrack,
  async (track) => {
    trackPlaybackProgress.value = 0;
    leafletTripMap.renderTracks();
    if (track && !tracksStore.getPointsForTrack(track.id).length) {
      try {
        const pts = await tracksStore.loadPoints(track.id);
        leafletTripMap.renderTracks();
        if (!pts.length) {
          setTimeout(async () => {
            if (focusedTrack.value?.id === track.id) {
              await tracksStore.loadPoints(track.id).catch(() => []);
              leafletTripMap.renderTracks();
            }
          }, 600);
        }
      } catch {}
    }
  },
  { immediate: true }
);

watch(
  () => focusedTrackPoints.value.length,
  () => leafletTripMap.renderTracks()
);

watch(trackPlaybackProgress, () => leafletTripMap.updateTrackPlaybackMarker());
</script>

<template>
  <div
    class="karte"
    :class="{ 'sheet-overlay-mode': isNarrowLayout }"
    :style="{
      '--calendar-offset': `${calendarOffset}px`,
      '--calendar-margin': calendarMargin,
      ...(props.coveredLeftPx ? { '--spots-col-right-px': `${props.coveredLeftPx}px` } : {}),
    }"
  >
    <div class="map-wrap">
      <div ref="mapEl" class="map"></div>
      <!-- Fasst "Alle anzeigen"/"Nur Urlaubsort"/"Nur Unterkünfte"/"Nur Tourziele" hinter einem
           Popover zusammen statt vier eigenen Buttons (Nutzer-Feedback: die Button-Spalte war zu
           lang/unübersichtlich geworden, einzelne Buttons rutschten hinter das Bottom-Sheet). -->
      <IconButton
        ref="focusButtonRef"
        variant="floating"
        shape="circle"
        class="fit-btn focus-btn"
        title="Kartenausschnitt fokussieren"
        aria-label="Kartenausschnitt fokussieren"
        :disabled="!filteredPoints.length"
        :icon="MAP_TOOL_ICONS.focusGroup"
        @click="toggleFocusMenu($event)"
      />
      <!-- Fasst "Zu meinem Standort springen" und den Ausrichtungs-Umschalter (Norden/Fahrtrichtung
           oben) hinter einem zweiten Popover zusammen - beide drehen sich um "wo bin ich/wohin
           schaue ich", anders als die reine Datenfokus-Gruppe oben. -->
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
        @click="downloadOfflineMap"
      />
      <!-- Standort-Freigabe (stores/locationSharing.ts): läuft unabhängig davon, ob diese
           Kartenansicht offen ist - Klick öffnet nur die Dauer-Auswahl. -->
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
      <!-- Standort-Aufzeichnung (stores/trackRecording.ts): läuft ebenfalls unabhängig von dieser
           Kartenansicht weiter - Klick öffnet bei Nicht-Aufzeichnung nur die Start-Auswahl, beendet
           bei laufender Aufzeichnung direkt (kein Menü nötig). -->
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
              :disabled="!filteredPoints.length"
              :title="
                !filteredPoints.length
                  ? 'Keine eingetragenen Orte vorhanden'
                  : 'Alle eingetragenen Orte auf der Karte anzeigen'
              "
              :icon="MAP_TOOL_ICONS.fitAll"
              label="Alle eingetragenen Orte anzeigen"
              @click="selectFocus(fitAll)"
            />
            <DropdownItem
              :disabled="!vacationPoints.length"
              :title="
                !vacationPoints.length
                  ? 'Kein Urlaubsort eingetragen'
                  : 'Auf den Urlaubsort fokussieren'
              "
              :icon="MAP_TOOL_ICONS.vacation"
              label="Nur Urlaubsort"
              @click="selectFocus(fitVacation)"
            />
            <DropdownItem
              :disabled="!accommodationPoints.length"
              :title="
                !accommodationPoints.length
                  ? totalAccommodationsCount > 0
                    ? 'Unterkünfte haben keinen Standort auf der Karte (Standort im Spot per Maps-Link oder Pin festlegen)'
                    : 'Keine Unterkünfte für diesen Urlaub eingetragen'
                  : accommodationPoints.length === 1
                    ? 'Auf die Unterkunft fokussieren'
                    : 'Auf die Unterkünfte fokussieren'
              "
              :icon="MAP_TOOL_ICONS.accommodation"
              label="Nur Unterkünfte"
              @click="selectFocus(fitAccommodations)"
            />
            <DropdownItem
              v-if="excursionsStore.excursions.length"
              :disabled="!excursionPoints.length"
              :title="
                !excursionPoints.length
                  ? 'Keine Tourziele mit Koordinaten vorhanden'
                  : 'Auf Tourziele fokussieren'
              "
              :icon="MAP_TOOL_ICONS.excursions"
              label="Nur Tourziele"
              @click="selectFocus(fitExcursions)"
            />
            <DropdownItem
              :disabled="allTripPhotosLoaded && !allTripPhotoPoints.length"
              :title="
                !allTripPhotosLoaded
                  ? 'Fotos werden geladen...'
                  : !allTripPhotoPoints.length
                    ? 'Keine Fotos mit Standortinformationen im Urlaub hinterlegt'
                    : allTripPhotoPoints.length === 1
                      ? '1 Foto mit Standort auf der Karte anzeigen'
                      : `${allTripPhotoPoints.length} Fotos mit Standort auf der Karte anzeigen`
              "
              :icon="MAP_TOOL_ICONS.photos"
              label="Alle Fotos mit Standort"
              @click="selectFocus(focusAllPhotos)"
            />
          </PickerMenu>
        </template>
        <template v-if="locationMenuOpen">
          <PickerMenu wide :style="locationMenuStyle" @close="locationMenuOpen = false">
            <DropdownItem :disabled="!ownPosition" @click="selectLocation(jumpToMyLocation)">
              <span class="picker-item-emoji" aria-hidden="true">{{
                auth.user?.avatar || '📍'
              }}</span>
              Zu meinem Standort springen
            </DropdownItem>
            <DropdownItem
              v-for="member in otherMembers"
              :key="member.id"
              :disabled="!hasMemberPosition(member.id)"
              :title="`${member.username} teilt gerade ${hasMemberPosition(member.id) ? '' : 'keinen '}Standort`"
              @click="selectLocation(() => jumpToMemberLocation(member.id))"
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
              :active="mapOrientation.mode === 'north'"
              :icon="MAP_TOOL_ICONS.orientationNorth"
              label="Norden oben"
              @click="selectLocation(() => setMapOrientationMode('north'))"
            />
            <DropdownItem
              :active="mapOrientation.mode === 'heading'"
              :icon="MAP_TOOL_ICONS.orientationHeading"
              label="Fahrtrichtung oben"
              @click="selectLocation(() => setMapOrientationMode('heading'))"
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
      <div class="tile-download-pill" v-if="trackRecording.startError">
        <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
        {{ trackRecording.startError }}
        <IconButton
          variant="ghost"
          size="sm"
          :icon="ACTION_ICONS.close"
          aria-label="Meldung schließen"
          title="Schließen"
          @click="trackRecording.startError = null"
        />
      </div>
      <div class="tile-download-pill" v-if="tileDownloadState === 'downloading'">
        <AppIcon :icon="ACTION_ICONS.refresh" :size="14" group="actions" /> Lädt Kartenkacheln…
        {{ tileDownloadProgress.done }}/{{ tileDownloadProgress.total }}
      </div>
      <div
        class="tile-download-pill"
        v-else-if="tileDownloadState === 'done' && tileDownloadResult"
      >
        <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
        {{ tileDownloadResult.downloaded }} Kacheln offline gespeichert{{
          tileDownloadResult.failed ? `, ${tileDownloadResult.failed} fehlgeschlagen` : ''
        }}
        <IconButton
          variant="ghost"
          size="sm"
          :icon="ACTION_ICONS.close"
          aria-label="Meldung schließen"
          title="Schließen"
          @click="dismissTileDownloadResult"
        />
      </div>
      <div
        class="focus-banner"
        :class="{ 'is-expanded': isFocusBannerExpanded }"
        v-if="
          focusedExcursion ||
          drawers.mapFocusDate ||
          focusedSpot ||
          drawers.mapFocusLocation ||
          drawers.mapFocusAllPhotos
        "
      >
        <button
          class="focus-banner-toggle-btn"
          :class="{ 'is-clickable': !!drawers.mapFocusLocation || drawers.mapFocusAllPhotos }"
          :aria-expanded="isFocusBannerExpanded"
          :aria-label="
            drawers.mapFocusLocation || drawers.mapFocusAllPhotos
              ? 'Foto in Galerie öffnen'
              : isFocusBannerExpanded
                ? 'Fokus-Banner einklappen'
                : 'Fokus-Banner ausklappen'
          "
          @click="
            drawers.mapFocusLocation || drawers.mapFocusAllPhotos
              ? openPhotoPreview()
              : (isFocusBannerExpanded = !isFocusBannerExpanded)
          "
        >
          <img
            v-if="
              !focusedExcursion &&
              !focusedSpot &&
              !drawers.mapFocusAllPhotos &&
              drawers.mapFocusLocation?.imageUrl
            "
            :src="drawers.mapFocusLocation.imageUrl"
            alt=""
            class="focus-banner-thumb"
          />
          <AppIcon
            v-else
            :icon="
              focusedExcursion
                ? SECTION_ICON_DEFS.excursions
                : focusedSpot
                  ? spotCategoryMeta(focusedSpot.category).tabler
                  : drawers.mapFocusAllPhotos
                    ? MAP_TOOL_ICONS.photos
                    : drawers.mapFocusLocation
                      ? FORM_FIELD_ICONS.image
                      : FORM_FIELD_ICONS.period
            "
            :size="18"
            :group="focusedExcursion ? 'navigation' : focusedSpot ? 'categories' : 'formFields'"
          />
        </button>
        <div class="focus-banner-content">
          <button
            v-if="drawers.mapFocusLocation"
            type="button"
            class="focus-title-btn"
            title="Foto in Galerie öffnen"
            @click="openPhotoPreview()"
          >
            {{ drawers.mapFocusLocation.title || 'Foto-Standort' }}
          </button>
          <button
            v-else-if="drawers.mapFocusAllPhotos"
            type="button"
            class="focus-title-btn"
            title="Fotos in Galerie öffnen"
            @click="openPhotoPreview()"
          >
            {{
              allTripPhotoPoints.length === 1
                ? '1 Foto mit Standort'
                : `Alle Fotos mit Standort (${allTripPhotoPoints.length})`
            }}
          </button>
          <span v-else>{{
            focusedExcursion
              ? focusedExcursion.title
              : focusedSpot
                ? focusedSpot.title
                : formatDate(drawers.mapFocusDate!)
          }}</span>
          <Button variant="card-action" @click="clearFocus">
            <AppIcon :icon="ACTION_ICONS.close" :size="14" group="actions" /> Fokus verlassen
          </Button>
        </div>
      </div>
    </div>

    <!-- Mobil/schmales Layout (Teleport aktiv, siehe isNarrowLayout) landet diese Stationen-Liste UND
         (weiter unten) den Tage-Streifen in der Spots-Schublade (ExcursionsView.vue's
         #map-focus-dock) statt als Overlay über der Karte zu schweben. Für die Stationen-Liste war
         das schon immer so (deckte sonst einen Teil des Kartenausschnitts/der Zoom-Steuerung ab); der
         Tage-Streifen kam erst nachträglich dazu, nachdem er als schwebendes Overlay am unteren
         Kartenrand auf Mobil praktisch permanent von der (dort ebenfalls unten verankerten, meist
         mindestens "partial" hohen) Spots-Schublade verdeckt und damit faktisch unbedienbar war -
         genau dieselbe Falle wie bei der Stationen-Liste vorher, jetzt mit demselben Muster gelöst.
         Auf echtem Desktop bleibt beides unverändert Teil dieser Karten-Spalte (ohne Teleport).
         Wichtig: Kein dynamisches :disabled auf <Teleport> verwenden, da Vue 3 bei initial deaktiviertem
         Teleport das Ziel nicht sauber auflöst und beim Umschalten auf Mobil mit "parent is null" abstürzt.
         Stattdessen echtes v-if / v-else-if. -->
    <Teleport v-if="canTeleportToDock && vacationDays.length && !focusedTrack" to="#map-focus-dock">
      <DayStrip
        :days="vacationDays"
        :active-date="drawers.mapFocusDate"
        :has-content="dayHasContent"
        :date-title="formatDate"
        @select="toggleDayFocus"
      />
    </Teleport>
    <DayStrip
      v-else-if="vacationDays.length && !focusedTrack"
      :days="vacationDays"
      :active-date="drawers.mapFocusDate"
      :has-content="dayHasContent"
      :date-title="formatDate"
      @select="toggleDayFocus"
    />

    <!-- Playback-Steuerung für fokussierte Aufzeichnung:
         Mobil im Bottom-Sheet-Dock (#map-focus-dock in ExcursionsView.vue),
         auf Desktop schwebend über der Karte unten -->
    <Teleport
      v-if="canTeleportToDock && focusedTrack && focusedTrackPoints.length >= 2"
      to="#map-focus-dock"
    >
      <div class="map-track-playback-container">
        <TrackPlayback
          :track="focusedTrack"
          :title="focusedTrack?.title"
          :author-avatar="
            focusedTrack?.author_avatar || trackAuthorUser(focusedTrack?.user_id)?.avatar
          "
          :author-name="
            focusedTrack?.author_username || trackAuthorUser(focusedTrack?.user_id)?.username
          "
          :points="focusedTrackPoints"
          v-model:progress="trackPlaybackProgress"
          @close="clearTrackFocus"
        />
      </div>
    </Teleport>
    <div
      v-else-if="focusedTrack && focusedTrackPoints.length >= 2"
      class="map-track-playback-container"
    >
      <TrackPlayback
        :track="focusedTrack"
        :title="focusedTrack?.title"
        :author-avatar="
          focusedTrack?.author_avatar || trackAuthorUser(focusedTrack?.user_id)?.avatar
        "
        :author-name="
          focusedTrack?.author_username || trackAuthorUser(focusedTrack?.user_id)?.username
        "
        :points="focusedTrackPoints"
        v-model:progress="trackPlaybackProgress"
        @close="clearTrackFocus"
      />
    </div>

    <TravelDetailDialog
      v-if="openTravel"
      :model-value="travelDialogOpen"
      @update:model-value="onTravelDialogUpdate"
      :item="openTravel"
      :payer-label="payerLabelFor(openTravel.paid_by_user_id)"
      :has-multiple-members="users.length > 1"
      @edit="editOpenTravel"
      @show-on-map-from="travelDialogOpen = false"
      @show-on-map-to="travelDialogOpen = false"
    />

    <AttachmentPreviewModal
      v-model="photoPreviewOpen"
      :attachments="photoPreviewAttachments"
      :initial-index="photoPreviewIndex"
      :editable="false"
    />

    <p v-if="!points.length" class="empty">
      Noch keine Orte mit Koordinaten hinterlegt. Füge bei Unterkunft, Reise-Einträgen oder Spots
      einen Maps-Link (Google/Apple) hinzu, damit sie hier erscheinen.
    </p>
  </div>
</template>

<style scoped>
/* Mobil (Default): die Karte füllt ihren Container (.map-col in ExcursionsView.vue, dort auf Mobil
   position:fixed über den ganzen Bildschirm) randlos vollflächig aus, ähnlich Google Maps –
   .karte selbst erzeugt dafür keine eigene Box mehr (display:contents), .map-wrap/.map übernehmen
   direkt die volle Fläche ihres jetzt fixed-positionierten Großelternteils. Auf Desktop
   (@container weiter unten) wird das komplett auf den bisherigen Stand zurückgesetzt. */
.karte {
  display: contents;
}

.map-wrap {
  /* Eckenabstand/Lücke über --space-3/--space-2, auf Mobil wie auf Desktop einheitlich.
     Touch-Targets halten stets mindestens 44px x 44px gemäß DESIGN.md §7.1 und WCAG 2.5.5 ein.
     Der Stapel umfasst 5 Buttons hinter Popover-Triggern (.focus-btn/.location-btn). */
  --fit-btn-size: 44px;
  --fit-btn-gap: var(--space-2);
  --fit-btn-inset: var(--space-3);
  /* Berücksichtigt den schwebenden AppHeader auf Mobil (Karte ragt jetzt darunter) */
  --fit-btn-top-inset: calc(var(--app-header-height, 56px) + var(--space-3));
  --fit-btn-step: calc(var(--fit-btn-size) + var(--fit-btn-gap));
  position: absolute;
  inset: 0;
}

.map {
  height: 100%;
  border-radius: 0;
  overflow: hidden;
  border: none;
}

/* Echter Kreisbogen (50% + corner-shape:round) statt der Squircle-Variable, die hier vorher ohne
   passendes corner-shape blieb - siehe DESIGN.md, Abschnitt "Eckenrundung", runde Icon-Buttons
   bekommen Kreisbogen, keinen Squircle. Größe/Abstand kommen aus den --fit-btn-*-Variablen
   (.map-wrap oben) statt fester px-Werte direkt hier, damit Mobil/Desktop (@container weiter
   unten) nur noch die Variablen überschreiben müssen statt jede top-Regel einzeln. */
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

/* Gleiche Akzentfarbe, solange die jeweilige Funktion aktiv ist/läuft - dieselbe wie z. B.
   TripSwitcher.vue's aktiver Zustand, statt einer neuen Farbsprache. */
.share-location-btn.active,
.record-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

/* Größe an AppIcon.vue's Default (20px) angeglichen, damit das Avatar-Emoji im Standort-Menü
   (bewusst kein AppIcon, siehe dortiger Template-Kommentar) genauso mit dem Folgetext fluchtet wie
   die AppIcon-Icons in den übrigen Menüpunkten. */
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

/* Mitreisende ohne Online-Präsenz (#182): ausgegraut, analog zu PresenceAvatars.vue's
   .presence-avatar.offline im Header - Klickbarkeit selbst hängt aber an hasMemberPosition()
   (:disabled), nicht am Online-Status allein (Standort-Freigabe ist ein eigener Opt-in). */
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

.picker-menu-hint {
  margin: 0 0 2px;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: normal;
}

/* Eigene Zeile unterhalb der Fokus-Banner-Position (links, wie .focus-banner) statt direkt neben
   dem auslösenden Button rechts - eine mehrzeilige Fortschritts-/Ergebnismeldung neben einer engen
   Button-Spalte hätte dort keinen Platz. */
.tile-download-pill {
  position: absolute;
  /* Unterhalb des Focus-Banners platziert (welcher jetzt dynamisch unter dem Header sitzt) */
  top: calc(var(--fit-btn-top-inset, var(--space-3)) + 52px);
  left: var(--space-3);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  max-width: calc(100% - 60px);
}

.focus-banner {
  position: absolute;
  /* Berücksichtigt den schwebenden AppHeader auf Mobil (Karte ragt darunter) */
  top: var(--fit-btn-top-inset, var(--space-3));
  left: var(--space-3);
  bottom: unset;
  right: unset;
  z-index: 1000;
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  color: var(--color-primary-dark);
  font-size: 0.85rem;
  font-weight: 600;
  overflow: hidden;

  /* Initial-Zustand Mobil: Runder Icon-Button */
  border-radius: var(--radius-pill, 999px);
  corner-shape: round;
  padding: 2px; /* Gleichmäßiges Padding für den Kreis */
  width: auto;
  max-width: 44px; /* Limitiert die Breite auf den Button */
  height: 44px;
  /* Schatten wie bei Floating Buttons (.btn--floating) */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.focus-banner.is-expanded {
  max-width: calc(100% - 60px);
  /* Behalte die runde Pillenform bei, damit der linke Button perfekt reinpasst */
  border-radius: var(--radius-pill, 999px);
  corner-shape: round;
  padding: 2px 14px 2px 2px;
}

.focus-banner-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  color: var(--color-primary-dark);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.2s;
}

.focus-banner-toggle-btn:active {
  background: var(--color-hover);
}

.focus-banner-thumb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.focus-banner-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  /* Erst sichtbar, wenn expanded (oder Desktop) */
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s,
    visibility 0.2s;
  /* Staucht sich nicht zusammen, während Breite animiert */
  white-space: nowrap;
}

.focus-banner.is-expanded .focus-banner-content {
  opacity: 1;
  visibility: visible;
  transition-delay: 0.1s; /* Wartet kurz auf die Breiten-Animation */
}

@media screen and (min-width: 1024px) {
  .focus-banner {
    /* Wie auf Mobil oben positionieren, unterhalb des Headers */
    top: calc(var(--app-header-height, 56px) + var(--space-4));

    /* Dynamisch rechts neben den Drawer setzen, analog zum früheren leaflet-left */
    left: calc(
      var(
          --spots-col-right-px,
          calc(
            var(--calendar-margin, var(--drawer-tab-width)) + var(--calendar-offset, 0px) +
              var(--spots-col-width, 400px) + var(--space-4)
          )
        ) +
        var(--space-3)
    );

    bottom: unset;
    right: unset;
    /* Auf Desktop immer ausgeklappt */
    width: auto;
    max-width: calc(100% - 60px);
    border-radius: var(--radius-pill, 999px);
    corner-shape: round;
    padding: 2px 14px 2px 2px;
    height: 44px;
  }

  /* Sheet-Overlay Fallback auf Desktop (wenn Spots-Drawer ein Bottom-Sheet ist) */
  .karte.sheet-overlay-mode .focus-banner {
    left: calc(
      var(--calendar-margin, var(--drawer-tab-width)) + var(--calendar-offset, 0px) + var(--space-4)
    );
  }

  .focus-banner-content {
    opacity: 1;
    visibility: visible;
  }

  .focus-banner-toggle-btn {
    pointer-events: none; /* Kein Klick auf Desktop */
  }

  .focus-banner-toggle-btn.is-clickable {
    pointer-events: auto;
    cursor: pointer;
  }

  .tile-download-pill {
    bottom: var(--space-4);
    right: var(--space-4);
    top: unset;
    left: unset;
  }
}

.focus-banner span,
.focus-banner .focus-title-btn {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-banner .focus-title-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 500;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.focus-banner .focus-title-btn:hover {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* Mobil (Default): schwebt als horizontal scrollbare Leiste über dem unteren Kartenrand (analog zu
   .focus-spot-list oben, nur unten statt oben verankert). Auf Desktop (@media weiter unten)
   wieder normales Flow-Element unterhalb der Karte. */
.day-strip {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  z-index: 1000;
}

/* Innerhalb der teleportierten Spots-Schublade (siehe Teleport-Kommentar oben) ist der Streifen
   normales Fließ-Element am Anfang der Liste statt eines schwebenden Overlays - ID-Selektor statt nur
   .day-strip, damit diese Regel unabhängig von Deklarationsreihenfolge/@container zuverlässig
   gewinnt (gleiches Prinzip wie DESIGN.md, Abschnitt "Abstände"). */
#map-focus-dock .day-strip {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  z-index: auto;
  margin-bottom: var(--space-2);
}

.map-track-playback-container {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  z-index: 1000;
}

#map-focus-dock .map-track-playback-container {
  position: relative;
  left: auto;
  right: auto;
  bottom: auto;
  z-index: auto;
  margin-bottom: var(--space-3);
}

/* Die OpenStreetMap-Kacheln selbst kennen keinen Dark Mode – ein Farb-Invert nur auf der
   Kachel-Ebene (nicht auf Markern/Popups) sorgt für eine abgedunkelte Karte statt eines
   grellen weißen Rechtecks im ansonsten dunklen UI. */
:root[data-theme='dark'] .map :deep(.leaflet-tile-pane) {
  filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
}

/* Hintergrund der Karte anpassen, damit beim Nachladen der Kacheln
   keine weiße Fläche aufblitzt. var(--color-bg) passt sich automatisch
   dem aktuellen Theme (Light/Dark) an. */
.map,
:deep(.leaflet-container) {
  background: var(--color-bg);
}

/* Ein weicherer Fade-In für nachladende Kacheln, um das visuelle Erlebnis
   beim schnellen Scrollen/Zoomen weiter zu verbessern. */
:deep(.leaflet-fade-anim .leaflet-tile) {
  transition: opacity 0.3s ease-in-out;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .map :deep(.leaflet-tile-pane) {
    filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9);
  }
}

/* Anpassung der Leaflet Zoom-Buttons an den Reisotor Styleguide */
:deep(.leaflet-bar) {
  border: 1px solid var(--color-border) !important;
  box-shadow: var(--shadow-sm) !important;
  border-radius: var(--radius-md-squircle) !important;
  overflow: hidden;
  background-color: var(--color-surface) !important;
}

@media screen and (max-width: 1023px) {
  :deep(.leaflet-control-zoom) {
    display: none !important;
  }
}

:deep(.leaflet-bar a) {
  background-color: var(--color-surface) !important;
  color: var(--color-text) !important;
  border-bottom: 1px solid var(--color-border) !important;
  width: 44px !important;
  height: 44px !important;
  line-height: 44px !important;
}

:deep(.leaflet-bar a:hover) {
  background-color: var(--color-hover) !important;
  color: var(--color-text) !important;
}

:deep(.leaflet-bar a:last-child) {
  border-bottom: none !important;
}

:deep(.leaflet-bar a.leaflet-disabled) {
  color: var(--color-text-muted) !important;
  background-color: var(--color-surface) !important;
}

:deep(.leaflet-top) {
  /* Berücksichtigt den schwebenden AppHeader auf Mobil (Karte ragt jetzt darunter) */
  top: calc(var(--app-header-height, 56px) + var(--space-3)) !important;
}

/* Desktop: Die Karte ist auf Desktop stets vollflächig über die gesamte Bildschirmbreite.
   Die Kartenwerkzeuge (.fit-btn) und Zoom-Buttons nutzen auf Desktop größere Insets,
   um unter dem schwebenden Header zu liegen.
   Die Zoom-Buttons sitzen rechts neben den Drawers: im Side-by-Side-Modus rechts neben beiden Drawers,
   im Sheet-Overlay-Modus (wenn z. B. der Kalender auf Zwischengrößen ausgeklappt ist) direkt rechts
   neben der Kalender-Schublade. */
@media (min-width: 1024px) {
  .map-wrap {
    --fit-btn-size: 44px;
    --fit-btn-top-inset: calc(var(--app-header-height, 56px) + var(--space-4));
    --fit-btn-right-inset: var(--space-4);
  }

  .fit-btn {
    font-size: 1.2rem;
  }

  :deep(.leaflet-top) {
    top: calc(var(--app-header-height, 56px) + var(--space-4)) !important;
  }

  :deep(.leaflet-left .leaflet-control) {
    margin-left: 0 !important;
  }

  :deep(.leaflet-top .leaflet-control) {
    margin-top: 0 !important;
  }

  /* Auf Desktop schwebt der day-strip als zentrierte Pille im verfügbaren Kartenbereich (neben dem Drawer) */
  .day-strip {
    left: var(--spots-col-right-px, 400px);
    right: 0;
    margin: 0 auto;
    width: fit-content;
    max-width: min(400px, calc(100% - 140px));
    border-radius: 999px;
    corner-shape: round;
    bottom: calc(var(--navbar-bottom-offset, 0px) + 24px);
  }

  .map-track-playback-container {
    left: var(--spots-col-right-px, 400px);
    right: 0;
    margin: 0 auto;
    width: min(520px, calc(100% - var(--spots-col-right-px, 400px) - 48px));
    bottom: calc(var(--navbar-bottom-offset, 0px) + 24px);
  }
}
</style>

<!-- Bewusst NICHT scoped: pulsingEmojiPin() (utils/mapRoute.ts) fügt sein Markup per innerHTML in
     einen von Leaflet verwalteten DOM-Knoten außerhalb von Vues Template-Kompilierung ein – ein
     scoped Style-Block würde sein data-v-*-Attribut nie auf dieses Markup anwenden, die Regel griffe
     dadurch nie. -->
<style>
.map-pulse-ring {
  animation: map-pulse-ring 2s ease-out infinite;
}

@keyframes map-pulse-ring {
  0% {
    transform: scale(0.6);
    opacity: 0.55;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}

.leaflet-tooltip.map-marker-tooltip {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  padding: 4px 8px;
  pointer-events: none;
  white-space: nowrap;
}

.leaflet-tooltip.map-marker-tooltip::before {
  border-top-color: var(--color-surface);
}

:root[data-theme='dark'] .leaflet-tooltip.map-marker-tooltip {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border);
}

:root[data-theme='dark'] .leaflet-tooltip.map-marker-tooltip::before {
  border-top-color: var(--color-surface);
}

.photo-marker-pin {
  background: transparent;
  border: none;
}

.photo-map-pin {
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.photo-marker-pin:hover .photo-map-pin {
  transform: rotate(-45deg) scale(1.08);
}

.photo-pin-date-badge {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 3px;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(20, 20, 25, 0.88);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  pointer-events: none;
  z-index: 10;
}
</style>

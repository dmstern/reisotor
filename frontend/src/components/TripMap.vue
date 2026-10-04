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
import { formatDate } from '../utils/dateFormat';
import { useIsDesktop } from '../composables/useIsDesktop';
import { useMapOfflineDownload } from '../composables/useMapOfflineDownload';
import { useMapPhotos } from '../composables/useMapPhotos';
import { useMapPoints, type MapPoint } from '../composables/useMapPoints';
import { useMapLiveLocation } from '../composables/useMapLiveLocation';
import { useLeafletTripMap } from '../composables/useLeafletTripMap';
import EmptyState from './primitives/EmptyState.vue';
import TripMapTools from './TripMapTools.vue';
import TripMapFocusBanner from './TripMapFocusBanner.vue';
import TripMapStatusPills from './TripMapStatusPills.vue';
import TripMapDockTeleport from './TripMapDockTeleport.vue';
import TravelDetailDialog from './TravelDetailDialog.vue';
import DayStrip from './DayStrip.vue';
import TrackPlayback from './TrackPlayback.vue';

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

// 4. Live Location composable
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
      <TripMapTools
        :filtered-points-count="filteredPoints.length"
        :vacation-points-count="vacationPoints.length"
        :accommodation-points-count="accommodationPoints.length"
        :total-accommodations-count="totalAccommodationsCount"
        :has-excursions="excursionsStore.excursions.length > 0"
        :excursion-points-count="excursionPoints.length"
        :all-trip-photos-loaded="allTripPhotosLoaded"
        :all-trip-photo-points-count="allTripPhotoPoints.length"
        :has-own-position="!!ownPosition"
        :user-avatar="auth.user?.avatar"
        :other-members="otherMembers"
        :is-member-online="isMemberOnline"
        :has-member-position="hasMemberPosition"
        :map-orientation-mode="mapOrientation.mode"
        :tile-download-state="tileDownloadState"
        @fit-all="fitAll"
        @fit-vacation="fitVacation"
        @fit-accommodations="fitAccommodations"
        @fit-excursions="fitExcursions"
        @focus-all-photos="focusAllPhotos"
        @open-focus-menu="loadAllTripPhotos"
        @jump-my-location="jumpToMyLocation"
        @jump-member-location="jumpToMemberLocation"
        @set-orientation-mode="setMapOrientationMode"
        @download-offline-map="downloadOfflineMap"
      />
      <TripMapStatusPills
        :tile-download-state="tileDownloadState"
        :tile-download-progress="tileDownloadProgress"
        :tile-download-result="tileDownloadResult"
        @dismiss-download-result="dismissTileDownloadResult"
      />
      <TripMapFocusBanner
        :focused-excursion="focusedExcursion"
        :focused-date="drawers.mapFocusDate"
        :focused-spot="focusedSpot"
        :focused-location="drawers.mapFocusLocation"
        :focused-all-photos="drawers.mapFocusAllPhotos"
        :all-trip-photo-points-count="allTripPhotoPoints.length"
        :format-date="formatDate"
        @clear="clearFocus"
        @open-photo-preview="openPhotoPreview"
      />
    </div>

    <!-- Mobil/schmales Layout landet diese Stationen-Liste UND den Tage-Streifen in der Spots-Schublade
         (#map-focus-dock) statt als Overlay über der Karte zu schweben. Auf Desktop schwebend über der Karte. -->
    <TripMapDockTeleport :active="canTeleportToDock">
      <DayStrip
        v-if="vacationDays.length && !focusedTrack"
        :days="vacationDays"
        :active-date="drawers.mapFocusDate"
        :has-content="dayHasContent"
        :date-title="formatDate"
        @select="toggleDayFocus"
      />
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
    </TripMapDockTeleport>

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

    <EmptyState v-if="!points.length">
      Noch keine Orte mit Koordinaten hinterlegt. Füge bei Unterkunft, Reise-Einträgen oder Spots
      einen Maps-Link (Google/Apple) hinzu, damit sie hier erscheinen.
    </EmptyState>
  </div>
</template>

<style scoped>
/* Mobil (Default): die Karte füllt ihren Container (.map-col in ExcursionsView.vue, dort auf Mobil
   position:absolute über den ganzen Bildschirm) randlos vollflächig aus, ähnlich Google Maps –
   .karte spannt als absoluter Container den trip-map Query-Container auf, damit alle untergeordneten
   Karten-Tools, Badges und Controls stufenlos und unabhängig vom Viewport responsiv reagieren. */
.karte {
  position: absolute;
  inset: 0;
  container: trip-map / inline-size;
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
  --fit-btn-right-inset: var(--space-3);
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

/* Mobil (Default): schwebt als horizontal scrollbare Leiste über dem unteren Kartenrand (analog zu
   .focus-spot-list oben, nur unten statt oben verankert). Auf Desktop (@container weiter unten)
   wieder normales Flow-Element unterhalb der Karte. */
.day-strip {
  position: absolute;
  left: var(--space-2);
  right: var(--space-2);
  bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-2));
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
  left: var(--space-2);
  right: var(--space-2);
  bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-2));
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

/* Im Sheet-Overlay-Modus (z. B. auf Mobil oder bei schmalem .app-main Container)
   schwebt der Day-Strip bzw. Track-Playback oberhalb des Sheets mit sauberem Abstand */
.karte.sheet-overlay-mode .day-strip {
  left: calc(
    var(--calendar-margin, var(--drawer-tab-width, 32px)) + var(--calendar-offset, 0px) +
      var(--space-4)
  );
  right: var(--space-4);
  margin: 0 auto;
  max-width: min(400px, calc(100% - 140px));
}

.karte.sheet-overlay-mode .map-track-playback-container {
  left: calc(
    var(--calendar-margin, var(--drawer-tab-width, 32px)) + var(--calendar-offset, 0px) +
      var(--space-4)
  );
  right: var(--space-4);
  margin: 0 auto;
  width: min(520px, calc(100% - var(--space-6)));
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
  corner-shape: squircle;
  overflow: hidden;
  background-color: var(--color-surface) !important;
}

:deep(.leaflet-control-zoom) {
  display: none !important;
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

/* Desktop & breite Container: Die Kartenwerkzeuge (.fit-btn) und Zoom-Buttons nutzen auf breiten
   Containern größere Insets, um unter dem schwebenden Header zu liegen.
   Die Zoom-Buttons sitzen rechts neben den Drawers: im Side-by-Side-Modus rechts neben beiden Drawers,
   im Sheet-Overlay-Modus (wenn z. B. der Kalender auf Zwischengrößen ausgeklappt ist) direkt rechts
   neben der Kalender-Schublade. */
@container trip-map (min-width: 720px) {
  :deep(.leaflet-control-zoom) {
    display: block !important;
  }

  .map-wrap {
    --fit-btn-size: 44px;
    --fit-btn-top-inset: calc(var(--app-header-height, 56px) + var(--space-4));
    --fit-btn-right-inset: var(--space-4);
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
    border-radius: var(--radius-pill);
    corner-shape: round;
    bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-4));
  }

  .map-track-playback-container {
    left: var(--spots-col-right-px, 400px);
    right: 0;
    margin: 0 auto;
    width: min(520px, calc(100% - var(--spots-col-right-px, 400px) - var(--space-6)));
    bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-4));
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
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  padding: var(--space-1) var(--space-2);
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
  margin-top: var(--space-1);
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1.3;
  padding: 1px var(--space-1);
  border-radius: var(--radius-pill);
  background: rgba(20, 20, 25, 0.88);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(4px);
  pointer-events: none;
  z-index: 10;
}
</style>

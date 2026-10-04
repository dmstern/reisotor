<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import type { Excursion, ExcursionComment, ExcursionLike, Spot, User } from '../api/types';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { useExcursionsStore } from '../stores/excursions';
import { useTracksStore } from '../stores/tracks';
import { useTrackRecordingStore } from '../stores/trackRecording';
import { useIconStyleStore } from '../stores/iconStyle';
import { useIsDesktop } from '../composables/useIsDesktop';
import { hashHighlightId } from '../utils/hashHighlight';
import SpotCard from '../components/SpotCard.vue';
import ExcursionCard from '../components/ExcursionCard.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';
import SearchFilterBar from '../components/SearchFilterBar.vue';
import TripMap from '../components/TripMap.vue';
import TrackRecordingWarningModal from '../components/TrackRecordingWarningModal.vue';
import ResizeHandle from '../components/ResizeHandle.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import LegTransportModal from '../components/LegTransportModal.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import AppIcon from '../components/AppIcon.vue';
import AnimatedText from '../components/AnimatedText.vue';
import Button from '../components/primitives/Button.vue';
import IconButton from '../components/primitives/IconButton.vue';
import InfoPopover from '../components/primitives/InfoPopover.vue';
import EmptyState from '../components/primitives/EmptyState.vue';

// Subkomponenten (Phase 2: UI-Dekomposition & Deduplizierung, #446)
import ExcursionCategoryNav from '../components/ExcursionCategoryNav.vue';
import ExcursionTracksList from '../components/ExcursionTracksList.vue';
import TourSerpentineWrap from '../components/TourSerpentineWrap.vue';
import SpotFormModal from '../components/SpotFormModal.vue';
import ExcursionFormModal from '../components/ExcursionFormModal.vue';
import TrackEditModal from '../components/TrackEditModal.vue';

// Composables extrahiert im Rahmen von Phase 1 (Logik- & State-Entflechtung, #446)
import { useExcursionsLayout } from '../composables/useExcursionsLayout';
import { useCategoryNavSpy } from '../composables/useCategoryNavSpy';
import {
  useExcursionsFilter,
  STATUS_FILTER_ICON,
  STATUS_FILTER_LABEL,
} from '../composables/useExcursionsFilter';
import { useTourSerpentine } from '../composables/useTourSerpentine';
import { useExcursionTracks } from '../composables/useExcursionTracks';
import { useExcursionSocial } from '../composables/useExcursionSocial';

const auth = useAuthStore();
const tripStore = useTripStore();
const route = useRoute();
const router = useRouter();
const tripId = tripStore.currentTripId as number;
const spotsStore = useSpotsStore();
const scheduleStore = useScheduleStore();
const drawers = useDrawersStore();
const liveSync = useLiveSyncStore();
const excursionsStore = useExcursionsStore();
const tracksStore = useTracksStore();
const _trackRecording = useTrackRecordingStore();
const _iconStyle = useIconStyleStore();
const isDesktop = useIsDesktop();

const tripMapRef = ref<InstanceType<typeof TripMap> | null>(null);
const users = ref<User[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());
const travelItems = computed(() => deriveTravelItems(excursionsStore.excursions, spotsStore.spots));

// 1. Layout & Responsive Bottom Sheet
const layout = useExcursionsLayout({
  isDesktop,
  tripMapRef,
});
const {
  spotsColWidth,
  resizingCol,
  onColResizeStart,
  sheetState,
  sheetDragging,
  sheetEl,
  sheetHeightPx,
  onSheetDragStart,
  onSheetBodyPointerDown,
  stepSheet,
  canExpandSheet,
  canCollapseSheet,
  spotsColRightPx,
  isSheetOverlayMode,
  mapCoveredBottomPx,
  mapCoveredLeftPx,
} = layout;

// 2. Filtering, Searching, Sorting & Grouping
const filter = useExcursionsFilter({
  route,
  router,
  highlightedIds,
});
const {
  sortMode,
  groupMode,
  categoryFilter,
  statusFilter,
  tourRoleFilter,
  searchQuery,
  spotScheduledDates,
  hasActiveFilters,
  clearAllFilters,
  removeCategoryFilter,
  removeStatusFilter,
  removeTourRoleFilter,
  tourRoleIconDef,
  tourRoleLabel,
  groupIconDef,
  groupIconColor,
  applyRouteQuery,
  filteredSpotItems,
  spotGroups,
  filterCategoryOptions,
  excursionForGroupTitle,
  isTourAllSpotsFiltered,
  isTourPartiallyFiltered,
  tourFilterReason,
  tourPartialFilteredPrefix,
} = filter;

// 3. Category Navigation, Sticky Sentinel & Scroll Spy
const navSpy = useCategoryNavSpy({
  spotGroups,
  isSheetOverlayMode,
  sheetState,
  sheetHeightPx,
  sheetEl,
  tripMapRef,
});
const {
  pageTitleHeight,
  setPageTitleRef,
  isCategoryNavStuck,
  setCategoryNavSentinelRef,
  excursionRefs,
  spotRefs,
  spotsColBodyEl,
  setCategoryRef,
  setTourCardRef,
  setSpotRef,
  activeCategory,
  underlineLeft,
  underlineWidth,
  categoryNavHeight,
  canScrollNavLeft,
  canScrollNavRight,
  updateNavArrows,
  setCategoryNavRef,
  setNavItemRef,
  scrollNavBy,
  scrollToCategory,
  scrollToExcursion,
  scrollToSpot,
  cancelProgrammaticScroll,
} = navSpy;

// 4. Tour Serpentine Lines & Leg Modal
const serpentine = useTourSerpentine({
  spotGroups,
});
const {
  tourLines,
  getTourCols,
  getTourRows,
  getTourLayover,
  recomputeTourLine,
  setTourWrapRef,
  editingCardLeg,
  showCardLegModal,
  openCardLegModal,
  onSaveCardLeg,
  onDeleteCardLeg,
} = serpentine;

// 5. Tracks Management & Warning Modals
const tracks = useExcursionTracks({
  users,
  isSheetOverlayMode,
  sheetState,
});
const {
  onTrackShowOnMap,
  editingTrack,
  startEditTrack,
  showTrackRecordingWarningModal,
  hasActiveRecording,
  onRecordButtonClick,
  startRecordingConfirmed,
  stopTrackDirect,
} = tracks;

// 6. Social: Likes & Comments
const social = useExcursionSocial({
  users,
});
const {
  creatorLabel,
  spotCommentItemsFor,
  toggleSpotLike,
  toggleSpotCommentLike,
  submitSpotComment,
  removeSpotComment,
  updateSpotComment,
  excursionLikesFor,
  excursionLikedByMe,
  excursionCommentItemsFor,
  toggleExcursionLike,
  toggleExcursionCommentLike,
  submitExcursionComment,
  removeExcursionComment,
  updateExcursionComment,
} = social;

// 7. Tour Form Modal State & Helpers
const showExcursionModal = ref(false);
const editingExcursion = ref<Excursion | null>(null);

function openExcursionForm() {
  editingExcursion.value = null;
  showExcursionModal.value = true;
}

function startEditExcursion(excursion: Excursion | number) {
  if (typeof excursion === 'number') {
    const found = excursionsStore.excursions.find((e) => e.id === excursion);
    editingExcursion.value = found ?? null;
  } else {
    editingExcursion.value = excursion;
  }
  showExcursionModal.value = true;
}

const allTourTitles = computed(() => excursionsStore.excursions.map((e) => e.title));

async function toggleExcursionDestination(excursion: Excursion, spotId: number) {
  const newDest = excursion.destination_spot_id === spotId ? null : spotId;
  const payload = {
    trip_id: excursion.trip_id,
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    note_format: 'html' as const,
    date: excursion.date ?? undefined,
    spot_ids: excursion.spot_ids,
    role: excursion.role ?? null,
    destination_spot_id: newDest,
    legs: excursion.legs,
  };
  await excursionsStore.update(excursion.id, payload);
}

async function addSpotToExcursion(excursionId: number, spotId: number) {
  const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
  if (!excursion || excursion.spot_ids.includes(spotId)) return;
  await excursionsStore.update(excursionId, {
    title: excursion.title,
    image_url: excursion.image_url ?? undefined,
    note: excursion.note ?? undefined,
    date: excursion.date ?? undefined,
    spot_ids: [...excursion.spot_ids, spotId],
  });
}

async function assignSpotToTourTitle(spotId: number, title: string) {
  const excursion = excursionForGroupTitle(title);
  if (excursion) {
    if (!excursion.spot_ids.includes(spotId)) await addSpotToExcursion(excursion.id, spotId);
  } else {
    await excursionsStore.create({ title, spot_ids: [spotId] });
  }
}

// 8. Spot Form Modal State
const showSpotModal = ref(false);
const editingSpot = ref<Spot | null>(null);

function openSpotForm() {
  editingSpot.value = null;
  showSpotModal.value = true;
}

function startEditSpot(spot: Spot | number) {
  if (typeof spot === 'number') {
    const found = spotsStore.spots.find((s) => s.id === spot);
    editingSpot.value = found ?? null;
  } else {
    editingSpot.value = spot;
  }
  showSpotModal.value = true;
}

// Card Expansion & Map Cross-Focus Orchestration
const expandedSpotId = ref<number | null>(null);
const expandedExcursionId = ref<number | null>(null);

let excursionOpenSequenceToken = 0;
let spotOpenSequenceToken = 0;

watch(expandedExcursionId, (newId, oldId) => {
  if (newId != null) {
    nextTick(() => recomputeTourLine(newId));
    setTimeout(() => recomputeTourLine(newId), 320);
    setTimeout(() => recomputeTourLine(newId), 420);
  }
  if (oldId != null) {
    nextTick(() => recomputeTourLine(oldId));
    setTimeout(() => recomputeTourLine(oldId), 320);
    setTimeout(() => recomputeTourLine(oldId), 420);
  }
});

async function openExcursionWithScroll(excursionId: number) {
  const token = ++excursionOpenSequenceToken;

  if (drawers.mapFocusExcursionId && drawers.mapFocusExcursionId !== excursionId) {
    drawers.mapFocusExcursionId = null;
  }
  if (drawers.mapFocusKey != null) {
    drawers.mapFocusKey = null;
  }

  const previousExcursionId = expandedExcursionId.value;
  if (previousExcursionId === excursionId) {
    await scrollToExcursion(excursionId);
    return;
  }

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let offsetAdjustment = 0;
  if (previousExcursionId != null) {
    const prevEl = excursionRefs.get(previousExcursionId);
    const targetEl = excursionRefs.get(excursionId);
    if (prevEl && targetEl) {
      const isPrevAbove = Boolean(
        prevEl.compareDocumentPosition(targetEl) & Node.DOCUMENT_POSITION_FOLLOWING
      );
      if (
        isPrevAbove &&
        targetEl.getBoundingClientRect().top > prevEl.getBoundingClientRect().top + 10
      ) {
        const prevGroup = prevEl.closest('.category-group');
        const prevAccordion = prevGroup?.querySelector(
          '.tour-station-accordion'
        ) as HTMLElement | null;
        if (prevAccordion) {
          offsetAdjustment = -prevAccordion.getBoundingClientRect().height;
        }
      }
    }
  }

  expandedExcursionId.value = excursionId;
  expandedSpotId.value = null;

  await nextTick();
  if (token !== excursionOpenSequenceToken) return;

  await scrollToExcursion(excursionId, offsetAdjustment);
  if (token !== excursionOpenSequenceToken) return;

  if (!prefersReduced) {
    await new Promise<void>((resolve) => setTimeout(resolve, 420));
    if (token !== excursionOpenSequenceToken) return;
    await scrollToExcursion(excursionId, 0, 'auto');
  }
}

async function openSpotWithScroll(spotId: number) {
  const token = ++spotOpenSequenceToken;

  if (drawers.mapFocusKey && drawers.mapFocusKey !== `spot-${spotId}`) {
    drawers.mapFocusKey = null;
  }
  if (drawers.mapFocusExcursionId != null) {
    drawers.mapFocusExcursionId = null;
  }

  const previousSpotId = expandedSpotId.value;
  if (previousSpotId === spotId) {
    await scrollToSpot(spotId);
    return;
  }

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let offsetAdjustment = 0;
  if (previousSpotId != null) {
    const prevEl = spotRefs.get(previousSpotId);
    const targetEl = spotRefs.get(spotId);
    if (prevEl && targetEl) {
      const isPrevAbove = Boolean(
        prevEl.compareDocumentPosition(targetEl) & Node.DOCUMENT_POSITION_FOLLOWING
      );
      if (
        isPrevAbove &&
        targetEl.getBoundingClientRect().top > prevEl.getBoundingClientRect().top + 10
      ) {
        const accordions = prevEl.querySelectorAll<HTMLElement>(
          '.spot-accordion.is-expanded, .actions-accordion.is-expanded'
        );
        let accHeight = 0;
        accordions.forEach((a) => {
          accHeight += a.getBoundingClientRect().height;
        });
        const mapActions = prevEl.querySelector<HTMLElement>('.map-actions');
        const mapActionsHeight = mapActions ? mapActions.getBoundingClientRect().height : 0;
        const img = prevEl.querySelector<HTMLElement>('.image');
        const imgDiff = img ? Math.max(0, img.getBoundingClientRect().height - 100) : 0;

        offsetAdjustment = -(accHeight + mapActionsHeight + imgDiff);
      }
    }
  }

  expandedSpotId.value = spotId;

  await nextTick();
  if (token !== spotOpenSequenceToken) return;

  await scrollToSpot(spotId, offsetAdjustment);
  if (token !== spotOpenSequenceToken) return;

  if (!prefersReduced) {
    await new Promise<void>((resolve) => setTimeout(resolve, 260));
    if (token !== spotOpenSequenceToken) return;
    await scrollToSpot(spotId, 0, 'auto');
  }
}

function onSpotCardOpen(spot: Spot) {
  openSpotWithScroll(spot.id);
}

function onSpotCardClose() {
  spotOpenSequenceToken++;
  expandedSpotId.value = null;
  drawers.mapFocusKey = null;
}

function onExcursionCardOpen(excursion: Excursion) {
  openExcursionWithScroll(excursion.id);
}

function onExcursionCardClose() {
  excursionOpenSequenceToken++;
  expandedExcursionId.value = null;
  drawers.mapFocusExcursionId = null;
}

function onSpotShowOnMap(spot: Spot) {
  sheetState.value = 'partial';
  drawers.openMapAt(`spot-${spot.id}`);
  if (isSheetOverlayMode.value) {
    nextTick(() => {
      scrollToSpot(spot.id);
    });
  }
}

function onExcursionShowOnMap(excursionId: number) {
  sheetState.value = 'partial';
  expandedExcursionId.value = excursionId;
  drawers.openMapForExcursion(excursionId);
  if (isSheetOverlayMode.value) {
    nextTick(() => {
      scrollToExcursion(excursionId);
    });
  }
}

function onFocusSpotFromMap(spotId: number) {
  if (groupMode.value === 'tracks') {
    groupMode.value = 'category';
  }
  if (sheetState.value === 'collapsed' || sheetState.value === 'full') sheetState.value = 'partial';
  if (groupMode.value === 'tours') {
    const parentExcursion = excursionsStore.excursions.find((e) => e.spot_ids.includes(spotId));
    if (parentExcursion) {
      expandedExcursionId.value = parentExcursion.id;
    }
  }
  openSpotWithScroll(spotId);
}

function onFocusExcursionFromMap(excursionId: number) {
  groupMode.value = 'tours';
  if (sheetState.value === 'collapsed' || sheetState.value === 'full') sheetState.value = 'partial';
  openExcursionWithScroll(excursionId);
}

// Drawer & Map Focus Watchers
watch(
  () => [
    drawers.mapFocusDate,
    drawers.mapFocusExcursionId,
    drawers.mapFocusKey,
    drawers.mapFocusTrackId,
    drawers.mapFocusLocation,
  ],
  ([date, excId, key, trackId, loc]) => {
    if (date != null || excId != null || key != null || trackId != null || loc != null) {
      if (sheetState.value === 'collapsed' || sheetState.value === 'full') {
        sheetState.value = 'partial';
      }
    }
  }
);

watch(
  () => [drawers.mapFocusTrackId, drawers.focusVersion],
  ([trackId]) => {
    if (trackId != null && isSheetOverlayMode.value) {
      groupMode.value = 'tracks';
    }
  }
);

watch(
  () => [drawers.mapFocusExcursionId, drawers.focusVersion],
  ([excId]) => {
    if (excId != null && isSheetOverlayMode.value) {
      groupMode.value = 'tours';
      nextTick(() => {
        scrollToExcursion(excId);
      });
    }
  }
);

watch(
  () => [drawers.mapFocusKey, drawers.focusVersion],
  ([key]) => {
    if (typeof key === 'string' && key.startsWith('spot-') && isSheetOverlayMode.value) {
      const spotId = Number(key.replace('spot-', ''));
      if (!Number.isNaN(spotId)) {
        nextTick(() => {
          scrollToSpot(spotId);
        });
      }
    }
  }
);

const dayFocusHighlightedIds = ref<Set<number>>(new Set());

watch(
  () => drawers.mapFocusDate,
  (date) => {
    dayFocusHighlightedIds.value = new Set();
    if (date) {
      const matchingExcursions = excursionsStore.excursions.filter((e) => e.date === date);
      const matchingSpotIds = scheduleStore.items
        .filter((s) => s.date === date && s.spot_id != null)
        .map((s) => s.spot_id as number);

      const next = new Set<number>();
      for (const e of matchingExcursions) {
        next.add(e.id);
      }
      for (const sid of matchingSpotIds) {
        next.add(sid);
      }
      dayFocusHighlightedIds.value = next;

      nextTick(() => {
        if (groupMode.value === 'tours' && matchingExcursions.length > 0) {
          scrollToExcursion(matchingExcursions[0].id);
          return;
        }
        if (matchingSpotIds.length > 0) {
          scrollToSpot(matchingSpotIds[0]);
        }
      });
    }
  }
);

// Hash Watcher
watch(
  () => route.hash,
  async (newHash) => {
    if (!newHash) return;
    const spotId = hashHighlightId(newHash, 'spot');
    if (spotId != null) {
      await nextTick();
      drawers.openMapAt(`spot-${spotId}`);
      onFocusSpotFromMap(spotId);
      return;
    }
    const excursionId = hashHighlightId(newHash, 'excursion') ?? hashHighlightId(newHash, 'travel');
    if (excursionId != null) {
      await nextTick();
      drawers.openMapForExcursion(excursionId);
      onFocusExcursionFromMap(excursionId);
    }
  }
);

watch(
  () => drawers.mapFocusKey,
  (newKey) => {
    if (!newKey && route.hash.startsWith('#spot-')) {
      router.replace({ path: route.path, query: route.query, hash: '' });
    }
  }
);

watch(
  () => drawers.mapFocusExcursionId,
  (newId) => {
    if (
      newId == null &&
      (route.hash.startsWith('#excursion-') || route.hash.startsWith('#travel-'))
    ) {
      router.replace({ path: route.path, query: route.query, hash: '' });
    }
  }
);

onMounted(async () => {
  applyRouteQuery();
  filter.markSeenForGroupMode(groupMode.value);
  const hashId = hashHighlightId(route.hash, 'spot');
  const excursionHashId =
    hashHighlightId(route.hash, 'excursion') ?? hashHighlightId(route.hash, 'travel');
  try {
    const [usersRes, likesRes, commentsRes] = await Promise.all([
      api.get<User[]>(`/trips/${tripId}/members`),
      api.get<ExcursionLike[]>(`/ideas/likes?trip_id=${tripId}`),
      api.get<ExcursionComment[]>(`/ideas/comments?trip_id=${tripId}`),
      spotsStore.load(),
      excursionsStore.load(),
    ]);
    users.value = usersRes;
    social.excursionLikes.value = likesRes;
    social.excursionComments.value = commentsRes;
  } catch {
    // Offline and not yet cached
  } finally {
    loading.value = false;
  }
  if (hashId != null) {
    await nextTick();
    drawers.openMapAt(`spot-${hashId}`);
    onFocusSpotFromMap(hashId);
  }
  if (excursionHashId != null) {
    await nextTick();
    drawers.openMapForExcursion(excursionHashId);
    onFocusExcursionFromMap(excursionHashId);
  }
});

onUnmounted(() => {
  drawers.mapFocusKey = null;
  drawers.mapFocusExcursionId = null;
  drawers.mapFocusDate = null;
  drawers.mapFocusTrackId = null;
  sheetState.value = 'collapsed';
});
</script>

<template>
  <div class="page" v-if="!loading" :style="{ '--page-title-height': pageTitleHeight + 'px' }">
    <h1 class="page-title" :ref="setPageTitleRef">
      <AppIcon :icon="SECTION_ICON_DEFS.map" :size="22" group="navigation" /> Karte
    </h1>
    <div
      class="layout"
      :style="{
        '--spots-col-width': spotsColWidth + 'px',
        '--spots-col-right-px': `${spotsColRightPx}px`,
      }"
    >
      <div
        ref="sheetEl"
        class="spots-col"
        :class="[isSheetOverlayMode ? sheetState : null, { dragging: sheetDragging }]"
      >
        <div class="sheet-handle-row">
          <IconButton
            variant="secondary"
            shape="circle"
            size="sm"
            class="sheet-step-btn"
            :disabled="!canExpandSheet"
            :icon="ACTION_ICONS.chevronUp"
            aria-label="Spots-Liste weiter hochschieben"
            title="Hochschieben"
            @click="stepSheet(1)"
          />
          <div
            class="sheet-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Spots-Liste ein-/ausklappen"
            @pointerdown="onSheetDragStart"
          >
            <span class="sheet-grip" aria-hidden="true"></span>
            <span class="sheet-summary">
              <AppIcon :icon="FORM_FIELD_ICONS.location" :size="13" group="formFields" />
              {{ filteredSpotItems.length }} {{ filteredSpotItems.length === 1 ? 'Ort' : 'Orte' }}
            </span>
          </div>
          <IconButton
            variant="secondary"
            shape="circle"
            size="sm"
            class="sheet-step-btn"
            :disabled="!canCollapseSheet"
            :icon="ACTION_ICONS.chevronDown"
            aria-label="Spots-Liste weiter runterschieben"
            title="Runterschieben"
            @click="stepSheet(-1)"
          />
        </div>
        <div
          class="spots-col-body"
          :class="{ 'has-tour-groups': groupMode === 'tours' }"
          ref="spotsColBodyEl"
          :style="{ '--category-nav-clearance': `${categoryNavHeight}px` }"
          @pointerdown="onSheetBodyPointerDown"
          @wheel.passive="cancelProgrammaticScroll"
          @touchmove.passive="cancelProgrammaticScroll"
        >
          <!-- Sprungziel für TripMap.vue's Tag-/Ausflug-Stationen-Liste: mobil (siehe TripMap.vue's
           Teleport) landet sie hier statt als Overlay über der Karte zu schweben (verdeckte dort
           Kartenausschnitt und teils die Zoom-Steuerung). Auf Desktop bleibt sie unverändert Teil
           der Karte-Spalte (Teleport dort deaktiviert), dieser Anker bleibt also leer. -->
          <div id="map-focus-dock" class="map-focus-dock"></div>
          <div class="header">
            <h2>
              <AnimatedText
                :text="
                  groupMode === 'tours' ? 'Touren' : groupMode === 'tracks' ? 'Tracks' : 'Spots'
                "
                :options="['Spots', 'Touren', 'Tracks']"
                :direction="groupMode === 'tours' ? 'up' : 'down'"
              />
              <!-- Der frühere, immer sichtbare Erklärtext nahm spürbar Platz weg, v. a. auf mobile
               (Nutzer-Feedback) - jetzt hinter einem Info-Button versteckt, gleiches
               Popover-Muster (Backdrop + .picker-menu) wie die Kategorie-/Status-Filter unten statt
               eines neuen Tooltip-Mechanismus. -->
              <InfoPopover
                :title="
                  groupMode === 'tours'
                    ? 'Was sind Touren?'
                    : groupMode === 'tracks'
                      ? 'Was sind Tracks?'
                      : 'Was sind Spots?'
                "
                :aria-label="
                  groupMode === 'tours'
                    ? 'Was sind Touren?'
                    : groupMode === 'tracks'
                      ? 'Was sind Tracks?'
                      : 'Was sind Spots?'
                "
                :menu-width="300"
              >
                <template v-if="groupMode === 'tours'">
                  <p>
                    <strong>Touren</strong> fassen mehrere Spots zu einer gemeinsamen Route oder
                    einem Tagesausflug zusammen. Eignet sich bspw. auch, um An- oder Abreise auf der
                    Karte zu visualisieren.
                  </p>
                  <p class="popover-tip">
                    💡 <strong>Tipp:</strong> Klicke auf eine Tour-Kachel, um deren Route und Wege
                    auf der Karte anzuzeigen.
                  </p>
                </template>
                <template v-else-if="groupMode === 'tracks'">
                  <p>
                    <strong>Tracks</strong> zeichnen deine zurückgelegten Wege per GPS auf. Du
                    kannst sie auf der Karte nachverfolgen, mit Mitreisenden teilen oder Touren
                    zuordnen.
                  </p>
                  <p class="popover-tip">
                    💡 <strong>Tipp:</strong> Starte eine Aufzeichnung per Klick auf „Aufzeichnen“
                    oder direkt über den Button auf der Karte.
                  </p>
                </template>
                <template v-else>
                  <p>
                    <strong>Spots</strong> sind einzelne Orte (Restaurants, Sehenswürdigkeiten,
                    Strände, …) – als Ideensammlung oder zur Reiseplanung.
                  </p>
                  <p class="popover-tip">
                    💡 <strong>Tipp:</strong> Ziehe eine Spot-Karte direkt auf einen Kalendertag
                    oder eine Tour, um sie einzutakten.
                  </p>
                </template>
              </InfoPopover>
              <!-- #155: der Spots/Touren/Tracks-Umschalter sitzt direkt neben der
               Drawer-Überschrift als primäre Weiche dieser Ansicht. -->
              <SegmentedToggle
                v-model="groupMode"
                :options="[
                  {
                    value: 'category',
                    label: 'Spots',
                    icon: FORM_FIELD_ICONS.category,
                    iconGroup: 'formFields',
                    dot: liveSync.hasUnseen('spots'),
                  },
                  {
                    value: 'tours',
                    label: 'Touren',
                    icon: SECTION_ICON_DEFS.excursions,
                    iconGroup: 'navigation',
                    dot: liveSync.hasUnseen('ideas'),
                  },
                  {
                    value: 'tracks',
                    label: 'Tracks',
                    icon: ACTION_ICONS.history,
                    iconGroup: 'actions',
                  },
                ]"
              />
            </h2>
            <div class="header-actions">
              <Button
                size="sm"
                class="add-button"
                :class="{ recording: groupMode === 'tracks' && hasActiveRecording }"
                :variant="groupMode === 'tracks' && hasActiveRecording ? 'danger' : 'primary'"
                :aria-label="
                  groupMode === 'tracks'
                    ? hasActiveRecording
                      ? 'Aufzeichnung beenden'
                      : 'Weg aufzeichnen'
                    : groupMode === 'tours'
                      ? 'Neue Tour'
                      : 'Neuer Spot'
                "
                @click="
                  groupMode === 'tracks'
                    ? onRecordButtonClick()
                    : groupMode === 'tours'
                      ? openExcursionForm()
                      : openSpotForm()
                "
              >
                <AppIcon
                  :icon="
                    groupMode === 'tracks'
                      ? hasActiveRecording
                        ? ACTION_ICONS.recordStop
                        : ACTION_ICONS.recordStart
                      : ACTION_ICONS.add
                  "
                  :size="14"
                  group="actions"
                />
                <span class="add-button__label">
                  <AnimatedText
                    :text="
                      groupMode === 'tracks'
                        ? hasActiveRecording
                          ? 'Beenden'
                          : 'Aufzeichnen'
                        : groupMode === 'tours'
                          ? 'Neue Tour'
                          : 'Neuer Spot'
                    "
                    :options="['Neuer Spot', 'Neue Tour', 'Aufzeichnen', 'Beenden']"
                    :direction="groupMode === 'tours' ? 'up' : 'down'"
                  />
                </span>
              </Button>
            </div>
          </div>
          <div class="subheader" v-if="hasActiveRecording">
            <div class="active-recording-banner">
              <span class="recording-pulse-dot" aria-hidden="true"></span>
              <span class="recording-banner-text">Standortaufzeichnung aktiv</span>
            </div>
          </div>

          <!-- Touren-Formular: Modale Komponente mit useTourForm (#446) -->
          <ExcursionFormModal
            v-model:show="showExcursionModal"
            v-model:excursion="editingExcursion"
            :users="users"
            :excursion-for-group-title="excursionForGroupTitle"
          />

          <div
            class="filter-bar"
            v-if="
              groupMode !== 'tracks' &&
              (filterCategoryOptions.length || excursionsStore.excursions.length)
            "
          >
            <SearchFilterBar
              v-model:search-query="searchQuery"
              v-model:sort-mode="sortMode"
              v-model:category-filter="categoryFilter"
              v-model:status-filter="statusFilter"
              v-model:tour-role-filter="tourRoleFilter"
              :category-options="filterCategoryOptions"
              search-placeholder="Spots oder Touren suchen..."
            />

            <div
              class="filter-chips"
              v-if="categoryFilter.length || statusFilter.length || tourRoleFilter.length"
            >
              <span v-for="cat in categoryFilter" :key="cat" class="filter-chip">
                <AppIcon :icon="groupIconDef(cat)" :size="13" group="categories" /> {{ cat }}
                <IconButton
                  variant="ghost"
                  size="sm"
                  :icon="ACTION_ICONS.close"
                  aria-label="Filter entfernen"
                  title="Filter entfernen"
                  @click="removeCategoryFilter(cat)"
                />
              </span>
              <span v-for="status in statusFilter" :key="status" class="filter-chip">
                <AppIcon :icon="STATUS_FILTER_ICON[status]" :size="13" group="actions" />
                {{ STATUS_FILTER_LABEL[status] }}
                <IconButton
                  variant="ghost"
                  size="sm"
                  :icon="ACTION_ICONS.close"
                  aria-label="Filter entfernen"
                  title="Filter entfernen"
                  @click="removeStatusFilter(status)"
                />
              </span>
              <span v-for="role in tourRoleFilter" :key="role" class="filter-chip">
                <AppIcon :icon="tourRoleIconDef(role)" :size="13" group="categories" />
                {{ tourRoleLabel(role) }}
                <IconButton
                  variant="ghost"
                  size="sm"
                  :icon="ACTION_ICONS.close"
                  aria-label="Filter entfernen"
                  title="Filter entfernen"
                  @click="removeTourRoleFilter(role)"
                />
              </span>
            </div>
          </div>

          <!-- Spot-Formular: Modale Komponente mit useSpotForm (#446) -->
          <SpotFormModal
            v-model:show="showSpotModal"
            v-model:spot="editingSpot"
            :trip-id="tripId"
            :users="users"
            :spot-scheduled-dates="spotScheduledDates"
          />

          <!-- Sticky Category Nav Bar (#144, #446) -->
          <ExcursionCategoryNav
            :spot-groups="spotGroups"
            :active-category="activeCategory"
            :is-stuck="isCategoryNavStuck"
            :underline-left="underlineLeft"
            :underline-width="underlineWidth"
            :can-scroll-left="canScrollNavLeft"
            :can-scroll-right="canScrollNavRight"
            :group-icon-color="groupIconColor"
            :set-sentinel-ref="setCategoryNavSentinelRef"
            :set-nav-ref="setCategoryNavRef"
            :set-nav-item-ref="setNavItemRef"
            @select-category="scrollToCategory"
            @scroll-nav="scrollNavBy"
            @update-nav-arrows="updateNavArrows"
          />

          <template v-if="groupMode !== 'tracks'">
            <section
              class="group category-group"
              :class="{
                'is-tour-group': !!grp.excursion,
                'is-expanded': !!(grp.excursion && expandedExcursionId === grp.excursion.id),
              }"
              :style="
                grp.excursion
                  ? {
                      '--tour-theme-color': grp.excursion.role
                        ? 'var(--color-travel)'
                        : 'var(--color-tour)',
                      '--tour-theme-tint': grp.excursion.role
                        ? 'var(--color-travel-tint)'
                        : 'var(--color-tour-tint)',
                      '--tour-theme-border': grp.excursion.role
                        ? 'var(--color-travel-border)'
                        : 'var(--color-tour-border)',
                    }
                  : undefined
              "
              v-for="grp in spotGroups"
              :key="grp.category"
            >
              <ExcursionCard
                v-if="grp.excursion"
                :ref="(el) => setTourCardRef(grp.category, grp.excursion!.id, el)"
                class="tour-group-card"
                :excursion="grp.excursion"
                :highlighted="
                  highlightedIds.has(grp.excursion.id) ||
                  dayFocusHighlightedIds.has(grp.excursion.id)
                "
                :creator-label="creatorLabel(grp.excursion.created_by)"
                :like-count="excursionLikesFor(grp.excursion.id).length"
                :liked="excursionLikedByMe(grp.excursion.id)"
                :comments="excursionCommentItemsFor(grp.excursion.id)"
                :stations="spotsStore.spots"
                :travel-items="travelItems"
                :expanded="expandedExcursionId === grp.excursion.id"
                @edit="startEditExcursion"
                @toggle-like="toggleExcursionLike(grp.excursion.id)"
                @submit-comment="(content) => submitExcursionComment(grp.excursion!.id, content)"
                @remove-comment="removeExcursionComment"
                @update-comment="updateExcursionComment"
                @toggle-comment-like="toggleExcursionCommentLike"
                @drop-spot="(spotId) => addSpotToExcursion(grp.excursion!.id, spotId)"
                @show-on-map="onExcursionShowOnMap(grp.excursion.id)"
                @open="onExcursionCardOpen(grp.excursion)"
                @close="onExcursionCardClose"
              />
              <h3 v-else class="category-heading" :ref="(el) => setCategoryRef(grp.category, el)">
                <AppIcon :icon="grp.iconDef" group="categories" :color="groupIconColor(grp)" />
                {{ grp.category }}
              </h3>
              <!-- Tour-Gruppe: eingerückte, per gebogener gestrichelter SVG-Linie verbundene vertikale Liste
             statt des normalen Karten-Grids (siehe .tour-station-wrap/.tour-station-line unten, #100)
             - die Reihenfolge entspricht spotGroups' Sortierung nach der echten Tour-Reihenfolge
             (spot_ids), macht den Rundgang direkt sichtbar. Ersetzt die früheren Mini-Stations-Chips
             auf der ExcursionCard selbst (redundant, sobald die echten Spot-Karten direkt darunter
             erscheinen). Das Wrapper-Div (nur bei Touren-Gruppierung gebraucht) ist position:relative
             und dadurch offsetParent der Spot-Karten - recomputeTourLine() liest deren offsetTop/
             offsetHeight direkt relativ dazu aus (siehe dortiger Kommentar). -->
              <div
                class="tour-station-accordion"
                :class="{
                  'is-expanded': !grp.excursion || expandedExcursionId === grp.excursion.id,
                }"
                :inert="!!(grp.excursion && expandedExcursionId !== grp.excursion.id)"
              >
                <div class="tour-station-accordion-inner">
                  <!-- Touren: Schlangen-Layout (Serpentine) via TourSerpentineWrap (#446) -->
                  <TourSerpentineWrap
                    v-if="grp.excursion"
                    :excursion="grp.excursion"
                    :items="grp.items"
                    :tour-line="tourLines.get(grp.excursion.id)"
                    :cols="getTourCols(grp.excursion.id)"
                    :rows="getTourRows(grp.excursion, grp.items)"
                    :expanded-spot-id="expandedSpotId"
                    :highlighted-ids="highlightedIds"
                    :day-focus-highlighted-ids="dayFocusHighlightedIds"
                    :spot-scheduled-dates="spotScheduledDates"
                    :users="users"
                    :all-tour-titles="allTourTitles"
                    :spot-comment-items-for="spotCommentItemsFor"
                    :get-tour-layover="getTourLayover"
                    :set-spot-ref="setSpotRef"
                    :set-tour-wrap-ref="(el) => setTourWrapRef(grp.excursion!.id, el)"
                    @open-leg-modal="
                      (fromSpot, toSpot) => openCardLegModal(grp.excursion!, fromSpot, toSpot)
                    "
                    @toggle-destination="
                      (spotId) => toggleExcursionDestination(grp.excursion!, spotId)
                    "
                    @edit-spot="(spot) => startEditSpot(spot.id)"
                    @toggle-spot-like="toggleSpotLike"
                    @submit-spot-comment="
                      ({ spotId, content }) => submitSpotComment(spotId, content)
                    "
                    @remove-spot-comment="removeSpotComment"
                    @update-spot-comment="
                      ({ commentId, content }) => updateSpotComment(commentId, content)
                    "
                    @toggle-spot-comment-like="toggleSpotCommentLike"
                    @open-spot="onSpotCardOpen"
                    @close-spot="onSpotCardClose"
                    @show-spot-on-map="onSpotShowOnMap"
                    @assign-tour="({ spotId, title }) => assignSpotToTourTitle(spotId, title)"
                  />

                  <!-- Nicht-Touren (z. B. "Ohne Tour"): Standard-Grid -->
                  <TransitionGroup v-else tag="div" name="list" class="grid cards">
                    <template v-for="(item, index) in grp.items" :key="`spot-${item.spot.id}`">
                      <SpotCard
                        :ref="(el) => setSpotRef(item.spot.id, el)"
                        class="staggered-spot"
                        :style="[{ '--stagger-idx': index, '--stagger-total': grp.items.length }]"
                        :spot="item.spot"
                        :highlighted="
                          highlightedIds.has(item.spot.id) ||
                          dayFocusHighlightedIds.has(item.spot.id)
                        "
                        :expanded="expandedSpotId === item.spot.id"
                        :scheduled-date="spotScheduledDates.get(item.spot.id) ?? null"
                        :creator-label="creatorLabel(item.spot.created_by)"
                        :payer-label="creatorLabel(item.spot.paid_by_user_id)"
                        :like-count="spotsStore.likeCountFor(item.spot.id)"
                        :liked="spotsStore.likedByMe(item.spot.id, auth.user?.id)"
                        :comments="spotCommentItemsFor(item.spot.id)"
                        :group-mode="groupMode === 'tours' ? 'tours' : 'category'"
                        :tour-options="allTourTitles"
                        :has-multiple-members="users.length > 1"
                        @edit="startEditSpot"
                        @toggle-like="toggleSpotLike(item.spot.id)"
                        @submit-comment="(content) => submitSpotComment(item.spot.id, content)"
                        @remove-comment="removeSpotComment"
                        @update-comment="updateSpotComment"
                        @toggle-comment-like="toggleSpotCommentLike"
                        @open="onSpotCardOpen(item.spot)"
                        @close="onSpotCardClose"
                        @show-on-map="onSpotShowOnMap(item.spot)"
                        @assign-tour="(title) => assignSpotToTourTitle(item.spot.id, title)"
                      />
                    </template>
                  </TransitionGroup>

                  <!-- Hinweis, wenn einige Spots der Tour gerade durch Filter ausgeblendet sind (#partially-filtered) -->
                  <p
                    v-if="grp.excursion && isTourPartiallyFiltered(grp.excursion, grp.items.length)"
                    class="empty tour-partial-filter-hint"
                  >
                    {{ tourPartialFilteredPrefix(grp.excursion, grp.items.length) }}
                    <button type="button" class="filter-reset-link" @click="clearAllFilters">
                      Filter zurücksetzen
                    </button>
                    <span>, um alle Stationen zu sehen.</span>
                  </p>
                </div>
              </div>
              <!-- Zwei unterschiedliche Gründe für eine leere Gruppe: entweder ist der Tour wirklich noch
              kein Spot zugeordnet (getTourTotalSpotsCount(grp.excursion) === 0), oder es sind welche zugeordnet,
              aber der aktive Filter (Kategorie, Status oder Suchbegriff) blendet sie gerade alle aus – ohne diese
              Unterscheidung wirkte eine reine Filter-Situation fälschlich wie eine leere Tour. -->
              <p
                v-if="grp.excursion && isTourAllSpotsFiltered(grp.excursion, grp.items.length)"
                class="empty"
              >
                Die zugeordneten Spots sind gerade durch {{ tourFilterReason() }} ausgeblendet –
                <button type="button" class="filter-reset-link" @click="clearAllFilters">
                  Filter zurücksetzen
                </button>
                <span>, um sie wieder zu sehen.</span>
              </p>
              <p v-else-if="grp.excursion && !grp.items.length" class="empty">
                Noch keine Spots zugeordnet – ziehe eine Spot-Karte hierher oder wähle diese Tour
                beim Bearbeiten eines Spots über "Tour zuordnen".
              </p>
            </section>
            <div v-if="!spotGroups.length" class="empty-state-wrap">
              <EmptyState>
                <template v-if="hasActiveFilters">
                  Keine {{ groupMode === 'tours' ? 'Touren' : 'Spots' }} für die aktuellen Filter
                  oder Suchbegriffe gefunden.
                </template>
                <template v-else-if="groupMode === 'tours'"> Noch keine Touren angelegt. </template>
                <template v-else> Noch keine Spots angelegt. </template>
              </EmptyState>
              <Button
                v-if="hasActiveFilters"
                variant="secondary"
                size="sm"
                class="clear-filters-btn"
                @click="clearAllFilters"
              >
                <AppIcon :icon="ACTION_ICONS.close" :size="13" group="actions" />
                <span>Filter zurücksetzen</span>
              </Button>
            </div>
          </template>

          <ExcursionTracksList
            v-else
            :tracks="tracksStore.tracks"
            :users="users"
            :active-track-id="drawers.mapFocusTrackId"
            :current-user-id="auth.user?.id"
            @show-on-map="onTrackShowOnMap"
            @stop-track="stopTrackDirect"
            @edit-track="startEditTrack"
          />

          <!-- Hinweis-Modal für Standort-Aufzeichnung (#230) -->
          <TrackRecordingWarningModal
            v-model="showTrackRecordingWarningModal"
            @confirm="startRecordingConfirmed"
          />

          <!-- Aufzeichnung bearbeiten (Name, Sichtbarkeit) via TrackEditModal (#446) -->
          <TrackEditModal v-model:track="editingTrack" :users="users" />

          <!-- Schnelles Bearbeiten einer Teilstrecke direkt aus der Leg-Card (#361) -->
          <LegTransportModal
            v-if="editingCardLeg"
            v-model="showCardLegModal"
            :from-spot="editingCardLeg.fromSpot"
            :to-spot="editingCardLeg.toSpot"
            :leg="editingCardLeg.leg"
            :users="users"
            @save="onSaveCardLeg"
            @delete="onDeleteCardLeg"
          />
        </div>
      </div>

      <ResizeHandle
        label="Aufteilung zwischen Spots-Liste und Karte anpassen"
        :is-resizing="resizingCol"
        class="col-resize-handle"
        @pointerdown="onColResizeStart"
      />

      <div class="map-col">
        <TripMap
          ref="tripMapRef"
          :category-filter="categoryFilter"
          :status-filter="statusFilter"
          :tour-role-filter="tourRoleFilter"
          :covered-bottom-px="mapCoveredBottomPx"
          :sheet-overlay-mode="isSheetOverlayMode"
          :covered-left-px="mapCoveredLeftPx"
          @focus-spot="onFocusSpotFromMap"
          @focus-excursion="onFocusExcursionFromMap"
          @edit-excursion="startEditExcursion"
        />
      </div>
    </div>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
/* Mobil (Default): kein eigener Titel-Balken über der (jetzt dahinterliegenden, siehe .map-col
   weiter unten) vollflächigen Karte – anders als bei Google Maps (Vorbild für die vollflächige
   Karte) ist das hier kein Suchfeld, nur eine leere Kopfzeile ohne Funktion. Auf Desktop
   (@container weiter unten) bleibt der bisherige schlichte Titel unverändert sichtbar. */
.page-title {
  display: none;
  font-size: 1.3rem;
  color: var(--color-primary-dark);
}

/* Mobil (Default) UND Desktop mit stark eingeschränktem .app-main (z. B. beide Schubladen
   gleichzeitig aufgeklappt, siehe @container weiter unten für die genaue Schwelle): .page zieht sich
   per negativem margin-top unter den transparenten schwebenden Header, sodass die Karte randlos
   und vollflächig von der oberen Gerätekante (unter Statusbar/Dynamic Island) bis zum unteren
   Bildschirmrand reicht.
   Zusammen mit der Klasse .map-view-active auf html/body (siehe onMounted) wird jegliches
   Überhang-Scrollen des Viewports verhindert. */
.page {
  position: relative;
  margin-top: calc(-1 * var(--app-header-height, 56px));
  height: 100dvh;
  overflow: hidden;
  padding: 0;
}

.layout {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.map-col {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: auto;
}

/* Bottom-Sheet mit drei Rasteinungen (siehe sheetState/onSheetDragStart im Script) – Höhe kommt
   entweder aus der Zustands-Klasse (collapsed/full, Default = "partial" ohne eigene Klasse) oder,
   während eines aktiven Ziehens, wird sie vom Script direkt aufs Element geschrieben (siehe
   applySheetHeight() im Script) statt über eine reaktive :style-Bindung, um jeden Vue-Render-Tick
   zu sparen. .dragging schaltet die Transition ab, damit das Ziehen nicht hinterherhinkt.
   BEWUSST height statt transform: translateY() (naheliegender für GPU-beschleunigtes Compositing,
   ohne Reflow/Repaint bei jedem Frame) – ein eigener Versuch damit zeigte ein nicht sauber
   eingrenzbares Race mit TripMap.vue's ResizeObserver/invalidateSize() (siehe dortiger Kommentar):
   ein transform auf .spots-col ließ die Karte (.map-col, Geschwisterelement) nach einem
   Fokus-Klick auf einen Spot in ca. 4 von 5 Läufen an eine falsche Position springen (per E2E
   reproduziert, Ursache trotz Analyse nicht abschließend gefunden). Nicht erneut versuchen, ohne
   dieses Race zuerst zuverlässig zu verstehen/zu beheben. */
.spots-col {
  /* Macht .spots-col selbst zum Container für die Kompakt-Zeile-Entscheidung in SpotCard.vue/
     .cards weiter unten (@container-Abfragen dort) – reagiert dadurch auf
     die TATSÄCHLICHE Breite dieser Spalte (auch beim Verschieben des Anfassers auf Desktop),
     unabhängig von Viewport/anderer-Container-Breite. Gilt unverändert in beiden Modi (Mobil
     fixed/Desktop sticky), da hier nicht zurückgesetzt. Benannt (statt anonym) und die Kompakt-
     Zeilen-Abfragen unten explizit "spots-col" statt unbenannt: sonst würden auch die unbenannten
     @container(min-width:720px)-Abfragen für Nachfahren wie .sheet-handle/.spots-col-body
     versehentlich gegen DIESEN (statt gegen .app-main, App.vue) ausgewertet – .spots-col ist selbst
     nie ≥720px breit, das "Desktop"-Zurücksetzen von .sheet-handle etc. hätte dadurch nie gegriffen. */
  container: spots-col / inline-size;
  /* Deckelt alle drei Höhen-Zustände (unten) auf .page's eigene Höhe (siehe .page weiter oben, die
     rechnet Kopfzeile/NavBar bereits ein) – reine vh-Werte kennen weder NavBar- noch Titel-Höhe und
     wuchsen sonst über den verfügbaren Platz hinaus. 100% statt einer eigenen vh-Rechnung, da
     .spots-col jetzt position:absolute innerhalb des bereits korrekt bemessenen .page ist (dessen
     Höhe ist die "Containing Block"-Höhe, gegen die % hier auflöst) – einfacher und automatisch
     konsistent mit .page, statt dieselbe Formel ein zweites Mal zu duplizieren. Reine CSS-Rechnung,
     nicht die JS-Berechnung in sheetHeightPx() – die greift nur während eines aktiven Ziehens/beim
     Einrasten, nicht für diesen ruhenden Grundzustand. */
  --sheet-max-height: calc(100% - var(--app-header-height, 56px) - 8px);
  position: absolute;
  /* Links und rechts auf var(--space-4) ausgerichtet, exakt identisch mit der mobilen NavBar-Pille
     (die ebenfalls max-width: calc(100vw - var(--space-4) * 2) und margin-inline: auto hat), sodass
     Drawer und NavBar auf denselben Fluchtlinien liegen. */
  left: var(--space-4);
  right: var(--space-4);
  /* Wie bei Apple: solange nicht ganz hochgezogen (collapsed/partial, .full überschreibt unten auf
     0) schwebt das Sheet mit einem sauberen Abstand (--space-3) über der unteren NavBar
     (--navbar-bottom-offset). Dadurch kleben Drawer und NavBar nicht aneinander und der Drawer wird
     nie von ihr verdeckt (#303). */
  bottom: calc(var(--space-3) + var(--navbar-bottom-offset, 0px));
  z-index: 5;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  /* Feiner Rand wie bei Apples schwebendem Sheet (siehe PR-Referenzscreenshot) - ohne ihn verlor
     sich die Kante der Karte gegen eine bunte Karte im Hintergrund, der box-shadow allein reicht
     dafür nicht. Gleiches --color-border-Muster wie z. B. Drawer.vue's/.picker-menu's Buttons. */
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  height: min(46vh, var(--sheet-max-height));
  transition:
    height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    bottom 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    left 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    right 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
  /* Bekannter iOS-Safari-Bug: ein fixed/absolute positioniertes Element mit border-radius+box-shadow
     malt seinen Hintergrund beim allerersten Paint mitunter nicht korrekt (bleibt transparent, bis
     irgendeine Interaktion – z. B. das Ziehen am Griff – einen Repaint erzwingt). Der Fix (eigene
     Compositing-Ebene erzwingen) sitzt trotzdem weiterhin auf einem eigenen ::before statt direkt
     auf .spots-col, obwohl .spots-col jetzt selbst ein transform trägt - .spots-col::before hält so
     unabhängig von .spots-col selbst seine eigene Compositing-Ebene, ohne dass diese beiden
     transform-Werte sich gegenseitig überschreiben könnten. */
}

.spots-col::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: inherit;
  transform: translateZ(0);
}

/* Wie bei Apples eingeklapptem Suchleisten-Zustand: eine reine Pille (nur die Anfasser-Zeile ist
   groß genug, um sichtbar zu bleiben) statt einer 96px hohen Karte, in die vorher noch eine Zeile
   Inhalt hineinragte. .spots-col-body braucht dafür kein eigenes display:none - flex:1 auf einem
   Elternelement, dessen Höhe exakt auf die Anfasser-Zeile passt, lässt ihm ohnehin keinen Platz
   mehr; schrumpft dadurch während der height-Transition weich zusammen statt beim Klassenwechsel
   hart zu verschwinden. 999px + corner-shape:round (nicht squircle wie die Basis-Karte) - Pillen
   bekommen laut DESIGN.md, Abschnitt "Eckenrundung", immer einen echten Kreisbogen. 64px ergibt
   sich aus der Anfasser-Zeile selbst (~33px Inhalt + 16px Polster oben + 16px unten, siehe
   .sheet-handle-row unten) - kein willkürlicher Wert. */
.spots-col.collapsed {
  height: min(64px, var(--sheet-max-height));
  border-radius: 999px;
  corner-shape: round;
}

/* Ganz hochgezogen: wie bei Apple erst jetzt randlos volle Breite UND -höhe (kein Abstand mehr nach
   unten, sonst wie collapsed/partial), nur noch oben gerundete Ecken (statt der rundum gerundeten
   "schwebenden Karte" oben) - Übergang läuft über dieselben bottom/left/right/border-radius-
   Transitions wie an .spots-col selbst. Reicht unten bis var(--navbar-bottom-offset, 0px) hoch,
   damit die Navbar nicht überfahren wird. */
.spots-col.full {
  left: 0;
  right: 0;
  bottom: 0;
  border-left: 0;
  border-right: 0;
  border-radius: var(--radius-lg-squircle) var(--radius-lg-squircle) 0 0;
  corner-shape: squircle;
  height: min(100vh, var(--sheet-max-height));
  height: min(100dvh, var(--sheet-max-height));

  .spots-col-body {
    padding-bottom: var(--navbar-bottom-offset, 0px);
  }
}

.spots-col.dragging {
  transition: none;
}

.sheet-handle-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  /* Seitliches/oberes Polster deutlich großzügiger als die alten 8px/4px - bei der jetzt sichtbar
     gerundeten Sheet-Ecke (--radius-lg-squircle, siehe .spots-col oben) saßen die Stufen-Buttons
     sonst fast in der Rundung selbst statt sichtbar davor (genau der von Apples "X"-Button
     abweichende Effekt aus dem PR-Review-Screenshot). Oben/seitlich identisch (var(--space-3)
     statt oben --space-3 und seitlich --space-4) - selbes Card-Innenabstand-Maß wie SpotCard.vue/
     ExcursionCard.vue u. a. (siehe DESIGN.md, Abschnitt "Abstände") statt
     eines eigens erfundenen asymmetrischen Werts. */
  padding: var(--space-3) var(--space-3) 0;
  /* Gilt für die ganze Zeile (nicht nur .sheet-handle): ein Zug, der knapp neben dem eigentlichen
     Anfasser beginnt (z. B. noch über den Stufen-Buttons), soll trotzdem nicht als Seiten-Scroll/
     Pull-to-Refresh interpretiert werden. */
  touch-action: none;
}

/* Im collapsed-Zustand ist die Anfasser-Zeile der komplette sichtbare Inhalt der Pille (siehe
   .spots-col.collapsed oben) - volle Höhe (100%), zentriertes Flex-Layout und seitliches Polster
   (var(--space-3) = 16px), damit die runden 30px-Stufenbuttons (mit 1px Rand) nach oben, unten und
   zu den Seiten exakt denselben 17px-Abstand zur Außenkante der 64px-Pille (Radius 32px) haben und
   sich perfekt konzentrisch in die Kappen schmiegen. */
.spots-col.collapsed .sheet-handle-row {
  height: 100%;
  box-sizing: border-box;
  align-items: center;
  padding: 0 var(--space-3);
}

.spots-col.collapsed .sheet-handle {
  padding: 0;
  margin: 0;
  justify-content: center;
}

.sheet-handle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  /* Größerer Anfassbereich für Touch (vorher 4px/6px): der eigentliche Treffer-Bereich reichte auf
     mobile oft nicht, ein Runterziehen landete leicht knapp daneben. */
  padding: 10px 0 14px;
  margin: -6px 0 -8px;
  cursor: grab;
  touch-action: none;
}

/* Alternative zum Ziehen am Anfasser (weniger präzise auf kleinen Touch-Zielen): schaltet jeweils
   einen Rasterschritt weiter, disabled am jeweiligen Ende (siehe canExpandSheet/canCollapseSheet
   im Script). */
.sheet-step-btn {
  flex-shrink: 0;
  position: relative;
}

.sheet-step-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
}

.sheet-grip {
  width: 40px;
  height: 4px;
  border-radius: 3px;
  background: var(--color-border);
}

.sheet-summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.spots-col-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  /* Verhindert, dass der Browser die Scrollposition beim Auf-/Zuklappen einer Spot-Karte (SpotCard.vue,
     ändert ihre Höhe drastisch) eigenmächtig "korrigiert" (CSS Scroll Anchoring, standardmäßig an) -
     kollidiert hier mit der View-Transition (#90, siehe animateSpotExpand() im Script): während die
     transitionierende Karte kurzzeitig aus dem normalen Layout genommen wird (view-transition-name),
     kann der Browser den falschen Anker wählen und springt sichtbar zu einer völlig anderen Stelle in
     der Liste (#140 - "Details verschwinden", auf Safari/iOS deutlich ausgeprägter als auf Chrome). */
  overflow-anchor: none;
  padding: 0 var(--space-3) var(--space-3);
  /* Live gemessene Höhe der sticky .category-nav-Leiste (Icon+Label-Zeile plus Padding/Trennlinie,
     siehe dortiges CSS), per ResizeObserver im Script (setCategoryNavRef -> categoryNavHeight) als
     Inline-Style-Var auf dieses Element gebunden - der 44px-Wert hier ist nur ein Fallback für den
     Moment vor der ersten Messung (z. B. der allererste Sprung direkt nach dem Mounten). War früher
     ein starrer, ungemessener Schätzwert; wich dieser von der tatsächlich gerenderten Höhe ab, landete
     scrollToCategory() nicht weit genug gescrollt (#101). Verwendet von .category-heading/
     .tour-group-card/.spot-card (scroll-margin-top) unten sowie identisch im Script
     (rebuildCategorySectionObserver()s rootMargin – muss mit diesem Wert übereinstimmen, damit "aktiv"
     und "per Klick angesprungen" an derselben Stelle greifen). */
  --category-nav-clearance: 44px;
}

/* Wie bei Apple Maps: nur im "voll"-Zustand ist die Liste selbst scrollbar. In "angeschnitten"/
   eingeklappt übernimmt stattdessen ein Zug irgendwo auf der Liste das Verschieben der ganzen
   Schublade (siehe onSheetBodyPointerDown() im Script) statt sie zu scrollen. touch-action:none
   verhindert, dass der Browser hier von sich aus zu scrollen anfängt, bevor unser eigener
   Pointer-Handler die Zugbewegung übernehmen kann. */
.spots-col.collapsed .spots-col-body,
.spots-col.partial .spots-col-body {
  overflow-y: hidden;
  touch-action: none;
}

/* Leer (kein Fokus aktiv bzw. Desktop, siehe TripMap.vue), wenn nichts hineingeteleportet wurde –
   dann soll der Anker keinen Platz beanspruchen. */
.map-focus-dock:empty {
  display: none;
}

.map-focus-dock:not(:empty) {
  padding-top: var(--space-2);
  margin-bottom: var(--space-3);
}

/* Nebeneinander statt untereinander, sobald genug Breite verfügbar ist – schmalere Spots-Liste
   links, große Karte rechts (grob an Google Maps orientiert: Liste/Suche links, Karte füllt den
   Rest). Container-Query statt @media, da sich die verfügbare Breite durchs Auf-/Zuklappen der
   Schubladen ändert, ohne dass sich das Browserfenster ändert (der Container ist .app-main in
   App.vue, nicht diese Seite selbst). Zusätzlich wird hier auch .page breiter gemacht – dessen
   normaler max-width:960px-Deckel (style.css, für die einspaltige Lesbarkeit auf allen anderen
   Seiten gedacht) würde die zwei Spalten sonst weiterhin auf denselben schmalen Streifen
   zusammenquetschen, obwohl links/rechts noch reichlich Platz frei wäre. */
/* Anfasser zwischen Spots-Liste und Karte: nur auf dem Desktop-Grid sichtbar (mobil stapeln sich
   die Spalten normal untereinander, ein horizontaler Anfasser ergäbe dort keinen Sinn). Eigene
   Grid-Spalte statt eines absolut positionierten Elements im Gap (wie ursprünglich bei Drawer.vue's
   Schubladen-Anfasser) – vermeidet dieselbe Falle wie dort: .spots-col/.map-col sind overflow-y:
   auto, was overflow-x laut CSS-Spec implizit auf auto setzt und ein überlappendes Element clippen
   würde. */
.col-resize-handle {
  display: none;
}

/* Zurück zu @container(app-main): jetzt, wo Karte+Sheet innerhalb von .page bleiben
   (position:absolute statt fixed, siehe .page/.map-col/.spots-col weiter oben), ist ein knappes
   .app-main (z. B. durch beide gleichzeitig geöffneten Schubladen) kein Problem mehr – die Karte
   quetscht sich dann einfach mit in den (jetzt wieder passend bemessenen) mobilen Vollbild-Modus,
   statt von den Schubladen überdeckt zu werden. Genau dieses Verhalten ist inzwischen auch
   gewünscht: bei sehr wenig Platz (unabhängig davon, ob das an einem schmalen Gerät oder an
   geöffneten Schubladen auf Desktop liegt) macht ein enges 2-Spalten-Grid weniger Sinn als eine
   große Karte mit Sheet darüber. Die feinere "wie schmal darf .spots-col selbst werden"-Frage
   (Kompakt-Zeile, Ein-Spalten-Raster) bleibt weiterhin ein separates @container(spots-col)-Query. */
/* Desktop: Die Karte (.map-col) ist auf Desktop stets vollflächig über die gesamte
   Bildschirmbreite (position:fixed von left:0 bis right:0), sodass hinter der schwebenden
   Kalender-Schublade nie ein grauer Hintergrund entsteht, sondern die Karte durchgängig sichtbar
   bleibt – unabhängig davon, wie breit der Kalender ausgeklappt ist.
   Die Spots-Spalte (.spots-col) ist auf Desktop stets permanent sichtbar und schwebt links im
   Hauptbereich (.app-main), ausgerichtet an derselben Ober- und Unterkante wie die Kalender-Schublade
    (top: var(--space-4), bottom: calc(var(--navbar-bottom-offset) + var(--space-4))).
    Das mobile Bottom-Sheet (inkl. Anfasser und Ein-/Ausklappstufen) greift auf Mobilgeräten (<1024px)
    sowie auf Desktop-Geräten (≥1024px) bei schmalem .app-main Container (<720px, z. B. bei geöffnetem Kalender). */
@media (min-width: 1024px) {
  /* .page bleibt wie auf Mobil absolute und vollbild, Karte füllt den Bereich aus */
  .page {
    max-width: none;
    margin: 0;
    padding: 0;
    position: relative;
    /* Desktop: Wieder normale Höhe, da margin-top=0 */
    height: calc(100vh - var(--app-header-height, 56px) - var(--navbar-offset, 0px));
    height: calc(100dvh - var(--app-header-height, 56px) - var(--navbar-offset, 0px));
  }

  /* Auf Desktop ist der Titel visuell ausgeblendet, bleibt aber für Screenreader lesbar */
  .page-title {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .layout {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .map-col {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1;
    pointer-events: auto;
  }

  /* Volle Höhe im Sheet-Fallback auf Desktop unterhalb des Headers */
  .spots-col {
    --sheet-max-height: calc(100% - 8px);
  }

  @container app-main (min-width: 720px) {
    .spots-col,
    .spots-col.collapsed,
    .spots-col.partial,
    .spots-col.full {
      position: absolute;
      left: var(--space-4);
      right: auto;
      top: var(--space-4);
      bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-4));
      height: auto;
      max-height: none;
      z-index: 5;
      background: var(--color-surface);
      border-radius: var(--radius-md-squircle);
      corner-shape: squircle;
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-md);
      width: var(--spots-col-width);
      /* Hält mindestens 380px Freiraum am rechten Rand von .app-main frei,
         damit nicht nur die Floating- und Zoom-Buttons Platz haben, sondern auch der
         Day-Strip unten rechts breit genug bleiben kann. */
      max-width: calc(100% - var(--space-4) - 380px);
      min-width: 280px;
      pointer-events: auto;

      display: flex;
      flex-direction: column;
      overflow: hidden;

      /* Override mobile transforms and bottom offsets */
      transform: none;
      transition: none;
    }

    /* .spots-col ist auf Desktop undurchsichtig, keine speziellen Hintergrundanpassungen nötig. */
    .spots-col .category-nav-wrap {
      background: var(--color-surface);
      --category-nav-bg: var(--color-surface);
    }

    .sheet-handle-row {
      display: none;
    }

    .spots-col-body,
    .spots-col.collapsed .spots-col-body,
    .spots-col.partial .spots-col-body,
    .spots-col.full .spots-col-body {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: var(--space-3);
      touch-action: auto;
    }

    .col-resize-handle {
      display: flex;
      position: absolute;
      left: calc(
        var(--space-4) +
          max(280px, min(var(--spots-col-width), calc(100% - var(--space-4) - 380px))) +
          (var(--space-4) - var(--drawer-handle-gap, 12px)) / 2
      );
      top: var(--space-4);
      bottom: calc(var(--navbar-bottom-offset, 0px) + var(--space-4));
      height: auto;
      z-index: 10;
      pointer-events: auto;
    }
  }
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.subheader {
  margin-bottom: var(--space-3);
  display: flex;
  justify-content: flex-end;
}

.header h2 {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  min-width: 0;
}

.header h2 :deep(.animated-text) {
  flex-shrink: 0;
}

/* Feste/gleiche Breite für den "Spots"/"Touren"-Titel, damit der Umschalter beim Wechsel
   nicht hin und her springt, kombiniert mit einer vertikalen Swipe-Animation (#220). */

/* Etwas mehr Abstand als das straffe 4px-gap der Überschrift selbst (dort passend für Text+Info-
   Icon) - der Umschalter ist ein eigenständiges Steuerungselement, keine Ergänzung des Titels. */
.header h2 .segmented-toggle {
  margin-left: var(--space-2);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.add-button {
  gap: var(--space-1);
  white-space: nowrap;
}

.add-button__label {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

/* Gleicher Rec-Ton wie TrackRecordingIndicator.vue's .recording-pill, damit "läuft gerade" app-weit
   dieselbe Farbe trägt. */
.header-actions button.recording {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}

.header-actions button.recording:hover {
  background: color-mix(in srgb, var(--color-danger) 85%, black);
  border-color: color-mix(in srgb, var(--color-danger) 85%, black);
}

/* Auf schmalen Schubladen-Breiten (<= 600px): zweizeiliger Header – oben Titel links & SegmentedToggle rechts,
   darunter beide Aktions-Buttons gleichmäßig aufgeteilt über die volle Zeilenbreite mit erhaltenem Label (#312). */
@container spots-col (max-width: 600px) {
  .header h2 {
    width: 100%;
  }

  .header h2 .segmented-toggle {
    margin-left: auto;
  }

  .header-actions {
    width: 100%;
  }

  .add-button {
    width: 100%;
    justify-content: center;
    min-width: 0;
  }
}

/* Auf mobilen Viewports / schmalem Drawer (<= 480px): Der visuelle Titel ("Spots"/"Touren"/"Tracks")
   wird ausgeblendet (per sr-only für Screenreader/Barrierefreiheit erhalten), da der Umschalter
   bereits anzeigt, welcher Modus aktiv ist. Dadurch haben die Labels des SegmentedToggle ("Spots",
   "Touren", "Tracks") voll ausgeschrieben Platz und müssen nicht abgeschnitten oder gekürzt werden. */
@container spots-col (max-width: 480px) {
  .header h2 {
    gap: var(--space-2);
    min-width: 0;
  }

  .header h2 :deep(.animated-text) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .header h2 .segmented-toggle {
    order: 1;
    flex: 1;
    min-width: 0;
    margin-left: 0;
  }

  .header h2 .info-dropdown {
    order: 2;
    flex-shrink: 0;
  }
}

/* Auf extrem schmalem Drawer (<= 320px) kompaktere Polsterung & kleinere Schrift, damit
   Titel, Toggle und Aktionsbutton selbst bei 280px ohne Umbruch oder Abschneiden Platz haben. */
@container spots-col (max-width: 320px) {
  .header h2 {
    font-size: 1.15rem;
    gap: 2px;
  }

  .header h2 .segmented-toggle {
    padding: 2px;
    gap: 1px;
  }

  .header h2 .segmented-toggle :deep(.segmented-option) {
    padding: 4px 6px;
    font-size: 0.78rem;
    gap: 3px;
    min-width: 0;
  }

  .add-button {
    padding: 6px 6px;
    gap: 3px;
    font-size: 0.8125rem;
  }
}

.subheader {
  display: flex;
  flex-direction: column;
}

.active-recording-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 12px;
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, var(--color-border));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-danger);
  font-size: 0.8125rem;
  font-weight: 500;
  margin-top: var(--space-2);
}

.recording-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-danger);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-danger) 70%, transparent);
  animation: recording-pulse 1.5s infinite;
}

@keyframes recording-pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-danger) 70%, transparent);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-danger) 0%, transparent);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-danger) 0%, transparent);
  }
}

.group {
  margin-bottom: var(--space-4);
  min-width: 0;
}

.category-group.is-tour-group {
  margin-left: calc(var(--space-3) * -1);
  margin-right: calc(var(--space-3) * -1);
  margin-bottom: 0;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.25s ease;
}

.category-group.is-tour-group:first-of-type {
  border-top: 1px solid var(--color-border);
}

.category-nav-wrap ~ .category-group.is-tour-group:first-of-type {
  border-top: none;
}

.category-group.is-tour-group.is-expanded {
  background: var(--tour-theme-tint);
}

.category-group.is-tour-group .empty {
  padding: var(--space-2) var(--space-3) var(--space-4);
  margin: 0;
}

.category-group.is-tour-group + .category-group:not(.is-tour-group) {
  margin-top: var(--space-4);
}

.spots-col-body.has-tour-groups .category-nav-wrap {
  margin-bottom: 0;
}

.group h3 {
  font-size: 1rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-3);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  align-items: start;
}

.tour-station-accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
}

.tour-station-accordion.is-expanded {
  grid-template-rows: 1fr;
}

.tour-station-accordion-inner {
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  transition: overflow 0s 0s;
  box-sizing: border-box;
  max-width: 100%;
}

.tour-station-accordion.is-expanded .tour-station-accordion-inner {
  overflow: visible;
  transition: overflow 0s 0.4s allow-discrete;
}

.tour-station-accordion :deep(.staggered-spot) {
  transition:
    opacity 0.35s ease,
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  transform: translateY(-24px) scale(0.95);
  transition-delay: calc((var(--stagger-total) - var(--stagger-idx) - 1) * 25ms);
}

.tour-station-accordion.is-expanded :deep(.staggered-spot) {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx) * 50ms + 50ms);
}

@media (prefers-reduced-motion: reduce) {
  .spots-col {
    transition: none;
  }
  .category-group.is-tour-group {
    transition: none;
  }
  .recording-pulse-dot {
    animation: none;
  }
  .tour-station-accordion {
    transition: none;
  }
  .tour-station-accordion-inner,
  .tour-station-accordion.is-expanded .tour-station-accordion-inner {
    transition: none;
  }
  .tour-station-accordion :deep(.staggered-spot),
  .tour-station-accordion.is-expanded :deep(.staggered-spot) {
    transition: none;
    transform: none;
    opacity: 1;
  }
}

.empty-state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
}

.empty-state-wrap .empty {
  padding: 0;
}

/* Auf schmalen .spots-col-Breiten (Bottom-Sheet auf Mobil, ODER auf Desktop, wenn der Anfasser sehr
   weit zur Karte hin gezogen wurde) immer eine einzelne Spalte statt auto-fill – bei knapper, aber
   nicht ganz ausreichender Breite für zwei 240px-Spalten schnitt auto-fill die zweite Karte sonst
   am rechten Rand ab, statt sie in eine neue Zeile umbrechen zu lassen. Container-Query statt
   @media (siehe container-type auf .spots-col oben) – reagiert dadurch auf die tatsächliche
   Spalten-Breite, nicht auf die Fenster-/Viewport-Breite. Derselbe Schwellenwert wie in
   SpotCard.vue (muss übereinstimmen, sonst driftet die Kompakt-Zeile dort
   von der Ein-Spalten-Entscheidung hier auseinander). Explizit "spots-col" statt unbenannt, damit
   eindeutig gegen diesen (statt versehentlich gegen .app-main) ausgewertet wird. */
@container spots-col (max-width: 480px) {
  .cards {
    /* minmax(0, 1fr) statt nacktem 1fr (= minmax(auto, 1fr)): eine bloße 1fr-Spalte bleibt trotz
       Ein-Spalten-Rasters implizit mindestens so breit wie ihr Inhalt (z. B. ein langer, per
       white-space:nowrap+ellipsis eigentlich kürzbarer Spot-Titel in SpotCard.vue), was auf schmalen
       Mobilbreiten eine horizontale Scrollleiste der ganzen Liste erzeugte statt den Titel zu
       kürzen. Die explizite 0-Untergrenze erlaubt der Spalte, echt auf die verfügbare Breite zu
       schrumpfen. */
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Eigene, dezente "Werkzeugleisten"-Box (heller/kleinerer Radius als .card, damit sie sich klar den
   eigentlichen Inhalts-Cards darunter unterordnet) statt frei im Seitenfluss stehender Buttons -
   fasst Gruppieren/Sortieren/Filtern als ein zusammengehöriges, klar abgegrenztes Werkzeug
   optisch zusammen (Nutzer-Feedback: wirkte vorher "gebastelt"). */
/* --color-primary-tint (leichte Markenfarbe) statt des neutralen --color-hover: dieser Bereich ist
   ein Steuerungs-/Werkzeug-Element (Gruppieren/Sortieren/Filtern), keine Dateninhalt-Fläche - siehe
   DESIGN.md, Abschnitt "Farben" für die Unterscheidung Steuerungselement (leicht eingefärbt) vs.
   Karte mit Dateninhalt (weiß/--color-surface, z. B. SpotCard.vue). */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 1;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--color-primary-tint);
  border: 1px solid var(--color-primary);
  color: var(--color-primary-dark);
  border-radius: var(--radius-pill);
  padding: 3px var(--space-1) 3px var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.filter-chip button {
  background: none;
  border: none;
  padding: var(--space-1);
  min-width: 24px;
  min-height: 24px;
  color: inherit;
  cursor: pointer;
  font-size: var(--font-size-sm);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-heading {
  display: flex;
  align-items: center;
  gap: 6px;
  /* scrollToCategory() landet sonst mit der Überschrift teilweise unter der sticky Kategorie-Nav.
     Bewusst OHNE --app-header-height/--navbar-offset (anders als .spots-col/.map-col weiter oben
     und Drawer.vue, wo tatsächlich das Fenster/eine eigene Overlay-Ebene relativ zur AppHeader
     scrollt): .category-heading scrollt dagegen innerhalb von .spots-col bzw. .spots-col-body, die
     schon selbst unterhalb von AppHeader/NavBar sitzen (Desktop per position:sticky mit
     entsprechendem top; Mobil als eigenständig positioniertes Sheet ohnehin unabhängig von der
     AppHeader) - ein zusätzliches Abziehen von deren Höhe landete den Sprung dadurch systematisch zu
     weit unten (per E2E-Test verifiziert, ursprünglich fälschlich von .spots-col/Drawer.vue
     übernommen, siehe Git-Historie #101). --category-nav-clearance (siehe .spots-col-body oben)
     reserviert weiterhin Platz für die sticky Kategorie-/Touren-Nav-Leiste selbst. */
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance));
}

/* Tour-Gruppen-Überschrift bei Touren-Gruppierung (ExcursionCard statt reinem Text, siehe Template)
   – gleicher scroll-margin-top wie .category-heading oben (dieselbe scrollToCategory()-Zielgruppe),
   plus Abstand zur darunterliegenden Spot-Card-Grid, die .category-heading dort bereits über ihren
   eigenen margin-bottom bekommt (h3-Element-Default reicht bei einer Card nicht). */
.tour-group-card {
  scroll-margin-top: calc(var(--space-2) + var(--category-nav-clearance));
  margin-bottom: 0;
}

.tour-partial-filter-hint {
  margin: var(--space-3) auto var(--space-2);
  padding: var(--space-2) var(--space-4);
  max-width: 540px;
}

.filter-reset-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
  display: inline;
}

.filter-reset-link:hover {
  color: var(--color-primary-dark);
}
</style>

<style>
::view-transition-group(root) {
  animation-duration: 0s;
}

::view-transition-group(expanding-spot-card) {
  animation-duration: 0.25s;
}

::view-transition-old(expanding-spot-card),
::view-transition-new(expanding-spot-card) {
  animation-duration: 0.25s;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(expanding-spot-card),
  ::view-transition-old(expanding-spot-card),
  ::view-transition-new(expanding-spot-card) {
    animation-duration: 0s;
  }
}
</style>

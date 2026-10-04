<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import type { Excursion, ExcursionComment, ExcursionLike, Spot, User } from '../api/types';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { TRAVEL_ROLE_OPTIONS, TRAVEL_ROLE_META } from '../utils/travelRole';
import { travelTypeIcon } from '../utils/travelTypeIcon';
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
import { formatDate, formatDateTime } from '../utils/dateFormat';
import { useIsDesktop } from '../composables/useIsDesktop';
import { hashHighlightId } from '../utils/hashHighlight';
import SpotCard from '../components/SpotCard.vue';
import ExcursionCard from '../components/ExcursionCard.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';
import SearchFilterBar from '../components/SearchFilterBar.vue';
import SpotOrderPicker from '../components/SpotOrderPicker.vue';
import TripMap from '../components/TripMap.vue';
import Modal from '../components/Modal.vue';
import FormField from '../components/FormField.vue';
import TourAssignPicker from '../components/TourAssignPicker.vue';
import TrackRecordingWarningModal from '../components/TrackRecordingWarningModal.vue';
import TrackShareWarningModal from '../components/TrackShareWarningModal.vue';
import TourAssignDropdown from '../components/TourAssignDropdown.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import ResizeHandle from '../components/ResizeHandle.vue';
import LocationPicker from '../components/LocationPicker.vue';
import CoverImagePicker from '../components/CoverImagePicker.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import FileAttachments from '../components/FileAttachments.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import LegTransportModal from '../components/LegTransportModal.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import AppIcon from '../components/AppIcon.vue';
import AnimatedText from '../components/AnimatedText.vue';
import Button from '../components/primitives/Button.vue';
import ButtonGroup from '../components/primitives/ButtonGroup.vue';
import CollapsibleFieldset from '../components/primitives/CollapsibleFieldset.vue';
import IconButton from '../components/primitives/IconButton.vue';
import PickerMenu from '../components/primitives/PickerMenu.vue';
import Select from '../components/primitives/Select.vue';
import TabBar from '../components/TabBar.vue';
import ItemVisibilitySettings from '../components/ItemVisibilitySettings.vue';
import InfoPopover from '../components/primitives/InfoPopover.vue';
import Input from '../components/primitives/Input.vue';

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
import { useTourForm } from '../composables/useTourForm';
import { useSpotForm, SPOT_SIDE_OPTIONS } from '../composables/useSpotForm';

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
  getLegDurationParts,
  getLegTooltip,
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
  onShareTrackToTour: (track) => {
    if (!tourForm.activeExcursionForm.value.track_ids.includes(track.id)) {
      tourForm.activeExcursionForm.value.track_ids.push(track.id);
      tracks.tracksToShareOnSave.value.add(track.id);
    }
  },
});
const {
  trackTitle,
  trackDurationLabel,
  trackAuthorAvatar,
  trackAuthorName,
  trackAuthorTitle,
  onTrackShowOnMap,
  trackEditTabs,
  activeTrackEditTab,
  editingTrack,
  editTrackTitle,
  editTrackStartedAt,
  editTrackVisibility,
  editTrackExcursionId,
  showTrackShareWarningModal,
  shareWarningTrackTitle,
  shareWarningTourTitle,
  trackTourAssignments,
  editTrackExcursionTitle,
  onToggleTrackTour,
  onCreateTourFromTrack,
  getTourForTrack,
  isEditTrackTitleModified,
  isEditTrackStartedAtModified,
  isEditTrackVisibilityModified,
  isEditTrackTourModified,
  startEditTrack,
  closeEditTrack,
  submitEditTrack,
  stopEditingTrack,
  deleteEditingTrack,
  onConfirmShareModal,
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

// 7. Tour Form (Add / Edit)
const tourForm = useTourForm({
  users,
  tracksToShareOnSave: tracks.tracksToShareOnSave,
  onTrackPrivateWarning: (trk, title) => {
    tracks.pendingShareTrack.value = trk;
    tracks.shareWarningTrackTitle.value = tracks.trackTitle(trk);
    tracks.shareWarningTourTitle.value = title;
    tracks.showTrackShareWarningModal.value = true;
  },
  excursionForGroupTitle,
});
const {
  showExcursionForm,
  showExcursionTracksSection,
  showEditExcursionTracksSection,
  showExcursionSpotsSection,
  showEditExcursionSpotsSection,
  editingExcursion,
  isExcursionUploadingAttachments,
  activeExcursionForm,
  excursionTitleTouched,
  showExcursionTitleError,
  canSaveExcursion,
  excursionSaveTooltip,
  newExcursionDraft,
  editExcursionDraft,
  isEditTourTitleModified,
  isEditTourDateModified,
  isEditTourNoteModified,
  isEditTourRoleModified,
  isExcursionModalDirty,
  selectableTracksForTour,
  onToggleTourTrack,
  openExcursionForm,
  closeExcursionForm,
  discardNewExcursionDraft,
  addExcursion,
  startEditExcursion,
  submitEditExcursion,
  closeEditExcursionForm,
  discardEditExcursionDraft,
  deleteEditingExcursion,
  toggleExcursionDestination,
  addSpotToExcursion,
  assignSpotToTourTitle,
} = tourForm;

// 8. Spot Form (Add / Edit)
const spotFormComposable = useSpotForm({
  tripId,
  users,
  spotScheduledDates,
});
const {
  showSpotForm,
  spotForm,
  newSpotDraft,
  openSpotForm,
  closeSpotForm,
  discardNewSpotDraft,
  addSpot,
  editingSpot,
  editSpotDraft,
  startEditSpot,
  closeEditSpotForm,
  discardEditSpotDraft,
  submitEditSpot,
  deleteEditingSpot,
  activeSpotForm,
  spotTitleTouched,
  showSpotTitleError,
  canSaveSpot,
  spotSaveTooltip,
  isSpotModalDirty,
  spotManualPin,
  spotLocationError,
  editSpotLocationError,
  isSpotUploadingAttachments,
  isSpotUploadingCoverImage,
  spotPreviewImages,
  spotPreviewImage,
  editSpotPreviewImage,
  spotImageSearchContext,
  resetEditSpotImage,
  spotReferencePoints,
  editSpotReferencePoints,
  spotPickerCenter,
  showSpotScheduleSection,
  editSpotScheduledItems,
  toggleScheduledItemDone,
  removeScheduledItemFromSpot,
  openScheduledItemDetail,
  addSchedulePopoverOpen,
  addScheduleDateVal,
  addScheduleBtnRef,
  addScheduleMenuStyle,
  toggleAddSchedulePopover,
  submitAddSpotToDate,
  allTourTitles,
  removeTourTitle,
  getTourDate,
  isTourTravel,
  onSpotMapsLinkUpdate,
  onSpotLocationSelect,
  spotLocationPickerRef,
  onSpotLocationClear,
  resetEditSpotLocation,
  isEditSpotLocationModified,
  isEditSpotSideModified,
  isEditSpotImageModified,
  isEditSpotNoteModified,
  isEditSpotStartDateModified,
  isEditSpotEndDateModified,
  isEditSpotCheckinModified,
  isEditSpotCheckoutModified,
  isEditSpotContactModified,
  isEditSpotAmountModified,
  isEditSpotPaidByModified,
} = spotFormComposable;

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

          <!-- Touren-Formular: für BEIDE Gruppierungen ("Touren" und "Reise") dasselbe Modal/Modell -
           der aufklappbare Transportmittel-Abschnitt (#176) macht aus einer normalen Tour bei
           Bedarf eine ehemalige Reise-Etappe, siehe Konzept-Entscheidung in Issue #68/#176. -->
          <Modal
            :model-value="showExcursionForm || editingExcursion !== null"
            :title="editingExcursion !== null ? 'Tour bearbeiten' : 'Neue Tour'"
            full-height
            :confirm-close="isExcursionModalDirty"
            :confirm-close-title="
              editingExcursion !== null
                ? 'Ungespeicherte Änderungen verwerfen?'
                : 'Entwurf verwerfen?'
            "
            :confirm-close-message="
              editingExcursion !== null
                ? 'Du hast ungespeicherte Änderungen an dieser Tour vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?'
                : 'Du hast bereits Eingaben für diese Tour gemacht. Möchtest du den Entwurf verwerfen?'
            "
            :confirm-close-confirm-label="
              editingExcursion !== null ? 'Änderungen verwerfen' : 'Entwurf verwerfen'
            "
            @update:model-value="
              (v) =>
                !v && (editingExcursion !== null ? closeEditExcursionForm() : closeExcursionForm())
            "
          >
            <form
              class="edit-form"
              @submit.prevent="editingExcursion !== null ? submitEditExcursion() : addExcursion()"
            >
              <FormField
                icon="title"
                label="Titel"
                required
                :invalid="showExcursionTitleError"
                :modified="isEditTourTitleModified"
                :error="
                  showExcursionTitleError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined
                "
                v-slot="{ id, invalid, modified }"
              >
                <Input
                  :id="id"
                  v-model="activeExcursionForm.title"
                  type="text"
                  placeholder="Titel"
                  required
                  :invalid="invalid"
                  :modified="modified"
                  @blur="excursionTitleTouched = true"
                />
              </FormField>
              <FormField icon="note" label="Notiz" :modified="isEditTourNoteModified">
                <RichTextEditor
                  v-model="activeExcursionForm.note"
                  placeholder="Notiz"
                  compact
                  expandable
                />
              </FormField>
              <FormField
                icon="date"
                label="Datum (sonst „In Planung“)"
                :modified="isEditTourDateModified"
                v-slot="{ modified }"
              >
                <Input v-model="activeExcursionForm.date" type="date" :modified="modified" />
              </FormField>
              <FormField
                icon="tour"
                label="Rolle"
                :modified="isEditTourRoleModified"
                v-slot="{ modified }"
              >
                <Select v-model="activeExcursionForm.role" :modified="modified">
                  <option value="">🎒 Ausflug</option>
                  <option v-for="r in TRAVEL_ROLE_OPTIONS" :key="r" :value="r">
                    {{ TRAVEL_ROLE_META[r].icon }} {{ TRAVEL_ROLE_META[r].label }} ({{
                      TRAVEL_ROLE_META[r].hint
                    }})
                  </option>
                </Select>
              </FormField>
              <p
                v-if="activeExcursionForm.role && activeExcursionForm.spot_ids.length < 2"
                class="hint error"
              >
                <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Für
                Anreise/Abreise/Weiterreise werden mindestens Start- und Zielstation benötigt.
              </p>
              <CollapsibleFieldset
                v-if="spotsStore.spots.length"
                :model-value="
                  editingExcursion !== null
                    ? showEditExcursionSpotsSection
                    : showExcursionSpotsSection
                "
                label="Stationen & Route"
                :count="
                  activeExcursionForm.spot_ids.length
                    ? `(${activeExcursionForm.spot_ids.length} zugeordnet)`
                    : undefined
                "
                :icon="FORM_FIELD_ICONS.location"
                icon-group="formFields"
                @update:model-value="
                  (val) => {
                    if (editingExcursion !== null) {
                      showEditExcursionSpotsSection = val;
                    } else {
                      showExcursionSpotsSection = val;
                    }
                  }
                "
              >
                <SpotOrderPicker
                  v-model="activeExcursionForm.spot_ids"
                  v-model:legs="activeExcursionForm.legs"
                  v-model:destination="activeExcursionForm.destination_spot_id"
                  :spots="spotsStore.spots"
                  :like-count="spotsStore.likeCountFor"
                  :users="users"
                />
              </CollapsibleFieldset>
              <CollapsibleFieldset
                v-if="tracksStore.tracks.length"
                :model-value="
                  editingExcursion !== null
                    ? showEditExcursionTracksSection
                    : showExcursionTracksSection
                "
                label="Aufzeichnungen"
                :count="
                  activeExcursionForm.track_ids.length
                    ? `(${activeExcursionForm.track_ids.length} zugeordnet)`
                    : undefined
                "
                :icon="ACTION_ICONS.recordStart"
                icon-group="actions"
                @update:model-value="
                  (val) => {
                    if (editingExcursion !== null) {
                      showEditExcursionTracksSection = val;
                    } else {
                      showExcursionTracksSection = val;
                    }
                  }
                "
              >
                <div class="excursion-tracks-picker">
                  <p v-if="!selectableTracksForTour.length" class="empty-subtext">
                    Keine verfügbaren Aufzeichnungen für diesen Urlaub vorhanden.
                  </p>
                  <ul v-else class="excursion-tracks-list">
                    <li
                      v-for="trk in selectableTracksForTour"
                      :key="trk.id"
                      class="excursion-track-item"
                      :class="{ 'is-selected': activeExcursionForm.track_ids.includes(trk.id) }"
                    >
                      <label class="excursion-track-label" :for="`tour-track-${trk.id}`">
                        <Checkbox
                          :id="`tour-track-${trk.id}`"
                          :checked="activeExcursionForm.track_ids.includes(trk.id)"
                          @change="onToggleTourTrack(trk)"
                        />
                        <div class="excursion-track-info">
                          <span class="excursion-track-name">{{ trackTitle(trk) }}</span>
                          <span class="excursion-track-meta">
                            <span>{{ formatDateTime(trk.started_at) }}</span>
                            <template v-if="trackDurationLabel(trk)">
                              · <span>{{ trackDurationLabel(trk) }}</span>
                            </template>
                            <span
                              v-if="trk.visibility === 'private'"
                              class="privacy-pill privacy-pill--private"
                              title="Aktuell nur für dich sichtbar"
                            >
                              <AppIcon :icon="ACTION_ICONS.private" :size="11" group="actions" />
                              Privat
                            </span>
                          </span>
                        </div>
                      </label>
                    </li>
                  </ul>
                </div>
              </CollapsibleFieldset>
              <FileAttachments
                v-if="editingExcursion"
                domain="ideas"
                :entity-id="editingExcursion"
                v-model:uploading="isExcursionUploadingAttachments"
              />
              <DraftStatusBar
                :status="
                  editingExcursion !== null
                    ? editExcursionDraft.status.value
                    : newExcursionDraft.status.value
                "
                :restored="
                  editingExcursion !== null
                    ? editExcursionDraft.restored.value
                    : newExcursionDraft.restored.value
                "
                :mode="editingExcursion !== null ? 'edit' : 'create'"
                :can-discard="true"
                @discard="
                  editingExcursion !== null
                    ? discardEditExcursionDraft()
                    : discardNewExcursionDraft()
                "
              />
              <div class="actions-row">
                <Button
                  v-if="editingExcursion !== null"
                  type="button"
                  variant="danger"
                  secondary
                  :icon="ACTION_ICONS.delete"
                  :disabled="isExcursionUploadingAttachments"
                  @click="deleteEditingExcursion"
                >
                  Löschen
                </Button>
                <div class="spacer"></div>
                <Button
                  type="button"
                  variant="secondary"
                  class="btn-cancel"
                  @click="
                    editingExcursion !== null ? closeEditExcursionForm() : closeExcursionForm()
                  "
                >
                  Abbrechen
                </Button>
                <Button type="submit" :disabled="!canSaveExcursion" :title="excursionSaveTooltip">{{
                  editingExcursion !== null ? 'Speichern' : 'Hinzufügen'
                }}</Button>
              </div>
            </form>
          </Modal>

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

          <Modal
            :model-value="showSpotForm || editingSpot !== null"
            :title="editingSpot !== null ? 'Spot bearbeiten' : 'Neuer Spot'"
            full-height
            :confirm-close="isSpotModalDirty"
            :confirm-close-title="
              editingSpot !== null ? 'Ungespeicherte Änderungen verwerfen?' : 'Entwurf verwerfen?'
            "
            :confirm-close-message="
              editingSpot !== null
                ? 'Du hast ungespeicherte Änderungen an diesem Spot vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?'
                : 'Du hast bereits Eingaben für diesen Spot gemacht. Möchtest du den Entwurf verwerfen?'
            "
            :confirm-close-confirm-label="
              editingSpot !== null ? 'Änderungen verwerfen' : 'Entwurf verwerfen'
            "
            @update:model-value="
              (v) => !v && (editingSpot !== null ? closeEditSpotForm() : closeSpotForm())
            "
          >
            <form
              class="edit-form"
              @submit.prevent="editingSpot !== null ? submitEditSpot() : addSpot()"
            >
              <!-- 1. Standort-Bereich (Vollflächige Minikarte mit schwebender Suche & Polaroid-Card) -->
              <div class="spot-location-section">
                <LocationPicker
                  ref="spotLocationPickerRef"
                  v-model="spotManualPin"
                  v-model:title="activeSpotForm.title"
                  v-model:category="activeSpotForm.category"
                  :address="activeSpotForm.address"
                  :maps-link="activeSpotForm.maps_link"
                  :proximity-bias="spotPickerCenter"
                  :center="spotPickerCenter"
                  :reference-points="
                    editingSpot !== null ? editSpotReferencePoints : spotReferencePoints
                  "
                  :title-required="true"
                  :title-invalid="showSpotTitleError"
                  :modified="isEditSpotLocationModified"
                  @update:address="activeSpotForm.address = $event"
                  @update:maps-link="onSpotMapsLinkUpdate"
                  @select="onSpotLocationSelect"
                  @clear="onSpotLocationClear"
                  @reset="resetEditSpotLocation"
                  @blur="spotTitleTouched = true"
                >
                  <template #media>
                    <CoverImagePicker
                      v-model="activeSpotForm.image_url"
                      v-model:uploading="isSpotUploadingCoverImage"
                      variant="polaroid"
                      :preview-image="
                        editingSpot !== null ? editSpotPreviewImage : spotPreviewImage
                      "
                      :placeholder-icon="groupIconDef(activeSpotForm.category)"
                      icon-group="categories"
                      modal-title="Spot-Bild bearbeiten"
                      :modified="isEditSpotImageModified"
                      :initial-value="editingSpot !== null ? (editingSpot.image_url ?? '') : ''"
                      :search-context="spotImageSearchContext"
                      :initial-suggestions="spotPreviewImages"
                      @reset="resetEditSpotImage"
                    />
                  </template>
                </LocationPicker>
                <p v-if="showSpotTitleError" class="hint error">
                  <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
                  Bitte gib einen Titel für den Spot ein.
                </p>
                <p
                  v-if="editingSpot !== null ? editSpotLocationError : spotLocationError"
                  class="hint error"
                >
                  <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Standort
                  konnte auch automatisch nicht ermittelt werden. Bitte tippe auf die Karte, um ihn
                  manuell zu setzen.
                </p>
              </div>
              <div
                class="spot-side-field"
                :class="{ 'is-modified': isEditSpotSideModified }"
                role="group"
                aria-label="Bereich des Standorts"
              >
                <div class="spot-side-header">
                  <span class="spot-side-label">
                    <span>Bereich</span>
                    <span
                      v-if="isEditSpotSideModified"
                      class="modified-dot"
                      title="Geändert"
                      aria-label="Geändert"
                    />
                  </span>
                  <InfoPopover
                    title="Was bedeutet Bereich?"
                    aria-label="Erklärung zum Standort-Bereich"
                    :menu-width="280"
                  >
                    <p>
                      <strong>Urlaubsort:</strong> z. B. Ausflugsziele, Restaurants oder Unterkünfte
                      am Reiseziel.
                    </p>
                    <p>
                      <strong>Heimat-Seite:</strong> z. B. der heimische Flughafen/Bahnhof/Zuhause
                      für Reise-Etappen.
                    </p>
                    <p class="popover-tip">
                      🗺️ Wird für das Auswählen des passenden Kartenausschnitts verwendet.
                    </p>
                  </InfoPopover>
                </div>
                <SegmentedToggle
                  id="spotFormSideToggle"
                  class="spot-side-toggle"
                  :model-value="activeSpotForm.is_home ? 'home' : 'vacation'"
                  :options="SPOT_SIDE_OPTIONS"
                  @update:model-value="(val) => (activeSpotForm.is_home = val === 'home')"
                />
              </div>
              <template v-if="activeSpotForm.category === 'Unterkunft'">
                <div class="row">
                  <FormField
                    icon="date"
                    label="Check-in-Datum"
                    :modified="isEditSpotStartDateModified"
                    v-slot="{ modified }"
                  >
                    <Input v-model="activeSpotForm.start_date" type="date" :modified="modified" />
                  </FormField>
                  <FormField
                    icon="date"
                    label="Check-out-Datum"
                    :modified="isEditSpotEndDateModified"
                    v-slot="{ modified }"
                  >
                    <Input v-model="activeSpotForm.end_date" type="date" :modified="modified" />
                  </FormField>
                </div>
                <div class="row">
                  <FormField
                    icon="time"
                    label="Check-in-Zeit"
                    :modified="isEditSpotCheckinModified"
                    v-slot="{ modified }"
                  >
                    <Input
                      v-model="activeSpotForm.checkin"
                      type="text"
                      placeholder="Check-in (z. B. 15:00)"
                      :modified="modified"
                    />
                  </FormField>
                  <FormField
                    icon="time"
                    label="Check-out-Zeit"
                    :modified="isEditSpotCheckoutModified"
                    v-slot="{ modified }"
                  >
                    <Input
                      v-model="activeSpotForm.checkout"
                      type="text"
                      placeholder="Check-out (z. B. 11:00)"
                      :modified="modified"
                    />
                  </FormField>
                </div>
                <FormField
                  icon="contact"
                  label="Kontakt"
                  :modified="isEditSpotContactModified"
                  v-slot="{ modified }"
                >
                  <Input
                    v-model="activeSpotForm.contact"
                    type="text"
                    placeholder="Kontakt (Telefon/E-Mail/Text)"
                    :modified="modified"
                  />
                </FormField>
                <div class="row">
                  <FormField
                    icon="amount"
                    label="Kosten"
                    :modified="isEditSpotAmountModified"
                    v-slot="{ modified }"
                  >
                    <Input
                      v-model="activeSpotForm.amount"
                      type="number"
                      step="0.01"
                      placeholder="Kosten (€)"
                      :modified="modified"
                    />
                  </FormField>
                  <FormField
                    v-if="users.length > 1"
                    icon="shared"
                    label="Bezahlt von"
                    :modified="isEditSpotPaidByModified"
                    v-slot="{ modified }"
                  >
                    <Select v-model="activeSpotForm.paid_by_user_id" :modified="modified">
                      <option value="">Bezahlt von –</option>
                      <option v-for="u in users" :key="u.id" :value="String(u.id)">
                        {{ u.avatar }} {{ u.username }}
                      </option>
                    </Select>
                  </FormField>
                </div>
              </template>
              <FormField icon="note" label="Notiz" :modified="isEditSpotNoteModified">
                <RichTextEditor
                  v-model="activeSpotForm.note"
                  placeholder="Notiz"
                  compact
                  expandable
                />
              </FormField>
              <!-- Kombiniertes "Einplanen"-Fieldset: Touren zuordnen + Datum einplanen in einem
                   Bereich, damit klar wird, dass beide Konzepte Alternativen zum selben Zweck sind. -->
              <CollapsibleFieldset
                v-model="showSpotScheduleSection"
                label="Einplanen"
                :icon="FORM_FIELD_ICONS.date"
                icon-group="formFields"
              >
                <template #count>
                  <span
                    v-if="activeSpotForm.tourTitles.length || editSpotScheduledItems.length"
                    class="picker-count"
                  >
                    ({{
                      [
                        activeSpotForm.tourTitles.length
                          ? `${activeSpotForm.tourTitles.length} ${activeSpotForm.tourTitles.length === 1 ? 'Tour' : 'Touren'}`
                          : '',
                        editSpotScheduledItems.length && editingSpot !== null
                          ? `${editSpotScheduledItems.length} ${editSpotScheduledItems.length === 1 ? 'Termin' : 'Termine'}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(', ')
                    }})
                  </span>
                </template>
                <p class="schedule-hint">
                  <AppIcon :icon="ACTION_ICONS.info" :size="12" group="actions" />
                  Ordne den Spot einer Tour zu oder plane ihn direkt für ein Datum ein (ohne Tour).
                </p>

                <!-- Oben: Datum-Hinzufügen-Button (nur im Edit-Modus) & Tour-zuordnen-Combobox -->
                <div class="schedule-controls">
                  <div v-if="editingSpot !== null" class="schedule-actions-row">
                    <button
                      ref="addScheduleBtnRef"
                      type="button"
                      class="add-schedule-btn"
                      title="Zu einem Datum einplanen"
                      @click="toggleAddSchedulePopover($event)"
                    >
                      <AppIcon :icon="ACTION_ICONS.add" :size="13" group="actions" />
                      <span>Datum hinzufügen</span>
                    </button>
                    <Teleport to="body">
                      <template v-if="addSchedulePopoverOpen">
                        <PickerMenu
                          class="add-schedule-popover"
                          :style="addScheduleMenuStyle"
                          @close="addSchedulePopoverOpen = false"
                        >
                          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                          <label
                            style="
                              display: block;
                              font-size: 0.85rem;
                              font-weight: 500;
                              margin-bottom: var(--space-2);
                            "
                          >
                            <span>Datum auswählen:</span>
                            <Input
                              type="date"
                              v-model="addScheduleDateVal"
                              class="field-input"
                              style="
                                width: 100%;
                                margin-top: var(--space-2);
                                margin-bottom: var(--space-3);
                              "
                              @keyup.enter="submitAddSpotToDate"
                            />
                          </label>
                          <ButtonGroup align="end" no-margin>
                            <Button
                              type="button"
                              variant="secondary"
                              small
                              @click="addSchedulePopoverOpen = false"
                            >
                              Abbrechen
                            </Button>
                            <Button
                              type="button"
                              variant="primary"
                              small
                              :disabled="!addScheduleDateVal"
                              @click="submitAddSpotToDate"
                            >
                              Hinzufügen
                            </Button>
                          </ButtonGroup>
                        </PickerMenu>
                      </template>
                    </Teleport>
                  </div>
                  <div v-else class="new-spot-schedule-row">
                    <FormField icon="date" label="Direkt für Datum einplanen">
                      <Input
                        type="date"
                        v-model="spotForm.scheduledDate"
                        placeholder="Datum auswählen"
                      />
                    </FormField>
                  </div>

                  <!-- Tour zuordnen (Combobox, in beiden Modi: Neu + Edit) -->
                  <TourAssignPicker
                    v-model="activeSpotForm.tourTitles"
                    :tour-options="allTourTitles"
                    :category="activeSpotForm.category"
                    :is-home="activeSpotForm.is_home"
                    :hide-chips="true"
                    :hide-hint="true"
                  />
                </div>

                <!-- Danach: Gemeinsame Chips für ausgewählte Touren (orange) & Termine (grau) -->
                <div
                  v-if="
                    activeSpotForm.tourTitles.length ||
                    (editingSpot !== null && editSpotScheduledItems.length)
                  "
                  class="assign-chips"
                >
                  <!-- Tour-Chips (orange) & Reise-Chips (grün) -->
                  <span
                    v-for="title in activeSpotForm.tourTitles"
                    :key="'tour-' + title"
                    class="assign-chip tour-chip"
                    :class="isTourTravel(title) ? 'assign-chip--travel' : 'assign-chip--tour'"
                  >
                    <span class="assign-chip-action">
                      <AppIcon
                        :icon="
                          isTourTravel(title)
                            ? SECTION_ICON_DEFS.travel
                            : SECTION_ICON_DEFS.excursions
                        "
                        :size="12"
                        group="navigation"
                      />
                      <span class="assign-chip-label">
                        {{ title
                        }}<template v-if="getTourDate(title)">
                          &nbsp;·&nbsp;{{ formatDate(getTourDate(title)!) }}</template
                        >
                      </span>
                    </span>
                    <button
                      type="button"
                      class="assign-chip-remove"
                      :aria-label="`Von '${title}' entfernen`"
                      title="Entfernen"
                      @click="removeTourTitle(title)"
                    >
                      <AppIcon :icon="ACTION_ICONS.close" :size="11" group="actions" />
                    </button>
                  </span>

                  <!-- Termin-Chips: grau (--color-calendar-appointment), nur im Edit-Modus -->
                  <template v-if="editingSpot !== null">
                    <span
                      v-for="item in editSpotScheduledItems"
                      :key="'sched-' + item.id"
                      class="assign-chip assign-chip--schedule"
                      :class="{ 'is-done': !!item.done }"
                    >
                      <button
                        type="button"
                        class="assign-chip-done-toggle"
                        :title="item.done ? 'Als nicht besucht markieren' : 'Als besucht markieren'"
                        :aria-label="
                          item.done ? 'Als nicht besucht markieren' : 'Als besucht markieren'
                        "
                        @click.stop="toggleScheduledItemDone(item)"
                      >
                        <AppIcon
                          :icon="item.done ? ACTION_ICONS.done : ACTION_ICONS.notDone"
                          :size="13"
                          group="actions"
                        />
                      </button>
                      <button
                        type="button"
                        class="assign-chip-action"
                        title="Termin im Kalender öffnen"
                        @click="openScheduledItemDetail(item)"
                      >
                        <span class="assign-chip-label">{{ formatDate(item.date) }}</span>
                      </button>
                      <button
                        type="button"
                        class="assign-chip-remove"
                        :aria-label="`Termin am ${formatDate(item.date)} entfernen`"
                        title="Termin entfernen"
                        @click="removeScheduledItemFromSpot(item)"
                      >
                        <AppIcon :icon="ACTION_ICONS.close" :size="11" group="actions" />
                      </button>
                    </span>
                  </template>
                </div>
              </CollapsibleFieldset>
              <FileAttachments
                v-if="editingSpot"
                domain="spots"
                :entity-id="editingSpot.id"
                v-model:uploading="isSpotUploadingAttachments"
              />
              <DraftStatusBar
                :status="
                  editingSpot !== null ? editSpotDraft.status.value : newSpotDraft.status.value
                "
                :restored="
                  editingSpot !== null ? editSpotDraft.restored.value : newSpotDraft.restored.value
                "
                :mode="editingSpot !== null ? 'edit' : 'create'"
                :can-discard="true"
                @discard="editingSpot !== null ? discardEditSpotDraft() : discardNewSpotDraft()"
              />
              <div class="actions-row">
                <Button
                  v-if="editingSpot !== null"
                  type="button"
                  variant="danger"
                  secondary
                  :icon="ACTION_ICONS.delete"
                  :disabled="isSpotUploadingAttachments || isSpotUploadingCoverImage"
                  @click="deleteEditingSpot"
                >
                  Löschen
                </Button>
                <div class="spacer"></div>
                <Button
                  type="button"
                  variant="secondary"
                  class="btn-cancel"
                  @click="editingSpot !== null ? closeEditSpotForm() : closeSpotForm()"
                >
                  Abbrechen
                </Button>
                <Button type="submit" :disabled="!canSaveSpot" :title="spotSaveTooltip">{{
                  editingSpot !== null ? 'Speichern' : 'Hinzufügen'
                }}</Button>
              </div>
            </form>
          </Modal>

          <div
            v-if="spotGroups.length > 1"
            class="category-nav-sentinel"
            :ref="setCategoryNavSentinelRef"
          ></div>
          <div
            class="category-nav-wrap"
            v-if="spotGroups.length > 1"
            :class="{ 'is-stuck': isCategoryNavStuck }"
          >
            <nav
              class="category-nav"
              aria-label="Zu Kategorie springen"
              :ref="setCategoryNavRef"
              @scroll="updateNavArrows"
            >
              <div class="category-nav-track">
                <button
                  v-for="grp in spotGroups"
                  :key="grp.category"
                  type="button"
                  class="category-nav-item"
                  :class="{ active: activeCategory === grp.category }"
                  :aria-current="activeCategory === grp.category ? 'true' : undefined"
                  :ref="(el) => setNavItemRef(grp.category, el)"
                  @click="scrollToCategory(grp.category)"
                >
                  <AppIcon
                    class="category-nav-icon"
                    :icon="grp.iconDef"
                    group="categories"
                    :active="activeCategory === grp.category"
                    :color="groupIconColor(grp)"
                  />
                  <span class="category-nav-label">{{ grp.category }}</span>
                </button>
                <span
                  class="category-nav-underline"
                  :style="{
                    transform: `translateX(${underlineLeft}px)`,
                    width: `${underlineWidth}px`,
                  }"
                  aria-hidden="true"
                ></span>
              </div>
            </nav>
            <!-- Dezente Klick-Flächen statt eines sichtbaren nativen Scrollbalkens (#144, siehe
             .category-nav's scrollbar-width/::-webkit-scrollbar-Reset im CSS) - nur sichtbar, wenn in
             die jeweilige Richtung tatsächlich noch etwas zu scrollen ist (canScrollNavLeft/Right,
             live nachgeführt per @scroll/ResizeObserver/spotGroups-Watcher im Script). -->
            <button
              v-if="canScrollNavLeft"
              type="button"
              class="category-nav-arrow left"
              aria-label="Kategorien nach links scrollen"
              @click="scrollNavBy(-1)"
            >
              <AppIcon :icon="ACTION_ICONS.scrollLeft" :size="16" group="actions" />
            </button>
            <button
              v-if="canScrollNavRight"
              type="button"
              class="category-nav-arrow right"
              aria-label="Kategorien nach rechts scrollen"
              @click="scrollNavBy(1)"
            >
              <AppIcon :icon="ACTION_ICONS.scrollRight" :size="16" group="actions" />
            </button>
          </div>

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
                  <div
                    class="tour-station-wrap"
                    :class="{
                      'is-tour': grp.excursion,
                      'single-col': grp.excursion && getTourCols(grp.excursion.id) === 1,
                    }"
                    :style="{
                      '--tour-theme-color': grp.excursion?.role
                        ? 'var(--color-travel)'
                        : 'var(--color-tour)',
                      '--tour-theme-tint': grp.excursion?.role
                        ? 'var(--color-travel-tint)'
                        : 'var(--color-tour-tint)',
                    }"
                    :ref="(el) => grp.excursion && setTourWrapRef(grp.excursion.id, el)"
                  >
                    <svg
                      v-if="grp.excursion && tourLines.get(grp.excursion.id)"
                      class="tour-station-line"
                      :width="tourLines.get(grp.excursion.id)!.width"
                      :height="tourLines.get(grp.excursion.id)!.height"
                      aria-hidden="true"
                    >
                      <defs>
                        <linearGradient
                          v-if="tourLines.get(grp.excursion.id)!.hinwegPath"
                          :id="`tour-gradient-hin-${grp.excursion.id}`"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stop-color="var(--tour-theme-color, var(--color-primary))"
                          />
                          <stop offset="100%" stop-color="var(--color-primary)" />
                        </linearGradient>
                        <linearGradient
                          v-if="tourLines.get(grp.excursion.id)!.rueckwegPath"
                          :id="`tour-gradient-rueck-${grp.excursion.id}`"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stop-color="var(--tour-theme-color, var(--color-primary))"
                          />
                          <stop offset="100%" stop-color="var(--color-primary)" />
                        </linearGradient>
                      </defs>

                      <path
                        v-if="tourLines.get(grp.excursion.id)!.hinwegPath"
                        :d="tourLines.get(grp.excursion.id)!.hinwegPath!.d"
                        fill="none"
                        :style="{ stroke: `url(#tour-gradient-hin-${grp.excursion.id})` }"
                        stroke-width="3"
                        stroke-dasharray="6,6"
                        stroke-linecap="round"
                      />
                      <path
                        v-if="tourLines.get(grp.excursion.id)!.rueckwegPath"
                        :d="tourLines.get(grp.excursion.id)!.rueckwegPath!.d"
                        fill="none"
                        :style="{ stroke: `url(#tour-gradient-rueck-${grp.excursion.id})` }"
                        stroke-width="3"
                        stroke-dasharray="6,6"
                        stroke-linecap="round"
                      />

                      <circle
                        v-for="(dot, i) in tourLines.get(grp.excursion.id)!.dots"
                        :key="'dot-' + i"
                        :cx="dot.x"
                        :cy="dot.y"
                        r="4.5"
                        :style="{
                          fill: dot.isEnd
                            ? 'var(--color-primary)'
                            : 'var(--tour-theme-color, var(--color-primary))',
                          stroke: 'var(--color-surface)',
                          strokeWidth: '2px',
                        }"
                      />
                    </svg>

                    <!-- Touren: Schlangen-Layout (Serpentine / S-Kurve) mit adaptiver Spaltenanzahl -->
                    <div
                      v-if="grp.excursion"
                      class="tour-serpentine-wrap"
                      :style="{
                        '--tour-cols': getTourCols(grp.excursion.id),
                        '--tour-conn-width': '76px',
                      }"
                    >
                      <div
                        v-for="row in getTourRows(grp.excursion, grp.items)"
                        :key="`row-${grp.excursion.id}-${row.rowIndex}`"
                        class="tour-serpentine-row-wrap"
                      >
                        <div
                          class="tour-serpentine-row"
                          :class="{
                            'is-rtl': row.isRtl,
                            'is-ltr': !row.isRtl,
                            'single-col': getTourCols(grp.excursion.id) === 1,
                          }"
                        >
                          <template v-for="cell in row.cells" :key="cell.key">
                            <!-- Spot-Kachel -->
                            <div v-if="cell.type === 'spot'" class="tour-spot-cell">
                              <SpotCard
                                :ref="(el) => setSpotRef(cell.spot.id, el)"
                                class="staggered-spot"
                                :data-spot-id="cell.spot.id"
                                :style="[
                                  {
                                    '--stagger-idx': cell.globalIndex,
                                    '--stagger-total': grp.items.length,
                                  },
                                ]"
                                :spot="cell.spot"
                                :excursion-context="{
                                  id: grp.excursion.id,
                                  isDestination: grp.excursion.destination_spot_id === cell.spot.id,
                                  hasDestination: grp.excursion.destination_spot_id != null,
                                }"
                                @toggle-destination="
                                  toggleExcursionDestination(grp.excursion, cell.spot.id)
                                "
                                :highlighted="
                                  highlightedIds.has(cell.spot.id) ||
                                  dayFocusHighlightedIds.has(cell.spot.id)
                                "
                                :expanded="expandedSpotId === cell.spot.id"
                                :scheduled-date="spotScheduledDates.get(cell.spot.id) ?? null"
                                :creator-label="creatorLabel(cell.spot.created_by)"
                                :payer-label="creatorLabel(cell.spot.paid_by_user_id)"
                                :like-count="spotsStore.likeCountFor(cell.spot.id)"
                                :liked="spotsStore.likedByMe(cell.spot.id, auth.user?.id)"
                                :comments="spotCommentItemsFor(cell.spot.id)"
                                :group-mode="groupMode === 'tours' ? 'tours' : 'category'"
                                :tour-options="allTourTitles"
                                :has-multiple-members="users.length > 1"
                                :layover-minutes="
                                  cell.globalIndex > 0 && cell.globalIndex < grp.items.length - 1
                                    ? getTourLayover(grp.excursion, grp.items, cell.globalIndex)
                                    : null
                                "
                                @edit="startEditSpot"
                                @toggle-like="toggleSpotLike(cell.spot.id)"
                                @submit-comment="
                                  (content) => submitSpotComment(cell.spot.id, content)
                                "
                                @remove-comment="removeSpotComment"
                                @update-comment="updateSpotComment"
                                @toggle-comment-like="toggleSpotCommentLike"
                                @open="onSpotCardOpen(cell.spot)"
                                @close="onSpotCardClose"
                                @show-on-map="onSpotShowOnMap(cell.spot)"
                                @assign-tour="(title) => assignSpotToTourTitle(cell.spot.id, title)"
                              />
                            </div>

                            <!-- Horizontaler Teilstrecken-Verbinder ("hochkant" zwischen 2 Kacheln) -->
                            <div
                              v-else-if="cell.type === 'leg-horizontal'"
                              class="tour-leg-connector is-horizontal"
                              :class="{ 'is-rtl': cell.isRtl }"
                            >
                              <!-- Teilstrecke existiert -->
                              <div
                                v-if="cell.leg"
                                class="tour-leg-pill is-horizontal-leg"
                                tabindex="0"
                                role="button"
                                :title="getLegTooltip(cell.leg, cell.fromSpot, cell.toSpot)"
                                :aria-label="`Teilstrecke von ${cell.fromSpot.title} nach ${cell.toSpot.title} bearbeiten`"
                                @click.stop="
                                  openCardLegModal(grp.excursion, cell.fromSpot, cell.toSpot)
                                "
                                @keydown.enter.self="
                                  openCardLegModal(grp.excursion, cell.fromSpot, cell.toSpot)
                                "
                                @keydown.space.self.prevent="
                                  openCardLegModal(grp.excursion, cell.fromSpot, cell.toSpot)
                                "
                              >
                                <span class="leg-pill-icon">
                                  {{ travelTypeIcon(cell.leg.transport_type ?? null) }}
                                </span>
                                <span
                                  v-if="getLegDurationParts(cell.leg)"
                                  class="leg-pill-duration"
                                >
                                  <span
                                    v-for="(part, pIdx) in getLegDurationParts(cell.leg)"
                                    :key="pIdx"
                                    class="leg-duration-part"
                                  >
                                    {{ part }}
                                  </span>
                                </span>
                                <span v-else-if="cell.leg.departure_time" class="leg-pill-duration">
                                  <span class="leg-duration-part">{{
                                    cell.leg.departure_time
                                  }}</span>
                                </span>
                                <span v-if="cell.leg.amount != null" class="leg-pill-cost nobr">
                                  {{ cell.leg.amount.toFixed(2).replace('.', ',') }}&nbsp;€
                                </span>
                              </div>

                              <!-- Keine Teilstrecke erfasst -> kleiner Add-Button -->
                              <button
                                v-else
                                type="button"
                                class="tour-leg-add-btn is-horizontal-leg"
                                title="Teilstrecke erfassen"
                                :aria-label="`Teilstrecke zwischen ${cell.fromSpot.title} und ${cell.toSpot.title} erfassen`"
                                @click.stop="
                                  openCardLegModal(grp.excursion, cell.fromSpot, cell.toSpot)
                                "
                              >
                                <AppIcon :icon="ACTION_ICONS.add" :size="12" group="actions" />
                                <span class="leg-add-text">Teilstrecke</span>
                              </button>
                            </div>
                          </template>
                        </div>

                        <!-- Zeilenumbruch-Verbinder (Zentriert zwischen den Kacheln auf der gestrichelten Linie) -->
                        <div
                          v-if="row.rowBreak"
                          class="tour-row-break"
                          :class="[
                            'align-' + row.rowBreak.alignSide,
                            { 'single-col': getTourCols(grp.excursion.id) === 1 },
                          ]"
                        >
                          <div class="tour-row-break-inner">
                            <!-- Teilstrecke existiert -->
                            <div
                              v-if="row.rowBreak.leg"
                              :key="`leg-${row.rowBreak.fromSpot.id}-${row.rowBreak.toSpot.id}`"
                              class="tour-leg-pill is-row-break"
                              tabindex="0"
                              role="button"
                              :title="
                                getLegTooltip(
                                  row.rowBreak.leg,
                                  row.rowBreak.fromSpot,
                                  row.rowBreak.toSpot
                                )
                              "
                              :aria-label="`Teilstrecke von ${row.rowBreak.fromSpot.title} nach ${row.rowBreak.toSpot.title} bearbeiten`"
                              @click.stop="
                                openCardLegModal(
                                  grp.excursion,
                                  row.rowBreak.fromSpot,
                                  row.rowBreak.toSpot
                                )
                              "
                              @keydown.enter.self="
                                openCardLegModal(
                                  grp.excursion,
                                  row.rowBreak.fromSpot,
                                  row.rowBreak.toSpot
                                )
                              "
                              @keydown.space.self.prevent="
                                openCardLegModal(
                                  grp.excursion,
                                  row.rowBreak.fromSpot,
                                  row.rowBreak.toSpot
                                )
                              "
                            >
                              <span class="leg-pill-icon">
                                {{ travelTypeIcon(row.rowBreak.leg.transport_type ?? null) }}
                              </span>
                              <span v-if="row.rowBreak.leg.transport_type" class="leg-pill-type">
                                {{ row.rowBreak.leg.transport_type }}
                              </span>
                              <span
                                v-if="getLegDurationParts(row.rowBreak.leg)"
                                class="leg-pill-duration"
                              >
                                <span
                                  v-for="(part, pIdx) in getLegDurationParts(row.rowBreak.leg)"
                                  :key="pIdx"
                                  class="leg-duration-part"
                                >
                                  {{ part }}
                                </span>
                              </span>
                              <span
                                v-else-if="row.rowBreak.leg.departure_time"
                                class="leg-pill-duration"
                              >
                                <span class="leg-duration-part">{{
                                  row.rowBreak.leg.departure_time
                                }}</span>
                              </span>
                              <span
                                v-if="row.rowBreak.leg.amount != null"
                                class="leg-pill-cost nobr"
                              >
                                {{ row.rowBreak.leg.amount.toFixed(2).replace('.', ',') }}&nbsp;€
                              </span>
                            </div>

                            <!-- Keine Teilstrecke am Umbruch erfasst -->
                            <div v-else class="tour-leg-add-wrap">
                              <button
                                type="button"
                                class="tour-leg-add-btn is-row-break"
                                title="Teilstrecke erfassen"
                                :aria-label="`Teilstrecke zwischen ${row.rowBreak.fromSpot.title} und ${row.rowBreak.toSpot.title} erfassen`"
                                @click.stop="
                                  openCardLegModal(
                                    grp.excursion,
                                    row.rowBreak.fromSpot,
                                    row.rowBreak.toSpot
                                  )
                                "
                              >
                                <AppIcon :icon="ACTION_ICONS.add" :size="12" group="actions" />
                                <span class="leg-add-text">Teilstrecke erfassen</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

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
                  </div>

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
              <p class="empty">
                <template v-if="hasActiveFilters">
                  Keine {{ groupMode === 'tours' ? 'Touren' : 'Spots' }} für die aktuellen Filter
                  oder Suchbegriffe gefunden.
                </template>
                <template v-else-if="groupMode === 'tours'"> Noch keine Touren angelegt. </template>
                <template v-else> Noch keine Spots angelegt. </template>
              </p>
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

          <div v-else class="tracks-tab-content">
            <div v-if="!tracksStore.tracks.length" class="empty-state-wrap tracks-empty-state">
              <p class="empty">
                Noch keine Tracks aufgezeichnet.<br />
                <span class="empty-subtext">
                  Starte eine Aufzeichnung über den Button oben oder direkt auf der Karte.
                </span>
              </p>
            </div>
            <div v-else class="tracks-view">
              <ul class="tracks-list">
                <li
                  v-for="track in tracksStore.tracks"
                  :key="track.id"
                  class="track-row"
                  :class="{ active: Number(drawers.mapFocusTrackId) === Number(track.id) }"
                >
                  <button type="button" class="track-row-main" @click="onTrackShowOnMap(track.id)">
                    <span class="track-row-title">
                      <AppIcon
                        v-if="track.visibility === 'private'"
                        :icon="ACTION_ICONS.private"
                        :size="13"
                        group="actions"
                        class="track-visibility-lock"
                        title="Nur für dich sichtbar (privat)"
                      />
                      <span>{{ trackTitle(track) }}</span>
                    </span>
                    <span class="track-row-meta">
                      <span class="track-meta-author" :title="trackAuthorTitle(track)">
                        <span class="track-meta-avatar">{{ trackAuthorAvatar(track) }}</span>
                        <span class="track-meta-name">{{ trackAuthorName(track) }}</span>
                        <span class="track-meta-sep" aria-hidden="true">·</span>
                      </span>
                      <span
                        v-if="!trackTitle(track).includes(formatDateTime(track.started_at))"
                        class="track-meta-time"
                      >
                        {{ formatDateTime(track.started_at) }}
                        <template
                          v-if="
                            !track.ended_at ||
                            track.end_reason === 'aborted' ||
                            trackDurationLabel(track)
                          "
                        >
                          ·
                        </template>
                      </span>
                      <span v-if="!track.ended_at" class="track-meta-live">
                        <span class="recording-pulse-dot" aria-hidden="true"></span>
                        Aufzeichnung läuft
                      </span>
                      <span
                        v-else-if="track.end_reason === 'aborted'"
                        class="track-meta-aborted"
                        title="Aufzeichnung wurde automatisch abgebrochen"
                      >
                        <AppIcon :icon="ACTION_ICONS.warning" :size="12" group="actions" />
                        Abgebrochen
                        <template v-if="trackDurationLabel(track)">
                          · {{ trackDurationLabel(track) }}
                        </template>
                      </span>
                      <span v-else-if="trackDurationLabel(track)" class="track-meta-duration">
                        <AppIcon :icon="ACTION_ICONS.duration" :size="12" group="actions" />
                        {{ trackDurationLabel(track) }}
                      </span>
                      <span
                        v-if="getTourForTrack(track)"
                        class="track-meta-tour"
                        :title="'Zugeordnete Tour: ' + getTourForTrack(track)?.title"
                      >
                        ·
                        <AppIcon
                          :icon="SECTION_ICON_DEFS.excursions"
                          :size="12"
                          group="navigation"
                        />
                        {{ getTourForTrack(track)?.title }}
                      </span>
                    </span>
                  </button>
                  <div v-if="track.user_id === auth.user?.id" class="track-row-actions">
                    <button
                      v-if="!track.ended_at"
                      type="button"
                      class="track-icon-btn track-icon-btn--stop"
                      title="Aufzeichnung beenden"
                      aria-label="Aufzeichnung beenden"
                      @click.stop="stopTrackDirect(track)"
                    >
                      <AppIcon :icon="ACTION_ICONS.recordStop" :size="15" group="actions" />
                    </button>
                    <button
                      type="button"
                      class="track-icon-btn"
                      title="Aufzeichnung bearbeiten"
                      aria-label="Aufzeichnung bearbeiten"
                      @click="startEditTrack(track)"
                    >
                      <AppIcon :icon="ACTION_ICONS.edit" :size="15" group="actions" />
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Hinweis-Modal für Standort-Aufzeichnung (#230) -->
          <TrackRecordingWarningModal
            v-model="showTrackRecordingWarningModal"
            @confirm="startRecordingConfirmed"
          />

          <!-- Datenschutz-Hinweis bei Zuordnung einer privaten Aufzeichnung zu einer Tour -->
          <TrackShareWarningModal
            v-model="showTrackShareWarningModal"
            :track-title="shareWarningTrackTitle"
            :tour-title="shareWarningTourTitle"
            @confirm="onConfirmShareModal"
          />

          <!-- Aufzeichnung bearbeiten (Name, Sichtbarkeit) -->
          <Modal
            :model-value="editingTrack !== null"
            title="Aufzeichnung bearbeiten"
            @update:model-value="(v) => !v && closeEditTrack()"
          >
            <form class="edit-form track-edit-form" @submit.prevent="submitEditTrack">
              <TabBar
                :tabs="trackEditTabs"
                :active-key="activeTrackEditTab"
                class="track-tab-bar"
                @select="(key) => (activeTrackEditTab = key as 'general' | 'permissions')"
              />

              <div v-show="activeTrackEditTab === 'general'" class="tab-content">
                <div
                  v-if="editingTrack?.end_reason === 'aborted'"
                  class="track-status-alert track-status-alert--aborted"
                  role="status"
                >
                  <AppIcon :icon="ACTION_ICONS.warning" :size="16" group="actions" />
                  <div class="track-status-alert__content">
                    <span class="track-status-alert__title">Automatisch abgebrochen</span>
                    <p class="track-status-alert__desc">
                      Die Aufzeichnung wurde vom System beendet (z. B. durch Bildschirmsperre oder
                      GPS-Abbruch).
                    </p>
                  </div>
                </div>
                <div
                  v-else-if="editingTrack && !editingTrack.ended_at"
                  class="track-status-alert track-status-alert--running"
                  role="status"
                >
                  <span class="recording-pulse-dot" aria-hidden="true"></span>
                  <div class="track-status-alert__content">
                    <span class="track-status-alert__title">Aufzeichnung läuft</span>
                    <p class="track-status-alert__desc">
                      Diese Aufzeichnung ist aktuell noch aktiv.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    :icon="ACTION_ICONS.recordStop"
                    @click="stopEditingTrack"
                  >
                    Aufzeichnung beenden
                  </Button>
                </div>

                <FormField
                  icon="title"
                  label="Name"
                  :modified="isEditTrackTitleModified"
                  v-slot="{ modified }"
                >
                  <Input
                    v-model="editTrackTitle"
                    type="text"
                    placeholder="z. B. Wanderung zur Berghütte"
                    :maxlength="100"
                    :modified="modified"
                  />
                </FormField>
                <FormField
                  icon="date"
                  label="Aufzeichnungszeitpunkt"
                  :modified="isEditTrackStartedAtModified"
                  v-slot="{ modified }"
                >
                  <Input
                    v-model="editTrackStartedAt"
                    type="datetime-local"
                    required
                    :modified="modified"
                  />
                </FormField>
                <FormField icon="tour" label="Zugeordnete Tour" :modified="isEditTrackTourModified">
                  <div class="track-tour-assign-field">
                    <TourAssignDropdown
                      :tours="trackTourAssignments"
                      @toggle-tour="onToggleTrackTour"
                      @create-tour="onCreateTourFromTrack"
                    />
                    <span v-if="editTrackExcursionTitle" class="track-tour-selected-badge">
                      <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="13" group="navigation" />
                      {{ editTrackExcursionTitle }}
                      <button
                        type="button"
                        class="remove-tour-btn"
                        title="Zuordnung entfernen"
                        aria-label="Zuordnung entfernen"
                        @click="editTrackExcursionId = null"
                      >
                        <AppIcon :icon="ACTION_ICONS.close" :size="12" group="actions" />
                      </button>
                    </span>
                  </div>
                </FormField>
              </div>

              <div
                v-show="activeTrackEditTab === 'permissions'"
                class="tab-content permissions-tab"
              >
                <ItemVisibilitySettings
                  v-model="editTrackVisibility"
                  item-label="Aufzeichnung"
                  :modified="isEditTrackVisibilityModified"
                />
              </div>
              <div class="actions-row">
                <Button
                  type="button"
                  variant="danger"
                  secondary
                  :icon="ACTION_ICONS.delete"
                  @click="deleteEditingTrack"
                >
                  Löschen
                </Button>
                <div class="spacer"></div>
                <Button
                  type="button"
                  variant="secondary"
                  class="btn-cancel"
                  @click="closeEditTrack"
                >
                  Abbrechen
                </Button>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </Modal>

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

/* Ersetzt den früheren, immer sichtbaren Erklärtext (siehe .description-popover unten) - reines
   Info-Icon statt eines vollen Buttons, damit es sich der Überschrift unterordnet statt mit ihr zu
   konkurrieren. */
.info-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: none;
  /* #185: ohne explizite Farbe erbte das Icon (currentColor, AppIcon.vue) die weiße Textfarbe des
     globalen `button`-Basisstils (style.css) - auf der hellen Kopfzeile praktisch unsichtbar. Der
     globale box-shadow (--shadow-sm) blieb aus demselben Grund (kein Reset) ebenfalls fälschlich
     sichtbar. */
  color: var(--color-text-muted);
  box-shadow: none;
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
}

.info-btn:hover {
  opacity: 1;
}

.description-popover {
  min-width: 260px;
  max-width: min(340px, 80vw);
}

.description-popover p {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.description-popover p + p {
  margin-top: var(--space-2);
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

@media (max-width: 480px) {
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

.hint {
  margin: 0 0 var(--space-3);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint.success {
  color: var(--color-success);
}

.hint.error {
  color: var(--color-danger);
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.edit-form .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form .row > * {
  flex: 1;
  min-width: 140px;
}

.spacer {
  flex: 1;
}

.spot-location-section {
  position: relative;
  z-index: var(--z-card-elevated, 5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.spot-location-section:focus-within,
.spot-location-section:has(.open),
.spot-location-section:has(.location-dropdown) {
  z-index: var(--z-popover, 1100);
}

.location-fieldset-content {
  gap: var(--space-4, 16px);
}

.location-fieldset-content .hint {
  margin: 0;
  line-height: 1.5;
}

.location-fieldset-content .checkbox-option {
  padding: var(--space-1) 0;
  line-height: 1.45;
}

.spot-side-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-2);
  margin-bottom: var(--space-4, 16px);
}

.spot-side-header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.spot-side-toggle {
  width: 100%;
}

@media (min-width: 581px) {
  .spot-side-toggle {
    width: fit-content;
    min-width: 280px;
    max-width: 340px;
    align-self: flex-start;
  }
}

.spot-side-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.spot-side-field.is-modified .spot-side-label {
  color: var(--color-accent-dark, var(--color-accent));
}

.location-fieldset-content :deep(.form-field),
.location-fieldset-content .form-field {
  margin-top: var(--space-2);
  margin-bottom: var(--space-2);
  gap: var(--space-2);
}

.track-warning-modal .track-warning-intro {
  margin-bottom: var(--space-3);
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--color-text);
}

.track-warning-modal .track-warning-points {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.track-warning-modal .track-warning-point h4 {
  margin: 0 0 4px;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.track-warning-modal .track-warning-point p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.track-warning-modal .warning-dismiss {
  margin-top: var(--space-2);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.syntax-hint {
  margin: -4px 0 0;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.syntax-hint code {
  background: var(--color-bg);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.78rem;
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

.caret {
  flex-shrink: 0;
}

.filter-bar-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Stationen einer Tour: eingerückte, vertikale Liste statt des normalen Karten-Grids (siehe
   Template). Wrapper ist bei Nicht-Touren-Gruppen ein reines display:contents-Passepartout (kein
   zusätzliches Layout-Element), bei Touren-Gruppen position:relative - dadurch offsetParent der
   Spot-Karten (recomputeTourLine() im Script liest offsetTop/offsetHeight direkt relativ dazu) und
   Bezugsrahmen für die absolut positionierte .tour-station-line (#100: statt einer starren,
   geraden CSS-border-left-Linie über die volle Container-Höhe eine per SVG berechnete, gebogene
   Linie, die exakt an den Kreis-Punkten auf Höhe jeder Spot-Karte endet/startet). Gleiche
   Akzentfarbe/Bogen-Idee wie die Tour-Route auf der Karte (TripMap.vue's renderRoutes()/
   utils/mapRoute.ts's arcPoints()) und wie ExcursionDetailDialog.vue's .station-connector, nur
   vertikal statt horizontal. */
.tour-station-wrap {
  display: contents;
}

.tour-station-wrap.is-tour {
  display: block;
  position: relative;
  margin-left: 0;
  margin-right: 0;
  min-width: 0;
  max-width: 100%;
}

.tour-station-wrap.is-tour.single-col {
  margin-left: 0;
  margin-right: 0;
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

.tour-station-accordion .staggered-spot {
  transition:
    opacity 0.35s ease,
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  transform: translateY(-24px) scale(0.95);
  transition-delay: calc((var(--stagger-total) - var(--stagger-idx) - 1) * 25ms);
}

.tour-station-accordion.is-expanded .staggered-spot {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx) * 50ms + 50ms);
}

@media (prefers-reduced-motion: reduce) {
  .tour-station-accordion {
    transition: none;
  }
  .tour-station-accordion-inner,
  .tour-station-accordion.is-expanded .tour-station-accordion-inner {
    transition: none;
  }
  .tour-station-accordion .staggered-spot,
  .tour-station-accordion.is-expanded .staggered-spot {
    transition: none;
    transform: none;
    opacity: 1;
  }
}

/* Serpentine / Schlangen-Layout für Tour-Stationen (#394) */
.tour-serpentine-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3) var(--space-4) var(--space-3);
  width: 100%;
  box-sizing: border-box;
  max-width: 100%;
  min-width: 0;
}

.tour-serpentine-row-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}

.tour-serpentine-row {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
  box-sizing: border-box;
  position: relative;
  min-width: 0;
}

.tour-serpentine-row.is-ltr {
  flex-direction: row;
  justify-content: flex-start;
}

.tour-serpentine-row.is-rtl {
  flex-direction: row-reverse;
  justify-content: flex-start;
}

/* Spot-Kachel-Zelle im Schlangen-Layout */
.tour-spot-cell {
  flex: 0 0
    calc((100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1));
  width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  max-width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 2;
}

.tour-spot-cell:hover {
  z-index: 6;
}

.tour-spot-cell .staggered-spot {
  width: 100%;
}

/* 1-Spalten-Modus: Spanne 100% */
.tour-serpentine-row.single-col .tour-spot-cell {
  flex: 0 0 100%;
  width: 100%;
  max-width: 100%;
}

/* Horizontaler Teilstrecken-Verbinder ("hochkant" zwischen 2 Kacheln) */
.tour-leg-connector.is-horizontal {
  flex: 0 0 var(--tour-conn-width, 76px);
  width: var(--tour-conn-width, 76px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  padding: 0 4px;
}

/* Zeilenumbruch-Verbinder im Schlangen-Layout */
.tour-row-break {
  display: flex;
  width: 100%;
  position: relative;
  z-index: 2;
  margin: var(--space-2) 0;
}

.tour-row-break.align-right {
  justify-content: flex-end;
}

.tour-row-break.align-left {
  justify-content: flex-start;
}

.tour-row-break-inner {
  width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  max-width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  display: flex;
  justify-content: center;
  align-items: center;
}

.tour-row-break.single-col .tour-row-break-inner {
  width: 100%;
  max-width: 100%;
}

/* Teilstrecken-Pill für vorhandene Teilstrecken */
.tour-leg-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  outline: none;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.tour-leg-pill:hover,
.tour-leg-pill:focus-visible {
  transform: translateY(-2px);
  border-color: var(--tour-theme-color, var(--color-primary));
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.tour-leg-pill.is-horizontal-leg {
  flex-direction: column;
  gap: 2px;
  padding: 8px 6px;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  width: 100%;
  max-width: 68px;
  text-align: center;
}

.tour-leg-pill.is-row-break {
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-pill, 9999px);
  max-width: 90%;
  text-align: center;
}

/* Button für noch nicht erfasste Teilstrecke */
.tour-leg-add-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
  color: var(--color-text-muted);
  cursor: pointer;
  outline: none;
  transition:
    transform 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.tour-leg-add-btn:hover,
.tour-leg-add-btn:focus-visible {
  background: var(--tour-theme-tint, var(--color-hover));
  border-color: var(--tour-theme-color, var(--color-primary));
  color: var(--tour-theme-color, var(--color-primary));
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.tour-leg-add-btn.is-horizontal-leg {
  flex-direction: column;
  gap: 3px;
  padding: 8px 3px;
  width: 100%;
  max-width: 68px;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  text-align: center;
}

.tour-leg-add-btn.is-row-break {
  flex-direction: row;
  gap: 6px;
  padding: 5px 14px;
  border-radius: var(--radius-pill, 9999px);
}

.tour-leg-add-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.leg-pill-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  line-height: 1;
  color: var(--tour-theme-color, var(--color-primary));
}

.leg-pill-type {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.15;
  white-space: nowrap;
}

.leg-pill-duration {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  column-gap: 4px;
  row-gap: 1px;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1.15;
  text-align: center;
}

.leg-duration-part {
  white-space: nowrap;
}

.leg-pill-cost {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--tour-theme-color, var(--color-primary));
  line-height: 1.1;
  white-space: nowrap;
}

.leg-add-text {
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.1;
  white-space: nowrap;
}

.tour-station-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) 12px 24px var(--space-4);
}

.tour-station-line {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  pointer-events: none;
}

.tour-station-line path {
  fill: none;
  stroke-width: 3;
  stroke-dasharray: 6 6;
  transition: stroke 0.2s ease;
}

.tour-station-line circle {
  transition: fill 0.2s ease;
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

.dropdown {
  position: relative;
  flex: 0 0 auto;
}

.category-btn.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.85rem;
  cursor: pointer;
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

/* Tracks-Tab im Drawer (eigene, geteilte und mit anderen geteilte GPS-Aufzeichnungen) */
.tracks-tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.tracks-empty-state {
  margin-top: var(--space-6);
}

.empty-subtext {
  display: inline-block;
  margin-top: var(--space-2);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.tracks-view {
  padding: 0;
}

.tracks-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.track-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  padding: var(--space-2) var(--space-3);
  transition:
    box-shadow 0.15s ease,
    border-color 0.15s ease;
}

.track-row:hover {
  border-color: var(--color-primary-light, var(--color-border));
}

.track-row.active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary);
}

.track-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.track-row-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-visibility-lock {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.track-row-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-meta-author {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.track-meta-avatar {
  flex-shrink: 0;
  line-height: 1;
}

.track-meta-name {
  white-space: nowrap;
}

.track-meta-sep {
  color: var(--color-text-muted);
}

.track-meta-time {
  flex-shrink: 0;
  white-space: nowrap;
}

.track-meta-duration {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
  white-space: nowrap;
}

.track-meta-tour {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.track-tab-bar {
  margin-bottom: var(--space-2);
}

.track-edit-form .tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.track-edit-form .permissions-tab {
  padding-top: var(--space-1);
}

@container spots-col (max-width: 480px) {
  .track-row {
    padding: var(--space-2);
    gap: var(--space-1);
  }
}

@container spots-col (max-width: 320px) {
  .track-meta-name {
    display: none;
  }
}

@container app-main (max-width: 719px) {
  .track-meta-name {
    display: none;
  }
}

@media (max-width: 719px) {
  .track-meta-name {
    display: none;
  }
}

@media (max-width: 480px) {
  .track-row {
    padding: var(--space-2);
    gap: var(--space-1);
  }
}

.track-meta-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-danger);
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
}

.track-meta-aborted {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-warning-dark);
  font-weight: 500;
  flex-shrink: 0;
  white-space: nowrap;
}

.track-icon-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.track-icon-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.track-icon-btn--stop {
  color: var(--color-danger);
}

.track-icon-btn--stop:hover {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
}

.track-status-alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
}

.track-status-alert--aborted {
  background: var(--color-warning-tint);
  border: 1px solid var(--color-warning);
  color: var(--color-warning-dark);
}

.track-status-alert--running {
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 25%, transparent);
  color: var(--color-text);
  align-items: center;
}

.track-status-alert__content {
  flex: 1;
  min-width: 0;
}

.track-status-alert__title {
  display: block;
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 2px;
}

.track-status-alert__desc {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.35;
}

/* Je eine Zeile für Sortieren und Filtern, statt einer gemeinsamen umbrechenden Reihe – siehe
   Kommentar am Template. flex-wrap:wrap (nicht nowrap): die Kategorie-/Status-Dropdowns behalten
   immer ihre volle Beschriftung (Nutzer:innen-Feedback, siehe @media weiter unten) - reicht der
   Platz neben dem (auf Mobil auf ein Icon reduzierten) Zeilen-Label nicht, bricht der Rest der
   Zeile innerhalb der GRÜNEN BOX in eine zweite Zeile um, statt seitlich über die Box
   hinauszuragen (Issue #170: "Dropdown ragt über die grüne Box hinaus - das darf nicht
   passieren"). */
.tool-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
}

/* Feste Breite statt nur flex-shrink:0 - richtet die Steuerelemente beider Zeilen (Sortieren/
   Filtern) an derselben gedachten vertikalen Linie aus, tabellenartig statt mit je nach
   Label-Länge unterschiedlich weit eingerücktem Inhalt (Issue #170, erste Lösungsidee). */
.tool-label {
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  gap: 4px;
  min-width: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
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
  gap: 6px;
  background: var(--color-primary-tint);
  border: 1px solid var(--color-primary);
  color: var(--color-primary-dark);
  border-radius: 999px;
  padding: 3px 6px 3px 12px;
  font-size: 0.82rem;
  font-weight: 600;
}

.filter-chip button {
  background: none;
  border: none;
  padding: 4px;
  min-width: 24px;
  min-height: 24px;
  color: inherit;
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* display:inline-flex/align-items:center kommen inzwischen aus style.css's globaler button-Regel
   (#95 "Eingabe Elemente cleanup" - vorher hier lokal als Fix für genau dieses Icon+Label+Caret-
   Ausrichtungsproblem nachgezogen, jetzt app-weit für jeden Button gelöst). Nur die kleinere
   Schriftgröße bleibt als lokale Abweichung.
   #156: bewusst OHNE eigenes box-shadow/border-color-Override mehr - button.secondary's Schatten
   (--shadow-sm) und kräftigerer Rahmen (--color-border-strong) gleichen diese Filter-Dropdowns damit
   optisch an die Sortieren-/Gruppieren-<select>-Felder in dieser und den anderen Listen-Views an
   (ShoppingListView.vue/TodoView.vue), statt wie zuvor dezenter/flacher zu wirken. */
.category-btn {
  font-size: 0.85rem;
}

.tool-label-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Kleiner Auf-/Zu-Pfeil rechts neben dem Label, macht auf einen Blick klarer, dass ein Klick ein
   Dropdown-Menü öffnet/schließt statt z. B. direkt eine Aktion auszulösen (Nutzer:innen-Feedback) -
   dasselbe Auf/Zu-Chevron wie SettingsView.vue's "Einzeln anpassen". */
.dropdown-caret {
  margin-left: 4px;
  opacity: 0.6;
  color: var(--color-primary);
}

.dropdown-caret.open {
  transform: rotate(180deg);
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

/* Zero-height Sentinel direkt vor .category-nav, per IntersectionObserver beobachtet (siehe
   setCategoryNavSentinelRef im Script) - sobald es aus dem sichtbaren Bereich scrollt, "klebt" die
   Nav gerade wirklich (position:sticky "stuck"), und .is-stuck unten greift. */
.category-nav-sentinel {
  height: 0;
}

/* Horizontale Kategorie-Navigation, Wolt-Stil: eine flache Tab-Leiste (gleitende Unterstreichung,
   gleiches Grundprinzip wie ListenView.vue's .tab-bar) statt einer schwebenden "Liquid Glass"-Pille
   wie in einer früheren Version dieser Nav (siehe Git-Historie) – dadurch unterscheidet sie sich
   klarer von der App-weiten NavBar (die IST eine schwebende Pille) und bleibt optisch eine
   sekundäre, dem Inhalt untergeordnete Werkzeugleiste. Icon links neben statt über dem Label
   (Wolt-Vorbild), ganze Leiste scrollt bei Bedarf horizontal statt umzubrechen (viele Kategorien
   nebeneinander) und hält die aktive Kategorie dabei per JS automatisch im sichtbaren Bereich
   (siehe watch(activeCategory) im Script). Vertikal sticky innerhalb von .spots-col-body (dem
   tatsächlich scrollenden Vorfahren, siehe dortige overflow-y) mit top:0, sitzt also im
   "stuck"-Zustand direkt an der Oberkante der Liste – anders als die frühere Pille bleibt die Höhe
   dabei konstant (kein Zustand mit größerem Padding mehr), daher ist keine zusätzliche
   Abstands-Kompensation für die erste sichtbare Gruppe mehr nötig.
   --color-primary-tint statt --color-surface + Squircle-Rundung statt eckiger Ecken: dieselbe
   "Steuerungselement statt Dateninhalt"-Behandlung wie .filter-bar oben (siehe DESIGN.md, Abschnitt
   "Farben") – diese Navi ist ein Werkzeug zum Springen zwischen Kategorien, kein Dateninhalt. Ein
   weißer, eckiger Balken sah hier speziell im "stuck"-Zustand sichtbar falsch aus: auf Desktop wird
   .spots-col dort komplett transparent (siehe dortiges background:none), ein weißes Rechteck mit
   90°-Ecken hätte scharf gegen den beigen Seitenhintergrund abgesetzt gewirkt – siehe DESIGN.md,
   Abschnitt "Eckenrundung", "nie ganz eckige Ecken"-Grundsatz. */
/* Sticky-/Hintergrund-/Schatten-Zustand sitzt jetzt am Wrapper statt an .category-nav selbst (#144)
   - .category-nav bleibt das reine Scroll-Element (overflow-x), die beiden Klick-Pfeile (Template)
   sind absolut positionierte Geschwister innerhalb desselben Wrappers, brauchen also dieselbe
   Sticky-Positionierung/denselben Hintergrund wie die Leiste, ohne selbst mitzuscrollen. */
.category-nav-wrap {
  position: sticky;
  /* -1px statt 0 + 1px zusätzliches Padding oben (kompensiert die Verschiebung, sichtbare Position
     bleibt gleich): schließt eine von Nutzer:innen gemeldete 1-2px-Lücke, durch die beim Scrollen
     kurz Spot-Inhalt hinter der Leiste durchschimmerte (#144) - bekanntes Sub-Pixel-Rundungsproblem
     von position:sticky mit top:0 bei fraktionaler Geräte-Pixel-Skalierung, dieser 1px-Vorzieh-Trick
     ist die gängige Lösung dafür. */
  top: -1px;
  padding-top: 1px;
  z-index: 10;
  margin-bottom: var(--space-3);

  /* Die Leiste auf die volle Breite der Schublade aufziehen, um auch das seitliche Scroll-Padding
     abzudecken, falls Inhalte drunterscrollen. */
  margin-left: calc(var(--space-3) * -1);
  margin-right: calc(var(--space-3) * -1);
  padding-left: var(--space-3);
  padding-right: var(--space-3);

  /* Eigene Variable statt direkt --color-surface, weil die Desktop-Regel weiter unten
     (.spots-col .category-nav-wrap) sie auf --color-bg umschaltet - Pfeile/Verlauf unten nutzen
     denselben Wert, damit beide Stellen bei einer künftigen Änderung nicht auseinanderlaufen. */
  --category-nav-bg: var(--color-surface);
  /* Gleiche Farbe wie der dahinterliegende Untergrund statt eines eigenen Tons (vorher
     --color-primary-tint mit eigener Rundung) - sieht dadurch "transparent" aus wie die anderen
     Tab-/Nav-Leisten der App (NavBar.vue, TabBar.vue), muss aber wegen position:sticky tatsächlich
     blickdicht bleiben, sonst schiene der darunter wegscrollende Inhalt durch. Mobil liegt dahinter
     das Bottom-Sheet (.spots-col mit --color-surface, s. u.), nicht der Seitenhintergrund - erst ab
     der Desktop-Breakpoint-Regel unten (.spots-col wird dort background:none) passt --color-bg. */
  background: var(--category-nav-bg);
  border-bottom: 1px solid var(--color-border);
  transition: box-shadow 0.2s ease;
}

/* Sobald tatsächlich "stuck" (siehe Sentinel/IntersectionObserver oben): ein dezenter Schatten
   zeigt an, dass die Leiste jetzt über scrollendem Inhalt schwebt, statt (wie die frühere Pille) die
   Form komplett zu wechseln. 
   Zusätzlich deckt ein solider Schatten nach oben den padding-top Bereich von .spots-col-body ab,
   damit die drunterscrollenden Karten dort nicht sichtbar werden. */
.category-nav-wrap.is-stuck {
  box-shadow:
    0 calc(var(--space-3) * -1) 0 0 var(--category-nav-bg),
    var(--shadow-sm);
}

.category-nav {
  display: flex;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  /* Nativer Scrollbalken wirkte zusammen mit der gleitenden Unterstreichung (.category-nav-underline
     unten) unruhig/doppelt gemoppelt (#144, Nutzer-Feedback) - die beiden Klick-Pfeile (Template)
     übernehmen die Scrollbarkeit stattdessen sichtbar/bedienbar, ohne den permanent sichtbaren
     Balken. scrollbar-width für Firefox, ::-webkit-scrollbar für Chrome/Safari - kein Standard-CSS
     für beide zugleich. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-nav::-webkit-scrollbar {
  display: none;
}

.category-nav-track {
  position: relative;
  display: flex;
  align-items: center;
  min-width: max-content;
}

/* Dezente Klick-Fläche mit Verlauf statt eines vollflächigen, hart abgesetzten Buttons (#144) - der
   Farbverlauf zum jeweiligen Rand hin lässt das letzte teils sichtbare Kategorie-Label unter dem
   Pfeil sanft ausblenden statt hart abzuschneiden. Volle Höhe des Wrappers (top/bottom:0) statt nur
   Icon-Größe, damit die Klickfläche nicht winzig ausfällt. */
.category-nav-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  width: 32px;
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
}

.category-nav-arrow:hover {
  color: var(--color-primary-dark);
}

.category-nav-arrow.left {
  left: 0;
  justify-content: flex-start;
  padding-left: 4px;
  background: linear-gradient(to right, var(--category-nav-bg) 45%, transparent);
}

.category-nav-arrow.right {
  right: 0;
  justify-content: flex-end;
  padding-right: 4px;
  background: linear-gradient(to left, var(--category-nav-bg) 45%, transparent);
}

.category-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  /* Explizit zurückgesetzt statt sich auf style.css's globale button-Regel zu verlassen (#95 gab
     jedem <button> per Default Schatten + Squircle-Rundung) - ein flaches Tab-Item einer
     Tab-Unterstreichungs-Leiste (wie TabBar.vue's .tab) braucht beides nicht, sonst wirkt jedes
     einzelne Item wie eine eigene erhobene Karte statt Teil einer gemeinsamen Leiste. */
  box-shadow: none;
  border-radius: 0;
  padding: var(--space-2) var(--space-3);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
}

.category-nav-item:hover {
  color: var(--color-primary-dark);
}

.category-nav-item.active {
  color: var(--color-primary-dark);
  font-weight: 600;
}

.category-nav-icon {
  font-size: 1.05rem;
  line-height: 1;
}

.category-nav-label {
  font-size: 0.85rem;
}

/* Gleitet per transform/width zur jeweils aktiven Kategorie statt die Farbe hart umzuschalten -
   identisches Prinzip wie ListenView.vue's .tab-underline (dortiger Kommentar für die Begründung,
   warum JS-gemessene Positionen statt eines starren CSS-Grids nötig sind: unterschiedlich breite
   Kategorie-Labels). Aktualisiert sowohl bei Klick als auch beim Scrollspy-getriebenen Wechsel der
   aktiven Kategorie (siehe activeCategory im Script) - funktioniert dadurch "in beide Richtungen". */
.category-nav-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 2;
  height: 2px;
  background: var(--color-primary);
  border-radius: 2px 2px 0 0;
  transition:
    transform 0.2s ease,
    width 0.2s ease;
  pointer-events: none;
}

/* Einplanen-Fieldset: Hinweis, Controls & vereinheitlichte Chips (Touren + Termine) */
.schedule-hint {
  margin: 0 0 var(--space-2);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.3;
}

.schedule-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.add-schedule-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 5px 12px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.82rem;
  font-weight: 500;
  border: 1px dashed var(--color-border-strong);
  background: var(--color-hover);
  color: var(--color-text);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.add-schedule-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-calendar-appointment);
  color: var(--color-calendar-appointment);
}

.add-schedule-popover {
  width: 240px;
  padding: var(--space-3);
  z-index: 1100;
}

/* Vereinheitlichte Chips für Touren und Termine (DRY-Prinzip) */
.assign-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.assign-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  padding: 3px 6px 3px 10px;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid;
  line-height: 1.2;
}

/* Touren-Chip: orange (Zentrale Tour-Farbe --color-tour / SCHEDULE_CATEGORY_META.excursion.color) */
.assign-chip--tour {
  background: var(--color-tour-tint);
  border-color: var(--color-tour-border);
  color: var(--color-tour);
}

/* Reise-Chip: grün (Zentrale Reise-Farbe --color-travel / SCHEDULE_CATEGORY_META.travel.color) */
.assign-chip--travel {
  background: var(--color-travel-tint);
  border-color: var(--color-travel-border);
  color: var(--color-travel);
}

/* Termin-Chip: grau (Farbe aus dem Kalender, SCHEDULE_CATEGORY_META.other.color) */
.assign-chip--schedule {
  background: var(--color-calendar-appointment-tint);
  border-color: var(--color-calendar-appointment-border);
  color: var(--color-calendar-appointment);
}

.assign-chip--schedule.is-done {
  background: color-mix(in srgb, var(--color-success) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
  color: var(--color-success);
}

.assign-chip-done-toggle {
  background: none;
  border: none;
  padding: 1px 2px;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
  opacity: 0.85;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}

.assign-chip-done-toggle:hover {
  opacity: 1;
  transform: scale(1.15);
}

.assign-chip-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  cursor: pointer;
}

.assign-chip-action:hover {
  text-decoration: underline;
}

.assign-chip-label {
  display: inline-flex;
  align-items: center;
}

.assign-chip-remove {
  background: none;
  border: none;
  padding: 2px 3px;
  margin-left: 2px;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.assign-chip-remove:hover {
  opacity: 1;
}

.track-tour-assign-field {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.track-tour-selected-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px 10px;
  background: var(--color-primary-tint);
  color: var(--color-primary);
  border-radius: var(--radius-pill);
  font-size: 0.85rem;
  font-weight: 500;
}

.remove-tour-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  margin-left: 2px;
  color: inherit;
  cursor: pointer;
  border-radius: var(--radius-full);
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.remove-tour-btn:hover {
  opacity: 1;
}

.track-meta-tour {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--color-primary);
  font-weight: 500;
}

.excursion-tracks-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.excursion-tracks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.excursion-track-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.excursion-track-item:hover {
  background: var(--color-bg-hover, var(--color-bg-secondary));
}

.excursion-track-item.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.excursion-track-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  width: 100%;
}

.excursion-track-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.excursion-track-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
}

.excursion-track-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.privacy-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  font-size: 0.72rem;
  font-weight: 600;
}

.privacy-pill--private {
  background: var(--color-warning-tint, rgba(234, 179, 8, 0.15));
  color: var(--color-warning-dark, #a16207);
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
</style>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api/client';
import type {
  Excursion,
  ExcursionComment,
  ExcursionLike,
  IdeaRole,
  Spot,
  User,
} from '../api/types';
import { deriveTravelItems } from '../utils/deriveTravelItems';
import { spotCategoryMeta } from '../utils/spotCategory';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { useLiveSyncStore } from '../stores/liveSync';
import { useExcursionsStore } from '../stores/excursions';
import { useDiaryStore } from '../stores/diary';
import { useTracksStore } from '../stores/tracks';
import { useIsDesktop } from '../composables/useIsDesktop';
import { hashHighlightId } from '../utils/hashHighlight';
import SpotCard from '../components/SpotCard.vue';
import ExcursionCard from '../components/ExcursionCard.vue';
import TourDetailView from '../components/TourDetailView.vue';
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
import Badge from '../components/primitives/Badge.vue';

// Subkomponenten (Phase 2: UI-Dekomposition & Deduplizierung, #446)
import ExcursionCategoryNav from '../components/ExcursionCategoryNav.vue';
import ExcursionTracksList from '../components/ExcursionTracksList.vue';
import TourSerpentineWrap from '../components/TourSerpentineWrap.vue';
import SpotFormModal from '../components/SpotFormModal.vue';
import ExcursionFormModal from '../components/ExcursionFormModal.vue';
import TrackEditModal from '../components/TrackEditModal.vue';
import TourSpotAssignDropdown from '../components/TourSpotAssignDropdown.vue';

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
import { useAccommodationDistances } from '../composables/useAccommodationDistances';

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
const diaryStore = useDiaryStore();
const tracksStore = useTracksStore();
const isDesktop = useIsDesktop();

const tripMapRef = ref<InstanceType<typeof TripMap> | null>(null);
const users = ref<User[]>([]);
const loading = ref(true);
const highlightedSpotIds = ref<Set<number>>(new Set());
const highlightedExcursionIds = ref<Set<number>>(new Set());
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
// spotScheduledDates vorab aus Spot-Besuchstagen & Touren ableiten für useAccommodationDistances
const spotScheduledDatesPreview = computed(() => {
  const map = new Map<number, string>();

  for (const spot of spotsStore.spots) {
    for (const entry of spot.dates ?? []) {
      if (entry.date && (!map.has(spot.id) || entry.date < map.get(spot.id)!)) {
        map.set(spot.id, entry.date);
      }
    }
  }

  for (const excursion of excursionsStore.excursions) {
    if (excursion.date) {
      for (const id of excursion.spot_ids) {
        if (!map.has(id) || excursion.date < map.get(id)!) {
          map.set(id, excursion.date);
        }
      }
    }
  }

  return map;
});

const { spotAccommodationDistances } = useAccommodationDistances({
  spotScheduledDates: spotScheduledDatesPreview,
});

const filter = useExcursionsFilter({
  route,
  router,
  highlightedSpotIds,
  highlightedExcursionIds,
  spotAccommodationDistances,
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
  spotGroups,
  filterCategoryOptions,
  excursionForGroupTitle,
} = filter;

const SEARCH_PLACEHOLDER_BY_MODE = {
  category: 'Spots suchen...',
  tours: 'Touren suchen...',
  tracks: 'Tracks suchen...',
} as const;
const searchPlaceholder = computed(() => SEARCH_PLACEHOLDER_BY_MODE[groupMode.value]);

const selectedExcursionId = ref<number | null>(null);
const tourDetailScreenEl = ref<HTMLElement | null>(null);

const selectedExcursion = computed(() =>
  selectedExcursionId.value != null
    ? (excursionsStore.excursions.find((e) => e.id === selectedExcursionId.value) ?? null)
    : null
);

const isTourDetailOpen = computed(
  () => groupMode.value === 'tours' && selectedExcursion.value != null
);

const canShowSearch = computed(
  () =>
    groupMode.value !== 'tracks' &&
    !isTourDetailOpen.value &&
    (filterCategoryOptions.value.length > 0 || excursionsStore.excursions.length > 0)
);

const isCollapsedSearchVisible = computed(
  () => isSheetOverlayMode.value && sheetState.value === 'collapsed' && canShowSearch.value
);

const searchFilterBarRef = ref<InstanceType<typeof SearchFilterBar> | null>(null);

const activeSearchAndFilterCount = computed(() => {
  return (
    categoryFilter.value.length +
    statusFilter.value.length +
    tourRoleFilter.value.length +
    (sortMode.value !== 'date' ? 1 : 0) +
    (searchQuery.value.trim() ? 1 : 0)
  );
});

const SHEET_EXPAND_FOCUS_DELAY_MS = 320;
let expandSearchTimeout: ReturnType<typeof setTimeout> | null = null;

function clearExpandSearchTimeout() {
  if (expandSearchTimeout) {
    clearTimeout(expandSearchTimeout);
    expandSearchTimeout = null;
  }
}

function expandAndFocusSearch() {
  sheetState.value = 'full';
  clearExpandSearchTimeout();

  expandSearchTimeout = setTimeout(() => {
    expandSearchTimeout = null;

    if (
      sheetDragging.value ||
      !canShowSearch.value ||
      (isSheetOverlayMode.value && sheetState.value !== 'full')
    ) {
      return;
    }

    searchFilterBarRef.value?.focusInput();
  }, SHEET_EXPAND_FOCUS_DELAY_MS);
}

watch(
  [sheetState, sheetDragging, canShowSearch, isSheetOverlayMode],
  ([state, dragging, searchable, overlay]) => {
    if (dragging || !searchable || (overlay && state !== 'full')) {
      clearExpandSearchTimeout();
    }
  }
);

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
  isCardWellVisibleInBody,
  getExcursionElement,
  getSpotElement,
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

// Contextual Actions & Buttons (Issue #698)
const isAccommodationFilterActive = computed(() => {
  return (
    groupMode.value === 'category' &&
    categoryFilter.value.length === 1 &&
    categoryFilter.value[0] === 'Unterkunft'
  );
});

const isTravelFilterActive = computed(() => {
  return (
    groupMode.value === 'tours' &&
    tourRoleFilter.value.length > 0 &&
    !tourRoleFilter.value.includes('excursion')
  );
});

const defaultTravelRole = computed<IdeaRole>(() => {
  if (tourRoleFilter.value.length === 1 && tourRoleFilter.value[0] !== 'excursion') {
    return tourRoleFilter.value[0] as IdeaRole;
  }

  const hasArrival = excursionsStore.excursions.some((e) => e.role === 'arrival');
  return hasArrival ? 'onward' : 'arrival';
});

const defaultTravelTitle = computed<string | undefined>(() => {
  if (defaultTravelRole.value === 'arrival') {
    return 'Anreise';
  }

  if (defaultTravelRole.value === 'departure') {
    return 'Abreise';
  }

  return undefined;
});

const emptyTravelCtaLabel = computed<string>(() => {
  if (defaultTravelRole.value === 'arrival') {
    return 'Anreise anlegen';
  }

  if (defaultTravelRole.value === 'departure') {
    return 'Abreise anlegen';
  }

  return 'Weiterreise anlegen';
});

const TRAVEL_BUTTON_LABELS = ['Neue Fahrt', 'Neuer Flug', 'Neuer Zug'];
const TRAVEL_LABEL_CYCLE_MS = 3500;
const travelLabelIndex = ref(0);
let travelLabelInterval: ReturnType<typeof setInterval> | null = null;

watch(
  isTravelFilterActive,
  (active) => {
    if (active) {
      if (!travelLabelInterval) {
        travelLabelInterval = setInterval(() => {
          travelLabelIndex.value = (travelLabelIndex.value + 1) % TRAVEL_BUTTON_LABELS.length;
        }, TRAVEL_LABEL_CYCLE_MS);
      }
    } else {
      if (travelLabelInterval) {
        clearInterval(travelLabelInterval);
        travelLabelInterval = null;
      }

      travelLabelIndex.value = 0;
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (travelLabelInterval) {
    clearInterval(travelLabelInterval);
    travelLabelInterval = null;
  }
});

const currentAddButtonText = computed(() => {
  if (groupMode.value === 'tracks') {
    return hasActiveRecording.value ? 'Beenden' : 'Aufzeichnen';
  }

  if (isAccommodationFilterActive.value) {
    return 'Neue Unterkunft';
  }

  if (isTravelFilterActive.value) {
    return TRAVEL_BUTTON_LABELS[travelLabelIndex.value];
  }

  if (groupMode.value === 'tours') {
    return 'Neue Tour';
  }

  return 'Neuer Spot';
});

const currentAddButtonAriaLabel = computed(() => {
  if (groupMode.value === 'tracks') {
    return hasActiveRecording.value ? 'Aufzeichnung beenden' : 'Weg aufzeichnen';
  }

  if (isAccommodationFilterActive.value) {
    return 'Neue Unterkunft';
  }

  if (isTravelFilterActive.value) {
    return 'Neue Reise anlegen';
  }

  if (groupMode.value === 'tours') {
    return 'Neue Tour';
  }

  return 'Neuer Spot';
});

const currentAddButtonIcon = computed(() => {
  if (groupMode.value === 'tracks') {
    return hasActiveRecording.value ? ACTION_ICONS.recordStop : ACTION_ICONS.recordStart;
  }

  if (isAccommodationFilterActive.value) {
    return spotCategoryMeta('Unterkunft').tabler;
  }

  if (isTravelFilterActive.value) {
    return SECTION_ICON_DEFS.travel;
  }

  if (groupMode.value === 'tours') {
    return ACTION_ICONS.mapPlus;
  }

  return ACTION_ICONS.mapPinPlus;
});

const currentAddButtonIconGroup = computed(() => {
  if (isAccommodationFilterActive.value) {
    return 'categories' as const;
  }

  return 'actions' as const;
});

const animatedTextOptions = [
  'Neuer Spot',
  'Neue Tour',
  'Aufzeichnen',
  'Beenden',
  'Neue Unterkunft',
  ...TRAVEL_BUTTON_LABELS,
];

// 7. Tour Form Modal State & Helpers
const showExcursionModal = ref(false);
const editingExcursion = ref<Excursion | null>(null);
const activeExcursionRole = ref<IdeaRole | ''>('');
const activeExcursionTitle = ref<string | undefined>(undefined);

function openExcursionForm(initialRole?: IdeaRole | '', initialTitle?: string) {
  editingExcursion.value = null;
  activeExcursionRole.value =
    initialRole ?? (isTravelFilterActive.value ? defaultTravelRole.value : '');
  activeExcursionTitle.value =
    initialTitle ?? (isTravelFilterActive.value ? defaultTravelTitle.value : undefined);
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

const excursionFormModalRef = ref<InstanceType<typeof ExcursionFormModal> | null>(null);

// 8. Spot Form Modal State
const showSpotModal = ref(false);
const editingSpot = ref<Spot | null>(null);
const defaultSpotCategory = ref<string | undefined>(undefined);
const defaultSpotTourTitle = ref<string | undefined>(undefined);
const pendingTourIdForNewSpot = ref<number | null>(null);
const pendingAddSpotToExcursionForm = ref(false);

function openSpotForm(initialCategory?: string, initialTourTitle?: string) {
  editingSpot.value = null;
  defaultSpotCategory.value =
    initialCategory ?? (isAccommodationFilterActive.value ? 'Unterkunft' : undefined);
  defaultSpotTourTitle.value = initialTourTitle;
  pendingTourIdForNewSpot.value = null;
  pendingAddSpotToExcursionForm.value = false;
  showSpotModal.value = true;
}

function startEditSpot(spot: Spot | number) {
  if (typeof spot === 'number') {
    const found = spotsStore.spots.find((candidate) => candidate.id === spot);
    editingSpot.value = found ?? null;
  } else {
    editingSpot.value = spot;
  }

  defaultSpotTourTitle.value = undefined;
  pendingTourIdForNewSpot.value = null;
  pendingAddSpotToExcursionForm.value = false;
  showSpotModal.value = true;
}

const TOUR_LINE_RECOMPUTE_DELAY_MS = 350;

watch(showSpotModal, (isOpen) => {
  if (isOpen) {
    return;
  }

  pendingAddSpotToExcursionForm.value = false;
  pendingTourIdForNewSpot.value = null;
  defaultSpotTourTitle.value = undefined;
});

async function onAddExistingSpotToTour(excursion: Excursion, spotId: number) {
  const current = excursionsStore.excursions.find((item) => item.id === excursion.id) ?? excursion;
  selectedExcursionId.value = current.id;

  await excursionsStore.update(current.id, {
    title: current.title,
    image_url: current.image_url ?? undefined,
    note: current.note ?? undefined,
    note_format: (current.note_format as 'html' | 'legacy') || undefined,
    date: current.date ?? undefined,
    spot_ids: [...current.spot_ids, spotId],
    legs: current.legs,
    role: current.role,
    transport_type: current.transport_type,
    departure_time: current.departure_time,
    arrival_time: current.arrival_time,
    checkin_info: current.checkin_info,
    amount: current.amount,
    paid_by_user_id: current.paid_by_user_id,
    luggage: current.luggage,
    seat: current.seat,
    ticket_link: current.ticket_link,
  });

  await nextTick();
  recomputeTourLine(current.id);
  setTimeout(() => {
    recomputeTourLine(current.id);
  }, TOUR_LINE_RECOMPUTE_DELAY_MS);
}

function onCreateSpotForTourCard(excursion: Excursion) {
  pendingTourIdForNewSpot.value = excursion.id;
  pendingAddSpotToExcursionForm.value = false;
  defaultSpotTourTitle.value = excursion.title;
  editingSpot.value = null;
  defaultSpotCategory.value = undefined;
  showSpotModal.value = true;
}

function onCreateSpotFromExcursionModal() {
  pendingAddSpotToExcursionForm.value = true;
  pendingTourIdForNewSpot.value = null;
  defaultSpotTourTitle.value = undefined;
  editingSpot.value = null;
  defaultSpotCategory.value = undefined;
  showSpotModal.value = true;
}

async function onSpotCreated(spot: Spot) {
  const isFromExcursionForm = pendingAddSpotToExcursionForm.value;
  const tourId = pendingTourIdForNewSpot.value;

  if (isFromExcursionForm) {
    excursionFormModalRef.value?.addSpotIdToActiveForm(spot.id);
    pendingAddSpotToExcursionForm.value = false;
    return;
  }

  if (tourId == null) {
    return;
  }

  const excursion = excursionsStore.excursions.find((e) => e.id === tourId);

  if (excursion) {
    selectedExcursionId.value = excursion.id;

    if (!excursion.spot_ids.includes(spot.id)) {
      await onAddExistingSpotToTour(excursion, spot.id);
    } else {
      await nextTick();
      recomputeTourLine(excursion.id);
      setTimeout(() => {
        recomputeTourLine(excursion.id);
      }, TOUR_LINE_RECOMPUTE_DELAY_MS);
    }
  }

  pendingTourIdForNewSpot.value = null;
  defaultSpotTourTitle.value = undefined;
}

function onAddButtonClick() {
  if (groupMode.value === 'tracks') {
    onRecordButtonClick();
  } else if (groupMode.value === 'tours') {
    if (isTravelFilterActive.value) {
      openExcursionForm(defaultTravelRole.value, defaultTravelTitle.value);
    } else {
      openExcursionForm();
    }
  } else if (isAccommodationFilterActive.value) {
    openSpotForm('Unterkunft');
  } else {
    openSpotForm();
  }
}

// Card Expansion & Map Cross-Focus Orchestration
const expandedSpotId = ref<number | null>(null);
let savedTourListScrollTop = 0;

const selectedExcursionStationItems = computed(() => {
  const excursion = selectedExcursion.value;

  if (!excursion) {
    return [];
  }

  const spotById = new Map(spotsStore.spots.map((spot) => [spot.id, spot]));
  const items: Array<{ kind: 'spot'; spot: Spot }> = [];

  for (const spotId of excursion.spot_ids) {
    const spot = spotById.get(spotId);

    if (spot) {
      items.push({ kind: 'spot', spot });
    }
  }

  return items;
});

let spotOpenSequenceToken = 0;
const TOUR_LINE_SETTLE_DELAY_MS = 320;
const TOUR_LINE_FINAL_DELAY_MS = 420;
let tourLineTimeouts: ReturnType<typeof setTimeout>[] = [];

function clearTourLineTimeouts() {
  for (const timer of tourLineTimeouts) {
    clearTimeout(timer);
  }

  tourLineTimeouts = [];
}

const tourViewTransitionName = ref<'tour-drill-forward' | 'tour-drill-back' | ''>('');
let pendingDetailFocusExcursionId: number | null = null;

watch(selectedExcursionId, (newId, oldId) => {
  clearTourLineTimeouts();
  pendingDetailFocusExcursionId = newId;

  if (newId != null) {
    excursionsStore.lastViewedExcursionId = newId;
  }

  if (newId != null && oldId == null && groupMode.value === 'tours') {
    tourViewTransitionName.value = 'tour-drill-forward';
  }

  if (newId == null) {
    return;
  }

  nextTick(() => recomputeTourLine(newId));
  tourLineTimeouts.push(
    setTimeout(() => recomputeTourLine(newId), TOUR_LINE_SETTLE_DELAY_MS),
    setTimeout(() => recomputeTourLine(newId), TOUR_LINE_FINAL_DELAY_MS)
  );
});

function parseRouteExcursionId(param: unknown): number | null {
  const raw = Array.isArray(param) ? param[0] : param;

  if (raw == null || raw === '') {
    return null;
  }

  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function syncTourDetailRoute(excursionId: number | null, mode: 'push' | 'replace' = 'push') {
  const currentRouteId = parseRouteExcursionId(route.params.excursionId);

  if (currentRouteId === excursionId) {
    return;
  }

  const targetTripId = route.params.tripId ? String(route.params.tripId) : String(tripId);
  const params: Record<string, string> = {
    tripId: targetTripId,
    excursionId: excursionId != null ? String(excursionId) : '',
  };

  void router[mode]({
    name: 'excursions',
    params,
    query: route.query,
  });
}

watch(
  () => route.params.excursionId,
  (newParam, oldParam) => {
    const routeId = parseRouteExcursionId(newParam);

    if (routeId != null) {
      if (groupMode.value !== 'tours') {
        groupMode.value = 'tours';
      }

      if (selectedExcursionId.value !== routeId) {
        if (selectedExcursionId.value == null && spotsColBodyEl.value) {
          savedTourListScrollTop = spotsColBodyEl.value.scrollTop;
        }

        if (oldParam !== undefined) {
          tourViewTransitionName.value = 'tour-drill-forward';
        }

        selectedExcursionId.value = routeId;
        expandedSpotId.value = null;
      }

      return;
    }

    if (selectedExcursionId.value == null) {
      return;
    }

    const closingId = selectedExcursionId.value;
    tourViewTransitionName.value = groupMode.value === 'tours' ? 'tour-drill-back' : '';
    selectedExcursionId.value = null;
    expandedSpotId.value = null;

    if (drawers.mapFocusExcursionId === closingId) {
      drawers.mapFocusExcursionId = null;
    }
  },
  { immediate: true }
);

watch(
  () =>
    [
      selectedExcursionId.value,
      selectedExcursion.value,
      loading.value,
      excursionsStore.loaded,
    ] as const,
  ([id, excursion, isLoading, isLoaded]) => {
    if (id == null || excursion != null || isLoading || !isLoaded) {
      return;
    }

    selectedExcursionId.value = null;
    expandedSpotId.value = null;
    excursionsStore.lastViewedExcursionId = null;

    if (drawers.mapFocusExcursionId === id) {
      drawers.mapFocusExcursionId = null;
    }

    syncTourDetailRoute(null, 'replace');
  }
);

watch(selectedExcursionStationItems, () => {
  if (selectedExcursionId.value != null) {
    const id = selectedExcursionId.value;
    nextTick(() => recomputeTourLine(id));
  }
});

watch(groupMode, (newMode) => {
  tourViewTransitionName.value = '';

  if (newMode !== 'tours') {
    excursionsStore.lastViewedExcursionId = null;
  }

  if (newMode !== 'tours' && selectedExcursionId.value != null) {
    selectedExcursionId.value = null;
    expandedSpotId.value = null;
  }

  if (newMode !== 'tours' && parseRouteExcursionId(route.params.excursionId) != null) {
    syncTourDetailRoute(null, 'replace');
  }
});

function focusLastViewedExcursionCard() {
  const excursionId = excursionsStore.lastViewedExcursionId;

  if (excursionId == null || isTourDetailOpen.value || groupMode.value !== 'tours') {
    return;
  }

  const cardEl = getExcursionElement(excursionId);

  if (!cardEl) {
    return;
  }

  excursionsStore.lastViewedExcursionId = null;
  cardEl.focus({ preventScroll: true });

  if (!isCardWellVisibleInBody(cardEl)) {
    void scrollToExcursion(excursionId);
  }
}

const TOUR_DETAIL_FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

function focusFirstElementInTourDetail() {
  if (
    !isTourDetailOpen.value ||
    selectedExcursionId.value == null ||
    pendingDetailFocusExcursionId !== selectedExcursionId.value
  ) {
    return;
  }

  const container = tourDetailScreenEl.value;

  if (!container) {
    return;
  }

  if (document.activeElement && container.contains(document.activeElement)) {
    pendingDetailFocusExcursionId = null;
    return;
  }

  const firstFocusable = container.querySelector<HTMLElement>(TOUR_DETAIL_FOCUSABLE_SELECTOR);

  if (firstFocusable) {
    pendingDetailFocusExcursionId = null;
    firstFocusable.focus({ preventScroll: true });
  }
}

watch(
  () => [loading.value, isTourDetailOpen.value, groupMode.value] as const,
  ([isLoading, detailOpen, mode]) => {
    if (isLoading || mode !== 'tours') {
      return;
    }

    if (detailOpen) {
      focusFirstElementInTourDetail();
      return;
    }

    if (excursionsStore.lastViewedExcursionId != null) {
      focusLastViewedExcursionCard();
    }
  },
  { flush: 'post' }
);

function onTourViewEnter() {
  if (!spotsColBodyEl.value) {
    return;
  }

  if (isTourDetailOpen.value && selectedExcursionId.value != null) {
    spotsColBodyEl.value.scrollTop = 0;
    nextTick(focusFirstElementInTourDetail);
    return;
  }

  spotsColBodyEl.value.scrollTop = savedTourListScrollTop;
  nextTick(focusLastViewedExcursionCard);
}

function onTourViewAfterEnter() {
  if (isTourDetailOpen.value && selectedExcursionId.value != null) {
    recomputeTourLine(selectedExcursionId.value);
    focusFirstElementInTourDetail();
    return;
  }

  focusLastViewedExcursionCard();

  if (excursionsStore.lastViewedExcursionId != null) {
    excursionsStore.lastViewedExcursionId = null;
  }
}

async function openTourDetail(excursionId: number) {
  if (drawers.mapFocusExcursionId && drawers.mapFocusExcursionId !== excursionId) {
    drawers.mapFocusExcursionId = null;
  }

  if (drawers.mapFocusKey != null) {
    drawers.mapFocusKey = null;
  }

  if (selectedExcursionId.value == null && spotsColBodyEl.value) {
    savedTourListScrollTop = spotsColBodyEl.value.scrollTop;
  }

  tourViewTransitionName.value = 'tour-drill-forward';
  selectedExcursionId.value = excursionId;
  expandedSpotId.value = null;
  syncTourDetailRoute(excursionId, 'push');

  await nextTick();
  recomputeTourLine(excursionId);
}

async function closeTourDetail() {
  const closingId = selectedExcursionId.value;
  tourViewTransitionName.value = 'tour-drill-back';
  selectedExcursionId.value = null;
  expandedSpotId.value = null;

  if (closingId != null && drawers.mapFocusExcursionId === closingId) {
    drawers.mapFocusExcursionId = null;
  }

  syncTourDetailRoute(null, 'push');

  await nextTick();
}

let lastActiveSpotEl: HTMLElement | null = null;

async function openSpotWithScroll(spotId: number, targetEl?: HTMLElement | null) {
  const token = ++spotOpenSequenceToken;

  if (drawers.mapFocusKey && drawers.mapFocusKey !== `spot-${spotId}`) {
    drawers.mapFocusKey = null;
  }

  if (drawers.mapFocusExcursionId != null) {
    drawers.mapFocusExcursionId = null;
  }

  const previousSpotId = expandedSpotId.value;
  const resolvedTarget =
    targetEl && targetEl.isConnected ? targetEl : getSpotElement(spotId, selectedExcursionId.value);

  if (previousSpotId === spotId) {
    if (resolvedTarget && isCardWellVisibleInBody(resolvedTarget)) {
      return;
    }

    await scrollToSpot(resolvedTarget ?? spotId);
    return;
  }

  const prefersReduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let offsetAdjustment = 0;

  if (previousSpotId != null) {
    const prevEl =
      lastActiveSpotEl && lastActiveSpotEl.isConnected
        ? lastActiveSpotEl
        : getSpotElement(previousSpotId, selectedExcursionId.value);
    const target = resolvedTarget;

    if (prevEl && target) {
      const isPrevAbove = Boolean(
        prevEl.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING
      );

      if (
        isPrevAbove &&
        target.getBoundingClientRect().top > prevEl.getBoundingClientRect().top + 10
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

  lastActiveSpotEl = resolvedTarget;
  expandedSpotId.value = spotId;

  await nextTick();

  if (token !== spotOpenSequenceToken) {
    return;
  }

  const currentTarget =
    resolvedTarget && resolvedTarget.isConnected
      ? resolvedTarget
      : getSpotElement(spotId, selectedExcursionId.value);

  if (currentTarget && isCardWellVisibleInBody(currentTarget, offsetAdjustment)) {
    return;
  }

  await scrollToSpot(currentTarget ?? spotId, offsetAdjustment);

  if (token !== spotOpenSequenceToken) {
    return;
  }

  if (prefersReduced) {
    return;
  }

  const DRAWER_TRANSITION_MS = 260;
  await new Promise<void>((resolve) => setTimeout(resolve, DRAWER_TRANSITION_MS));

  if (token !== spotOpenSequenceToken) {
    return;
  }

  const finalTarget =
    resolvedTarget && resolvedTarget.isConnected
      ? resolvedTarget
      : getSpotElement(spotId, selectedExcursionId.value);
  await scrollToSpot(finalTarget ?? spotId, 0, 'auto');
}

function onSpotCardOpen(spot: Spot, targetEl?: HTMLElement | null) {
  openSpotWithScroll(spot.id, targetEl);
}

function onSpotCardClose() {
  spotOpenSequenceToken++;
  expandedSpotId.value = null;
  drawers.mapFocusKey = null;
  lastActiveSpotEl = null;
}

function onExcursionCardOpen(excursion: Excursion) {
  openTourDetail(excursion.id);
}

function onCancelProgrammaticScroll() {
  spotOpenSequenceToken++;
  cancelProgrammaticScroll();
}

function onSpotShowOnMap(spot: Spot) {
  sheetState.value = 'partial';
  drawers.openMapAt(`spot-${spot.id}`);

  if (isSheetOverlayMode.value) {
    nextTick(() => {
      const el =
        lastActiveSpotEl && lastActiveSpotEl.isConnected
          ? lastActiveSpotEl
          : getSpotElement(spot.id, selectedExcursionId.value);
      scrollToSpot(el ?? spot.id);
    });
  }
}

function onExcursionShowOnMap(excursionId: number) {
  sheetState.value = 'partial';
  selectedExcursionId.value = excursionId;
  drawers.openMapForExcursion(excursionId);
}

async function onFocusSpotFromMap(spotId: number) {
  groupMode.value = 'category';

  const spot = spotsStore.spots.find((candidate) => candidate.id === spotId);

  if (
    spot &&
    categoryFilter.value.length > 0 &&
    !categoryFilter.value.includes(spot.category ?? 'Sonstiges')
  ) {
    categoryFilter.value = [];
  }

  if (searchQuery.value) {
    searchQuery.value = '';
  }

  if (sheetState.value === 'collapsed' || sheetState.value === 'full') {
    sheetState.value = 'partial';
  }

  await nextTick();
  await openSpotWithScroll(spotId);
}

async function onFocusExcursionFromMap(excursionId: number) {
  groupMode.value = 'tours';

  if (sheetState.value === 'collapsed' || sheetState.value === 'full') {
    sheetState.value = 'partial';
  }

  await nextTick();
  await openTourDetail(excursionId);
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
    if (trackId != null) {
      groupMode.value = 'tracks';
    }
  },
  { immediate: true }
);

watch(
  () => [drawers.mapFocusExcursionId, drawers.focusVersion],
  ([excId]) => {
    if (excId != null) {
      nextTick(() => {
        onFocusExcursionFromMap(excId);
      });
    }
  }
);

watch(
  () => [drawers.mapFocusKey, drawers.focusVersion],
  ([key]) => {
    if (typeof key === 'string') {
      if (key.startsWith('spot-')) {
        const spotId = Number(key.replace('spot-', ''));

        if (!Number.isNaN(spotId)) {
          nextTick(() => {
            onFocusSpotFromMap(spotId);
          });
        }
      } else if (key.startsWith('excursion-')) {
        const excursionId = Number(key.replace('excursion-', ''));

        if (!Number.isNaN(excursionId)) {
          nextTick(() => {
            onFocusExcursionFromMap(excursionId);
          });
        }
      }
    }
  }
);

const dayFocusExcursionIds = computed(() => {
  const date = drawers.mapFocusDate;

  if (!date) {
    return new Set<number>();
  }

  return new Set(
    excursionsStore.excursions
      .filter((excursion) => excursion.date === date)
      .map((excursion) => excursion.id)
  );
});

const dayFocusSpotIds = computed(() => {
  const date = drawers.mapFocusDate;

  if (!date) {
    return new Set<number>();
  }

  const nextSpotIds = new Set<number>();

  for (const spot of spotsStore.spots) {
    if (spot.dates?.some((entry) => entry.date === date)) {
      nextSpotIds.add(spot.id);
    }
  }

  for (const item of scheduleStore.items) {
    if (item.date === date && item.spot_id != null) {
      nextSpotIds.add(item.spot_id);
    }
  }

  for (const entry of diaryStore.entries) {
    if (entry.date === date && Array.isArray(entry.spot_ids)) {
      for (const spotId of entry.spot_ids) {
        nextSpotIds.add(spotId);
      }
    }
  }

  return nextSpotIds;
});

watch(
  () => [drawers.mapFocusDate, drawers.focusVersion, loading.value] as const,
  ([date, , isLoading]) => {
    if (!date || isLoading) {
      return;
    }

    nextTick(() => {
      const firstExcursionId = dayFocusExcursionIds.value.values().next().value;

      if (groupMode.value === 'tours' && firstExcursionId != null) {
        scrollToExcursion(firstExcursionId);
        return;
      }

      const firstSpotId = dayFocusSpotIds.value.values().next().value;

      if (firstSpotId == null) {
        return;
      }

      const el = getSpotElement(firstSpotId, selectedExcursionId.value);
      scrollToSpot(el ?? firstSpotId);
    });
  },
  { immediate: true }
);

// Hash Watcher
watch(
  () => route.hash,
  async (newHash) => {
    if (!newHash) {
      return;
    }

    const spotId = hashHighlightId(newHash, 'spot');

    if (spotId != null) {
      await nextTick();
      drawers.openMapAt(`spot-${spotId}`);
      onFocusSpotFromMap(spotId);
      return;
    }

    const excursionId = hashHighlightId(newHash, 'excursion') ?? hashHighlightId(newHash, 'travel');

    if (excursionId == null) {
      return;
    }

    await nextTick();
    drawers.openMapForExcursion(excursionId);
    onFocusExcursionFromMap(excursionId);
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

function onTourDetailKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || !isTourDetailOpen.value) {
    return;
  }

  if (
    showSpotModal.value ||
    showExcursionModal.value ||
    showCardLegModal.value ||
    showTrackRecordingWarningModal.value ||
    editingTrack.value != null ||
    document.querySelector('.modal, .picker-backdrop, .dropdown-menu, [role="dialog"]')
  ) {
    return;
  }

  closeTourDetail();
}

onMounted(async () => {
  window.addEventListener('keydown', onTourDetailKeydown);
  applyRouteQuery();

  if (parseRouteExcursionId(route.params.excursionId) != null && groupMode.value !== 'tours') {
    groupMode.value = 'tours';
  }

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
      diaryStore.load(),
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
    await onFocusSpotFromMap(hashId);
  } else if (excursionHashId != null) {
    await nextTick();
    drawers.openMapForExcursion(excursionHashId);
    await onFocusExcursionFromMap(excursionHashId);
  } else if (drawers.mapFocusKey) {
    if (drawers.mapFocusKey.startsWith('spot-')) {
      const spotId = Number(drawers.mapFocusKey.replace('spot-', ''));

      if (!Number.isNaN(spotId)) {
        await nextTick();
        await onFocusSpotFromMap(spotId);
      }
    } else if (drawers.mapFocusKey.startsWith('excursion-')) {
      const excId = Number(drawers.mapFocusKey.replace('excursion-', ''));

      if (!Number.isNaN(excId)) {
        await nextTick();
        await onFocusExcursionFromMap(excId);
      }
    }
  } else if (drawers.mapFocusExcursionId != null) {
    await nextTick();
    await onFocusExcursionFromMap(drawers.mapFocusExcursionId);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', onTourDetailKeydown);
  clearExpandSearchTimeout();
  clearTourLineTimeouts();

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
        <div class="sheet-handle-row" @pointerdown="onSheetDragStart">
          <div
            class="sheet-title-group"
            :class="{ 'is-collapsed-search': isCollapsedSearchVisible }"
          >
            <template v-if="isCollapsedSearchVisible">
              <h2 class="sr-only">
                {{ groupMode === 'tours' ? 'Touren' : 'Spots' }}
              </h2>
              <button
                type="button"
                class="collapsed-search-trigger"
                :class="{
                  'has-query': Boolean(searchQuery.trim()),
                  'has-active-filters': activeSearchAndFilterCount > 0,
                }"
                :aria-label="
                  activeSearchAndFilterCount > 0
                    ? `${searchPlaceholder} (${activeSearchAndFilterCount} Filter aktiv)`
                    : searchPlaceholder
                "
                @click="expandAndFocusSearch"
              >
                <AppIcon
                  :icon="ACTION_ICONS.search"
                  :size="16"
                  group="actions"
                  class="collapsed-search-icon"
                />
                <span class="collapsed-search-text">
                  {{ searchQuery.trim() || searchPlaceholder }}
                </span>
                <Badge
                  v-if="activeSearchAndFilterCount > 0"
                  variant="primary"
                  size="sm"
                  class="collapsed-search-badge"
                >
                  {{ activeSearchAndFilterCount }}
                </Badge>
              </button>
            </template>
            <template v-else-if="isSheetOverlayMode && isTourDetailOpen">
              <div
                class="sheet-handle"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Tour-Details ein-/ausklappen"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  shape="squircle"
                  :icon="ACTION_ICONS.arrowLeft"
                  class="tour-detail-back-btn"
                  @pointerdown.stop
                  @click="closeTourDetail"
                >
                  Alle Touren
                </Button>
              </div>
            </template>
            <template v-else>
              <div
                class="sheet-handle"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Spots-Liste ein-/ausklappen"
              >
                <h2 class="sheet-title">
                  <AnimatedText
                    aria-hidden="true"
                    :text="
                      groupMode === 'tours' ? 'Touren' : groupMode === 'tracks' ? 'Tracks' : 'Spots'
                    "
                    :options="['Spots', 'Touren', 'Tracks']"
                    :direction="groupMode === 'tours' ? 'up' : 'down'"
                  />
                  <span class="sr-only">{{
                    groupMode === 'tours' ? 'Touren' : groupMode === 'tracks' ? 'Tracks' : 'Spots'
                  }}</span>
                </h2>
              </div>
              <InfoPopover
                v-if="sheetState !== 'collapsed'"
                class="header-info-popover"
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
            </template>
          </div>
          <div class="sheet-handle-actions">
            <IconButton
              v-if="sheetState !== 'collapsed' && sheetState !== 'full' && canShowSearch"
              variant="ghost"
              size="md"
              :active="activeSearchAndFilterCount > 0"
              :icon="ACTION_ICONS.search"
              :badge="activeSearchAndFilterCount > 0 ? activeSearchAndFilterCount : undefined"
              :title="
                activeSearchAndFilterCount > 0
                  ? `Suche & Filter öffnen (${activeSearchAndFilterCount} aktiv)`
                  : 'Suche & Filter öffnen'
              "
              :aria-label="
                activeSearchAndFilterCount > 0
                  ? `Suche und Filter öffnen (${activeSearchAndFilterCount} aktiv)`
                  : 'Suche und Filter öffnen'
              "
              @click="expandAndFocusSearch"
            />
            <Button
              v-if="sheetState !== 'collapsed' && !isTourDetailOpen"
              size="md"
              class="add-button"
              :class="{ recording: groupMode === 'tracks' && hasActiveRecording }"
              :variant="groupMode === 'tracks' && hasActiveRecording ? 'danger' : 'primary'"
              :aria-label="currentAddButtonAriaLabel"
              @click="onAddButtonClick"
            >
              <AppIcon :icon="currentAddButtonIcon" :size="16" :group="currentAddButtonIconGroup" />
              <span class="add-button__label">
                <AnimatedText
                  :text="currentAddButtonText"
                  :options="animatedTextOptions"
                  :direction="groupMode === 'tours' ? 'up' : 'down'"
                />
              </span>
            </Button>
            <div class="sheet-stepper">
              <IconButton
                variant="ghost"
                size="md"
                class="sheet-step-btn"
                :disabled="!canCollapseSheet"
                :icon="ACTION_ICONS.foldDown"
                aria-label="Spots-Liste weiter runterschieben"
                title="Runterschieben"
                @click="stepSheet(-1)"
              />
              <IconButton
                variant="ghost"
                size="md"
                class="sheet-step-btn"
                :disabled="!canExpandSheet"
                :icon="ACTION_ICONS.foldUp"
                aria-label="Spots-Liste weiter hochschieben"
                title="Hochschieben"
                @click="stepSheet(1)"
              />
            </div>
          </div>
        </div>
        <div
          class="spots-col-body"
          ref="spotsColBodyEl"
          :style="{
            '--category-nav-clearance':
              groupMode === 'category' && (!isSheetOverlayMode || sheetState === 'full')
                ? `${categoryNavHeight}px`
                : '0px',
          }"
          @pointerdown="onSheetBodyPointerDown"
          @touchstart.passive="onCancelProgrammaticScroll"
          @wheel.passive="onCancelProgrammaticScroll"
          @touchmove.passive="onCancelProgrammaticScroll"
        >
          <!-- Sprungziel für TripMap.vue's Tag-/Ausflug-Stationen-Liste: mobil (siehe TripMap.vue's
           Teleport) landet sie hier statt als Overlay über der Karte zu schweben (verdeckte dort
           Kartenausschnitt und teils die Zoom-Steuerung). Auf Desktop bleibt sie unverändert Teil
           der Karte-Spalte (Teleport dort deaktiviert), dieser Anker bleibt also leer. -->
          <div id="map-focus-dock" class="map-focus-dock"></div>
          <div v-if="!isSheetOverlayMode && !isTourDetailOpen" class="header">
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
                class="header-info-popover"
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
            </h2>
            <div class="header-actions">
              <Button
                size="md"
                class="add-button"
                :class="{ recording: groupMode === 'tracks' && hasActiveRecording }"
                :variant="groupMode === 'tracks' && hasActiveRecording ? 'danger' : 'primary'"
                :aria-label="currentAddButtonAriaLabel"
                @click="onAddButtonClick"
              >
                <AppIcon
                  :icon="currentAddButtonIcon"
                  :size="16"
                  :group="currentAddButtonIconGroup"
                />
                <span class="add-button__label">
                  <AnimatedText
                    :text="currentAddButtonText"
                    :options="animatedTextOptions"
                    :direction="groupMode === 'tours' ? 'up' : 'down'"
                  />
                </span>
              </Button>
            </div>
          </div>
          <!-- #515: Der 3-teilige SegmentedToggle (Spots / Touren / Tracks) bekommt eine eigene Zeile
           in voller Breite, damit die größeren 40px-Buttons auch auf 320px ohne Quetschen sitzen. -->
          <SegmentedToggle
            v-if="!isTourDetailOpen"
            v-model="groupMode"
            class="header-mode-toggle"
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
          <div class="subheader" v-if="hasActiveRecording">
            <div class="active-recording-banner">
              <span class="recording-pulse-dot" aria-hidden="true"></span>
              <span class="recording-banner-text">Standortaufzeichnung aktiv</span>
            </div>
          </div>

          <!-- Touren-Formular: Modale Komponente mit useTourForm (#446) -->
          <ExcursionFormModal
            ref="excursionFormModalRef"
            v-model:show="showExcursionModal"
            v-model:excursion="editingExcursion"
            :default-role="activeExcursionRole"
            :default-title="activeExcursionTitle"
            :users="users"
            :excursion-for-group-title="excursionForGroupTitle"
            @create-spot="onCreateSpotFromExcursionModal"
          />

          <div
            v-if="canShowSearch"
            class="drawer-search-accordion"
            :class="{ 'is-collapsed': isSheetOverlayMode && sheetState !== 'full' }"
            :inert="isSheetOverlayMode && sheetState !== 'full'"
          >
            <div class="drawer-search-accordion-inner">
              <div class="filter-bar">
                <SearchFilterBar
                  ref="searchFilterBarRef"
                  v-model:search-query="searchQuery"
                  v-model:sort-mode="sortMode"
                  v-model:category-filter="categoryFilter"
                  v-model:status-filter="statusFilter"
                  v-model:tour-role-filter="tourRoleFilter"
                  :category-options="filterCategoryOptions"
                  :search-placeholder="searchPlaceholder"
                />

                <div
                  class="filter-chips"
                  v-if="categoryFilter.length || statusFilter.length || tourRoleFilter.length"
                >
                  <Badge
                    v-for="cat in categoryFilter"
                    :key="cat"
                    variant="primary"
                    size="sm"
                    closable
                    close-aria-label="Filter entfernen"
                    close-title="Filter entfernen"
                    class="filter-chip"
                    @close="removeCategoryFilter(cat)"
                  >
                    <AppIcon :icon="groupIconDef(cat)" :size="13" group="categories" /> {{ cat }}
                  </Badge>
                  <Badge
                    v-for="status in statusFilter"
                    :key="status"
                    variant="primary"
                    size="sm"
                    closable
                    close-aria-label="Filter entfernen"
                    close-title="Filter entfernen"
                    class="filter-chip"
                    @close="removeStatusFilter(status)"
                  >
                    <AppIcon :icon="STATUS_FILTER_ICON[status]" :size="13" group="actions" />
                    {{ STATUS_FILTER_LABEL[status] }}
                  </Badge>
                  <Badge
                    v-for="role in tourRoleFilter"
                    :key="role"
                    variant="primary"
                    size="sm"
                    closable
                    close-title="Filter entfernen"
                    close-aria-label="Filter entfernen"
                    class="filter-chip"
                    @close="removeTourRoleFilter(role)"
                  >
                    <AppIcon :icon="tourRoleIconDef(role)" :size="13" group="categories" />
                    {{ tourRoleLabel(role) }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <!-- Spot-Formular: Modale Komponente mit useSpotForm (#446) -->
          <SpotFormModal
            v-model:show="showSpotModal"
            v-model:spot="editingSpot"
            :default-category="defaultSpotCategory"
            :default-tour-title="defaultSpotTourTitle"
            :trip-id="tripId"
            :users="users"
            :spot-scheduled-dates="spotScheduledDates"
            @created="onSpotCreated"
          />

          <!-- Sticky Category Nav Bar (#144, #446) -->
          <ExcursionCategoryNav
            v-if="groupMode === 'category'"
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
            <Transition
              :name="tourViewTransitionName || undefined"
              :css="Boolean(tourViewTransitionName)"
              :mode="tourViewTransitionName ? 'out-in' : undefined"
              @enter="onTourViewEnter"
              @after-enter="onTourViewAfterEnter"
            >
              <div
                v-if="isTourDetailOpen && selectedExcursion"
                key="tour-detail"
                ref="tourDetailScreenEl"
                class="tour-detail-screen"
              >
                <div v-if="!isSheetOverlayMode" class="tour-detail-back-bar">
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="squircle"
                    :icon="ACTION_ICONS.arrowLeft"
                    class="tour-detail-back-btn"
                    @click="closeTourDetail"
                  >
                    Alle Touren
                  </Button>
                </div>

                <TourDetailView
                  :key="selectedExcursion.id"
                  :excursion="selectedExcursion"
                  :creator-label="creatorLabel(selectedExcursion.created_by)"
                  :like-count="excursionLikesFor(selectedExcursion.id).length"
                  :liked="excursionLikedByMe(selectedExcursion.id)"
                  :comments="excursionCommentItemsFor(selectedExcursion.id)"
                  :stations="spotsStore.spots"
                  :travel-items="travelItems"
                  @edit="startEditExcursion"
                  @toggle-like="toggleExcursionLike(selectedExcursion.id)"
                  @submit-comment="
                    (content) => submitExcursionComment(selectedExcursion!.id, content)
                  "
                  @remove-comment="removeExcursionComment"
                  @update-comment="updateExcursionComment"
                  @toggle-comment-like="toggleExcursionCommentLike"
                  @show-on-map="onExcursionShowOnMap(selectedExcursion.id)"
                  @update-note="(html) => excursionsStore.updateNote(selectedExcursion!.id, html)"
                >
                  <template #stations>
                    <TourSerpentineWrap
                      v-if="selectedExcursionStationItems.length"
                      :excursion="selectedExcursion"
                      :items="selectedExcursionStationItems"
                      :tour-line="tourLines.get(selectedExcursion.id)"
                      :cols="getTourCols(selectedExcursion.id)"
                      :rows="getTourRows(selectedExcursion, selectedExcursionStationItems)"
                      :expanded-spot-id="expandedSpotId"
                      :highlighted-ids="highlightedSpotIds"
                      :day-focus-highlighted-ids="dayFocusSpotIds"
                      :spot-scheduled-dates="spotScheduledDates"
                      :users="users"
                      :spot-comment-items-for="spotCommentItemsFor"
                      :get-tour-layover="getTourLayover"
                      :set-spot-ref="setSpotRef"
                      :set-tour-wrap-ref="setTourWrapRef"
                      @open-leg-modal="
                        (fromSpot, toSpot) => openCardLegModal(selectedExcursion!, fromSpot, toSpot)
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
                      @add-spot-to-tour="
                        (spotId) => onAddExistingSpotToTour(selectedExcursion!, spotId)
                      "
                      @create-spot-for-tour="onCreateSpotForTourCard(selectedExcursion!)"
                      @update-spot-note="({ spotId, note }) => spotsStore.updateNote(spotId, note)"
                    />
                    <div v-else class="empty tour-empty-group">
                      <p class="tour-empty-text">
                        Noch keine Spots zugeordnet – füge Stationen hinzu oder bearbeite die
                        Tour-Details.
                      </p>
                      <div class="tour-empty-actions">
                        <TourSpotAssignDropdown
                          :spots="spotsStore.spots"
                          :selected-spot-ids="selectedExcursion?.spot_ids ?? []"
                          @select-spot="
                            (spotId) => onAddExistingSpotToTour(selectedExcursion!, spotId)
                          "
                          @create-spot="onCreateSpotForTourCard(selectedExcursion!)"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          class="tour-empty-action-btn"
                          @click="startEditExcursion(selectedExcursion)"
                        >
                          <AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" />
                          <span>Tour bearbeiten</span>
                        </Button>
                      </div>
                    </div>
                  </template>
                </TourDetailView>
              </div>

              <div v-else key="list-view" class="tour-list-screen">
                <section
                  class="group category-group"
                  :class="{
                    'is-tour-group': !!grp.excursion,
                  }"
                  v-for="grp in spotGroups"
                  :key="grp.category"
                >
                  <ExcursionCard
                    v-if="grp.excursion"
                    :ref="(el) => setTourCardRef(grp.category, grp.excursion!.id, el)"
                    class="tour-group-card"
                    :excursion="grp.excursion"
                    :highlighted="highlightedExcursionIds.has(grp.excursion.id)"
                    :focused="dayFocusExcursionIds.has(grp.excursion.id)"
                    :like-count="excursionLikesFor(grp.excursion.id).length"
                    :liked="excursionLikedByMe(grp.excursion.id)"
                    :comments="excursionCommentItemsFor(grp.excursion.id)"
                    :stations="spotsStore.spots"
                    :travel-items="travelItems"
                    @open="onExcursionCardOpen(grp.excursion)"
                  />
                  <template v-else>
                    <h3 class="category-heading" :ref="(el) => setCategoryRef(grp.category, el)">
                      <AppIcon
                        :icon="grp.iconDef"
                        group="categories"
                        :color="groupIconColor(grp)"
                      />
                      {{ grp.category }}
                    </h3>
                    <!-- Nicht-Touren (Kategorie-Modus): Standard-Grid -->
                    <TransitionGroup tag="div" name="list" class="grid cards">
                      <template v-for="(item, index) in grp.items" :key="`spot-${item.spot.id}`">
                        <SpotCard
                          :ref="(el) => setSpotRef(item.spot.id, el, null)"
                          class="staggered-spot"
                          :style="[{ '--stagger-idx': index, '--stagger-total': grp.items.length }]"
                          :spot="item.spot"
                          :highlighted="highlightedSpotIds.has(item.spot.id)"
                          :focused="dayFocusSpotIds.has(item.spot.id)"
                          :expanded="expandedSpotId === item.spot.id"
                          :scheduled-date="spotScheduledDates.get(item.spot.id) ?? null"
                          :creator-label="creatorLabel(item.spot.created_by)"
                          :payer-label="creatorLabel(item.spot.paid_by_user_id)"
                          :like-count="spotsStore.likeCountFor(item.spot.id)"
                          :liked="spotsStore.likedByMe(item.spot.id, auth.user?.id)"
                          :comments="spotCommentItemsFor(item.spot.id)"
                          :has-multiple-members="users.length > 1"
                          :accommodation-distance="
                            spotAccommodationDistances.get(item.spot.id) ?? null
                          "
                          @edit="startEditSpot"
                          @toggle-like="toggleSpotLike(item.spot.id)"
                          @submit-comment="(content) => submitSpotComment(item.spot.id, content)"
                          @remove-comment="removeSpotComment"
                          @update-comment="updateSpotComment"
                          @toggle-comment-like="toggleSpotCommentLike"
                          @open="(spot, el) => onSpotCardOpen(spot, el)"
                          @close="onSpotCardClose"
                          @show-on-map="onSpotShowOnMap(item.spot)"
                          @update-note="(html) => spotsStore.updateNote(item.spot.id, html)"
                        />
                      </template>
                    </TransitionGroup>
                  </template>
                </section>
                <div v-if="!spotGroups.length" class="empty-state-wrap">
                  <EmptyState
                    v-if="
                      isAccommodationFilterActive && !searchQuery.trim() && !statusFilter.length
                    "
                  >
                    Noch keine Unterkunft eingetragen. Trage hier dein Hotel, deine Ferienwohnung
                    oder deinen Campingplatz ein.
                  </EmptyState>
                  <EmptyState
                    v-else-if="isTravelFilterActive && !searchQuery.trim() && !statusFilter.length"
                  >
                    Noch keine Reise eingetragen. Hinterlege deine Anreise, Flüge oder
                    Zugverbindungen.
                  </EmptyState>
                  <EmptyState v-else>
                    <template v-if="hasActiveFilters">
                      Keine {{ groupMode === 'tours' ? 'Touren' : 'Spots' }} für die aktuellen
                      Filter oder Suchbegriffe gefunden.
                    </template>
                    <template v-else-if="groupMode === 'tours'">
                      Noch keine Touren angelegt.
                    </template>
                    <template v-else> Noch keine Spots angelegt. </template>
                  </EmptyState>

                  <Button
                    v-if="
                      isAccommodationFilterActive && !searchQuery.trim() && !statusFilter.length
                    "
                    variant="primary"
                    size="sm"
                    class="empty-cta-btn"
                    @click="openSpotForm('Unterkunft')"
                  >
                    <AppIcon
                      :icon="spotCategoryMeta('Unterkunft').tabler"
                      :size="15"
                      group="categories"
                    />
                    <span>Unterkunft eintragen</span>
                  </Button>

                  <Button
                    v-else-if="isTravelFilterActive && !searchQuery.trim() && !statusFilter.length"
                    variant="primary"
                    size="sm"
                    class="empty-cta-btn"
                    @click="openExcursionForm(defaultTravelRole, defaultTravelTitle)"
                  >
                    <AppIcon :icon="SECTION_ICON_DEFS.travel" :size="15" group="actions" />
                    <span>{{ emptyTravelCtaLabel }}</span>
                  </Button>

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
              </div>
            </Transition>
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

<style lang="scss" scoped>
/* Mobil (Default): kein eigener Titel-Balken über der (jetzt dahinterliegenden, siehe .map-col
   weiter unten) vollflächigen Karte – anders als bei Google Maps (Vorbild für die vollflächige
   Karte) ist das hier kein Suchfeld, nur eine leere Kopfzeile ohne Funktion. Auf Desktop
   (@container weiter unten) bleibt der bisherige schlichte Titel unverändert sichtbar. */
.page-title {
  display: none;
  font-size: var(--font-size-xl);
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
  /* Links und rechts auf var(--space-4) ausgerichtet (Fluchtlinie passend zum Standard-Seitenabstand). */
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
  background: transparent;
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
    border-radius 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    border-color 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  overflow: hidden;
  /* Bekannter iOS-Safari-Bug: ein fixed/absolute positioniertes Element mit border-radius+box-shadow
     malt seinen Hintergrund beim allerersten Paint mitunter nicht korrekt (bleibt transparent, bis
     irgendeine Interaktion – z. B. das Ziehen am Griff – einen Repaint erzwingt). Zudem dient ::before
     im Liquid-Glass-Modus (.collapsed / .partial) als eigenständige Hintergrund-/Blur-Ebene unter
     den Kindern, damit .spots-col selbst keinen Backdrop-Root bildet und sticky Kinder wie
     .category-nav-wrap ihren eigenen backdrop-filter auf gescrollte Karten anwenden können. */
}

.spots-col::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  corner-shape: inherit;
  background: var(--color-surface);
  backdrop-filter: none;
  transform: translateZ(0);
  transition: background-color 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Obere Glanzkante als eigenes Overlay-Layer über .spots-col-body und sticky .category-nav-wrap,
   damit der opake Hintergrund der fixierten Tab-Leiste beim Scrollen die Kante nicht überdeckt. */
.spots-col::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  border-radius: inherit;
  corner-shape: inherit;
  box-shadow: inset 0 1px 0 var(--shadow-control-highlight);
}

/* Wie bei Apple Karten: im eingeklappten ("klein") und angeschnittenen ("halb") Zustand schwebt
   das Sheet mit Liquid-Glass-Effekt über der Karte; erst ganz hochgezogen (.full) wird es
   undurchsichtig. */
.spots-col.collapsed,
.spots-col.partial {
  --color-divider-groove: var(--color-divider-groove-glass);
  --color-divider-highlight: var(--color-divider-highlight-glass);
  border-color: var(--color-surface-glass-border);
  box-shadow: var(--shadow-floating-island);
}

.spots-col.collapsed::before,
.spots-col.partial::before {
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
}

/* Kategorie-TabNav auf dem Liquid-Glass-Sheet: im ungescrollten Zustand transparent (ohne eigenen
   Blur-Block), damit keine doppelte Blur-Kante auf dem Glas entsteht; sobald gescrollter Inhalt
   darunter liegt (auch beim Zurückstufen von full -> partial mit erhaltenem scrollTop), bleibt
   der Hintergrund transparent und ein verstärkter backdrop-filter: blur(...) verhindert das
   Durchscheinen des Contents, ohne eine opake Fläche auf das Glas zu legen. */
.spots-col.collapsed :deep(.category-nav-wrap),
.spots-col.partial :deep(.category-nav-wrap) {
  --category-nav-bg: transparent;
  background: var(--category-nav-bg);
  backdrop-filter: none;
}

.spots-col.partial :deep(.category-nav-wrap.is-stuck) {
  --category-nav-bg: transparent;
  background: var(--category-nav-bg);
  backdrop-filter: blur(max(16px, calc(var(--glass-blur, 6px) * 2))) saturate(180%);
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
  border-radius: var(--radius-pill);
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
    padding-bottom: calc(var(--navbar-bottom-offset, 0px) + var(--spots-col-pad));
  }
}

.spots-col.dragging,
.spots-col.dragging::before {
  transition: none;
}

.sheet-handle-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  /* Seitliches/oberes Polster deutlich großzügiger als die alten 8px/4px - bei der jetzt sichtbar
     gerundeten Sheet-Ecke (--radius-lg-squircle, siehe .spots-col oben) saßen die Stufen-Buttons
     sonst fast in der Rundung selbst statt sichtbar davor (genau der von Apples "X"-Button
     abweichende Effekt aus dem PR-Review-Screenshot). */
  padding: var(--space-lg) var(--space-lg) var(--space-md);
  /* Gilt für die ganze Zeile (nicht nur .sheet-handle): ein Zug, der knapp neben dem eigentlichen
     Anfasser beginnt (z. B. noch über den Stufen-Buttons), soll trotzdem nicht als Seiten-Scroll/
     Pull-to-Refresh interpretiert werden. */
  touch-action: none;
}

/* Im collapsed-Zustand ist die Anfasser-Zeile der komplette sichtbare Inhalt der Pille (siehe
   .spots-col.collapsed oben) - volle Höhe (100%), zentriertes Flex-Layout und seitliches Polster
   von 12px innerhalb des 1px-Rahmens (= 13px zur Außenkante), damit sowohl das 38px hohe Suchfeld
   links als auch die 38x38px-Stufenbuttons rechts oben, unten und seitlich exakt denselben
   konzentrischen Abstand zur 64px-Pille (Radius 32px) einhalten. */
.spots-col.collapsed .sheet-handle-row {
  height: 100%;
  box-sizing: border-box;
  align-items: center;
  padding: 0 var(--space-md);
}

.sheet-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  min-width: 0;
}

.sheet-title-group.is-collapsed-search {
  flex: 1 1 auto;
}

.collapsed-search-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
  height: 38px;
  padding: 0 var(--space-3);
  box-sizing: border-box;
  border-radius: var(--radius-pill);
  corner-shape: round;
  background-color: var(--color-glass-field-inset-bg);
  background-image: none;
  border: 1px solid var(--color-glass-field-inset-border);
  box-shadow: var(--shadow-glass-field-inset);
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-align: left;
  cursor: text;
  user-select: none;
  touch-action: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.collapsed-search-trigger::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 44px;
  transform: translateY(-50%);
}

.collapsed-search-trigger.has-query {
  color: var(--color-text);
}

.collapsed-search-trigger.has-active-filters {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--color-glass-field-inset-border));
}

@include can-hover {
  .collapsed-search-trigger:hover {
    background-color: var(--color-glass-field-inset-hover-bg);
    color: var(--color-text);
  }
}

.collapsed-search-trigger:active {
  background-color: var(--color-glass-field-inset-hover-bg);
  box-shadow: var(--shadow-control-active);
}

.collapsed-search-trigger:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo), var(--shadow-glass-field-inset);
}

.collapsed-search-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.collapsed-search-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.collapsed-search-badge {
  flex-shrink: 0;
}

.sheet-handle {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  min-width: 0;
  cursor: grab;
  touch-action: none;
}

.spots-col.collapsed .sheet-handle {
  padding: 0;
  margin: 0;
}

.sheet-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  margin: 0;
  min-width: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-text);
  user-select: none;
}

.sheet-title :deep(.animated-text) {
  flex-shrink: 0;
}

.sheet-title-group .sr-only {
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

.sheet-handle-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  touch-action: none;

  :deep(button),
  :deep(.btn) {
    touch-action: none;
  }
}

.sheet-stepper {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-left: var(--space-2);
}

.sheet-stepper:first-child {
  margin-left: 0;
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

.spots-col-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* Verhindert, dass der Browser die Scrollposition beim Auf-/Zuklappen einer Spot-Karte (SpotCard.vue,
     ändert ihre Höhe drastisch) eigenmächtig "korrigiert" (CSS Scroll Anchoring, standardmäßig an) -
     kollidiert hier mit der View-Transition (#90, siehe animateSpotExpand() im Script): während die
     transitionierende Karte kurzzeitig aus dem normalen Layout genommen wird (view-transition-name),
     kann der Browser den falschen Anker wählen und springt sichtbar zu einer völlig anderen Stelle in
     der Liste (#140 - "Details verschwinden", auf Safari/iOS deutlich ausgeprägter als auf Chrome). */
  overflow-anchor: none;
  --spots-col-pad: var(--space-lg);
  padding: 0 var(--spots-col-pad) var(--spots-col-pad);
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

  :deep(*) {
    touch-action: none;
  }
}

/* Leer (kein Fokus aktiv bzw. Desktop, siehe TripMap.vue), wenn nichts hineingeteleportet wurde –
   dann soll der Anker keinen Platz beanspruchen. */
.map-focus-dock:empty {
  display: none;
}

.map-focus-dock:not(:empty) {
  padding-top: 0;
  margin-bottom: var(--space-lg);
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
@include media-up('desktop') {
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
      backdrop-filter: none;
      border-radius: var(--radius-md-squircle);
      corner-shape: squircle;
      border: 1px solid var(--color-border);
      box-shadow: var(--shadow-md);
      --color-divider-groove: var(--color-divider-groove-surface);
      --color-divider-highlight: var(--color-divider-highlight-surface);
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

    .spots-col::before,
    .spots-col.collapsed::before,
    .spots-col.partial::before,
    .spots-col.full::before {
      background: var(--color-surface);
      backdrop-filter: none;
      transition: none;
    }

    /* .spots-col ist auf Desktop undurchsichtig, Glas-/Blur-Regeln von Mobil-States zurücksetzen. */
    .spots-col :deep(.category-nav-wrap),
    .spots-col.collapsed :deep(.category-nav-wrap),
    .spots-col.partial :deep(.category-nav-wrap),
    .spots-col.partial :deep(.category-nav-wrap.is-stuck) {
      --category-nav-bg: var(--color-surface);
      background: var(--category-nav-bg);
      backdrop-filter: none;
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
      --spots-col-pad: var(--space-xl);
      padding: var(--spots-col-pad);
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
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.subheader {
  margin-bottom: var(--space-3);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.header h2 {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  margin: 0;
  min-width: 0;
}

.header h2 :deep(.animated-text) {
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
}

/* #515: Der 3-teilige SegmentedToggle (Spots / Touren / Tracks) sitzt in einer eigenen Zeile
   über die volle Breite des Drawer-Headers, sodass die Segmente auch auf 320px ohne Quetschen sitzen. */
.header-mode-toggle {
  width: 100%;
  flex: 1 1 100%;
  margin-bottom: var(--space-md);
}

.header-mode-toggle :deep(.segmented-option) {
  flex: 1;
  justify-content: center;
  min-width: 0;
}

@include container-spots-col-down('mobile-sm') {
  .spots-col-body,
  .spots-col.collapsed .spots-col-body,
  .spots-col.partial .spots-col-body,
  .spots-col.full .spots-col-body {
    --spots-col-pad: var(--space-lg);
  }

  .sheet-handle-actions .add-button__label {
    display: none;
  }
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

@include can-hover {
  .header-actions button.recording:hover {
    background: color-mix(in srgb, var(--color-danger) 85%, black);
    border-color: color-mix(in srgb, var(--color-danger) 85%, black);
  }
}

.active-recording-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1-5) var(--space-md);
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, var(--color-border));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-danger);
  font-size: var(--font-size-xs);
  font-weight: 500;
  margin-top: var(--space-2);
}

.recording-pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-pill);
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
  margin-bottom: var(--space-xl);
  min-width: 0;
}

.group:last-of-type {
  margin-bottom: 0;
}

.category-group.is-tour-group {
  margin-left: calc(var(--spots-col-pad, var(--space-lg)) * -1);
  margin-right: calc(var(--spots-col-pad, var(--space-lg)) * -1);
  margin-bottom: 0;
  @include divider-engraved('bottom');
  transition:
    background 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.category-group.is-tour-group:first-of-type {
  @include divider-engraved('both');
}

.tour-empty-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

.tour-empty-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.tour-empty-text {
  margin: 0;
}

.category-group.is-tour-group + .category-group:not(.is-tour-group) {
  margin-top: var(--space-xl);
}

.group h3 {
  font-size: var(--font-size-md);
  color: var(--color-primary-dark);
  margin: 0 0 var(--space-md);
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  align-items: start;
}

.tour-detail-screen,
.tour-list-screen {
  min-width: 0;
}

.tour-detail-back-bar {
  display: flex;
  align-items: center;
  padding: 0 0 var(--space-md);
  @include divider-engraved('bottom');
}

.tour-detail-back-btn {
  margin-left: calc(var(--space-2) * -1);
  color: var(--color-text-muted);
}

.tour-drill-forward-enter-active,
.tour-drill-forward-leave-active,
.tour-drill-back-enter-active,
.tour-drill-back-leave-active {
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tour-drill-forward-enter-from {
  opacity: 0;
  transform: translateX(16px);
}

.tour-drill-forward-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}

.tour-drill-back-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}

.tour-drill-back-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

@media (prefers-reduced-motion: reduce) {
  .spots-col,
  .spots-col::before {
    transition: none;
  }
  .category-group.is-tour-group {
    transition: none;
  }
  .recording-pulse-dot {
    animation: none;
  }
  .drawer-search-accordion {
    transition: none;
  }
  .tour-drill-forward-enter-active,
  .tour-drill-forward-leave-active,
  .tour-drill-back-enter-active,
  .tour-drill-back-leave-active {
    transform: none !important;
    transition: opacity 0.12s ease !important;
  }
  .tour-drill-forward-enter-from,
  .tour-drill-forward-leave-to,
  .tour-drill-back-enter-from,
  .tour-drill-back-leave-to {
    transform: none !important;
  }
}

.empty-state-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
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
@include container-spots-col-down('mobile') {
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
/* Im partial-Zustand des mobilen Bottom-Sheets klappt die Such-/Filterleiste weich ein (#684),
   damit die eigentlichen Spots/Touren direkt sichtbar sind. */
.drawer-search-accordion {
  display: grid;
  grid-template-rows: 1fr;
  transition:
    grid-template-rows 0.25s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease;
  opacity: 1;
}

.drawer-search-accordion.is-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
}

.drawer-search-accordion-inner {
  min-height: 0;
  padding-top: var(--space-1-5);
  margin-top: calc(-1 * var(--space-1-5));
  padding-bottom: var(--space-1-5);
  margin-bottom: calc(-1 * var(--space-1-5));
  overflow: visible;
}

.drawer-search-accordion.is-collapsed .drawer-search-accordion-inner {
  overflow: hidden;
}

.filter-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin: 0 0 var(--space-lg);
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
  border: 1px solid var(--color-primary);
}

.category-heading {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
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

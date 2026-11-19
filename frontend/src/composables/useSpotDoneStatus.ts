import { computed, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Excursion, IdeaRole, Spot } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import {
  DATES_POPOVER_WIDTH_PX,
  UNPLANNED_POPOVER_HEIGHT_PX,
  UNPLANNED_POPOVER_WIDTH_PX,
  useDoneStatusPopovers,
  type PopoverPositionStyle,
} from './useDoneStatusPopovers';

const DATES_POPOVER_HEIGHT_PX = 240;

export interface ScheduledSpotItem {
  id: string | number;
  date: string;
  done: boolean | number;
  type: 'spotDate' | 'tour' | 'prop';
  sourceId: number;
  title?: string;
  /** Nur bei type 'tour': Reiserolle (Anreise/Abreise/Weiterreise) bzw. null für Ausflüge. */
  role?: IdeaRole | null;
}

export interface UseSpotDoneStatusOptions {
  spot: MaybeRefOrGetter<Spot>;
  scheduledDate: MaybeRefOrGetter<string | null>;
}

export interface UseSpotDoneStatusReturn {
  scheduledItemsForSpot: ComputedRef<ScheduledSpotItem[]>;
  totalItemsCount: ComputedRef<number>;
  doneItemsCount: ComputedRef<number>;
  allItemsDone: ComputedRef<boolean>;
  isSpotDone: ComputedRef<boolean>;
  isSpotPartiallyDone: ComputedRef<boolean>;
  datesPopoverOpen: Ref<boolean>;
  datesPopoverStyle: Ref<PopoverPositionStyle>;
  unplannedPopoverOpen: Ref<boolean>;
  unplannedPopoverStyle: Ref<PopoverPositionStyle>;
  unplannedDoneDate: Ref<string>;
  onToggleDone: (event?: MouseEvent) => Promise<void>;
  toggleScheduledItemDone: (item: ScheduledSpotItem) => Promise<void>;
  submitUnplannedDone: () => Promise<void>;
  submitUnplannedPlan: () => Promise<void>;
  openCalendarConfirmDone: () => void;
}

function collectSpotDateItems(spot: Spot): ScheduledSpotItem[] {
  const result: ScheduledSpotItem[] = [];

  for (const entry of spot.dates ?? []) {
    if (entry.date) {
      result.push({
        id: entry.id,
        date: entry.date,
        done: Boolean(entry.done),
        type: 'spotDate',
        sourceId: entry.id,
        title: spot.title,
      });
    }
  }

  return result;
}

function collectTourItems(spotId: number, excursions: Excursion[]): ScheduledSpotItem[] {
  const result: ScheduledSpotItem[] = [];

  for (const excursion of excursions) {
    if (excursion.date && excursion.spot_ids.includes(spotId)) {
      result.push({
        id: `tour-${excursion.id}`,
        date: excursion.date,
        done: Boolean(excursion.done),
        type: 'tour',
        sourceId: excursion.id,
        title: excursion.title,
        role: excursion.role,
      });
    }
  }

  return result;
}

export function useSpotDoneStatus(options: UseSpotDoneStatusOptions): UseSpotDoneStatusReturn {
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const drawers = useDrawersStore();

  const {
    datesPopoverOpen,
    datesPopoverStyle,
    unplannedPopoverOpen,
    unplannedPopoverStyle,
    unplannedDoneDate,
    positionAndOpenPopover,
  } = useDoneStatusPopovers();

  const scheduledItemsForSpot = computed<ScheduledSpotItem[]>(() => {
    const spot = toValue(options.spot);
    const result: ScheduledSpotItem[] = [
      ...collectSpotDateItems(spot),
      ...collectTourItems(spot.id, excursionsStore.excursions),
    ];

    if (result.length === 0) {
      const fallbackDate = toValue(options.scheduledDate);

      if (fallbackDate) {
        result.push({
          id: `prop-${fallbackDate}`,
          date: fallbackDate,
          done: Boolean(spot.done),
          type: 'prop',
          sourceId: spot.id,
          title: spot.title,
        });
      }
    }

    const isSingleTour = result.length === 1 && result[0].type === 'tour';

    if (isSingleTour && spot.done) {
      result[0].done = true;
    }

    return result.sort((first, second) => first.date.localeCompare(second.date));
  });

  const totalItemsCount = computed(() => scheduledItemsForSpot.value.length);
  const doneItemsCount = computed(
    () => scheduledItemsForSpot.value.filter((item) => Boolean(item.done)).length
  );
  const allItemsDone = computed(
    () => totalItemsCount.value > 0 && doneItemsCount.value === totalItemsCount.value
  );
  const isSpotDone = computed(() => {
    if (totalItemsCount.value > 0) {
      return allItemsDone.value;
    }

    const spot = toValue(options.spot);
    return Boolean(spot.done);
  });
  const isSpotPartiallyDone = computed(() => {
    return totalItemsCount.value > 1 && doneItemsCount.value > 0 && !allItemsDone.value;
  });

  async function onToggleDone(event?: MouseEvent) {
    const spot = toValue(options.spot);

    if (totalItemsCount.value >= 1) {
      await positionAndOpenPopover({
        event,
        openRef: datesPopoverOpen,
        styleRef: datesPopoverStyle,
        selector: '.spot-dates-popover',
        widthPx: DATES_POPOVER_WIDTH_PX,
        heightPx: DATES_POPOVER_HEIGHT_PX,
      });
      return;
    }

    if (spot.done) {
      await spotsStore.setDone(spot.id, false);
      return;
    }

    await positionAndOpenPopover({
      event,
      openRef: unplannedPopoverOpen,
      styleRef: unplannedPopoverStyle,
      selector: '.spot-unplanned-popover',
      widthPx: UNPLANNED_POPOVER_WIDTH_PX,
      heightPx: UNPLANNED_POPOVER_HEIGHT_PX,
    });
  }

  async function toggleScheduledItemDone(item: ScheduledSpotItem) {
    const spot = toValue(options.spot);

    if (item.type === 'tour') {
      if (spot.done) {
        await spotsStore.setDone(spot.id, false);
      }

      await excursionsStore.setDone(item.sourceId, !item.done);
    } else if (item.type === 'spotDate') {
      await spotsStore.updateDate(spot.id, item.sourceId, { done: !item.done });
    } else {
      await spotsStore.setDone(spot.id, !item.done);
    }
  }

  async function saveUnplannedDate(done: boolean) {
    const spot = toValue(options.spot);

    if (unplannedDoneDate.value) {
      await spotsStore.addDate(spot.id, unplannedDoneDate.value, done);
      unplannedPopoverOpen.value = false;
      return;
    }

    if (done) {
      await spotsStore.setDone(spot.id, true);
      unplannedPopoverOpen.value = false;
    }
  }

  async function submitUnplannedDone() {
    await saveUnplannedDate(true);
  }

  async function submitUnplannedPlan() {
    await saveUnplannedDate(false);
  }

  function openCalendarConfirmDone() {
    const spot = toValue(options.spot);
    unplannedPopoverOpen.value = false;
    drawers.startPendingSchedule('spot', spot.id, 'confirm-done');
  }

  return {
    scheduledItemsForSpot,
    totalItemsCount,
    doneItemsCount,
    allItemsDone,
    isSpotDone,
    isSpotPartiallyDone,
    datesPopoverOpen,
    datesPopoverStyle,
    unplannedPopoverOpen,
    unplannedPopoverStyle,
    unplannedDoneDate,
    onToggleDone,
    toggleScheduledItemDone,
    submitUnplannedDone,
    submitUnplannedPlan,
    openCalendarConfirmDone,
  };
}

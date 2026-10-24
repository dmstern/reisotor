import {
  computed,
  nextTick,
  ref,
  toValue,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import type { Spot } from '../api/types';
import { useScheduleStore } from '../stores/schedule';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { toLocalDateString } from '../utils/dateFormat';
import { computePopoverPosition } from '../utils/popoverPosition';

export interface ScheduledSpotItem {
  id: string | number;
  date: string;
  done: boolean | number;
  type: 'schedule' | 'tour' | 'prop';
  sourceId: number;
  title?: string;
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
  datesPopoverStyle: Ref<{ top: string; left: string }>;
  unplannedPopoverOpen: Ref<boolean>;
  unplannedPopoverStyle: Ref<{ top: string; left: string }>;
  unplannedDoneDate: Ref<string>;
  onToggleDone: (event?: MouseEvent) => Promise<void>;
  toggleScheduledItemDone: (item: ScheduledSpotItem) => Promise<void>;
  submitUnplannedDone: () => Promise<void>;
  openCalendarConfirmDone: () => void;
}

export function useSpotDoneStatus(options: UseSpotDoneStatusOptions): UseSpotDoneStatusReturn {
  const scheduleStore = useScheduleStore();
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const tripStore = useTripStore();
  const drawers = useDrawersStore();

  const scheduledItemsForSpot = computed<ScheduledSpotItem[]>(() => {
    const spot = toValue(options.spot);
    const result: ScheduledSpotItem[] = [];

    for (const item of scheduleStore.items) {
      if (item.spot_id === spot.id && item.date) {
        result.push({
          id: item.id,
          date: item.date,
          done: !!item.done,
          type: 'schedule',
          sourceId: item.id,
          title: item.title,
        });
      }
    }

    for (const excursion of excursionsStore.excursions) {
      if (excursion.date && excursion.spot_ids.includes(spot.id)) {
        result.push({
          id: `tour-${excursion.id}`,
          date: excursion.date,
          done: !!excursion.done,
          type: 'tour',
          sourceId: excursion.id,
          title: excursion.title,
        });
      }
    }

    if (result.length === 0) {
      const fallbackDate = toValue(options.scheduledDate);
      if (fallbackDate) {
        result.push({
          id: `prop-${fallbackDate}`,
          date: fallbackDate,
          done: !!spot.done,
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

    return result.sort((a, b) => a.date.localeCompare(b.date));
  });

  const totalItemsCount = computed(() => scheduledItemsForSpot.value.length);
  const doneItemsCount = computed(() => scheduledItemsForSpot.value.filter((i) => !!i.done).length);
  const allItemsDone = computed(
    () => totalItemsCount.value > 0 && doneItemsCount.value === totalItemsCount.value
  );
  const isSpotDone = computed(() => {
    if (totalItemsCount.value > 0) return allItemsDone.value;
    const spot = toValue(options.spot);
    return !!spot.done;
  });
  const isSpotPartiallyDone = computed(() => {
    return totalItemsCount.value > 1 && doneItemsCount.value > 0 && !allItemsDone.value;
  });

  const datesPopoverOpen = ref(false);
  const datesPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

  const unplannedPopoverOpen = ref(false);
  const unplannedPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

  const defaultDate = computed(() => {
    const trip = tripStore.currentTrip;
    const today = toLocalDateString(new Date());
    if (trip && trip.start_date && trip.end_date) {
      if (today >= trip.start_date && today <= trip.end_date) return today;
      return trip.start_date;
    }
    return today;
  });
  const unplannedDoneDate = ref(defaultDate.value);
  watch(defaultDate, (d) => {
    unplannedDoneDate.value = d;
  });

  async function onToggleDone(event?: MouseEvent) {
    const spot = toValue(options.spot);
    const scheduledDate = toValue(options.scheduledDate);

    if (totalItemsCount.value > 1) {
      const triggerEl = (event?.currentTarget as HTMLElement | undefined) ?? null;
      if (triggerEl) {
        datesPopoverStyle.value = computePopoverPosition(triggerEl, {
          menuWidth: 290,
          menuHeight: 240,
        });
      }
      datesPopoverOpen.value = true;
      await nextTick();
      const menuEl = document.querySelector('.spot-dates-popover') as HTMLElement | null;
      if (menuEl && triggerEl) {
        const rect = menuEl.getBoundingClientRect();
        datesPopoverStyle.value = computePopoverPosition(triggerEl, {
          menuWidth: rect.width,
          menuHeight: rect.height,
        });
      }
    } else if (totalItemsCount.value === 1) {
      const item = scheduledItemsForSpot.value[0];
      if (item.type === 'tour') {
        await spotsStore.setDone(spot.id, !isSpotDone.value);
      } else if (item.type === 'schedule') {
        await scheduleStore.setDone(item.sourceId, !item.done);
      } else {
        await spotsStore.setDone(spot.id, !spot.done);
      }
    } else if (scheduledDate) {
      await spotsStore.setDone(spot.id, !spot.done);
    } else {
      const triggerEl = (event?.currentTarget as HTMLElement | undefined) ?? null;
      if (triggerEl) {
        unplannedPopoverStyle.value = computePopoverPosition(triggerEl, {
          menuWidth: 260,
          menuHeight: 180,
        });
      }
      unplannedPopoverOpen.value = true;
      await nextTick();
      const menuEl = document.querySelector('.spot-unplanned-popover') as HTMLElement | null;
      if (menuEl && triggerEl) {
        const rect = menuEl.getBoundingClientRect();
        unplannedPopoverStyle.value = computePopoverPosition(triggerEl, {
          menuWidth: rect.width,
          menuHeight: rect.height,
        });
      }
    }
  }

  async function toggleScheduledItemDone(item: ScheduledSpotItem) {
    if (item.type === 'tour') {
      await excursionsStore.setDone(item.sourceId, !item.done);
    } else if (item.type === 'schedule') {
      await scheduleStore.setDone(item.sourceId, !item.done);
    } else {
      const spot = toValue(options.spot);
      await spotsStore.setDone(spot.id, !item.done);
    }
  }

  async function submitUnplannedDone() {
    if (!unplannedDoneDate.value) return;
    const spot = toValue(options.spot);
    if (tripStore.currentTripId != null) {
      await scheduleStore.setSpotDate(
        spot.id,
        tripStore.currentTripId,
        spot.title,
        unplannedDoneDate.value,
        true
      );
    }
    unplannedPopoverOpen.value = false;
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
    openCalendarConfirmDone,
  };
}

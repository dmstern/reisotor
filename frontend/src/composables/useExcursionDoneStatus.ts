import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Excursion } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { toLocalDateString } from '../utils/dateFormat';
import { computePopoverPosition } from '../utils/popoverPosition';

const DATES_POPOVER_WIDTH_PX = 320;
const DATES_POPOVER_HEIGHT_PX = 180;
const UNPLANNED_POPOVER_WIDTH_PX = 290;
const UNPLANNED_POPOVER_HEIGHT_PX = 220;
const POPOVER_VIEWPORT_PADDING_PX = 16;

export interface UseExcursionDoneStatusOptions {
  excursion: MaybeRefOrGetter<Excursion>;
}

export interface UseExcursionDoneStatusReturn {
  datesPopoverOpen: Ref<boolean>;
  datesPopoverStyle: Ref<{ top: string; left: string }>;
  unplannedPopoverOpen: Ref<boolean>;
  unplannedPopoverStyle: Ref<{ top: string; left: string }>;
  unplannedDoneDate: Ref<string>;
  onToggleDone: (event?: MouseEvent) => Promise<void>;
  togglePlannedDone: () => Promise<void>;
  submitUnplannedDone: () => Promise<void>;
  submitUnplannedPlan: () => Promise<void>;
  openCalendarConfirmDone: () => void;
}

export function useExcursionDoneStatus(
  options: UseExcursionDoneStatusOptions
): UseExcursionDoneStatusReturn {
  const excursionsStore = useExcursionsStore();
  const tripStore = useTripStore();
  const drawers = useDrawersStore();

  const datesPopoverOpen = ref(false);
  const datesPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

  const unplannedPopoverOpen = ref(false);
  const unplannedPopoverStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

  const defaultDate = computed(() => {
    const trip = tripStore.currentTrip;
    const today = toLocalDateString(new Date());

    if (trip && trip.start_date && trip.end_date) {
      if (today >= trip.start_date && today <= trip.end_date) {
        return today;
      }

      return trip.start_date;
    }

    return today;
  });

  const unplannedDoneDate = ref(defaultDate.value);
  watch(defaultDate, (newDate) => {
    unplannedDoneDate.value = newDate;
  });

  async function positionAndOpenPopover(popoverOptions: {
    event?: MouseEvent;
    openRef: Ref<boolean>;
    styleRef: Ref<{ top: string; left: string }>;
    selector: string;
    widthPx: number;
    heightPx: number;
  }) {
    const triggerEl = (popoverOptions.event?.currentTarget as HTMLElement | undefined) ?? null;
    const initialWidth =
      typeof window !== 'undefined'
        ? Math.min(popoverOptions.widthPx, window.innerWidth - POPOVER_VIEWPORT_PADDING_PX)
        : popoverOptions.widthPx;

    if (triggerEl) {
      popoverOptions.styleRef.value = computePopoverPosition(triggerEl, {
        menuWidth: initialWidth,
        menuHeight: popoverOptions.heightPx,
      });
    }

    popoverOptions.openRef.value = true;
    await nextTick();

    if (typeof document !== 'undefined') {
      const menuEl = document.querySelector(popoverOptions.selector) as HTMLElement | null;

      if (menuEl && triggerEl) {
        const rect = menuEl.getBoundingClientRect();
        popoverOptions.styleRef.value = computePopoverPosition(triggerEl, {
          menuWidth: rect.width,
          menuHeight: rect.height,
        });
      }
    }
  }

  async function onToggleDone(event?: MouseEvent) {
    const excursion = toValue(options.excursion);

    if (excursion.date) {
      await positionAndOpenPopover({
        event,
        openRef: datesPopoverOpen,
        styleRef: datesPopoverStyle,
        selector: '.tour-dates-popover',
        widthPx: DATES_POPOVER_WIDTH_PX,
        heightPx: DATES_POPOVER_HEIGHT_PX,
      });
      return;
    }

    if (excursion.done) {
      await excursionsStore.setDone(excursion.id, false);
      return;
    }

    await positionAndOpenPopover({
      event,
      openRef: unplannedPopoverOpen,
      styleRef: unplannedPopoverStyle,
      selector: '.tour-unplanned-popover',
      widthPx: UNPLANNED_POPOVER_WIDTH_PX,
      heightPx: UNPLANNED_POPOVER_HEIGHT_PX,
    });
  }

  async function togglePlannedDone() {
    const excursion = toValue(options.excursion);
    await excursionsStore.setDone(excursion.id, !excursion.done);
  }

  async function submitUnplannedDone() {
    const excursion = toValue(options.excursion);

    if (!unplannedDoneDate.value) {
      return;
    }

    await excursionsStore.setDate(excursion.id, unplannedDoneDate.value);
    await excursionsStore.setDone(excursion.id, true);
    unplannedPopoverOpen.value = false;
  }

  async function submitUnplannedPlan() {
    const excursion = toValue(options.excursion);

    if (!unplannedDoneDate.value) {
      return;
    }

    await excursionsStore.setDate(excursion.id, unplannedDoneDate.value);
    unplannedPopoverOpen.value = false;
  }

  function openCalendarConfirmDone() {
    const excursion = toValue(options.excursion);
    unplannedPopoverOpen.value = false;
    drawers.startPendingSchedule('excursion', excursion.id, 'confirm-done');
  }

  return {
    datesPopoverOpen,
    datesPopoverStyle,
    unplannedPopoverOpen,
    unplannedPopoverStyle,
    unplannedDoneDate,
    onToggleDone,
    togglePlannedDone,
    submitUnplannedDone,
    submitUnplannedPlan,
    openCalendarConfirmDone,
  };
}

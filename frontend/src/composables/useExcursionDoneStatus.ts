import { toValue, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Excursion } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import {
  DATES_POPOVER_WIDTH_PX,
  UNPLANNED_POPOVER_HEIGHT_PX,
  UNPLANNED_POPOVER_WIDTH_PX,
  useDoneStatusPopovers,
  type PopoverPositionStyle,
} from './useDoneStatusPopovers';

const DATES_POPOVER_HEIGHT_PX = 180;

export interface UseExcursionDoneStatusOptions {
  excursion: MaybeRefOrGetter<Excursion>;
}

export interface UseExcursionDoneStatusReturn {
  datesPopoverOpen: Ref<boolean>;
  datesPopoverStyle: Ref<PopoverPositionStyle>;
  unplannedPopoverOpen: Ref<boolean>;
  unplannedPopoverStyle: Ref<PopoverPositionStyle>;
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
  const drawers = useDrawersStore();

  const {
    datesPopoverOpen,
    datesPopoverStyle,
    unplannedPopoverOpen,
    unplannedPopoverStyle,
    unplannedDoneDate,
    positionAndOpenPopover,
  } = useDoneStatusPopovers();

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

    if (unplannedDoneDate.value) {
      await excursionsStore.setDate(excursion.id, unplannedDoneDate.value);
    }

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

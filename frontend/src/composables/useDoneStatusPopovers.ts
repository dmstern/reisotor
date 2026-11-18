import { computed, nextTick, ref, watch, type Ref } from 'vue';
import { useTripStore } from '../stores/trip';
import { toLocalDateString } from '../utils/dateFormat';
import { computePopoverPosition } from '../utils/popoverPosition';

export const DATES_POPOVER_WIDTH_PX = 320;
export const UNPLANNED_POPOVER_WIDTH_PX = 290;
export const UNPLANNED_POPOVER_HEIGHT_PX = 220;
const POPOVER_VIEWPORT_PADDING_PX = 16;

export interface PopoverPositionStyle {
  top: string;
  left: string;
}

export interface OpenDonePopoverOptions {
  event?: MouseEvent;
  openRef: Ref<boolean>;
  styleRef: Ref<PopoverPositionStyle>;
  selector: string;
  widthPx: number;
  heightPx: number;
}

/**
 * Gemeinsame Popover-Zustands-, Datums-Default- und Positionierungslogik
 * für den Status-Dropdown-Flow von Spots und Touren (DRY).
 */
export function useDoneStatusPopovers() {
  const tripStore = useTripStore();

  const datesPopoverOpen = ref(false);
  const datesPopoverStyle = ref<PopoverPositionStyle>({ top: '0px', left: '0px' });

  const unplannedPopoverOpen = ref(false);
  const unplannedPopoverStyle = ref<PopoverPositionStyle>({ top: '0px', left: '0px' });

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

  async function positionAndOpenPopover(popoverOptions: OpenDonePopoverOptions) {
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

  return {
    datesPopoverOpen,
    datesPopoverStyle,
    unplannedPopoverOpen,
    unplannedPopoverStyle,
    unplannedDoneDate,
    positionAndOpenPopover,
  };
}

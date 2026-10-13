import { computed, nextTick, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Excursion } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import { toLocalDateString } from '../utils/dateFormat';
import { computePopoverPosition } from '../utils/popoverPosition';

export interface UseExcursionDoneStatusOptions {
  excursion: MaybeRefOrGetter<Excursion>;
}

export interface UseExcursionDoneStatusReturn {
  unplannedPopoverOpen: Ref<boolean>;
  unplannedPopoverStyle: Ref<{ top: string; left: string }>;
  unplannedDoneDate: Ref<string>;
  onToggleDone: (event?: MouseEvent) => Promise<void>;
  submitUnplannedDone: () => Promise<void>;
  openCalendarConfirmDone: () => void;
}

export function useExcursionDoneStatus(
  options: UseExcursionDoneStatusOptions
): UseExcursionDoneStatusReturn {
  const excursionsStore = useExcursionsStore();
  const tripStore = useTripStore();
  const drawers = useDrawersStore();

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
    const excursion = toValue(options.excursion);
    if (excursion.done) {
      await excursionsStore.setDone(excursion.id, false);
    } else if (excursion.date) {
      await excursionsStore.setDone(excursion.id, true);
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
      if (typeof document !== 'undefined') {
        const menuEl = document.querySelector('.tour-unplanned-popover') as HTMLElement | null;
        if (menuEl && triggerEl) {
          const rect = menuEl.getBoundingClientRect();
          unplannedPopoverStyle.value = computePopoverPosition(triggerEl, {
            menuWidth: rect.width,
            menuHeight: rect.height,
          });
        }
      }
    }
  }

  async function submitUnplannedDone() {
    const excursion = toValue(options.excursion);
    if (!unplannedDoneDate.value) return;
    await excursionsStore.setDate(excursion.id, unplannedDoneDate.value);
    await excursionsStore.setDone(excursion.id, true);
    unplannedPopoverOpen.value = false;
  }

  function openCalendarConfirmDone() {
    const excursion = toValue(options.excursion);
    unplannedPopoverOpen.value = false;
    drawers.startPendingSchedule('excursion', excursion.id, 'confirm-done');
  }

  return {
    unplannedPopoverOpen,
    unplannedPopoverStyle,
    unplannedDoneDate,
    onToggleDone,
    submitUnplannedDone,
    openCalendarConfirmDone,
  };
}

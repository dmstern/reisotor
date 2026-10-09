import { toValue, type CSSProperties, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Spot } from '../api/types';
import { usePointerDrag } from './usePointerDrag';
import { useScheduleStore } from '../stores/schedule';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';

export interface UseSpotCalendarDragOptions {
  spot: MaybeRefOrGetter<Spot>;
}

export interface UseSpotCalendarDragReturn {
  dragging: Ref<boolean>;
  ghostStyle: Ref<CSSProperties | null>;
  onPointerDown: (e: PointerEvent) => void;
}

export function useSpotCalendarDrag(
  options: UseSpotCalendarDragOptions
): UseSpotCalendarDragReturn {
  const scheduleStore = useScheduleStore();
  const tripStore = useTripStore();
  const drawers = useDrawersStore();

  const { dragging, ghostStyle, onPointerDown } = usePointerDrag({
    onStart: () => {
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(min-width: 1024px)').matches
      ) {
        drawers.calendarOpen = true;
      }
      if (typeof document !== 'undefined') {
        document.body.classList.add('is-dragging-calendar');
      }
    },
    onEnd: () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('is-dragging-calendar');
      }
    },
    onDrop: (targetEl) => {
      const spot = toValue(options.spot);
      const dayEl = targetEl?.closest<HTMLElement>('[data-date]');
      if (!dayEl?.dataset.date || tripStore.currentTripId == null) return;
      scheduleStore.create({
        trip_id: tripStore.currentTripId,
        date: dayEl.dataset.date,
        title: spot.title,
        spot_id: spot.id,
        auto_created: 1,
        user_modified: 0,
      });
    },
    onTap: () => {
      const spot = toValue(options.spot);
      drawers.startPendingSchedule('spot', spot.id);
    },
  });

  return {
    dragging,
    ghostStyle,
    onPointerDown,
  };
}

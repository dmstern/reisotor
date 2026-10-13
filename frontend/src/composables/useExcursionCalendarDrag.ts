import { toValue, type CSSProperties, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Excursion } from '../api/types';
import { usePointerDrag } from './usePointerDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';

export interface UseExcursionCalendarDragOptions {
  excursion: MaybeRefOrGetter<Excursion>;
}

export interface UseExcursionCalendarDragReturn {
  dragging: Ref<boolean>;
  ghostStyle: Ref<CSSProperties | null>;
  onPointerDown: (e: PointerEvent) => void;
}

export function useExcursionCalendarDrag(
  options: UseExcursionCalendarDragOptions
): UseExcursionCalendarDragReturn {
  const excursionsStore = useExcursionsStore();
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
      const excursion = toValue(options.excursion);
      const dayEl = targetEl?.closest<HTMLElement>('[data-date]');
      if (!dayEl?.dataset.date) return;
      excursionsStore.setDate(excursion.id, dayEl.dataset.date);
    },
    onTap: () => {
      const excursion = toValue(options.excursion);
      drawers.startPendingSchedule('excursion', excursion.id);
    },
  });

  return {
    dragging,
    ghostStyle,
    onPointerDown,
  };
}

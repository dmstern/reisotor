import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
} from 'vue';
import type { Spot } from '../api/types';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';

export interface TourAssignmentItem {
  id: number;
  title: string;
  assigned: boolean;
}

export interface UseSpotTourAssignmentOptions {
  spot: MaybeRefOrGetter<Spot>;
  groupMode: MaybeRefOrGetter<'category' | 'tours'>;
}

export interface UseSpotTourAssignmentReturn {
  tourAssignments: ComputedRef<TourAssignmentItem[]>;
  onToggleTour: (excursionId: number) => Promise<void>;
  onCreateTour: (title: string) => Promise<void>;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
}

export function useSpotTourAssignment(
  options: UseSpotTourAssignmentOptions
): UseSpotTourAssignmentReturn {
  const excursionsStore = useExcursionsStore();
  const drawers = useDrawersStore();

  const tourAssignments = computed(() => {
    const spot = toValue(options.spot);
    return excursionsStore.excursions.map((e) => ({
      id: e.id,
      title: e.title,
      assigned: e.spot_ids.includes(spot.id),
    }));
  });

  async function onToggleTour(excursionId: number) {
    const spot = toValue(options.spot);
    const excursion = excursionsStore.excursions.find((e) => e.id === excursionId);
    if (!excursion) return;
    const isAssigned = excursion.spot_ids.includes(spot.id);
    const nextSpotIds = isAssigned
      ? excursion.spot_ids.filter((id) => id !== spot.id)
      : [...excursion.spot_ids, spot.id];
    await excursionsStore.update(excursionId, {
      title: excursion.title,
      image_url: excursion.image_url ?? undefined,
      note: excursion.note ?? undefined,
      date: excursion.date ?? undefined,
      spot_ids: nextSpotIds,
    });
  }

  async function onCreateTour(title: string) {
    const spot = toValue(options.spot);
    const trimmed = title.trim();
    if (!trimmed) return;
    await excursionsStore.create({
      title: trimmed,
      spot_ids: [spot.id],
    });
  }

  function onDragStart(event: DragEvent) {
    const groupMode = toValue(options.groupMode);
    const spot = toValue(options.spot);
    if (groupMode !== 'tours') {
      event.preventDefault();
      return;
    }
    drawers.draggingTourSpotId = spot.id;
    event.dataTransfer?.setData('text/spot-id', String(spot.id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    drawers.draggingTourSpotId = null;
  }

  function onWindowDragEnd() {
    if (drawers.draggingTourSpotId != null) {
      drawers.draggingTourSpotId = null;
    }
  }

  if (getCurrentInstance() && typeof window !== 'undefined') {
    onMounted(() => {
      window.addEventListener('dragend', onWindowDragEnd);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('dragend', onWindowDragEnd);
    });
  }

  return {
    tourAssignments,
    onToggleTour,
    onCreateTour,
    onDragStart,
    onDragEnd,
  };
}

import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Excursion } from '../api/types';
import { useDrawersStore } from '../stores/drawers';

export interface UseExcursionSpotDropOptions {
  excursion: MaybeRefOrGetter<Excursion>;
  onDropSpot?: (spotId: number) => void;
}

export interface UseExcursionSpotDropReturn {
  spotDragOverCount: Ref<number>;
  isDropCandidate: ComputedRef<boolean>;
  isDropDisabled: ComputedRef<boolean>;
  onSpotDragEnter: (event: DragEvent) => void;
  onSpotDragLeave: (event: DragEvent) => void;
  onSpotDrop: (event: DragEvent) => void;
}

export function useExcursionSpotDrop(
  options: UseExcursionSpotDropOptions
): UseExcursionSpotDropReturn {
  const drawers = useDrawersStore();
  const spotDragOverCount = ref(0);

  function isStationDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('text/spot-id');
  }

  const isDropCandidate = computed(() => {
    const excursion = toValue(options.excursion);
    if (drawers.draggingTourSpotId == null) return false;
    return !excursion.spot_ids.includes(drawers.draggingTourSpotId);
  });

  const isDropDisabled = computed(() => {
    const excursion = toValue(options.excursion);
    if (drawers.draggingTourSpotId == null) return false;
    return excursion.spot_ids.includes(drawers.draggingTourSpotId);
  });

  function onSpotDragEnter(event: DragEvent) {
    if (!isStationDrag(event) || isDropDisabled.value) return;
    spotDragOverCount.value++;
  }

  function onSpotDragLeave(event: DragEvent) {
    if (!isStationDrag(event)) return;
    spotDragOverCount.value = Math.max(0, spotDragOverCount.value - 1);
  }

  function onSpotDrop(event: DragEvent) {
    spotDragOverCount.value = 0;
    if (isDropDisabled.value) return;
    const rawSpotId = event.dataTransfer?.getData('text/spot-id');
    if (rawSpotId && options.onDropSpot) {
      options.onDropSpot(Number(rawSpotId));
    }
  }

  return {
    spotDragOverCount,
    isDropCandidate,
    isDropDisabled,
    onSpotDragEnter,
    onSpotDragLeave,
    onSpotDrop,
  };
}

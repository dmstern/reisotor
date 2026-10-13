// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useExcursionSpotDrop } from './useExcursionSpotDrop';
import { useDrawersStore } from '../stores/drawers';
import type { Excursion } from '../api/types';

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return {
    id: 1,
    trip_id: 10,
    title: 'Tour',
    spot_ids: [100],
    done: 0,
    ...partial,
  } as unknown as Excursion;
}

function createDragEvent(types: string[] = ['text/spot-id'], data: Record<string, string> = {}) {
  return {
    dataTransfer: {
      types,
      getData: (format: string) => data[format] || '',
    },
  } as unknown as DragEvent;
}

describe('useExcursionSpotDrop', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('ermittelt isDropCandidate und isDropDisabled anhand des gezogenen Spots', () => {
    const drawers = useDrawersStore();
    const excursion = ref(createMockExcursion({ spot_ids: [100] }));

    const { isDropCandidate, isDropDisabled } = useExcursionSpotDrop({ excursion });

    expect(isDropCandidate.value).toBe(false);
    expect(isDropDisabled.value).toBe(false);

    // Spot 101 wird gezogen (noch nicht in Tour)
    drawers.draggingTourSpotId = 101;
    expect(isDropCandidate.value).toBe(true);
    expect(isDropDisabled.value).toBe(false);

    // Spot 100 wird gezogen (bereits in Tour)
    drawers.draggingTourSpotId = 100;
    expect(isDropCandidate.value).toBe(false);
    expect(isDropDisabled.value).toBe(true);
  });

  it('zählt spotDragOverCount bei dragenter und dragleave hoch und runter', () => {
    const drawers = useDrawersStore();
    drawers.draggingTourSpotId = 101;
    const excursion = ref(createMockExcursion({ spot_ids: [100] }));

    const { spotDragOverCount, onSpotDragEnter, onSpotDragLeave } = useExcursionSpotDrop({
      excursion,
    });

    const event = createDragEvent(['text/spot-id']);

    onSpotDragEnter(event);
    expect(spotDragOverCount.value).toBe(1);

    onSpotDragEnter(event);
    expect(spotDragOverCount.value).toBe(2);

    onSpotDragLeave(event);
    expect(spotDragOverCount.value).toBe(1);

    onSpotDragLeave(event);
    expect(spotDragOverCount.value).toBe(0);
  });

  it('ignoriert Drags ohne text/spot-id MIME-Type', () => {
    const drawers = useDrawersStore();
    drawers.draggingTourSpotId = 101;
    const excursion = ref(createMockExcursion({ spot_ids: [100] }));

    const { spotDragOverCount, onSpotDragEnter } = useExcursionSpotDrop({ excursion });

    const event = createDragEvent(['text/plain']);
    onSpotDragEnter(event);
    expect(spotDragOverCount.value).toBe(0);
  });

  it('feuert onDropSpot Callback mit Spot-ID bei erfolgreichem Drop', () => {
    const onDropSpot = vi.fn();
    const excursion = ref(createMockExcursion({ spot_ids: [100] }));

    const { spotDragOverCount, onSpotDrop } = useExcursionSpotDrop({
      excursion,
      onDropSpot,
    });

    spotDragOverCount.value = 1;
    const event = createDragEvent(['text/spot-id'], { 'text/spot-id': '101' });

    onSpotDrop(event);

    expect(spotDragOverCount.value).toBe(0);
    expect(onDropSpot).toHaveBeenCalledWith(101);
  });

  it('blockiert Drop wenn Spot bereits in Tour enthalten ist (isDropDisabled)', () => {
    const drawers = useDrawersStore();
    drawers.draggingTourSpotId = 100;
    const onDropSpot = vi.fn();
    const excursion = ref(createMockExcursion({ spot_ids: [100] }));

    const { onSpotDrop } = useExcursionSpotDrop({
      excursion,
      onDropSpot,
    });

    const event = createDragEvent(['text/spot-id'], { 'text/spot-id': '100' });
    onSpotDrop(event);

    expect(onDropSpot).not.toHaveBeenCalled();
  });
});

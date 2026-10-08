// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useSpotTourAssignment } from './useSpotTourAssignment';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import type { Excursion, Spot } from '../api/types';

function createMockSpot(partial: Partial<Spot>): Spot {
  return {
    id: 1,
    trip_id: 10,
    title: 'Test Spot',
    category: 'Aktivität',
    ...partial,
  } as Spot;
}

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return partial as unknown as Excursion;
}

describe('useSpotTourAssignment', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('erstellt tourAssignments mit korrektem assigned-Status', () => {
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      createMockExcursion({ id: 10, title: 'Tour 1', spot_ids: [1, 2] }),
      createMockExcursion({ id: 20, title: 'Tour 2', spot_ids: [3] }),
    ];

    const spot = ref(createMockSpot({ id: 1 }));
    const groupMode = ref<'category' | 'tours'>('category');

    const { tourAssignments } = useSpotTourAssignment({ spot, groupMode });

    expect(tourAssignments.value).toEqual([
      { id: 10, title: 'Tour 1', assigned: true },
      { id: 20, title: 'Tour 2', assigned: false },
    ]);
  });

  it('fügt Spot bei onToggleTour hinzu bzw. entfernt ihn', async () => {
    const excursionsStore = useExcursionsStore();
    excursionsStore.excursions = [
      createMockExcursion({ id: 10, title: 'Tour 1', spot_ids: [1, 2] }),
    ];
    const updateSpy = vi
      .spyOn(excursionsStore, 'update')
      .mockResolvedValue({} as unknown as Excursion);

    const spot = ref(createMockSpot({ id: 1 }));
    const groupMode = ref<'category' | 'tours'>('category');

    const { onToggleTour } = useSpotTourAssignment({ spot, groupMode });

    // Entfernen
    await onToggleTour(10);
    expect(updateSpy).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        spot_ids: [2],
      })
    );

    // Hinzufügen (wenn nicht vorhanden)
    excursionsStore.excursions[0].spot_ids = [2];
    await onToggleTour(10);
    expect(updateSpy).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        spot_ids: [2, 1],
      })
    );
  });

  it('erstellt neue Tour mit Spot bei onCreateTour', async () => {
    const excursionsStore = useExcursionsStore();
    const createSpy = vi
      .spyOn(excursionsStore, 'create')
      .mockResolvedValue({} as unknown as Excursion);

    const spot = ref(createMockSpot({ id: 1 }));
    const groupMode = ref<'category' | 'tours'>('category');

    const { onCreateTour } = useSpotTourAssignment({ spot, groupMode });

    await onCreateTour(' Neue Wanderung ');
    expect(createSpy).toHaveBeenCalledWith({
      title: 'Neue Wanderung',
      spot_ids: [1],
    });

    // Leerer Titel -> kein Aufruf
    createSpy.mockClear();
    await onCreateTour('   ');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('steuert natives Drag-and-Drop abhängig vom groupMode', () => {
    const drawers = useDrawersStore();
    const spot = ref(createMockSpot({ id: 42 }));
    const groupMode = ref<'category' | 'tours'>('category');

    const { onDragStart, onDragEnd } = useSpotTourAssignment({ spot, groupMode });

    const preventDefault = vi.fn();
    const setData = vi.fn();
    const fakeEvent = {
      preventDefault,
      dataTransfer: {
        setData,
        effectAllowed: '',
      },
    } as unknown as DragEvent;

    // In 'category'-Modus darf Drag nicht starten
    onDragStart(fakeEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(drawers.draggingTourSpotId).toBeNull();

    // In 'tours'-Modus startet Drag
    groupMode.value = 'tours';
    onDragStart(fakeEvent);
    expect(drawers.draggingTourSpotId).toBe(42);
    expect(setData).toHaveBeenCalledWith('text/spot-id', '42');

    // onDragEnd setzt zurück
    onDragEnd();
    expect(drawers.draggingTourSpotId).toBeNull();
  });
});

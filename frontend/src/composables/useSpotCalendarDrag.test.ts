// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useSpotCalendarDrag } from './useSpotCalendarDrag';
import { useScheduleStore } from '../stores/schedule';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import type { ScheduleItem, Spot } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

function createMockSpot(partial: Partial<Spot>): Spot {
  return {
    id: 42,
    trip_id: 10,
    title: 'Eiffelturm',
    category: 'Aktivität',
    ...partial,
  } as Spot;
}

describe('useSpotCalendarDrag', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
    document.body.className = '';
  });

  it('initialisiert dragging und ghostStyle korrekt', () => {
    const spot = ref(createMockSpot({ id: 42 }));
    const { dragging, ghostStyle, onPointerDown } = useSpotCalendarDrag({ spot });

    expect(dragging.value).toBe(false);
    expect(ghostStyle.value).toBeNull();
    expect(typeof onPointerDown).toBe('function');
  });

  it('startet pending schedule bei Klick/Tap', () => {
    const drawers = useDrawersStore();
    const startPendingSpy = vi.spyOn(drawers, 'startPendingSchedule');

    const spot = ref(createMockSpot({ id: 42 }));
    const { onPointerDown } = useSpotCalendarDrag({ spot });

    // Simuliere Klick (PointerDown gefolgt von PointerUp an derselben Stelle)
    const downEvent = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0 });
    onPointerDown(downEvent);

    const upEvent = new PointerEvent('pointerup', { clientX: 100, clientY: 100, button: 0 });
    window.dispatchEvent(upEvent);

    expect(startPendingSpy).toHaveBeenCalledWith('spot', 42);
  });

  it('erstellt schedule item bei erfolgreichem Drop auf Kalendertag', () => {
    const scheduleStore = useScheduleStore();
    const tripStore = useTripStore();
    tripStore.currentTripId = 10;
    const createSpy = vi
      .spyOn(scheduleStore, 'create')
      .mockResolvedValue({} as unknown as ScheduleItem);

    const spot = ref(createMockSpot({ id: 42, title: 'Eiffelturm' }));
    const { onPointerDown } = useSpotCalendarDrag({ spot });

    // PointerDown
    onPointerDown(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0 }));

    // PointerMove über Schwellwert (> 5px)
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 120 }));
    expect(document.body.classList.contains('is-dragging-calendar')).toBe(true);

    // Ziel-Element mit data-date erstellen
    const dayEl = document.createElement('div');
    dayEl.dataset.date = '2026-08-15';
    document.body.appendChild(dayEl);

    // Definieren von document.elementFromPoint
    document.elementFromPoint = () => dayEl;

    // PointerUp (Drop)
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 120 }));

    expect(document.body.classList.contains('is-dragging-calendar')).toBe(false);
    expect(createSpy).toHaveBeenCalledWith({
      trip_id: 10,
      date: '2026-08-15',
      title: 'Eiffelturm',
      spot_id: 42,
      auto_created: 1,
      user_modified: 0,
    });

    document.body.removeChild(dayEl);
  });
});

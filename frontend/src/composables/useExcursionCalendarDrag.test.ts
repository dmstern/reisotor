// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useExcursionCalendarDrag } from './useExcursionCalendarDrag';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import type { Excursion } from '../api/types';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue({}),
  },
}));

class MockEventSource {
  addEventListener() {}
  removeEventListener() {}
  close() {}
}

function createMockExcursion(partial: Partial<Excursion>): Excursion {
  return {
    id: 42,
    trip_id: 10,
    title: 'Tour ins Grüne',
    spot_ids: [],
    done: 0,
    ...partial,
  } as unknown as Excursion;
}

describe('useExcursionCalendarDrag', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', MockEventSource);
    setActivePinia(createPinia());
    document.body.className = '';
  });

  it('initialisiert dragging und ghostStyle korrekt', () => {
    const excursion = ref(createMockExcursion({ id: 42 }));
    const { dragging, ghostStyle, onPointerDown } = useExcursionCalendarDrag({ excursion });

    expect(dragging.value).toBe(false);
    expect(ghostStyle.value).toBeNull();
    expect(typeof onPointerDown).toBe('function');
  });

  it('startet pending schedule bei Klick/Tap', () => {
    const drawers = useDrawersStore();
    const startPendingSpy = vi.spyOn(drawers, 'startPendingSchedule');

    const excursion = ref(createMockExcursion({ id: 42 }));
    const { onPointerDown } = useExcursionCalendarDrag({ excursion });

    const downEvent = new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0 });
    onPointerDown(downEvent);

    const upEvent = new PointerEvent('pointerup', { clientX: 100, clientY: 100, button: 0 });
    window.dispatchEvent(upEvent);

    expect(startPendingSpy).toHaveBeenCalledWith('excursion', 42);
  });

  it('setzt Excursion-Datum bei erfolgreichem Drop auf Kalendertag', () => {
    const excursionsStore = useExcursionsStore();
    const setDateSpy = vi.spyOn(excursionsStore, 'setDate').mockResolvedValue();

    const excursion = ref(createMockExcursion({ id: 42 }));
    const { onPointerDown } = useExcursionCalendarDrag({ excursion });

    // PointerDown
    onPointerDown(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, button: 0 }));

    // PointerMove über Schwellwert
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 120, clientY: 120 }));
    expect(document.body.classList.contains('is-dragging-calendar')).toBe(true);

    // Ziel-Element mit data-date erstellen
    const dayEl = document.createElement('div');
    dayEl.dataset.date = '2026-08-20';
    document.body.appendChild(dayEl);

    document.elementFromPoint = () => dayEl;

    // Drop
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 120, clientY: 120 }));

    expect(document.body.classList.contains('is-dragging-calendar')).toBe(false);
    expect(setDateSpy).toHaveBeenCalledWith(42, '2026-08-20');
  });
});

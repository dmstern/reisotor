import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useScheduleStore } from '../stores/schedule';
import { useTripStore } from '../stores/trip';

export interface UsePendingScheduleOptions {
  standalone?: boolean;
}

/**
 * Verwaltet den Klick- und Drag&Drop-Workflow zum Einplanen von Touren und Spots im Kalender
 * (inkl. 'confirm-done'-Modus und Rücksprung zur aufrufenden Karte per Hash).
 */
export function usePendingSchedule(options: UsePendingScheduleOptions = {}) {
  const router = useRouter();
  const drawers = useDrawersStore();
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();
  const scheduleStore = useScheduleStore();
  const tripStore = useTripStore();

  const pendingScheduleLabel = computed(() => {
    const pending = drawers.pendingSchedule;
    if (!pending) return null;
    if (pending.kind === 'excursion') {
      return excursionsStore.excursions.find((e) => e.id === pending.id)?.title ?? null;
    }
    return spotsStore.spots.find((s) => s.id === pending.id)?.title ?? null;
  });

  // Gleiches Blau-Highlighting der Tage wie beim Drag & Drop, solange der Auswahlmodus aktiv ist
  watch(
    () => drawers.pendingSchedule,
    (pending) => document.body.classList.toggle('is-dragging-calendar', !!pending),
    { immediate: true }
  );
  onBeforeUnmount(() => document.body.classList.remove('is-dragging-calendar'));

  function returnToCard(kind: 'excursion' | 'spot', id: number) {
    if (!options.standalone) return;
    router.push(`/excursions#${kind}-${id}`);
  }

  async function finishPendingSchedule(
    pending: { kind: 'excursion' | 'spot'; id: number; mode: 'plan' | 'confirm-done' },
    date: string
  ) {
    if (pending.kind === 'excursion') {
      await excursionsStore.setDate(pending.id, date);
      if (pending.mode === 'confirm-done') await excursionsStore.setDone(pending.id, true);
    } else {
      const spot = spotsStore.spots.find((s) => s.id === pending.id);
      if (spot && tripStore.currentTripId != null) {
        if (pending.mode === 'confirm-done') {
          await scheduleStore.setSpotDate(
            pending.id,
            tripStore.currentTripId,
            spot.title,
            date,
            true
          );
          await spotsStore.setDone(pending.id, true);
        } else {
          await scheduleStore.create({
            trip_id: tripStore.currentTripId,
            date,
            title: spot.title,
            spot_id: spot.id,
            auto_created: 1,
            user_modified: 0,
          });
        }
      }
    }
    drawers.clearPendingSchedule();
    returnToCard(pending.kind, pending.id);
  }

  function cancelPendingSchedule() {
    const pending = drawers.pendingSchedule;
    if (!pending) return;
    drawers.clearPendingSchedule();
    returnToCard(pending.kind, pending.id);
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && drawers.pendingSchedule) cancelPendingSchedule();
  }
  onMounted(() => document.addEventListener('keydown', onEscape));
  onBeforeUnmount(() => document.removeEventListener('keydown', onEscape));

  function onDropExcursion(date: string, excursionId: number) {
    excursionsStore.setDate(excursionId, date);
  }

  return {
    pendingSchedule: computed(() => drawers.pendingSchedule),
    pendingScheduleLabel,
    finishPendingSchedule,
    cancelPendingSchedule,
    returnToCard,
    onDropExcursion,
  };
}

import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';

export interface UsePendingScheduleOptions {
  standalone?: boolean;
}

/**
 * Verwaltet den Klick-Workflow zum Einplanen von Touren und Spots im Kalender
 * (inkl. 'confirm-done'-Modus und Rücksprung zur aufrufenden Karte per Hash).
 */
export function usePendingSchedule(options: UsePendingScheduleOptions = {}) {
  const router = useRouter();
  const drawers = useDrawersStore();
  const excursionsStore = useExcursionsStore();
  const spotsStore = useSpotsStore();

  const pendingScheduleLabel = computed(() => {
    const pending = drawers.pendingSchedule;

    if (!pending) {
      return null;
    }

    if (pending.kind === 'excursion') {
      return excursionsStore.excursions.find((e) => e.id === pending.id)?.title ?? null;
    }

    return spotsStore.spots.find((spot) => spot.id === pending.id)?.title ?? null;
  });

  // Blau-Highlighting der Kalendertage, solange der Einplanen-/Auswahlmodus aktiv ist
  watch(
    () => drawers.pendingSchedule,
    (pending) => document.body.classList.toggle('is-dragging-calendar', !!pending),
    { immediate: true }
  );
  onBeforeUnmount(() => document.body.classList.remove('is-dragging-calendar'));

  function returnToCard(kind: 'excursion' | 'spot', id: number) {
    if (!options.standalone) {
      return;
    }

    router.push(`/excursions#${kind}-${id}`);
  }

  async function finishPendingSchedule(
    pending: { kind: 'excursion' | 'spot'; id: number; mode: 'plan' | 'confirm-done' },
    date: string
  ) {
    if (pending.kind === 'excursion') {
      await excursionsStore.setDate(pending.id, date);

      if (pending.mode === 'confirm-done') {
        await excursionsStore.setDone(pending.id, true);
      }
    } else {
      await spotsStore.addDate(
        pending.id,
        date,
        pending.mode === 'confirm-done' ? true : undefined
      );
    }

    drawers.clearPendingSchedule();
    returnToCard(pending.kind, pending.id);
  }

  function cancelPendingSchedule() {
    const pending = drawers.pendingSchedule;

    if (!pending) {
      return;
    }

    drawers.clearPendingSchedule();
    returnToCard(pending.kind, pending.id);
  }

  function onEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && drawers.pendingSchedule) {
      cancelPendingSchedule();
    }
  }

  onMounted(() => document.addEventListener('keydown', onEscape));
  onBeforeUnmount(() => document.removeEventListener('keydown', onEscape));

  return {
    pendingSchedule: computed(() => drawers.pendingSchedule),
    pendingScheduleLabel,
    finishPendingSchedule,
    cancelPendingSchedule,
    returnToCard,
  };
}

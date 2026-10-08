import {
  computed,
  getCurrentInstance,
  onMounted,
  onUnmounted,
  ref,
  type ComputedRef,
  type Ref,
} from 'vue';
import type { Trip } from '../api/types';
import {
  computeDepartureCountdown,
  computeVacationPhase,
  type DepartureCountdown,
  type VacationPhase,
} from '../utils/departureCountdown';
import { toLocalDateString } from '../utils/dateFormat';

export interface UseTripCountdownReturn {
  now: Ref<Date>;
  todayStr: () => string;
  departureCountdown: ComputedRef<DepartureCountdown | null>;
  vacationPhase: ComputedRef<VacationPhase | null>;
  isTripOver: ComputedRef<boolean>;
}

export function useTripCountdown(
  trip: Ref<Trip | null | undefined> | ComputedRef<Trip | null | undefined>
): UseTripCountdownReturn {
  const todayStr = () => toLocalDateString(new Date());

  const now = ref(new Date());
  let nowTimer: ReturnType<typeof setInterval> | null = null;

  if (getCurrentInstance()) {
    onMounted(() => {
      nowTimer = setInterval(() => {
        now.value = new Date();
      }, 60_000);
    });

    onUnmounted(() => {
      if (nowTimer != null) clearInterval(nowTimer);
    });
  }

  const departureCountdown = computed(() =>
    trip.value?.start_date ? computeDepartureCountdown(trip.value.start_date, now.value) : null
  );

  const vacationPhase = computed(() =>
    trip.value ? computeVacationPhase(trip.value, now.value) : null
  );

  const isTripOver = computed(() => {
    if (vacationPhase.value?.phase === 'over') return true;
    if (trip.value?.end_date && trip.value.end_date < todayStr()) return true;
    return false;
  });

  return {
    now,
    todayStr,
    departureCountdown,
    vacationPhase,
    isTripOver,
  };
}

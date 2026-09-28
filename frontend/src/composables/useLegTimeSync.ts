import { computed, ref, type ComputedRef, type Ref } from 'vue';
import type { AlertVariant } from '../components/primitives/Alert.vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDuration } from '../utils/formatRoute';

export interface TimeDurationStatus {
  type: 'matched' | 'mismatch' | 'suggest' | 'info';
  text: string;
  field?: 'departure' | 'arrival';
  target?: string | null;
  elapsedMinutes?: number;
  diffMinutes?: number;
  canToggleLink: boolean;
}

/**
 * Parst einen "HH:MM"-String in Minuten seit Mitternacht.
 * Gibt null zurück, wenn der String ungültig oder unvollständig ist.
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Formatiert Minuten seit Mitternacht in einen "HH:MM"-String.
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Berechnet Ankunftszeit: Abfahrt + Dauer
 */
export function calcArrivalTime(departureStr: string, durationSeconds: number): string | null {
  const depMinutes = parseTimeToMinutes(departureStr);
  if (depMinutes == null) return null;
  const durMinutes = Math.round(durationSeconds / 60);
  return formatMinutesToTime(depMinutes + durMinutes);
}

/**
 * Berechnet Abfahrtszeit: Ankunft - Dauer
 */
export function calcDepartureTime(arrivalStr: string, durationSeconds: number): string | null {
  const arrMinutes = parseTimeToMinutes(arrivalStr);
  if (arrMinutes == null) return null;
  const durMinutes = Math.round(durationSeconds / 60);
  return formatMinutesToTime(arrMinutes - durMinutes);
}

/**
 * Berechnet die Zeitspanne (in Minuten) zwischen Abfahrt und Ankunft.
 */
export function calcElapsedMinutes(departureStr: string, arrivalStr: string): number | null {
  const dep = parseTimeToMinutes(departureStr);
  const arr = parseTimeToMinutes(arrivalStr);
  if (dep == null || arr == null) return null;
  return (((arr - dep) % 1440) + 1440) % 1440;
}

export interface UseLegTimeSyncOptions {
  departureTime: Ref<string>;
  arrivalTime: Ref<string>;
  activeDurationSeconds: ComputedRef<number | null> | Ref<number | null>;
  departureLabel: ComputedRef<string> | Ref<string>;
}

export function useLegTimeSync(options: UseLegTimeSyncOptions) {
  const { departureTime, arrivalTime, activeDurationSeconds, departureLabel } = options;

  const lastModifiedTimeField = ref<'departure' | 'arrival'>('departure');
  const isTimeLinked = ref(true);
  const isCalculatingDepartureSparkle = ref(false);
  const isCalculatingArrivalSparkle = ref(false);

  const canCalcArrival = computed(() => {
    return (
      activeDurationSeconds.value != null &&
      !!departureTime.value &&
      parseTimeToMinutes(departureTime.value) != null
    );
  });

  const canCalcDeparture = computed(() => {
    return (
      activeDurationSeconds.value != null &&
      !!arrivalTime.value &&
      parseTimeToMinutes(arrivalTime.value) != null
    );
  });

  const arrivalSparkleTitle = computed(() => {
    if (!canCalcArrival.value || !activeDurationSeconds.value) return 'Ankunftszeit berechnen';
    const durStr = formatDuration(activeDurationSeconds.value);
    const target = calcArrivalTime(departureTime.value, activeDurationSeconds.value);
    return target
      ? `Ankunftszeit aus ${departureLabel.value} berechnen (${departureTime.value} + ${durStr} = ${target})`
      : 'Ankunftszeit aus Reisedauer berechnen';
  });

  const departureSparkleTitle = computed(() => {
    if (!canCalcDeparture.value || !activeDurationSeconds.value) {
      return `${departureLabel.value} berechnen`;
    }
    const durStr = formatDuration(activeDurationSeconds.value);
    const target = calcDepartureTime(arrivalTime.value, activeDurationSeconds.value);
    return target
      ? `${departureLabel.value} aus Wunschankunftszeit berechnen (${arrivalTime.value} − ${durStr} = ${target})`
      : `${departureLabel.value} aus Reisedauer berechnen`;
  });

  function syncTimesWithDuration(durationSeconds?: number | null) {
    const dur = durationSeconds ?? activeDurationSeconds.value;
    if (!dur || dur <= 0) return;

    if (lastModifiedTimeField.value === 'arrival' && arrivalTime.value) {
      const target = calcDepartureTime(arrivalTime.value, dur);
      if (target) {
        departureTime.value = target;
      }
    } else if (departureTime.value) {
      const target = calcArrivalTime(departureTime.value, dur);
      if (target) {
        arrivalTime.value = target;
      }
    } else if (arrivalTime.value) {
      const target = calcDepartureTime(arrivalTime.value, dur);
      if (target) {
        departureTime.value = target;
      }
    }
  }

  function onDepartureInput() {
    lastModifiedTimeField.value = 'departure';
    if (isTimeLinked.value && activeDurationSeconds.value) {
      const target = calcArrivalTime(departureTime.value, activeDurationSeconds.value);
      if (target) {
        arrivalTime.value = target;
      }
    }
  }

  function onArrivalInput() {
    lastModifiedTimeField.value = 'arrival';
    if (isTimeLinked.value && activeDurationSeconds.value) {
      const target = calcDepartureTime(arrivalTime.value, activeDurationSeconds.value);
      if (target) {
        departureTime.value = target;
      }
    }
  }

  function calcArrivalFromDeparture() {
    if (!departureTime.value || !activeDurationSeconds.value) return;
    const target = calcArrivalTime(departureTime.value, activeDurationSeconds.value);
    if (target) {
      arrivalTime.value = target;
      lastModifiedTimeField.value = 'departure';
      isTimeLinked.value = true;
      isCalculatingArrivalSparkle.value = true;
      setTimeout(() => {
        isCalculatingArrivalSparkle.value = false;
      }, 600);
    }
  }

  function calcDepartureFromArrival() {
    if (!arrivalTime.value || !activeDurationSeconds.value) return;
    const target = calcDepartureTime(arrivalTime.value, activeDurationSeconds.value);
    if (target) {
      departureTime.value = target;
      lastModifiedTimeField.value = 'arrival';
      isTimeLinked.value = true;
      isCalculatingDepartureSparkle.value = true;
      setTimeout(() => {
        isCalculatingDepartureSparkle.value = false;
      }, 600);
    }
  }

  function toggleTimeLink() {
    if (!isTimeLinked.value) {
      if (activeDurationSeconds.value) {
        syncTimesWithDuration(activeDurationSeconds.value);
      }
      isTimeLinked.value = true;
    } else {
      isTimeLinked.value = false;
    }
  }

  function applySuggestedTime(field: 'departure' | 'arrival', target?: string | null) {
    if (!target) return;
    if (field === 'departure') {
      departureTime.value = target;
      lastModifiedTimeField.value = 'arrival';
    } else {
      arrivalTime.value = target;
      lastModifiedTimeField.value = 'departure';
    }
    isTimeLinked.value = true;
  }

  const timeDurationStatus = computed<TimeDurationStatus | null>(() => {
    const dep = departureTime.value;
    const arr = arrivalTime.value;
    const durSec = activeDurationSeconds.value;

    if (!dep && !arr) return null;

    if (dep && arr) {
      const elapsedMins = calcElapsedMinutes(dep, arr);
      if (elapsedMins == null) return null;

      if (durSec != null) {
        const durMins = Math.round(durSec / 60);
        const diffMins = elapsedMins - durMins;

        if (Math.abs(diffMins) <= 1) {
          return {
            type: 'matched',
            text: `Dauer & Zeitspanne: ${formatDuration(durSec)}`,
            elapsedMinutes: elapsedMins,
            canToggleLink: true,
          };
        } else {
          return {
            type: 'mismatch',
            text: `Zeitfenster: ${formatDuration(elapsedMins * 60)} • Reisedauer: ${formatDuration(durSec)}`,
            elapsedMinutes: elapsedMins,
            diffMinutes: diffMins,
            canToggleLink: true,
          };
        }
      } else {
        return {
          type: 'info',
          text: `Reisedauer: ${formatDuration(elapsedMins * 60)}`,
          elapsedMinutes: elapsedMins,
          canToggleLink: false,
        };
      }
    }

    if (durSec != null) {
      if (dep && !arr) {
        const target = calcArrivalTime(dep, durSec);
        return {
          type: 'suggest',
          field: 'arrival',
          text: `Ankunft bei ${formatDuration(durSec)} Reisedauer: ${target}`,
          target,
          canToggleLink: false,
        };
      }
      if (arr && !dep) {
        const target = calcDepartureTime(arr, durSec);
        return {
          type: 'suggest',
          field: 'departure',
          text: `${departureLabel.value} für Ankunft um ${arr} (${formatDuration(durSec)}): ${target}`,
          target,
          canToggleLink: false,
        };
      }
    }

    return null;
  });

  const alertVariantForStatus = computed<AlertVariant>(() => {
    if (!timeDurationStatus.value) return 'neutral';
    switch (timeDurationStatus.value.type) {
      case 'mismatch':
        return 'warning';
      case 'suggest':
        return 'info';
      case 'matched':
        return 'success';
      case 'info':
      default:
        return 'neutral';
    }
  });

  const alertIconForStatus = computed<IconDef | undefined>(() => {
    if (!timeDurationStatus.value) return undefined;
    switch (timeDurationStatus.value.type) {
      case 'mismatch':
        return ACTION_ICONS.warning;
      case 'suggest':
        return ACTION_ICONS.sparkles;
      case 'matched':
        return ACTION_ICONS.done;
      case 'info':
        return ACTION_ICONS.duration;
      default:
        return undefined;
    }
  });

  return {
    lastModifiedTimeField,
    isTimeLinked,
    isCalculatingDepartureSparkle,
    isCalculatingArrivalSparkle,
    canCalcArrival,
    canCalcDeparture,
    arrivalSparkleTitle,
    departureSparkleTitle,
    timeDurationStatus,
    alertVariantForStatus,
    alertIconForStatus,
    syncTimesWithDuration,
    onDepartureInput,
    onArrivalInput,
    calcArrivalFromDeparture,
    calcDepartureFromArrival,
    toggleTimeLink,
    applySuggestedTime,
  };
}

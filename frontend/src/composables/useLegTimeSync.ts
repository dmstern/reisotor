import { computed, ref, toValue, type ComputedRef, type Ref } from 'vue';
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
  transportCategory?: ComputedRef<string> | Ref<string>;
  transportType?: ComputedRef<string> | Ref<string>;
}

export function useLegTimeSync(options: UseLegTimeSyncOptions) {
  const { departureTime, arrivalTime, activeDurationSeconds, departureLabel } = options;

  const lastModifiedTimeField = ref<'departure' | 'arrival'>('departure');
  const isTimeLinked = ref(true);

  const lockedDurationMinutes = ref<number | null>(null);

  const effectiveDurationSeconds = computed<number | null>(() => {
    if (activeDurationSeconds.value && activeDurationSeconds.value > 0) {
      return activeDurationSeconds.value;
    }
    if (lockedDurationMinutes.value != null && lockedDurationMinutes.value > 0) {
      return lockedDurationMinutes.value * 60;
    }
    return null;
  });

  const canToggleLink = computed(() => {
    return (
      (activeDurationSeconds.value != null && activeDurationSeconds.value > 0) ||
      (Boolean(departureTime.value) && Boolean(arrivalTime.value))
    );
  });

  const timeLinkTitle = computed(() => {
    let durStr: string | null = null;
    if (activeDurationSeconds.value && activeDurationSeconds.value > 0) {
      durStr = formatDuration(activeDurationSeconds.value);
    } else if (departureTime.value && arrivalTime.value) {
      const elapsed = calcElapsedMinutes(departureTime.value, arrivalTime.value);
      if (elapsed != null && elapsed > 0) {
        durStr = formatDuration(elapsed * 60);
      }
    }

    if (!canToggleLink.value) {
      return 'Zeiten koppeln (verfügbar sobald eine Reisedauer berechnet oder beide Zeiten eingetragen sind)';
    }

    if (isTimeLinked.value) {
      return durStr
        ? `Zeiten sind an Reisedauer gekoppelt (${durStr}) – Klick zum Entkoppeln`
        : 'Zeiten sind gekoppelt – Klick zum Entkoppeln';
    }

    return durStr ? `Zeiten an Reisedauer koppeln (${durStr})` : 'Zeiten an Reisedauer koppeln';
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
    const durSec = effectiveDurationSeconds.value;
    if (isTimeLinked.value && durSec && durSec > 0) {
      const target = calcArrivalTime(departureTime.value, durSec);
      if (target) {
        arrivalTime.value = target;
      }
    }
  }

  function onArrivalInput() {
    lastModifiedTimeField.value = 'arrival';
    const durSec = effectiveDurationSeconds.value;
    if (isTimeLinked.value && durSec && durSec > 0) {
      const target = calcDepartureTime(arrivalTime.value, durSec);
      if (target) {
        departureTime.value = target;
      }
    }
  }

  function toggleTimeLink() {
    if (!isTimeLinked.value) {
      if (activeDurationSeconds.value && activeDurationSeconds.value > 0) {
        syncTimesWithDuration(activeDurationSeconds.value);
        lockedDurationMinutes.value = Math.round(activeDurationSeconds.value / 60);
      } else if (departureTime.value && arrivalTime.value) {
        lockedDurationMinutes.value = calcElapsedMinutes(departureTime.value, arrivalTime.value);
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

  const timeDurationInfo = computed<{ label: string; duration: string } | null>(() => {
    if (
      timeDurationStatus.value?.type === 'mismatch' ||
      timeDurationStatus.value?.type === 'suggest'
    ) {
      return null;
    }

    const cat = options.transportCategory ? toValue(options.transportCategory) : '';
    const type = options.transportType ? toValue(options.transportType) : '';
    const durSec = activeDurationSeconds.value;

    if (durSec && durSec > 0) {
      const durStr = formatDuration(durSec);
      let label = 'Reisedauer';
      if (cat === 'zu Fuß') label = 'Gehzeit';
      else if (cat === 'Auto' || cat === 'Fahrrad') label = 'Fahrzeit';
      else if (type === 'Flugzeug' || type === 'Flug') label = 'Flugdauer';
      return { label, duration: durStr };
    }

    if (departureTime.value && arrivalTime.value) {
      const elapsed = calcElapsedMinutes(departureTime.value, arrivalTime.value);
      if (elapsed != null && elapsed > 0) {
        let label = 'Reisedauer';
        if (cat === 'zu Fuß') label = 'Gehzeit';
        else if (cat === 'Auto' || cat === 'Fahrrad' || cat === 'ÖPNV') label = 'Fahrzeit';
        else if (type === 'Flugzeug' || type === 'Flug') label = 'Flugdauer';
        return { label, duration: formatDuration(elapsed * 60) };
      }
    }

    return null;
  });

  function clearLinkedTimes() {
    if (isTimeLinked.value) {
      if (lastModifiedTimeField.value === 'departure' && arrivalTime.value) {
        arrivalTime.value = '';
      } else if (lastModifiedTimeField.value === 'arrival' && departureTime.value) {
        departureTime.value = '';
      }
    }
  }

  function initTimeState(
    departure?: string | null,
    arrival?: string | null,
    durationSeconds?: number | null
  ) {
    if (arrival && !departure) {
      lastModifiedTimeField.value = 'arrival';
    } else {
      lastModifiedTimeField.value = 'departure';
    }

    if (departure && arrival && durationSeconds) {
      const elapsed = calcElapsedMinutes(departure, arrival);
      const durMins = Math.round(durationSeconds / 60);
      isTimeLinked.value = elapsed != null && Math.abs(elapsed - durMins) <= 1;
    } else {
      isTimeLinked.value = true;
    }
  }

  return {
    lastModifiedTimeField,
    isTimeLinked,
    canToggleLink,
    timeLinkTitle,
    timeDurationStatus,
    timeDurationInfo,
    alertVariantForStatus,
    alertIconForStatus,
    syncTimesWithDuration,
    onDepartureInput,
    onArrivalInput,
    toggleTimeLink,
    applySuggestedTime,
    clearLinkedTimes,
    initTimeState,
  };
}

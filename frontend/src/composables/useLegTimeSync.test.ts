import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  calcArrivalTime,
  calcDepartureTime,
  calcElapsedMinutes,
  useLegTimeSync,
} from './useLegTimeSync';

describe('useLegTimeSync helpers', () => {
  it('parses valid time string to minutes and formats minutes back to time string', () => {
    expect(parseTimeToMinutes('08:30')).toBe(510);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:59')).toBe(1439);
    expect(parseTimeToMinutes('invalid')).toBeNull();
    expect(parseTimeToMinutes('')).toBeNull();

    expect(formatMinutesToTime(510)).toBe('08:30');
    expect(formatMinutesToTime(0)).toBe('00:00');
    expect(formatMinutesToTime(1440)).toBe('00:00');
  });

  it('calculates arrival and departure times based on duration', () => {
    // 08:30 + 90 min (5400s) = 10:00
    expect(calcArrivalTime('08:30', 5400)).toBe('10:00');
    // 10:00 - 90 min (5400s) = 08:30
    expect(calcDepartureTime('10:00', 5400)).toBe('08:30');
    // Elapsed between 08:30 and 10:00 = 90 min
    expect(calcElapsedMinutes('08:30', '10:00')).toBe(90);
  });
});

describe('useLegTimeSync composable', () => {
  it('initializes and calculates forward arrival time when departure is entered and linked', () => {
    const departureTime = ref('09:00');
    const arrivalTime = ref('');
    const activeDurationSeconds = ref(3600); // 1 hour
    const departureLabel = ref('Abfahrt');

    const { onDepartureInput, isTimeLinked, timeDurationInfo } = useLegTimeSync({
      departureTime,
      arrivalTime,
      activeDurationSeconds,
      departureLabel,
      transportCategory: ref('Auto'),
      transportType: ref('Auto'),
    });

    expect(isTimeLinked.value).toBe(true);
    onDepartureInput();
    expect(arrivalTime.value).toBe('10:00');

    expect(timeDurationInfo.value).toEqual({
      label: 'Fahrzeit',
      duration: '1 Std.',
    });
  });

  it('calculates backwards departure time when arrival is modified', () => {
    const departureTime = ref('');
    const arrivalTime = ref('12:00');
    const activeDurationSeconds = ref(1800); // 30 min
    const departureLabel = ref('Abfahrt');

    const { onArrivalInput } = useLegTimeSync({
      departureTime,
      arrivalTime,
      activeDurationSeconds,
      departureLabel,
    });

    onArrivalInput();
    expect(departureTime.value).toBe('11:30');
  });

  it('handles clearing linked times', () => {
    const departureTime = ref('08:00');
    const arrivalTime = ref('09:00');
    const activeDurationSeconds = ref(null);
    const departureLabel = ref('Abfahrt');

    const { clearLinkedTimes, lastModifiedTimeField } = useLegTimeSync({
      departureTime,
      arrivalTime,
      activeDurationSeconds,
      departureLabel,
    });

    lastModifiedTimeField.value = 'departure';
    clearLinkedTimes();
    expect(arrivalTime.value).toBe('');
    expect(departureTime.value).toBe('08:00');
  });

  it('detects mismatch status when times diverge from route duration', () => {
    const departureTime = ref('08:00');
    const arrivalTime = ref('10:00'); // 120 mins
    const activeDurationSeconds = ref(1800); // 30 mins
    const departureLabel = ref('Abfahrt');

    const { timeDurationStatus } = useLegTimeSync({
      departureTime,
      arrivalTime,
      activeDurationSeconds,
      departureLabel,
    });

    expect(timeDurationStatus.value?.type).toBe('mismatch');
    expect(timeDurationStatus.value?.diffMinutes).toBe(90);
  });
});

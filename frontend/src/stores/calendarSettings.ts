import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const WEEK_START_OPTIONS = [
  { value: 'monday', label: 'Montag' },
  { value: 'sunday', label: 'Sonntag' },
] as const;
export type WeekStart = (typeof WEEK_START_OPTIONS)[number]['value'];

export const DATE_FORMAT_OPTIONS = [
  { value: 'de', label: '31.12.2026 (deutsch)' },
  { value: 'iso', label: '2026-12-31 (ISO)' },
  { value: 'us', label: '12/31/2026 (US)' },
] as const;
export type DateFormatOption = (typeof DATE_FORMAT_OPTIONS)[number]['value'];

const WEEK_START_KEY = 'reisotor-week-start';
const DATE_FORMAT_KEY = 'reisotor-date-format';
const DEFAULT_WEEK_START: WeekStart = 'monday';
const DEFAULT_DATE_FORMAT: DateFormatOption = 'de';

function loadWeekStart(): WeekStart {
  const stored = localStorage.getItem(WEEK_START_KEY);
  return WEEK_START_OPTIONS.some((o) => o.value === stored)
    ? (stored as WeekStart)
    : DEFAULT_WEEK_START;
}

function loadDateFormat(): DateFormatOption {
  const stored = localStorage.getItem(DATE_FORMAT_KEY);
  return DATE_FORMAT_OPTIONS.some((o) => o.value === stored)
    ? (stored as DateFormatOption)
    : DEFAULT_DATE_FORMAT;
}

// Geräte-/Browser-UI-Einstellung (wie stores/weatherProvider.ts/stores/navPosition.ts) statt
// Account-Daten: bewusst nur lokal in localStorage gehalten. Default (Montag/deutsches Format)
// entspricht dem bisherigen, hart codierten Verhalten der App.
export const useCalendarSettingsStore = defineStore('calendarSettings', () => {
  const weekStart = ref<WeekStart>(loadWeekStart());
  const dateFormat = ref<DateFormatOption>(loadDateFormat());

  watch(weekStart, (v) => localStorage.setItem(WEEK_START_KEY, v));
  watch(dateFormat, (v) => localStorage.setItem(DATE_FORMAT_KEY, v));

  return { weekStart, dateFormat };
});

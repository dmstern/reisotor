import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { CalendarEntry, Spot, Trip } from '../api/types';
import type { DayWeatherEntry } from '../utils/dayWeather';
import { useCalendarSettingsStore } from '../stores/calendarSettings';
import { endOfWeek, formatDate, startOfWeek, toLocalDateString } from '../utils/dateFormat';

export type PageGranularity = 'week' | 'twoWeeks' | 'month';
export type CalendarSlideDirection = 'next' | 'prev' | 'fade';

export interface DayCell {
  date: string;
  entries: CalendarEntry[];
  accommodations: Spot[];
  weatherEntries: DayWeatherEntry[];
  otherMonth?: boolean;
}

export interface UseCalendarNavigationOptions {
  trip: Ref<Trip | null> | ComputedRef<Trip | null>;
  entriesForDate: (date: string) => CalendarEntry[];
  accommodationsForDate: (date: string) => Spot[];
  weatherEntriesFor: (date: string) => DayWeatherEntry[];
  onSelectDay?: (date: string) => void;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toIso(d: Date) {
  return toLocalDateString(d);
}

/**
 * Steuert die Navigation und Darstellung des Kalenderrasters:
 * Granularität (Woche, 2 Wochen, Monat), Blättern, Sprung zu Heute/Urlaub,
 * Raster-Generierung (DayCell[][]) und Animationstransitionen.
 */
export function useCalendarNavigation(options: UseCalendarNavigationOptions) {
  const { trip, entriesForDate, accommodationsForDate, weatherEntriesFor } = options;
  const calendarSettings = useCalendarSettingsStore();

  const granularity = ref<PageGranularity>('month');
  const selectedDate = ref<string | null>(null);
  const activeJumpTarget = ref<'today' | 'trip' | null>(null);
  const slideDirection = ref<CalendarSlideDirection>('next');

  const monthAnchor = ref(startOfMonth(new Date()));
  const weekAnchor = ref(startOfWeek(new Date()));

  function buildWeek(weekStartDate: Date): DayCell[] {
    const result: DayCell[] = [];
    const cursor = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
      const iso = toIso(cursor);
      result.push({
        date: iso,
        entries: entriesForDate(iso),
        accommodations: accommodationsForDate(iso),
        weatherEntries: weatherEntriesFor(iso),
        otherMonth: false,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  const monthWeeks = computed<DayCell[][]>(() => {
    const year = monthAnchor.value.getFullYear();
    const month = monthAnchor.value.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    const gridStart = startOfWeek(firstOfMonth);
    const gridEnd = endOfWeek(lastOfMonth);

    const result: DayCell[][] = [];
    let week: DayCell[] = [];
    const cursor = new Date(gridStart);
    while (cursor <= gridEnd) {
      const iso = toIso(cursor);
      week.push({
        date: iso,
        entries: entriesForDate(iso),
        accommodations: accommodationsForDate(iso),
        weatherEntries: weatherEntriesFor(iso),
        otherMonth: cursor.getMonth() !== month,
      });
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  });

  const monthLabel = computed(() =>
    monthAnchor.value.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  );

  const visibleWeeks = computed<DayCell[][]>(() => {
    if (granularity.value === 'month') {
      return monthWeeks.value;
    }
    const count = granularity.value === 'twoWeeks' ? 2 : 1;
    const result: DayCell[][] = [];
    const cursor = new Date(startOfWeek(weekAnchor.value));
    for (let w = 0; w < count; w++) {
      result.push(buildWeek(cursor));
      cursor.setDate(cursor.getDate() + 7);
    }
    return result;
  });

  const canGoPrev = computed(() => true);
  const canGoNext = computed(() => true);

  const calendarPageKey = computed(() => {
    if (granularity.value === 'month') {
      return `month-${monthAnchor.value.getFullYear()}-${monthAnchor.value.getMonth()}`;
    }
    return `${granularity.value}-${toIso(weekAnchor.value)}`;
  });

  const calendarTransitionName = computed(() => `calendar-slide-${slideDirection.value}`);

  function determineSlideDirection(targetIso: string): CalendarSlideDirection {
    if (granularity.value === 'month') {
      const targetYearMonth = targetIso.slice(0, 7);
      const currentYear = monthAnchor.value.getFullYear();
      const currentMonth = String(monthAnchor.value.getMonth() + 1).padStart(2, '0');
      const currentYearMonth = `${currentYear}-${currentMonth}`;
      if (targetYearMonth > currentYearMonth) return 'next';
      if (targetYearMonth < currentYearMonth) return 'prev';
      return 'fade';
    } else {
      const currentIso = toIso(weekAnchor.value);
      const count = granularity.value === 'twoWeeks' ? 14 : 7;
      const end = new Date(weekAnchor.value);
      end.setDate(end.getDate() + count - 1);
      const endIso = toIso(end);
      if (targetIso > endIso) return 'next';
      if (targetIso < currentIso) return 'prev';
      return 'fade';
    }
  }

  const prevPageLabel = computed(() => {
    if (granularity.value === 'month') return 'Vorheriger Monat';
    if (granularity.value === 'twoWeeks') return 'Vorherige 2 Wochen';
    return 'Vorherige Woche';
  });

  const nextPageLabel = computed(() => {
    if (granularity.value === 'month') return 'Nächster Monat';
    if (granularity.value === 'twoWeeks') return 'Nächste 2 Wochen';
    return 'Nächste Woche';
  });

  const visibleRangeLabel = computed(() => {
    if (granularity.value === 'month') return monthLabel.value;
    if (!visibleWeeks.value.length) return '';
    const first = visibleWeeks.value[0][0]?.date;
    const lastWeek = visibleWeeks.value[visibleWeeks.value.length - 1];
    const last = lastWeek[lastWeek.length - 1]?.date;
    if (!first || !last) return '';
    const currentYear = new Date().getFullYear();
    const firstYear = new Date(`${first}T00:00:00`).getFullYear();
    const lastYear = new Date(`${last}T00:00:00`).getFullYear();
    const includeYear =
      firstYear !== currentYear || lastYear !== currentYear || firstYear !== lastYear;
    const fmt = (d: string) => formatDate(d, { includeYear });
    return `${fmt(first)} – ${fmt(last)}`;
  });

  function prevMonth() {
    monthAnchor.value = new Date(
      monthAnchor.value.getFullYear(),
      monthAnchor.value.getMonth() - 1,
      1
    );
  }

  function nextMonth() {
    monthAnchor.value = new Date(
      monthAnchor.value.getFullYear(),
      monthAnchor.value.getMonth() + 1,
      1
    );
  }

  function prevPage() {
    slideDirection.value = 'prev';
    activeJumpTarget.value = null;
    if (granularity.value === 'month') {
      prevMonth();
    } else if (granularity.value === 'twoWeeks') {
      const d = new Date(weekAnchor.value);
      d.setDate(d.getDate() - 14);
      weekAnchor.value = startOfWeek(d);
    } else {
      const d = new Date(weekAnchor.value);
      d.setDate(d.getDate() - 7);
      weekAnchor.value = startOfWeek(d);
    }
  }

  function nextPage() {
    slideDirection.value = 'next';
    activeJumpTarget.value = null;
    if (granularity.value === 'month') {
      nextMonth();
    } else if (granularity.value === 'twoWeeks') {
      const d = new Date(weekAnchor.value);
      d.setDate(d.getDate() + 14);
      weekAnchor.value = startOfWeek(d);
    } else {
      const d = new Date(weekAnchor.value);
      d.setDate(d.getDate() + 7);
      weekAnchor.value = startOfWeek(d);
    }
  }

  watch(granularity, (next, prev) => {
    slideDirection.value = 'fade';
    if (next === 'month' && prev !== 'month') {
      const weekStartIso = toIso(startOfWeek(weekAnchor.value));
      const count = prev === 'twoWeeks' ? 14 : 7;
      const endDate = new Date(startOfWeek(weekAnchor.value));
      endDate.setDate(endDate.getDate() + count - 1);
      const weekEndIso = toIso(endDate);

      const isSelectedInWeek =
        !!selectedDate.value &&
        selectedDate.value >= weekStartIso &&
        selectedDate.value <= weekEndIso;

      const anchor = isSelectedInWeek ? selectedDate.value! : toIso(weekAnchor.value);
      monthAnchor.value = startOfMonth(new Date(`${anchor}T00:00:00`));
    } else if (prev === 'month' && next !== 'month') {
      const yearMonth = `${monthAnchor.value.getFullYear()}-${String(monthAnchor.value.getMonth() + 1).padStart(2, '0')}`;
      const isSelectedInMonth = selectedDate.value?.startsWith(yearMonth);
      const anchor = isSelectedInMonth ? selectedDate.value! : toIso(monthAnchor.value);
      weekAnchor.value = startOfWeek(new Date(`${anchor}T00:00:00`));
    }
  });

  function goToDate(dateIso: string): boolean {
    const d = new Date(`${dateIso}T00:00:00`);
    monthAnchor.value = startOfMonth(d);
    weekAnchor.value = startOfWeek(d);
    return true;
  }

  const isTodayActive = computed(() => {
    const today = toLocalDateString(new Date());
    const todayVisible = visibleWeeks.value.some((week) => week.some((day) => day.date === today));
    if (!todayVisible) return false;
    if (activeJumpTarget.value === 'today') return true;
    if (activeJumpTarget.value === 'trip') return false;
    return selectedDate.value === today;
  });

  const isTripActive = computed(() => {
    if (!trip.value?.start_date) return false;
    const tripStartDate = trip.value.start_date;
    const tripStartVisible = visibleWeeks.value.some((week) =>
      week.some((day) => day.date === tripStartDate)
    );
    if (!tripStartVisible) return false;
    if (activeJumpTarget.value === 'trip') return true;
    if (activeJumpTarget.value === 'today') return false;
    return selectedDate.value === tripStartDate;
  });

  function jumpToToday() {
    activeJumpTarget.value = 'today';
    const today = toLocalDateString(new Date());
    slideDirection.value = determineSlideDirection(today);
    goToDate(today);
    selectDay(today);
  }

  function goToTripDates() {
    activeJumpTarget.value = 'trip';
    if (trip.value?.start_date) {
      slideDirection.value = determineSlideDirection(trip.value.start_date);
      goToDate(trip.value.start_date);
      selectDay(trip.value.start_date);
    }
  }

  function selectDay(date: string) {
    selectedDate.value = date;
    const today = toLocalDateString(new Date());
    if (date === today) {
      activeJumpTarget.value = 'today';
    } else if (trip.value?.start_date && date === trip.value.start_date) {
      activeJumpTarget.value = 'trip';
    } else {
      activeJumpTarget.value = null;
    }
    options.onSelectDay?.(date);
  }

  function initNavigation() {
    const today = toLocalDateString(new Date());
    selectedDate.value = today;
    if (!goToDate(today) && trip.value?.start_date) {
      goToDate(trip.value.start_date);
      selectedDate.value = trip.value.start_date;
      activeJumpTarget.value = 'trip';
    } else {
      activeJumpTarget.value = 'today';
    }
  }

  const weekdayHeaders = computed(() =>
    calendarSettings.weekStart === 'sunday'
      ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
      : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  );

  function isToday(dateStr: string) {
    return dateStr === toLocalDateString(new Date());
  }

  function isTripDate(dateStr: string) {
    if (!trip.value?.start_date || !trip.value?.end_date) return false;
    return dateStr >= trip.value.start_date && dateStr <= trip.value.end_date;
  }

  function formatDay(date: string) {
    return new Date(date).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    });
  }

  return {
    granularity,
    selectedDate,
    activeJumpTarget,
    slideDirection,
    monthAnchor,
    weekAnchor,
    monthWeeks,
    visibleWeeks,
    monthLabel,
    prevPageLabel,
    nextPageLabel,
    visibleRangeLabel,
    canGoPrev,
    canGoNext,
    calendarPageKey,
    calendarTransitionName,
    isTodayActive,
    isTripActive,
    weekdayHeaders,
    prevPage,
    nextPage,
    prevMonth,
    nextMonth,
    goToDate,
    jumpToToday,
    goToTripDates,
    selectDay,
    initNavigation,
    isToday,
    isTripDate,
    formatDay,
  };
}

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { CalendarEntry } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useDrawersStore } from '../stores/drawers';
import Card from '../components/primitives/Card.vue';
import CalendarWeek from '../components/CalendarWeek.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import ScheduleToolbar from '../components/ScheduleToolbar.vue';
import ScheduleDayDetail from '../components/ScheduleDayDetail.vue';
import ScheduleAddModal from '../components/ScheduleAddModal.vue';
import ScheduleEditModal from '../components/ScheduleEditModal.vue';
import ScheduleDetailModal from '../components/ScheduleDetailModal.vue';
import { useCalendarData } from '../composables/useCalendarData';
import { usePendingSchedule } from '../composables/usePendingSchedule';
import { useCalendarNavigation } from '../composables/useCalendarNavigation';
import { useScheduleItemForm } from '../composables/useScheduleItemForm';
import { useScheduleItemDetail } from '../composables/useScheduleItemDetail';

// Auf Desktop weiterhin eigenständig gemountete Schublade (App.vue, linker Platz). Auf Mobil
// dagegen dieselbe Komponente als eigenständige Seite (Route /calendar, siehe router/index.ts)
// statt in einer kaum bedienbaren Schublade – standalone (per Route-Prop gesetzt) reserviert dafür
// wie jede andere Seite unten Platz für eine unten fixierte mobile NavBar (siehe .page-Pendant in
// style.css; im Schubladen-Kontext übernimmt das stattdessen Drawer.vue's eigenes Scroll-Panel).
const props = defineProps<{ standalone?: boolean }>();
const router = useRouter();
const tripStore = useTripStore();
const drawers = useDrawersStore();

// 1. Kalender-Daten & Synchronisation
const {
  trip,
  loading,
  allEntries,
  accommodationsForDate,
  weatherEntriesFor,
  entriesForDate,
  entryDone,
  toggleTodoDone,
  initCalendarData,
} = useCalendarData();

// 2. Einplanen-Workflow & Drag-and-Drop
const { pendingScheduleLabel, finishPendingSchedule, cancelPendingSchedule, onDropExcursion } =
  usePendingSchedule({ standalone: props.standalone });

// 3. Kalenderraster-Navigation & Datumsauswahl
const {
  granularity,
  selectedDate,
  canGoPrev,
  canGoNext,
  prevPageLabel,
  nextPageLabel,
  visibleRangeLabel,
  prevPage,
  nextPage,
  isTodayActive,
  isTripActive,
  jumpToToday,
  goToTripDates,
  weekdayHeaders,
  calendarTransitionName,
  calendarPageKey,
  visibleWeeks,
  selectDay,
  initNavigation,
  formatDay,
  isToday,
  isTripDate,
} = useCalendarNavigation({
  trip,
  entriesForDate,
  accommodationsForDate,
  weatherEntriesFor,
  onSelectDay: (date) => {
    const pending = drawers.pendingSchedule;
    if (!pending) return;
    void finishPendingSchedule(pending, date);
  },
});

// 4. Formular für neue/bearbeitete Termine
const scheduleItemForm = useScheduleItemForm({ selectedDate });
const { showAddForm, editingItem, openAddForm, closeEditForm, startEdit } = scheduleItemForm;

// 5. Detail-Ansicht für Termine
const scheduleItemDetail = useScheduleItemDetail({
  allEntries,
  weatherEntriesFor,
  onStartEdit: startEdit,
});
const { viewingItem, openAccommodationSpot } = scheduleItemDetail;

// Tages-Detailberechnungen
const dayEntries = computed(() => (selectedDate.value ? entriesForDate(selectedDate.value) : []));
const dayAccommodations = computed(() =>
  selectedDate.value ? accommodationsForDate(selectedDate.value) : []
);
const selectedDateWeatherEntries = computed(() =>
  selectedDate.value ? weatherEntriesFor(selectedDate.value) : []
);

function showDayOnMap() {
  if (!selectedDate.value) return;
  drawers.focusMapOnDate(selectedDate.value);
  drawers.calendarOpen = false;
}

function jumpToTrip() {
  tripStore.requestEditTrip();
}

function openEntry(entry: CalendarEntry) {
  if (entry.kind === 'trip') jumpToTrip();
  else if (entry.kind === 'todo') {
    drawers.calendarOpen = false;
    router.push(`/listen?tab=todo#todo-${entry.todoId}`);
  } else if (entry.category === 'travel' && entry.ideaId != null) {
    drawers.openMapForExcursion(entry.ideaId);
    drawers.calendarOpen = false;
    router.push(`/excursions#excursion-${entry.ideaId}`);
  } else if (entry.kind === 'schedule') {
    viewingItem.value = entry.scheduleItem;
  }
}

onMounted(async () => {
  await initCalendarData();
  initNavigation();
  loading.value = false;
});
</script>

<template>
  <div class="calendar-drawer-content" :class="{ standalone, page: standalone }" v-if="!loading">
    <h1 v-if="standalone">Kalender</h1>
    <h2 v-else>Kalender</h2>

    <ScheduleToolbar
      :pending-schedule="drawers.pendingSchedule"
      :pending-schedule-label="pendingScheduleLabel"
      v-model:granularity="granularity"
      :can-go-prev="canGoPrev"
      :can-go-next="canGoNext"
      :prev-page-label="prevPageLabel"
      :next-page-label="nextPageLabel"
      :visible-range-label="visibleRangeLabel"
      :is-today-active="isTodayActive"
      :is-trip-active="isTripActive"
      :has-trip-start-date="!!trip?.start_date"
      @cancel-pending-schedule="cancelPendingSchedule"
      @prev-page="prevPage"
      @next-page="nextPage"
      @jump-to-today="jumpToToday"
      @go-to-trip-dates="goToTripDates"
      @open-add="openAddForm"
    />

    <Card class="weeks">
      <div class="calendar-weekday-headers" aria-hidden="true">
        <span v-for="h in weekdayHeaders" :key="h" class="weekday-col-header">{{ h }}</span>
      </div>
      <div class="calendar-weeks-viewport">
        <Transition :name="calendarTransitionName">
          <div :key="calendarPageKey" class="calendar-weeks-page">
            <CalendarWeek
              v-for="week in visibleWeeks"
              :key="week[0]?.date"
              :days="week"
              :selected-date="selectedDate"
              :trip-start-date="trip?.start_date"
              :trip-end-date="trip?.end_date"
              @select="selectDay"
              @drop-excursion="onDropExcursion"
            />
          </div>
        </Transition>
      </div>
    </Card>

    <ScheduleDayDetail
      v-if="selectedDate"
      :selected-date="selectedDate"
      :entries="dayEntries"
      :accommodations="dayAccommodations"
      :weather-entries="selectedDateWeatherEntries"
      :is-today="isToday(selectedDate)"
      :is-trip-date="isTripDate(selectedDate)"
      :format-day="formatDay(selectedDate)"
      :entry-done="entryDone"
      @show-on-map="showDayOnMap"
      @open-accommodation="openAccommodationSpot"
      @open-entry="openEntry"
      @toggle-todo-done="toggleTodoDone"
    />

    <ScheduleAddModal v-model="showAddForm" :form="scheduleItemForm" />

    <ScheduleEditModal :item="editingItem" :form="scheduleItemForm" @close="closeEditForm" />

    <ScheduleDetailModal
      :model-value="viewingItem !== null"
      :detail="scheduleItemDetail"
      @update:model-value="(v) => !v && (viewingItem = null)"
    />
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.calendar-drawer-content {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Als eigenständige Seite (Route /calendar) übernimmt kein Drawer-Panel mehr das Scrollen/die
   Höhenbegrenzung – braucht deshalb wie jede andere Seite unten Platz für eine unten fixierte
   mobile NavBar (siehe .page-Pendant in style.css, inkl. des zusätzlichen --space-4 dort für einen
   sichtbaren Mindestabstand, den --navbar-bottom-offset allein nicht liefert). */
.calendar-drawer-content.standalone {
  max-width: var(--page-max-width);
  margin: 0 auto;
  padding: var(--space-4);
  padding-bottom: calc(var(--navbar-bottom-offset, 88px) + var(--space-4));
  box-sizing: border-box;
}

.calendar-drawer-content h2 {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-primary-dark);
}

.weeks {
  padding: var(--space-2);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

/* Leucht-Effekt für den gesamten Kalender-Wochenbereich während des Einplanen-Drags (#drag) */
:global(body.is-dragging-calendar .weeks) {
  border-color: color-mix(in srgb, var(--color-scheduled) 60%, transparent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--color-scheduled) 35%, transparent),
    0 6px 20px -2px color-mix(in srgb, var(--color-scheduled) 25%, transparent);
}

.calendar-weekday-headers {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
  margin-bottom: 2px;
  padding: 0 var(--space-1);
  text-align: center;
}

.weekday-col-header {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: 2px 0;
  line-height: 1.2;
}

.calendar-weeks-viewport {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 100%;
  padding: var(--space-1);
}

.calendar-weeks-page {
  grid-area: 1 / 1;
  width: 100%;
  will-change: transform, opacity;
}

/* Blätter-Animation für den Kalender (Monat, Woche, 2 Wochen) */
.calendar-slide-next-enter-active,
.calendar-slide-next-leave-active,
.calendar-slide-prev-enter-active,
.calendar-slide-prev-leave-active {
  transition:
    transform 0.26s cubic-bezier(0.25, 1, 0.5, 1),
    opacity 0.22s ease;
}

.calendar-slide-next-leave-active,
.calendar-slide-prev-leave-active,
.calendar-slide-fade-leave-active {
  pointer-events: none;
}

.calendar-slide-next-enter-from {
  transform: translateX(100%);
  opacity: 0.2;
}

.calendar-slide-next-leave-to {
  transform: translateX(-100%);
  opacity: 0.2;
}

.calendar-slide-prev-enter-from {
  transform: translateX(-100%);
  opacity: 0.2;
}

.calendar-slide-prev-leave-to {
  transform: translateX(100%);
  opacity: 0.2;
}

.calendar-slide-fade-enter-active,
.calendar-slide-fade-leave-active {
  transition: opacity 0.2s ease;
}

.calendar-slide-fade-enter-from,
.calendar-slide-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .calendar-slide-next-enter-active,
  .calendar-slide-next-leave-active,
  .calendar-slide-prev-enter-active,
  .calendar-slide-prev-leave-active,
  .calendar-slide-fade-enter-active,
  .calendar-slide-fade-leave-active {
    transition: none !important;
    transform: none !important;
  }
}
</style>

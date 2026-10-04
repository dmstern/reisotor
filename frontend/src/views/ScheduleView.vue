<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { CalendarEntry } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useSpotsStore } from '../stores/spots';
import { useDrawersStore } from '../stores/drawers';
import CalendarWeek from '../components/CalendarWeek.vue';
import SegmentedToggle from '../components/SegmentedToggle.vue';
import Modal from '../components/Modal.vue';
import DetailModal from '../components/DetailModal.vue';
import MapsAppPicker from '../components/MapsAppPicker.vue';
import Combobox from '../components/Combobox.vue';
import FormField from '../components/FormField.vue';
import FileAttachments from '../components/FileAttachments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import RichTextEditor from '../components/RichTextEditor.vue';
import RichTextDisplay from '../components/RichTextDisplay.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import IconButton from '../components/primitives/IconButton.vue';
import DropdownItem from '../components/primitives/DropdownItem.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import CollapsibleFieldset from '../components/primitives/CollapsibleFieldset.vue';
import Select from '../components/primitives/Select.vue';
import Input from '../components/primitives/Input.vue';
import DetailRow from '../components/primitives/DetailRow.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import PickerMenu from '../components/primitives/PickerMenu.vue';
import Badge from '../components/primitives/Badge.vue';
import WeatherIcon from '../components/WeatherIcon.vue';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { spotCategoryMeta } from '../utils/spotCategory';
import {
  calendarEventFromEntry,
  googleCalendarHref,
  outlookCalendarHref,
} from '../utils/calendarExport';
import { weatherCodeMeta } from '../utils/weather';
import { formatDate } from '../utils/dateFormat';
import { isEmptyRichText } from '../utils/richText';
import { useCalendarData } from '../composables/useCalendarData';
import { usePendingSchedule } from '../composables/usePendingSchedule';
import { useCalendarNavigation } from '../composables/useCalendarNavigation';
import { useScheduleItemForm } from '../composables/useScheduleItemForm';
import { useScheduleItemDetail } from '../composables/useScheduleItemDetail';
import { useCalendarExportPicker } from '../composables/useCalendarExportPicker';

// Auf Desktop weiterhin eigenständig gemountete Schublade (App.vue, linker Platz). Auf Mobil
// dagegen dieselbe Komponente als eigenständige Seite (Route /calendar, siehe router/index.ts)
// statt in einer kaum bedienbaren Schublade – standalone (per Route-Prop gesetzt) reserviert dafür
// wie jede andere Seite unten Platz für eine unten fixierte mobile NavBar (siehe .page-Pendant in
// style.css; im Schubladen-Kontext übernimmt das stattdessen Drawer.vue's eigenes Scroll-Panel).
const props = defineProps<{ standalone?: boolean }>();
const router = useRouter();
const tripStore = useTripStore();
const excursionsStore = useExcursionsStore();
const spotsStore = useSpotsStore();
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
const {
  placeNames,
  newStartDate,
  newTime,
  newEndTime,
  newTitle,
  newNote,
  newEndDate,
  newLocation,
  newMapsLink,
  newLinkKey,
  showAddForm,
  showAddLocationSection,
  newTitleTouched,
  newStartDateTouched,
  showNewTitleError,
  showNewStartDateError,
  canAddScheduleItem,
  addScheduleItemTooltip,
  newDraft,
  openAddForm,
  closeAddForm,
  discardNewDraft,
  addItem,
  editingItem,
  isItemUploadingAttachments,
  showEditLocationSection,
  editTitleTouched,
  editForm,
  showEditTitleError,
  canSaveEditScheduleItem,
  editScheduleItemTooltip,
  editDraft,
  startEdit,
  submitEdit,
  closeEditForm,
  discardEditDraft,
  deleteEditingItem,
} = useScheduleItemForm({ selectedDate });

// 5. Detail-Ansicht für Termine
const {
  viewingItem,
  viewingEntry,
  viewingImageUrl,
  viewingCollageImages,
  viewingCategoryInfo,
  viewingWeatherEntry,
  viewingEffectiveCoords,
  formatViewingDate,
  linkedTitleFor,
  navigateToLinkedEntity,
  openAccommodationSpot,
  editViewingItem,
} = useScheduleItemDetail({
  allEntries,
  weatherEntriesFor,
  onStartEdit: startEdit,
});

// 6. Kalender-Export Dropdown (Apple, Google, Outlook, Android)
const { calendarPickerKey, calendarPickerStyle, toggleCalendarPicker, downloadIcsForEntry } =
  useCalendarExportPicker();

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

    <div class="pending-schedule-banner" v-if="drawers.pendingSchedule">
      <span v-if="drawers.pendingSchedule.mode === 'confirm-done'">
        <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Wähle den Tag, an
        dem „{{ pendingScheduleLabel }}“
        {{ drawers.pendingSchedule.kind === 'excursion' ? 'gemacht' : 'besucht' }} wurde
      </span>
      <span v-else
        ><AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Tippe einen Tag an,
        um „{{ pendingScheduleLabel }}“ einzuplanen</span
      >
      <Button variant="secondary" @click="cancelPendingSchedule">Abbrechen</Button>
    </div>

    <div class="calendar-toolbar">
      <div class="toolbar-nav-row">
        <div class="pager">
          <IconButton
            variant="ghost"
            size="sm"
            :disabled="!canGoPrev"
            :icon="ACTION_ICONS.scrollLeft"
            :aria-label="prevPageLabel"
            :title="prevPageLabel"
            @click="prevPage"
          />
          <span class="range-label">{{ visibleRangeLabel }}</span>
          <IconButton
            variant="ghost"
            size="sm"
            :disabled="!canGoNext"
            :icon="ACTION_ICONS.scrollRight"
            :aria-label="nextPageLabel"
            :title="nextPageLabel"
            @click="nextPage"
          />
        </div>
        <div class="granularity-wrap">
          <SegmentedToggle
            v-model="granularity"
            :options="[
              { value: 'week', label: 'Woche' },
              { value: 'twoWeeks', label: '2 Wochen' },
              { value: 'month', label: 'Monat' },
            ]"
          />
        </div>
      </div>

      <div class="toolbar-actions-row">
        <div class="jump-row">
          <Button
            variant="secondary"
            size="sm"
            :active="isTodayActive"
            title="Zum heutigen Datum springen"
            @click="jumpToToday"
          >
            <AppIcon
              :icon="ACTION_ICONS.today"
              :size="14"
              group="actions"
              :active="isTodayActive"
            />
            Heute
          </Button>
          <Button
            variant="secondary"
            size="sm"
            v-if="trip?.start_date"
            :active="isTripActive"
            title="Zum Reisezeitraum springen"
            @click="goToTripDates"
          >
            <AppIcon
              :icon="ACTION_ICONS.vacation"
              :size="14"
              group="actions"
              :active="isTripActive"
            />
            Urlaub
          </Button>
        </div>
        <Button size="sm" @click="openAddForm">
          <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Neu
        </Button>
      </div>
    </div>

    <div class="card weeks">
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
    </div>

    <div class="card day-detail" v-if="selectedDate">
      <div class="day-detail-head">
        <div class="day-detail-title-group">
          <h3>{{ formatDay(selectedDate) }}</h3>
          <Badge v-if="isToday(selectedDate)" variant="accent" size="sm">Heute</Badge>
          <Badge v-else-if="isTripDate(selectedDate)" variant="primary" size="sm">Urlaubstag</Badge>
        </div>
        <div class="day-detail-actions">
          <Button variant="card-action" size="sm" @click="showDayOnMap">
            <AppIcon :icon="SECTION_ICON_DEFS.map" :size="14" group="navigation" /> Tag auf Karte
            anzeigen
          </Button>
        </div>
      </div>

      <div
        class="day-meta-bar"
        v-if="selectedDateWeatherEntries.length || dayAccommodations.length"
      >
        <div
          v-for="entry in selectedDateWeatherEntries"
          :key="entry.key"
          class="day-meta-pill weather-pill"
          :title="`${entry.label}: ${weatherCodeMeta(entry.weather.weatherCode).label}`"
        >
          <WeatherIcon :code="entry.weather.weatherCode" :size="16" />
          <span class="meta-label">{{ entry.label }}:</span>
          <span class="temp-range">
            <strong>{{ Math.round(entry.weather.tempMax) }}°</strong>
            <span class="temp-min"> / {{ Math.round(entry.weather.tempMin) }}°</span>
          </span>
          <span v-if="entry.weather.precipitationProbability != null" class="rain-prob">
            · <AppIcon :icon="ACTION_ICONS.rain" :size="12" group="actions" />
            {{ entry.weather.precipitationProbability }}%
          </span>
        </div>

        <button
          type="button"
          v-for="acc in dayAccommodations"
          :key="acc.id"
          class="day-meta-pill acc-pill is-clickable"
          :title="`Unterkunft: ${acc.title} auf Karte anzeigen`"
          @click="openAccommodationSpot(acc.id)"
        >
          <AppIcon :icon="spotCategoryMeta('Unterkunft').tabler" :size="14" group="categories" />
          <span class="meta-label">Unterkunft:</span>
          <strong>{{ acc.title }}</strong>
        </button>
      </div>

      <TransitionGroup tag="ul" name="list" class="items">
        <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions, vuejs-accessibility/click-events-have-key-events -->
        <li
          v-for="(entry, index) in dayEntries"
          :key="entry.key"
          class="item clickable animate-cascade"
          tabindex="0"
          :style="{
            '--stagger-delay': `${index * 40}ms`,
            '--entry-cat-color': SCHEDULE_CATEGORY_META[entry.category].color,
            borderLeftColor: SCHEDULE_CATEGORY_META[entry.category].color,
          }"
          @click="openEntry(entry)"
          @keydown.enter.prevent="openEntry(entry)"
          @keydown.space.prevent="openEntry(entry)"
        >
          <div class="item-leading">
            <Checkbox
              v-if="entry.kind === 'todo'"
              class="todo-checkbox"
              aria-label="Erledigt"
              :checked="entryDone(entry)"
              @click.stop="toggleTodoDone(entry.todoId!)"
            />
            <div v-else class="item-cat-icon" :title="SCHEDULE_CATEGORY_META[entry.category].label">
              <AppIcon
                :size="16"
                :icon="entry.iconDef ?? SCHEDULE_CATEGORY_META[entry.category].tabler"
                group="categories"
              />
            </div>
          </div>

          <div class="item-main">
            <div class="item-header-line">
              <span v-if="entry.time" class="item-time-badge">
                <AppIcon :icon="FORM_FIELD_ICONS.time" :size="11" group="formFields" />
                {{ entry.time }}<template v-if="entry.endTime"> – {{ entry.endTime }}</template>
              </span>
              <span class="item-category-pill">
                {{ SCHEDULE_CATEGORY_META[entry.category].label }}
              </span>
            </div>
            <div class="title" :class="{ 'todo-done': entry.kind === 'todo' && entryDone(entry) }">
              {{ entry.title }}
            </div>
            <p v-if="entry.location" class="location">
              <AppIcon :icon="FORM_FIELD_ICONS.location" :size="12" group="formFields" />
              {{ entry.location }}
            </p>
            <RichTextDisplay
              v-if="entry.note && !isEmptyRichText(entry.note)"
              :content="entry.note"
              format="html"
              class="note"
            />
          </div>

          <div class="item-actions">
            <div class="calendar-export">
              <Button
                variant="secondary"
                size="sm"
                class="calendar-btn"
                title="Zum eigenen Kalender hinzufügen"
                aria-label="Zum eigenen Kalender hinzufügen"
                @click.stop="toggleCalendarPicker(entry.key, $event)"
              >
                <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" />
                <span class="calendar-btn-label">In Kalender</span>
              </Button>
              <Teleport to="body">
                <template v-if="calendarPickerKey === entry.key">
                  <PickerMenu
                    :style="calendarPickerStyle"
                    origin="top-right"
                    @close="calendarPickerKey = null"
                  >
                    <DropdownItem
                      :icon="ACTION_ICONS.apple"
                      label="Apple/iPhone"
                      @click="downloadIcsForEntry(entry)"
                    />
                    <DropdownItem
                      :href="googleCalendarHref(calendarEventFromEntry(entry))"
                      target="_blank"
                      rel="noopener"
                      :icon="ACTION_ICONS.googleCalendar"
                      label="Google Kalender"
                      @click="calendarPickerKey = null"
                    />
                    <DropdownItem
                      :href="outlookCalendarHref(calendarEventFromEntry(entry))"
                      target="_blank"
                      rel="noopener"
                      :icon="FORM_FIELD_ICONS.email"
                      icon-group="formFields"
                      label="Outlook"
                      @click="calendarPickerKey = null"
                    />
                    <DropdownItem
                      :icon="ACTION_ICONS.android"
                      label="Android"
                      @click="downloadIcsForEntry(entry)"
                    />
                  </PickerMenu>
                </template>
              </Teleport>
            </div>
          </div>
        </li>
        <EmptyState v-if="!dayEntries.length" key="empty" tag="li">
          Noch keine Termine an diesem Tag.
        </EmptyState>
      </TransitionGroup>
    </div>

    <Modal
      :model-value="showAddForm"
      title="Termin anlegen"
      full-height
      :confirm-close="newDraft.isDirty.value"
      confirm-close-title="Entwurf verwerfen?"
      confirm-close-message="Du hast bereits Eingaben für diesen Termin gemacht. Möchtest du den Entwurf verwerfen?"
      confirm-close-confirm-label="Entwurf verwerfen"
      @update:model-value="(v) => !v && closeAddForm()"
    >
      <form class="edit-form" @submit.prevent="addItem">
        <FormField
          icon="title"
          label="Titel"
          required
          :invalid="showNewTitleError"
          :error="showNewTitleError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
          v-slot="{ id, invalid }"
        >
          <Input
            :id="id"
            v-model="newTitle"
            type="text"
            placeholder="Titel"
            required
            :invalid="invalid"
            @blur="newTitleTouched = true"
          />
        </FormField>
        <div class="row">
          <FormField
            icon="date"
            label="Startdatum"
            required
            :invalid="showNewStartDateError"
            :error="showNewStartDateError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
            v-slot="{ id, invalid }"
          >
            <Input
              :id="id"
              v-model="newStartDate"
              type="date"
              required
              :invalid="invalid"
              @blur="newStartDateTouched = true"
            />
          </FormField>
          <FormField icon="time" label="Startzeit" v-slot="{ id }">
            <Input :id="id" v-model="newTime" type="time" />
          </FormField>
        </div>
        <div class="row">
          <FormField icon="date" label="Enddatum" v-slot="{ id }">
            <Input :id="id" v-model="newEndDate" type="date" :min="newStartDate || undefined" />
          </FormField>
          <FormField icon="time" label="Enduhrzeit" v-slot="{ id }">
            <Input :id="id" v-model="newEndTime" type="time" />
          </FormField>
        </div>
        <CollapsibleFieldset
          v-model="showAddLocationSection"
          label="Ortsangaben"
          :icon="FORM_FIELD_ICONS.location"
          icon-group="formFields"
        >
          <div class="row">
            <FormField icon="maps" label="Karte" v-slot="{ id }">
              <Select :id="id" v-model="newLinkKey">
                <option value="">Kein Spot/keine Tour verknüpft</option>
                <optgroup label="Spots" v-if="spotsStore.spots.length">
                  <option
                    v-for="s in spotsStore.spots"
                    :key="`spot:${s.id}`"
                    :value="`spot:${s.id}`"
                  >
                    {{ s.title }}
                  </option>
                </optgroup>
                <optgroup label="Touren" v-if="excursionsStore.excursions.length">
                  <option
                    v-for="e in excursionsStore.excursions"
                    :key="`idea:${e.id}`"
                    :value="`idea:${e.id}`"
                  >
                    {{ e.title }}
                  </option>
                </optgroup>
              </Select>
            </FormField>
            <FormField v-if="!newLinkKey" icon="location" label="Ort (Freitext)" v-slot="{ id }">
              <Combobox :id="id" v-model="newLocation" :options="placeNames" placeholder="Ort" />
            </FormField>
          </div>
          <FormField v-if="!newLinkKey" icon="maps" label="Maps-Link" v-slot="{ id }">
            <Input
              :id="id"
              v-model="newMapsLink"
              type="url"
              placeholder="Maps-Link (Google/Apple)"
            />
          </FormField>
        </CollapsibleFieldset>
        <FormField icon="note" label="Notiz">
          <RichTextEditor v-model="newNote" placeholder="Notiz" compact expandable />
        </FormField>
        <DraftStatusBar
          :status="newDraft.status.value"
          :restored="newDraft.restored.value"
          :can-discard="true"
          mode="create"
          @discard="discardNewDraft"
        />
        <div class="actions-row">
          <div class="spacer"></div>
          <Button type="button" variant="secondary" class="btn-cancel" @click="closeAddForm">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="!canAddScheduleItem" :title="addScheduleItemTooltip">
            Hinzufügen
          </Button>
        </div>
      </form>
    </Modal>

    <Modal
      :model-value="editingItem !== null"
      title="Termin bearbeiten"
      full-height
      :confirm-close="editDraft.isDirty.value"
      confirm-close-title="Ungespeicherte Änderungen verwerfen?"
      confirm-close-message="Du hast ungespeicherte Änderungen an diesem Termin vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?"
      confirm-close-confirm-label="Änderungen verwerfen"
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField
          icon="title"
          label="Titel"
          required
          :invalid="showEditTitleError"
          :error="showEditTitleError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
          v-slot="{ id, invalid }"
        >
          <Input
            :id="id"
            v-model="editForm.title"
            type="text"
            placeholder="Titel"
            required
            :invalid="invalid"
            @blur="editTitleTouched = true"
          />
        </FormField>
        <div class="row">
          <FormField icon="date" label="Startdatum" required v-slot="{ id }">
            <Input :id="id" :model-value="editingItem?.date" type="date" disabled readonly />
          </FormField>
          <FormField icon="time" label="Startzeit" v-slot="{ id }">
            <Input :id="id" v-model="editForm.time" type="time" />
          </FormField>
        </div>
        <div class="row">
          <FormField icon="date" label="Enddatum" v-slot="{ id }">
            <Input :id="id" v-model="editForm.endDate" type="date" :min="editingItem?.date" />
          </FormField>
          <FormField icon="time" label="Enduhrzeit" v-slot="{ id }">
            <Input :id="id" v-model="editForm.endTime" type="time" />
          </FormField>
        </div>
        <CollapsibleFieldset
          v-model="showEditLocationSection"
          label="Ortsangaben"
          :icon="FORM_FIELD_ICONS.location"
          icon-group="formFields"
        >
          <div class="row">
            <FormField icon="maps" label="Karte" v-slot="{ id }">
              <Select :id="id" v-model="editForm.linkKey">
                <option value="">Kein Spot/keine Tour verknüpft</option>
                <optgroup label="Spots" v-if="spotsStore.spots.length">
                  <option
                    v-for="s in spotsStore.spots"
                    :key="`spot:${s.id}`"
                    :value="`spot:${s.id}`"
                  >
                    {{ s.title }}
                  </option>
                </optgroup>
                <optgroup label="Touren" v-if="excursionsStore.excursions.length">
                  <option
                    v-for="e in excursionsStore.excursions"
                    :key="`idea:${e.id}`"
                    :value="`idea:${e.id}`"
                  >
                    {{ e.title }}
                  </option>
                </optgroup>
              </Select>
            </FormField>
            <FormField
              v-if="!editForm.linkKey"
              icon="location"
              label="Ort (Freitext)"
              v-slot="{ id }"
            >
              <Combobox
                :id="id"
                v-model="editForm.location"
                :options="placeNames"
                placeholder="Ort"
              />
            </FormField>
          </div>
          <FormField v-if="!editForm.linkKey" icon="maps" label="Maps-Link" v-slot="{ id }">
            <Input
              :id="id"
              v-model="editForm.mapsLink"
              type="url"
              placeholder="Maps-Link (Google/Apple)"
            />
          </FormField>
        </CollapsibleFieldset>
        <FormField icon="note" label="Notiz">
          <RichTextEditor v-model="editForm.note" placeholder="Notiz" compact expandable />
        </FormField>
        <FileAttachments
          v-if="editingItem"
          domain="schedule"
          :entity-id="editingItem.id"
          v-model:uploading="isItemUploadingAttachments"
        />
        <DraftStatusBar
          :status="editDraft.status.value"
          :restored="editDraft.restored.value"
          :can-discard="true"
          mode="edit"
          @discard="discardEditDraft"
        />
        <div class="actions-row">
          <Button
            type="button"
            variant="danger"
            secondary
            :icon="ACTION_ICONS.delete"
            :disabled="isItemUploadingAttachments"
            @click="deleteEditingItem"
          >
            Löschen
          </Button>
          <div class="spacer"></div>
          <Button type="button" variant="secondary" class="btn-cancel" @click="closeEditForm">
            Abbrechen
          </Button>
          <Button
            type="submit"
            :disabled="!canSaveEditScheduleItem"
            :title="editScheduleItemTooltip"
          >
            Speichern
          </Button>
        </div>
      </form>
    </Modal>

    <DetailModal
      :model-value="viewingItem !== null"
      @update:model-value="(v) => !v && (viewingItem = null)"
      :title="viewingItem?.title ?? ''"
      :image-url="viewingImageUrl"
      :collage-images="viewingCollageImages"
      :placeholder-icon="viewingCategoryInfo.icon"
      :category-label="viewingCategoryInfo.label"
      :category-icon="viewingCategoryInfo.icon"
      :theme-color="viewingCategoryInfo.themeColor"
      :theme-tint="viewingCategoryInfo.themeTint"
      @edit="editViewingItem"
    >
      <template #meta>
        <span v-if="viewingItem" class="detail-badge">
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
          {{ formatViewingDate(viewingItem.date) }}
        </span>
        <span
          v-if="
            viewingWeatherEntry &&
            (viewingWeatherEntry.weather.tempMax !== 0 || viewingWeatherEntry.weather.tempMin !== 0)
          "
          class="detail-badge weather-badge"
        >
          <WeatherIcon :code="viewingWeatherEntry.weather.weatherCode" :size="13" />
          {{ Math.round(viewingWeatherEntry.weather.tempMax) }}° /
          {{ Math.round(viewingWeatherEntry.weather.tempMin) }}°
        </span>
        <Badge v-if="viewingItem?.auto_created" variant="primary" size="sm">
          <AppIcon :icon="ACTION_ICONS.sparkles" :size="12" group="actions" />
          Automatisch angelegt
        </Badge>
      </template>
      <DetailRow v-if="viewingItem?.time" label="Zeit">
        <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" /> {{ viewingItem.time
        }}<template v-if="viewingItem.end_time"> – {{ viewingItem.end_time }}</template>
      </DetailRow>
      <DetailRow
        v-if="viewingItem?.end_date && viewingItem.end_date !== viewingItem.date"
        label="Zeitraum"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
        {{ formatDate(viewingItem.date) }} – {{ formatDate(viewingItem.end_date) }}
      </DetailRow>
      <DetailRow v-if="!linkedTitleFor(viewingEntry) && viewingItem?.location" label="Ort">
        <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
        {{ viewingItem.location }}
      </DetailRow>
      <DetailRow
        v-if="linkedTitleFor(viewingEntry)"
        :label="viewingEntry?.spotId != null ? 'Verknüpfter Ort' : 'Verknüpfte Tour'"
        tag="div"
        class="linked-entity-row"
      >
        <Button
          variant="secondary"
          size="sm"
          class="linked-entity-btn"
          @click="navigateToLinkedEntity"
        >
          <AppIcon
            :icon="
              viewingEntry?.iconDef ??
              (viewingEntry?.spotId != null
                ? FORM_FIELD_ICONS.location
                : SECTION_ICON_DEFS.excursions)
            "
            :size="15"
            group="categories"
          />
          <span class="linked-entity-title">{{ linkedTitleFor(viewingEntry) }}</span>
          <AppIcon
            :icon="ACTION_ICONS.scrollRight"
            :size="12"
            group="actions"
            class="linked-entity-chevron"
          />
        </Button>
      </DetailRow>
      <RichTextDisplay
        v-if="viewingItem?.note && !isEmptyRichText(viewingItem.note)"
        :content="viewingItem.note"
        format="html"
        class="detail-row note"
      />
      <FileAttachments
        v-if="viewingItem"
        domain="schedule"
        :entity-id="viewingItem.id"
        :editable="false"
      />
      <div v-if="viewingEffectiveCoords || viewingEntry" class="detail-actions">
        <MapsAppPicker
          v-if="viewingEffectiveCoords"
          :lat="viewingEffectiveCoords.lat"
          :lng="viewingEffectiveCoords.lng"
          :title="viewingEffectiveCoords.title"
          :maps-link="viewingEffectiveCoords.mapsLink"
        />
        <Button
          v-if="viewingEntry"
          variant="card-action"
          size="sm"
          class="calendar-btn"
          title="Zum eigenen Kalender hinzufügen"
          aria-label="Zum eigenen Kalender hinzufügen"
          @click.stop="toggleCalendarPicker(viewingEntry.key, $event)"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" />
          <span class="calendar-btn-label">In meinen Kalender</span>
        </Button>
      </div>
    </DetailModal>
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

.pending-schedule-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-highlight);
  border: 1px solid var(--color-highlight-border);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-primary-dark);
}

.pending-schedule-banner button {
  flex-shrink: 0;
  padding: 4px 10px;
  font-size: 0.82rem;
}

.calendar-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.toolbar-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.granularity-wrap {
  display: flex;
  justify-content: flex-end;
}

.pager {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.range-label {
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--color-text);
  min-width: 105px;
  text-align: center;
}

.toolbar-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.jump-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}

.day-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}

.day-detail-title-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.day-detail-title-group h3 {
  color: var(--color-primary-dark);
  margin: 0;
  font-size: 1.15rem;
}

.day-detail-actions,
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.detail-actions {
  margin-top: var(--space-3);
}

.day-detail {
  container-type: inline-size;
  container-name: day-detail;
}

.day-meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.day-meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: 0.82rem;
  border: 1px solid var(--color-border);
  background: var(--color-hover);
  color: var(--color-text);
}

.day-meta-pill.weather-pill {
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.day-meta-pill.acc-pill {
  background: var(--color-accent-secondary-bg);
  border-color: color-mix(in srgb, var(--color-accent-secondary) 25%, transparent);
  color: var(--color-accent-secondary);
}

.day-meta-pill.acc-pill.is-clickable {
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.day-meta-pill.acc-pill.is-clickable:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.meta-label {
  font-weight: 500;
  color: var(--color-text-muted);
}

.day-meta-pill.acc-pill .meta-label {
  color: var(--color-accent-secondary);
  opacity: 0.85;
}

.temp-range {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.temp-min {
  color: var(--color-text-muted);
  font-weight: normal;
}

.rain-prob {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.items {
  list-style: none;
  padding: 0;
  margin: 0 0 var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--entry-cat-color, var(--color-primary));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.item.clickable {
  cursor: pointer;
}

.item.clickable:hover {
  background: var(--color-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.item-leading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding-top: 2px;
}

.item-cat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-xs-squircle, 6px);
  corner-shape: squircle;
  background: color-mix(in srgb, var(--entry-cat-color) 12%, var(--color-surface));
  color: var(--entry-cat-color);
  flex-shrink: 0;
}

.todo-checkbox {
  margin-top: 2px;
}

.item-main {
  min-width: 0;
  flex: 1;
  word-break: break-word;
  overflow-wrap: break-word;
}

.item-header-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: 3px;
  flex-wrap: wrap;
}

.item-time-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--color-primary-dark);
  background: var(--color-primary-tint);
  padding: 1px 6px;
  border-radius: 4px;
  line-height: 1.25;
}

.item-category-pill {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1.25;
}

.item .title {
  font-weight: 600;
  font-size: 0.94rem;
  color: var(--color-text);
  line-height: 1.3;
}

.item .title.todo-done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.item .location {
  margin: 3px 0 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}

.item .note {
  margin: 4px 0 0;
  font-size: 0.86rem;
}

.empty {
  padding: var(--space-2);
}

.item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: center;
  padding-top: 1px;
}

.calendar-btn {
  padding: 4px 8px;
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.2;
  gap: 6px;
  white-space: nowrap;
}

.calendar-btn-label {
  display: none;
}

@container day-detail (min-width: 440px) {
  .calendar-btn {
    padding: 4px 10px;
  }

  .calendar-btn-label {
    display: inline;
  }
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.edit-form .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form .row > * {
  flex: 1;
  min-width: 140px;
}

/* Ohne eigenes FormField-Label würde der Absenden-Button, sobald er in derselben umgebrochenen
   Flex-Zeile wie ein FormField landet, vom Flex-Default align-items:stretch auf dessen (größere)
   Höhe gezogen (Konsistenz-Prinzip, siehe DESIGN.md). flex-basis:100% erzwingt stattdessen immer
   eine eigene, volle Zeile - Absenden-Button bekommt so app-weit dieselbe, natürliche Höhe. */
.edit-form button[type='submit'] {
  flex: 1 1 100%;
}

.spacer {
  flex: 1;
}

/* --- Termin-Detail-Badge (#264) --- */
.detail-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

/* --- Verknüpfte Entität Button (#264) --- */
.linked-entity-row {
  margin-top: var(--space-2);
  margin-bottom: var(--space-1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.linked-entity-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
}

.linked-entity-title {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linked-entity-chevron {
  margin-left: var(--space-1);
  opacity: 0.6;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.detail-actions .calendar-btn {
  padding: 5px 12px;
  font-size: 0.82rem;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.detail-actions .calendar-btn .calendar-btn-label {
  display: inline;
}
</style>

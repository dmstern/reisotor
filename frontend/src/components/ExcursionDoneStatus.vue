<script setup lang="ts">
import { computed } from 'vue';
import type { Excursion } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';
import { useExcursionWeather } from '../composables/useExcursionWeather';
import { useExcursionDoneStatus } from '../composables/useExcursionDoneStatus';
import { useDrawersStore } from '../stores/drawers';
import DoneToggle from './primitives/DoneToggle.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';

const props = withDefaults(
  defineProps<{
    excursion: Excursion;
    expanded: boolean;
    resolvedStations?: ExcursionStation[];
  }>(),
  {
    resolvedStations: () => [],
  }
);

const drawers = useDrawersStore();

const { weatherSummary, statusDateLabel } = useExcursionWeather({
  excursion: () => props.excursion,
  resolvedStations: () => props.resolvedStations,
});

const {
  datesPopoverOpen,
  datesPopoverStyle,
  unplannedPopoverOpen,
  unplannedPopoverStyle,
  unplannedDoneDate,
  onToggleDone,
  togglePlannedDone,
  submitUnplannedDone,
  submitUnplannedPlan,
  openCalendarConfirmDone,
} = useExcursionDoneStatus({
  excursion: () => props.excursion,
});

const hasDropdown = computed(
  () => props.expanded && (!!props.excursion.date || !props.excursion.done)
);

const dropdownTitle = computed(() => {
  if (!hasDropdown.value) {
    return undefined;
  }

  return props.excursion.date
    ? 'Tour-Status und Termin verwalten'
    : 'Tour einplanen oder als gemacht markieren';
});

function openCalendarAtDate(date: string) {
  datesPopoverOpen.value = false;
  drawers.openCalendar(date);
}
</script>

<template>
  <DoneToggle
    v-if="expanded"
    key="btn-done"
    :done="!!excursion.done"
    :planned="!!excursion.date"
    :dropdown="hasDropdown"
    :dropdown-open="datesPopoverOpen || unplannedPopoverOpen"
    :aria-label="excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
    :title="
      dropdownTitle ||
      (excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren')
    "
    @click="onToggleDone"
  >
    <template v-if="excursion.done">
      <template v-if="excursion.date">
        <span class="done-toggle-prefix">Gemacht am </span>
        <span class="done-toggle-date">
          <AppIcon
            :icon="FORM_FIELD_ICONS.date"
            :size="12"
            group="formFields"
            class="done-toggle-calendar-icon"
          />
          {{ statusDateLabel }}
        </span>
      </template>
      <template v-else>Gemacht</template>
      <span v-if="weatherSummary" class="done-toggle-weather">
        · <WeatherIcon :code="weatherSummary.weatherCode" :size="14" />
        {{ weatherSummary.tempLabel }}
      </span>
    </template>
    <template v-else-if="excursion.date">
      <span class="done-toggle-prefix">Geplant für </span>
      <span class="done-toggle-date">
        <AppIcon
          :icon="FORM_FIELD_ICONS.date"
          :size="12"
          group="formFields"
          class="done-toggle-calendar-icon"
        />
        {{ statusDateLabel }}
      </span>
      <span v-if="weatherSummary" class="done-toggle-weather">
        · <WeatherIcon :code="weatherSummary.weatherCode" :size="14" />
        {{ weatherSummary.tempLabel }}
      </span>
    </template>
    <template v-else>Gemacht</template>
  </DoneToggle>

  <div
    v-else-if="excursion.done || excursion.date"
    class="tour-status-meta status"
    :class="{
      'status-done': !!excursion.done,
      planned: !!excursion.date && !excursion.done,
    }"
  >
    <template v-if="excursion.done">
      <AppIcon
        :icon="ACTION_ICONS.done"
        :size="13"
        group="actions"
        active
        class="tour-status-done-icon"
      />
      <template v-if="excursion.date">
        <span class="done-toggle-prefix">Gemacht am </span>
        <span class="done-toggle-date">
          <AppIcon
            :icon="FORM_FIELD_ICONS.date"
            :size="12"
            group="formFields"
            class="done-toggle-calendar-icon"
          />
          {{ statusDateLabel }}
        </span>
      </template>
      <template v-else>Gemacht</template>
      <span v-if="weatherSummary" class="done-toggle-weather">
        · <WeatherIcon :code="weatherSummary.weatherCode" :size="14" />
        {{ weatherSummary.tempLabel }}
      </span>
    </template>
    <template v-else-if="excursion.date">
      <span class="done-toggle-prefix">Geplant für </span>
      <span class="done-toggle-date">
        <AppIcon
          :icon="FORM_FIELD_ICONS.date"
          :size="12"
          group="formFields"
          class="done-toggle-calendar-icon"
        />
        {{ statusDateLabel }}
      </span>
      <span v-if="weatherSummary" class="done-toggle-weather">
        · <WeatherIcon :code="weatherSummary.weatherCode" :size="14" />
        {{ weatherSummary.tempLabel }}
      </span>
    </template>
  </div>

  <Teleport to="body">
    <!-- Popover zur Datumsauswahl für ungeplante Touren -->
    <PickerMenu
      v-if="unplannedPopoverOpen"
      class="tour-unplanned-popover"
      :style="unplannedPopoverStyle"
      @close="unplannedPopoverOpen = false"
    >
      <div class="unplanned-popover-content">
        <div class="popover-title-row">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          <span class="popover-heading">Tour einplanen oder abhaken</span>
        </div>
        <p class="popover-subtext">Wähle ein Datum für diese Tour:</p>
        <Input
          v-model="unplannedDoneDate"
          type="date"
          class="popover-date-input"
          aria-label="Datum der gemachten Tour"
          @keyup.enter="submitUnplannedDone"
        />
        <div class="popover-buttons">
          <Button
            type="button"
            variant="primary"
            size="sm"
            :disabled="!unplannedDoneDate"
            @click="submitUnplannedDone"
          >
            Als gemacht markieren
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            :disabled="!unplannedDoneDate"
            @click="submitUnplannedPlan"
          >
            Für Datum einplanen
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="calendar-alt-link"
            @click="openCalendarConfirmDone"
          >
            <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
            Im Kalender auswählen
          </Button>
        </div>
      </div>
    </PickerMenu>

    <!-- Popover zum Abhaken des Termins bei geplanten Touren -->
    <PickerMenu
      v-if="datesPopoverOpen"
      class="tour-dates-popover"
      :style="datesPopoverStyle"
      @close="datesPopoverOpen = false"
    >
      <div class="dates-popover-content">
        <div class="popover-title-row">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          <span class="popover-heading">Besuche abhaken</span>
        </div>
        <p class="popover-subtext">Markiere diesen Termin als gemacht:</p>
        <div v-if="excursion.date" class="dates-checklist">
          <div class="date-check-row" :class="excursion.role ? 'is-travel' : 'is-tour'">
            <button
              type="button"
              class="date-check-item btn"
              :class="{ checked: !!excursion.done }"
              @click="togglePlannedDone"
            >
              <AppIcon
                :icon="excursion.done ? ACTION_ICONS.done : ACTION_ICONS.notDone"
                :size="15"
                group="actions"
              />
              <span class="date-check-info">
                <span class="date-check-date">{{ formatDateShared(excursion.date) }}</span>
              </span>
              <span class="date-check-status">{{ excursion.done ? 'Gemacht' : 'Geplant' }}</span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon-only
              class="date-calendar-jump-btn"
              title="Diesen Tag im Kalender öffnen"
              :aria-label="`${formatDateShared(excursion.date)} im Kalender öffnen`"
              @click.stop="openCalendarAtDate(excursion.date)"
            >
              <AppIcon :icon="FORM_FIELD_ICONS.date" :size="16" group="formFields" />
            </Button>
          </div>
        </div>
        <div class="popover-buttons">
          <Button type="button" variant="secondary" size="sm" @click="datesPopoverOpen = false">
            Fertig
          </Button>
        </div>
      </div>
    </PickerMenu>
  </Teleport>
</template>

<style scoped lang="scss">
:deep(.done-toggle) {
  --toggle-hover-border: var(--excursion-theme-color, var(--color-tour));
}

.tour-status-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  line-height: 1.35;
  color: var(--color-text-muted);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tour-status-meta.status-done {
  color: var(--color-success);
  font-weight: 600;
}

.tour-status-done-icon {
  flex-shrink: 0;
}

.tour-status-meta :deep(.done-toggle-date) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  white-space: nowrap;
}

.tour-status-meta :deep(.done-toggle-calendar-icon) {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.85;
}

.tour-status-meta :deep(.done-toggle-weather) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

.tour-unplanned-popover {
  width: min(300px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}

.tour-dates-popover {
  width: min(340px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}

.unplanned-popover-content,
.dates-popover-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-1);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
}

.popover-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.popover-subtext {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.3;
}

.popover-date-input {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.popover-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.calendar-alt-link {
  font-size: var(--font-size-xs);
}

.dates-checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: 2px;
}

.date-check-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.date-check-item {
  @include control-3d-raised;
  background-image: none;
  box-shadow: none;
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: var(--border-width) solid var(--color-border);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  user-select: none;
  width: auto;
  box-sizing: border-box;
}

.date-check-item:hover:not(:disabled),
.date-check-item:focus-visible {
  background-image: var(--gradient-control-3d);
  box-shadow: var(--shadow-control-hover);
}

.date-check-item:hover {
  background-color: var(--color-control-hover-bg);
  border-color: var(--color-primary-dark);
}

.date-check-item:active {
  background-color: var(--color-control-active-bg);
}

.date-check-item.checked {
  background-color: var(--color-control-active-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  box-shadow: none;
}

.date-check-item.checked:hover {
  background-color: var(--color-control-active-tint-hover);
  border-color: var(--color-primary-dark);
  box-shadow: var(--shadow-control-hover);
}

.date-check-item.checked:active {
  background-color: var(--color-control-active-tint);
  box-shadow: var(--shadow-control-active);
}

.date-check-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
  text-align: left;
}

.date-check-date {
  font-weight: 500;
  white-space: nowrap;
}

.date-check-status {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  padding-left: var(--space-1);
}

.date-calendar-jump-btn {
  flex: 0 0 34px !important;
  width: 34px !important;
  height: 34px !important;
  min-width: 34px !important;
  max-width: 34px !important;
  min-height: 34px !important;
  max-height: 34px !important;
  padding: 0 !important;
  border-radius: var(--radius-pill);
  color: var(--color-text-muted);
}

.is-tour .date-check-item:not(.checked) {
  border-color: var(--color-tour-border);
}

.is-tour .date-check-item:not(.checked):hover {
  border-color: var(--color-tour);
}

.is-tour .date-calendar-jump-btn {
  color: var(--color-tour);
}

.is-tour .date-calendar-jump-btn:hover {
  color: var(--color-tour-dark);
}

.is-travel .date-check-item:not(.checked) {
  border-color: var(--color-travel-border);
}

.is-travel .date-check-item:not(.checked):hover {
  border-color: var(--color-travel);
}

.is-travel .date-calendar-jump-btn {
  color: var(--color-travel);
}

.is-travel .date-calendar-jump-btn:hover {
  color: var(--color-travel-dark);
}

@container spots-col (max-width: 360px) {
  :deep(.done-toggle) {
    font-size: var(--font-size-xs);
    padding: 2px var(--space-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .date-check-item {
    transition: none !important;
    transform: none !important;
    translate: none !important;
  }
}
</style>

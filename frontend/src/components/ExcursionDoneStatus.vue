<script setup lang="ts">
import type { Excursion } from '../api/types';
import type { ExcursionStation } from '../utils/excursionStations';
import { useExcursionWeather } from '../composables/useExcursionWeather';
import { useExcursionDoneStatus } from '../composables/useExcursionDoneStatus';
import DoneToggle from './primitives/DoneToggle.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

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

const { weatherSummary, statusDateLabel } = useExcursionWeather({
  excursion: () => props.excursion,
  resolvedStations: () => props.resolvedStations,
});

const {
  unplannedPopoverOpen,
  unplannedPopoverStyle,
  unplannedDoneDate,
  onToggleDone,
  submitUnplannedDone,
  openCalendarConfirmDone,
} = useExcursionDoneStatus({
  excursion: () => props.excursion,
});
</script>

<template>
  <DoneToggle
    :done="!!excursion.done"
    :planned="!!excursion.date"
    :aria-label="excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
    :title="excursion.done ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
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
    <template v-else>
      <template v-if="expanded">Als gemacht markieren</template>
      <template v-else>Gemacht</template>
    </template>
  </DoneToggle>

  <Teleport to="body">
    <PickerMenu
      v-if="unplannedPopoverOpen"
      class="tour-unplanned-popover"
      :style="unplannedPopoverStyle"
      @close="unplannedPopoverOpen = false"
    >
      <div class="unplanned-popover-content">
        <div class="popover-title-row">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          <span class="popover-heading">Tour als gemacht markieren</span>
        </div>
        <p class="popover-subtext">An welchem Tag wurde diese Tour gemacht?</p>
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
  </Teleport>
</template>

<style scoped>
:deep(.done-toggle) {
  --toggle-hover-border: var(--excursion-theme-color, var(--color-tour));
}

.unplanned-popover-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2);
  min-width: 250px;
}

.popover-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.86rem;
  font-weight: 600;
  color: var(--color-text);
}

.popover-subtext {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.3;
}

.popover-date-input {
  width: 100%;
}

.popover-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.calendar-alt-link {
  font-size: 0.78rem !important;
  color: var(--color-text-muted) !important;
  justify-content: center;
}

.calendar-alt-link:hover {
  color: var(--color-primary) !important;
}

@container spots-col (max-width: 360px) {
  :deep(.done-toggle) {
    font-size: 0.72rem;
    padding: 2px 8px;
  }
}
</style>

<script setup lang="ts">
import type { Spot } from '../api/types';
import { useSpotWeather } from '../composables/useSpotWeather';
import { useSpotDoneStatus } from '../composables/useSpotDoneStatus';
import DoneToggle from './primitives/DoneToggle.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';

const props = defineProps<{
  spot: Spot;
  scheduledDate: string | null;
  expanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'card-click', event: MouseEvent): void;
}>();

const { scheduledDaysCount, dayWeather, plannedDateLabel } = useSpotWeather({
  spot: () => props.spot,
  scheduledDate: () => props.scheduledDate,
  expanded: () => props.expanded,
});

const {
  scheduledItemsForSpot,
  totalItemsCount,
  doneItemsCount,
  allItemsDone,
  isSpotDone,
  isSpotPartiallyDone,
  datesPopoverOpen,
  datesPopoverStyle,
  unplannedPopoverOpen,
  unplannedPopoverStyle,
  unplannedDoneDate,
  onToggleDone,
  toggleScheduledItemDone,
  submitUnplannedDone,
  openCalendarConfirmDone,
} = useSpotDoneStatus({
  spot: () => props.spot,
  scheduledDate: () => props.scheduledDate,
});

function handleDoneClick(event: MouseEvent) {
  if (props.expanded) {
    onToggleDone(event);
  } else {
    emit('card-click', event);
  }
}
</script>

<template>
  <DoneToggle
    key="btn-done"
    :done="isSpotDone"
    :partially-done="isSpotPartiallyDone"
    :planned="!!(scheduledDate || totalItemsCount > 0)"
    :aria-label="isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
    :title="isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
    @click="handleDoneClick"
  >
    <template v-if="totalItemsCount > 1">
      <template v-if="allItemsDone">
        <template v-if="expanded">Besucht an {{ totalItemsCount }} Tagen</template>
        <template v-else>{{ totalItemsCount }}x besucht</template>
      </template>
      <template v-else-if="doneItemsCount > 0">
        <template v-if="expanded">
          Besucht an {{ doneItemsCount }} von {{ totalItemsCount }} Tagen
        </template>
        <template v-else> {{ doneItemsCount }}/{{ totalItemsCount }} x besucht </template>
      </template>
      <template v-else>
        <template v-if="expanded">Geplant an {{ totalItemsCount }} Tagen</template>
        <template v-else>{{ totalItemsCount }}x geplant</template>
      </template>
    </template>
    <template v-else-if="isSpotDone">
      <template v-if="scheduledDate">
        <span class="done-toggle-prefix">Besucht am </span>
        <span class="done-toggle-date">
          <AppIcon
            :icon="FORM_FIELD_ICONS.date"
            :size="12"
            group="formFields"
            class="done-toggle-calendar-icon"
          />
          {{ plannedDateLabel }}
        </span>
      </template>
      <template v-else>Besucht</template>
      <span v-if="dayWeather && scheduledDaysCount <= 1" class="done-toggle-weather">
        · <WeatherIcon :code="dayWeather.weatherCode" :size="14" />
        {{ Math.round(dayWeather.tempMax) }}°
      </span>
    </template>
    <template v-else-if="scheduledDate || totalItemsCount === 1">
      <span class="done-toggle-prefix">Geplant für </span>
      <span class="done-toggle-date">
        <AppIcon
          :icon="FORM_FIELD_ICONS.date"
          :size="12"
          group="formFields"
          class="done-toggle-calendar-icon"
        />
        {{ plannedDateLabel }}
      </span>
      <span v-if="dayWeather && scheduledDaysCount <= 1" class="done-toggle-weather">
        · <WeatherIcon :code="dayWeather.weatherCode" :size="14" />
        {{ Math.round(dayWeather.tempMax) }}°
      </span>
    </template>
    <template v-else> Besucht </template>
  </DoneToggle>

  <Teleport to="body">
    <!-- Popover zur Datumsauswahl für ungeplante Spots -->
    <PickerMenu
      v-if="unplannedPopoverOpen"
      class="spot-unplanned-popover"
      :style="unplannedPopoverStyle"
      @close="unplannedPopoverOpen = false"
    >
      <div class="unplanned-popover-content">
        <div class="popover-title-row">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          <span class="popover-heading">Spot als besucht markieren</span>
        </div>
        <p class="popover-subtext">An welchem Tag wurde dieser Spot besucht?</p>
        <Input
          v-model="unplannedDoneDate"
          type="date"
          class="popover-date-input"
          aria-label="Datum des Besuchs"
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
            Als besucht markieren
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

    <!-- Popover zum Abhaken einzelner Termine bei Multi-Datum-Spots -->
    <PickerMenu
      v-if="datesPopoverOpen"
      class="spot-dates-popover"
      :style="datesPopoverStyle"
      @close="datesPopoverOpen = false"
    >
      <div class="dates-popover-content">
        <div class="popover-title-row">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          <span class="popover-heading">Besuche abhaken</span>
        </div>
        <p class="popover-subtext">Wähle die Tage aus, an denen dieser Spot besucht wurde:</p>
        <div class="dates-checklist">
          <button
            v-for="item in scheduledItemsForSpot"
            :key="item.id"
            type="button"
            class="date-check-item"
            :class="{ checked: !!item.done }"
            @click="toggleScheduledItemDone(item)"
          >
            <AppIcon
              :icon="item.done ? ACTION_ICONS.done : ACTION_ICONS.notDone"
              :size="15"
              group="actions"
            />
            <span class="date-check-date">{{ formatDateShared(item.date) }}</span>
            <span class="date-check-status">{{ item.done ? 'Besucht' : 'Geplant' }}</span>
          </button>
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

<style scoped>
.unplanned-popover-content,
.dates-popover-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-1);
}

.popover-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.popover-subtext {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
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
  font-size: var(--font-size-xs);
}

.dates-checklist {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 180px;
  overflow-y: auto;
}

.date-check-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  text-align: left;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.date-check-item:hover {
  background: var(--color-hover);
}

.date-check-item.checked {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.date-check-date {
  font-weight: 500;
}

.date-check-status {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
</style>

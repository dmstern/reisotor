<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Spot } from '../api/types';
import { useSpotWeather } from '../composables/useSpotWeather';
import { useSpotDoneStatus, type ScheduledSpotItem } from '../composables/useSpotDoneStatus';
import { useDrawersStore } from '../stores/drawers';
import DoneToggle from './primitives/DoneToggle.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { getTourRoleIconDef } from '../utils/travelRole';
import { formatDate as formatDateShared } from '../utils/dateFormat';

const props = defineProps<{
  spot: Spot;
  scheduledDate: string | null;
  expanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'card-click', event: MouseEvent): void;
}>();

const drawers = useDrawersStore();
const router = useRouter();

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

const targetCalendarDate = computed<string | null>(() => {
  if (totalItemsCount.value === 1 && scheduledItemsForSpot.value[0]?.date) {
    return scheduledItemsForSpot.value[0].date;
  }

  if (totalItemsCount.value <= 1 && props.scheduledDate) {
    return props.scheduledDate;
  }

  return null;
});

const { scheduledDaysCount, dayWeather, plannedDateLabel } = useSpotWeather({
  spot: () => props.spot,
  scheduledDate: () => targetCalendarDate.value,
  expanded: () => props.expanded,
});

const isSplit = computed(() => props.expanded && totalItemsCount.value === 1);
const hasDropdown = computed(() => props.expanded && totalItemsCount.value > 1);

const checkAriaLabel = computed(() =>
  isSpotDone.value ? 'Nicht mehr als gemacht markieren' : 'Als gemacht markieren'
);
const actionAriaLabel = computed(() =>
  plannedDateLabel.value ? `${plannedDateLabel.value} im Kalender öffnen` : undefined
);
const actionTitle = computed(() =>
  plannedDateLabel.value ? `Zum ${plannedDateLabel.value} im Kalender springen` : undefined
);
const dropdownTitle = computed(() =>
  hasDropdown.value ? 'Besuche für einzelne Tage verwalten' : undefined
);

function handleDoneClick(event: MouseEvent) {
  if (props.expanded) {
    onToggleDone(event);
  } else {
    emit('card-click', event);
  }
}

function handleSingleItemToggle() {
  const singleItem = scheduledItemsForSpot.value[0];

  if (singleItem) {
    void toggleScheduledItemDone(singleItem);
  }
}

function handleCalendarJump(event: MouseEvent) {
  event.stopPropagation();

  if (targetCalendarDate.value) {
    openCalendarAtDate(targetCalendarDate.value);
  }
}

function openCalendarAtDate(date: string) {
  datesPopoverOpen.value = false;
  drawers.openCalendar(date);
}

/** Herkunft eines Termins: Kalender, Ausflug (Tour-Farbe) oder Reise-Etappe (Reise-Farbe). */
function dateSourceClass(item: ScheduledSpotItem): string {
  if (item.type !== 'tour') {
    return 'is-calendar';
  }

  return item.role ? 'is-travel' : 'is-tour';
}

function handleItemJump(item: ScheduledSpotItem) {
  if (item.type === 'tour') {
    datesPopoverOpen.value = false;
    router.push(`/excursions#excursion-${item.sourceId}`);
    return;
  }

  openCalendarAtDate(item.date);
}
</script>

<template>
  <DoneToggle
    key="btn-done"
    :done="isSpotDone"
    :partially-done="isSpotPartiallyDone"
    :planned="!!(scheduledDate || totalItemsCount > 0)"
    :split="isSplit"
    :jumpable="isSplit"
    :dropdown="hasDropdown"
    :dropdown-open="datesPopoverOpen"
    :check-aria-label="checkAriaLabel"
    :check-title="checkAriaLabel"
    :action-aria-label="actionAriaLabel"
    :action-title="actionTitle"
    :aria-label="isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
    :title="
      dropdownTitle || (isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren')
    "
    @click="handleDoneClick"
    @click-check="handleSingleItemToggle"
    @click-action="handleCalendarJump"
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
      <template v-if="plannedDateLabel">
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
      <span
        v-if="dayWeather && dayWeather.tempMax != null && scheduledDaysCount <= 1"
        class="done-toggle-weather"
      >
        · <WeatherIcon :code="dayWeather.weatherCode" :size="14" />
        {{ Math.round(dayWeather.tempMax) }}°
      </span>
    </template>
    <template v-else-if="plannedDateLabel">
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
      <span
        v-if="dayWeather && dayWeather.tempMax != null && scheduledDaysCount <= 1"
        class="done-toggle-weather"
      >
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
        <p class="popover-subtext">
          {{
            totalItemsCount === 1
              ? 'Markiere diesen Termin als besucht:'
              : 'Wähle die Tage aus, an denen dieser Spot besucht wurde:'
          }}
        </p>
        <div class="dates-checklist">
          <div
            v-for="item in scheduledItemsForSpot"
            :key="item.id"
            class="date-check-row"
            :class="dateSourceClass(item)"
          >
            <button
              type="button"
              class="date-check-item btn"
              :class="{ checked: !!item.done }"
              @click="toggleScheduledItemDone(item)"
            >
              <AppIcon
                :icon="item.done ? ACTION_ICONS.done : ACTION_ICONS.notDone"
                :size="15"
                group="actions"
              />
              <span class="date-check-info">
                <span class="date-check-date">{{ formatDateShared(item.date) }}</span>
                <span
                  v-if="item.type === 'tour' && item.title"
                  class="date-check-title"
                  :title="item.title"
                >
                  {{ item.title }}
                </span>
              </span>
              <span class="date-check-status">{{ item.done ? 'Besucht' : 'Geplant' }}</span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon-only
              class="date-calendar-jump-btn"
              :title="item.type === 'tour' ? 'Zur Tour springen' : 'Diesen Tag im Kalender öffnen'"
              :aria-label="
                item.type === 'tour'
                  ? `Tour ${item.title ?? ''} öffnen`
                  : `${formatDateShared(item.date)} im Kalender öffnen`
              "
              @click.stop="handleItemJump(item)"
            >
              <AppIcon
                v-if="item.type === 'tour'"
                :icon="getTourRoleIconDef(item.role)"
                :size="16"
                group="categories"
              />
              <AppIcon v-else :icon="FORM_FIELD_ICONS.date" :size="16" group="formFields" />
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
.spot-unplanned-popover {
  width: min(300px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
}

.spot-dates-popover {
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
  max-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px;
  overscroll-behavior: contain;
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
  /* Initial flach (wie Dropdowns/Inputs) - der 3D-Look entsteht erst bei Hover/Fokus */
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
  background-color: var(--color-hover);
  border-color: var(--color-primary-dark);
}

.date-check-item:active {
  background-color: var(--color-hover);
}

.date-check-item.checked {
  background-color: color-mix(in srgb, var(--color-primary-tint) 65%, var(--color-surface));
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
  box-shadow: none;
}

.date-check-item.checked:hover {
  background-color: color-mix(in srgb, var(--color-primary-tint) 80%, var(--color-surface));
  border-color: var(--color-primary-dark);
  box-shadow: var(--shadow-control-hover);
}

.date-check-item.checked:active {
  background-color: color-mix(in srgb, var(--color-primary-tint) 55%, var(--color-surface));
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

.date-check-title {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.date-check-item.checked .date-check-title {
  color: inherit;
  opacity: 0.8;
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
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
}

.date-calendar-jump-btn:hover {
  color: var(--color-primary);
}

/* Quelle des Termins: Kalender (blau) vs. Tour (orange) */
.is-calendar .date-check-item:not(.checked) {
  border-color: color-mix(in srgb, var(--color-scheduled) 40%, transparent);
}

.is-calendar .date-check-item:not(.checked):hover {
  border-color: var(--color-scheduled);
}

.is-calendar .date-calendar-jump-btn {
  color: var(--color-scheduled);
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

@media (prefers-reduced-motion: reduce) {
  .date-check-item {
    transition: none !important;
    transform: none !important;
    translate: none !important;
  }
}
</style>

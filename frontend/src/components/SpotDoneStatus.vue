<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Spot } from '../api/types';
import { useSpotWeather } from '../composables/useSpotWeather';
import { useSpotDoneStatus, type ScheduledSpotItem } from '../composables/useSpotDoneStatus';
import { useDrawersStore } from '../stores/drawers';
import { useTripStore } from '../stores/trip';
import DoneToggle from './primitives/DoneToggle.vue';
import DoneUnplannedPopover from './DoneUnplannedPopover.vue';
import DoneDatesPopover, { type DoneDateChecklistItem } from './DoneDatesPopover.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
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
const tripStore = useTripStore();
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
  submitUnplannedPlan,
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

const hasDropdown = computed(
  () => props.expanded && (totalItemsCount.value >= 1 || !isSpotDone.value)
);

const dropdownTitle = computed(() => {
  if (!hasDropdown.value) {
    return undefined;
  }

  return totalItemsCount.value >= 1
    ? 'Besuche für einzelne Tage verwalten'
    : 'Spot einplanen oder als besucht markieren';
});

function handleDoneClick(event: MouseEvent) {
  if (props.expanded) {
    onToggleDone(event);
  } else {
    emit('card-click', event);
  }
}

function openCalendarAtDate(date: string) {
  datesPopoverOpen.value = false;
  drawers.openCalendar(date);
}

/** Herkunft eines Termins: Spot-Besuchstag (Kalender), Ausflug (Tour-Farbe) oder Reise-Etappe. */
function dateSourceClass(item: ScheduledSpotItem): string {
  if (item.type !== 'tour') {
    return 'is-calendar';
  }

  return item.role ? 'is-travel' : 'is-tour';
}

function jumpTitleFor(item: ScheduledSpotItem): string {
  if (item.type === 'tour') {
    return 'Zur Tour springen';
  }

  return 'Diesen Tag im Kalender öffnen';
}

function jumpAriaLabelFor(item: ScheduledSpotItem): string {
  if (item.type === 'tour') {
    return `Tour ${item.title ?? ''} öffnen`;
  }

  return `${formatDateShared(item.date)} im Kalender öffnen`;
}

const spotDateItems = computed<DoneDateChecklistItem[]>(() =>
  scheduledItemsForSpot.value.map((item) => ({
    id: item.id,
    date: item.date,
    done: !!item.done,
    sourceClass: dateSourceClass(item),
    title: item.type === 'tour' ? item.title : undefined,
    statusLabel: item.done ? 'Besucht' : 'Geplant',
    jumpTitle: jumpTitleFor(item),
    jumpAriaLabel: jumpAriaLabelFor(item),
  }))
);

function findScheduledItem(itemId: string | number): ScheduledSpotItem | undefined {
  return scheduledItemsForSpot.value.find((scheduled) => scheduled.id === itemId);
}

function handleToggleChecklistItem(checklistItem: DoneDateChecklistItem) {
  const scheduled = findScheduledItem(checklistItem.id);

  if (scheduled) {
    void toggleScheduledItemDone(scheduled);
  }
}

function handleItemJump(checklistItem: DoneDateChecklistItem) {
  const item = findScheduledItem(checklistItem.id);

  if (!item) {
    return;
  }

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
    :dropdown="hasDropdown"
    :dropdown-open="datesPopoverOpen || unplannedPopoverOpen"
    :aria-label="isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
    :title="
      dropdownTitle || (isSpotDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren')
    "
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

  <DoneUnplannedPopover
    v-model:date="unplannedDoneDate"
    :open="unplannedPopoverOpen"
    :popover-style="unplannedPopoverStyle"
    popover-class="spot-unplanned-popover"
    heading="Spot einplanen oder abhaken"
    subtext="Wähle ein Datum für diesen Spot:"
    date-aria-label="Datum für diesen Spot"
    done-button-label="Als besucht markieren"
    @close="unplannedPopoverOpen = false"
    @submit-done="submitUnplannedDone"
    @submit-plan="submitUnplannedPlan"
    @open-calendar="openCalendarConfirmDone"
  />

  <DoneDatesPopover
    :open="datesPopoverOpen"
    :popover-style="datesPopoverStyle"
    popover-class="spot-dates-popover"
    heading="Besuche abhaken"
    :subtext="
      totalItemsCount === 1
        ? 'Markiere diesen Termin als besucht:'
        : 'Wähle die Tage aus, an denen dieser Spot besucht wurde:'
    "
    :items="spotDateItems"
    @close="datesPopoverOpen = false"
    @toggle-item="handleToggleChecklistItem"
    @jump-item="handleItemJump"
  >
    <template #jump-icon="{ item }">
      <AppIcon
        v-if="findScheduledItem(item.id)?.type === 'tour'"
        :icon="getTourRoleIconDef(findScheduledItem(item.id)?.role)"
        :size="16"
        group="categories"
      />
      <AppIcon v-else :icon="FORM_FIELD_ICONS.date" :size="16" group="formFields" />
    </template>
  </DoneDatesPopover>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Excursion } from '../api/types';
import { useExcursionDoneStatus } from '../composables/useExcursionDoneStatus';
import { useDrawersStore } from '../stores/drawers';
import DoneToggle from './primitives/DoneToggle.vue';
import DoneUnplannedPopover from './DoneUnplannedPopover.vue';
import DoneDatesPopover, { type DoneDateChecklistItem } from './DoneDatesPopover.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';

const props = defineProps<{
  excursion: Excursion;
  expanded: boolean;
}>();

const drawers = useDrawersStore();

const statusDateLabel = computed(() =>
  props.excursion.date ? formatDateShared(props.excursion.date, { includeYear: false }) : ''
);

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

const tourDateItems = computed<DoneDateChecklistItem[]>(() => {
  if (!props.excursion.date) {
    return [];
  }

  return [
    {
      id: props.excursion.id,
      date: props.excursion.date,
      done: !!props.excursion.done,
      sourceClass: props.excursion.role ? 'is-travel' : 'is-tour',
      statusLabel: props.excursion.done ? 'Gemacht' : 'Geplant',
      jumpTitle: 'Diesen Tag im Kalender öffnen',
      jumpAriaLabel: `${formatDateShared(props.excursion.date)} im Kalender öffnen`,
    },
  ];
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
    </template>
  </div>

  <DoneUnplannedPopover
    v-model:date="unplannedDoneDate"
    :open="unplannedPopoverOpen"
    :popover-style="unplannedPopoverStyle"
    popover-class="tour-unplanned-popover"
    heading="Tour einplanen oder abhaken"
    subtext="Wähle ein Datum für diese Tour:"
    date-aria-label="Datum für diese Tour"
    done-button-label="Als gemacht markieren"
    @close="unplannedPopoverOpen = false"
    @submit-done="submitUnplannedDone"
    @submit-plan="submitUnplannedPlan"
    @open-calendar="openCalendarConfirmDone"
  />

  <DoneDatesPopover
    :open="datesPopoverOpen"
    :popover-style="datesPopoverStyle"
    popover-class="tour-dates-popover"
    heading="Tour abhaken"
    subtext="Markiere diesen Termin als gemacht:"
    :items="tourDateItems"
    @close="datesPopoverOpen = false"
    @toggle-item="togglePlannedDone"
    @jump-item="(item) => openCalendarAtDate(item.date)"
  />
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
  line-height: var(--line-height-snug);
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

@container spots-col (max-width: 360px) {
  :deep(.done-toggle) {
    font-size: var(--font-size-xs);
    padding: 2px var(--space-2);
  }
}
</style>

<script setup lang="ts">
import type { PageGranularity } from '../composables/useCalendarNavigation';
import SegmentedToggle from './SegmentedToggle.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

interface PendingSchedule {
  kind: 'spot' | 'excursion';
  id: number;
  mode: 'plan' | 'confirm-done';
}

defineProps<{
  pendingSchedule?: PendingSchedule | null;
  pendingScheduleLabel?: string | null;
  canGoPrev: boolean;
  canGoNext: boolean;
  prevPageLabel: string;
  nextPageLabel: string;
  visibleRangeLabel: string;
  isTodayActive: boolean;
  isTripActive: boolean;
  hasTripStartDate: boolean;
}>();

const granularity = defineModel<PageGranularity>('granularity', { required: true });

defineEmits<{
  (e: 'cancelPendingSchedule'): void;
  (e: 'prevPage'): void;
  (e: 'nextPage'): void;
  (e: 'jumpToToday'): void;
  (e: 'goToTripDates'): void;
  (e: 'openAdd'): void;
}>();
</script>

<template>
  <div class="schedule-toolbar-container">
    <div class="pending-schedule-banner" v-if="pendingSchedule">
      <span v-if="pendingSchedule.mode === 'confirm-done'">
        <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Wähle den Tag, an
        dem „{{ pendingScheduleLabel }}“
        {{ pendingSchedule.kind === 'excursion' ? 'gemacht' : 'besucht' }} wurde
      </span>
      <span v-else>
        <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Tippe einen Tag an,
        um „{{ pendingScheduleLabel }}“ einzuplanen
      </span>
      <Button variant="secondary" size="sm" @click="$emit('cancelPendingSchedule')">
        Abbrechen
      </Button>
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
            @click="$emit('prevPage')"
          />
          <span class="range-label">{{ visibleRangeLabel }}</span>
          <IconButton
            variant="ghost"
            size="sm"
            :disabled="!canGoNext"
            :icon="ACTION_ICONS.scrollRight"
            :aria-label="nextPageLabel"
            :title="nextPageLabel"
            @click="$emit('nextPage')"
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
            @click="$emit('jumpToToday')"
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
            v-if="hasTripStartDate"
            :active="isTripActive"
            title="Zum Reisezeitraum springen"
            @click="$emit('goToTripDates')"
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
        <Button size="sm" @click="$emit('openAdd')">
          <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Neu
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-toolbar-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-primary-dark);
}

.pending-schedule-banner .btn {
  flex-shrink: 0;
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
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text);
  min-width: 11ch;
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

@container schedule-view (max-width: 330px) {
  .toolbar-nav-row {
    justify-content: center;
  }

  .granularity-wrap {
    width: 100%;
    justify-content: center;
  }

  .toolbar-actions-row {
    justify-content: center;
  }
}
</style>

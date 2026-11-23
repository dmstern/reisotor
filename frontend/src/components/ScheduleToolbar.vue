<script setup lang="ts">
import type { PageGranularity } from '../composables/useCalendarNavigation';
import SegmentedToggle from './SegmentedToggle.vue';
import Button from './primitives/Button.vue';
import PagerButton from './primitives/PagerButton.vue';
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
      <div class="toolbar-timeframe-row">
        <span class="range-label">{{ visibleRangeLabel }}</span>
        <div class="timeframe-actions" role="group" aria-label="Zeitraum-Navigation">
          <div class="pager">
            <PagerButton
              direction="prev"
              variant="secondary"
              :disabled="!canGoPrev"
              :aria-label="prevPageLabel"
              :title="prevPageLabel"
              @click="$emit('prevPage')"
            />
            <PagerButton
              direction="next"
              variant="secondary"
              :disabled="!canGoNext"
              :aria-label="nextPageLabel"
              :title="nextPageLabel"
              @click="$emit('nextPage')"
            />
          </div>
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
        </div>
      </div>

      <div class="toolbar-view-row">
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
    </div>
  </div>
</template>

<style lang="scss" scoped>
.schedule-toolbar-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  min-width: 0;
}

.pending-schedule-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-scheduled-tint);
  border: 1px solid color-mix(in srgb, var(--color-scheduled) 50%, transparent);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-scheduled-dark, var(--color-scheduled));
}

.pending-schedule-banner > span {
  flex: 1 1 180px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.pending-schedule-banner .btn {
  flex-shrink: 0;
}

.calendar-toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}

.toolbar-timeframe-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  min-width: 0;
}

.range-label {
  font-size: var(--font-size-md);
  font-weight: 700;
  color: var(--color-text);
  min-width: 0;
}

.timeframe-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-inline-start: auto;
  flex-shrink: 0;
  min-width: 0;
}

.pager {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  flex-shrink: 0;
}

.jump-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  flex-wrap: wrap;
  min-width: 0;
}

.toolbar-view-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.granularity-wrap {
  display: flex;
  justify-content: flex-start;
  max-width: 100%;
  min-width: 0;
}

@include container-down('schedule-view', 'mobile') {
  .toolbar-timeframe-row {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-sm);
  }

  .timeframe-actions {
    margin-inline-start: 0;
    flex-shrink: 1;
    flex-wrap: wrap;
  }

  .granularity-wrap {
    width: 100%;
  }

  .granularity-wrap :deep(.segmented-toggle) {
    width: 100%;
  }
}

@include container-down('schedule-view', 'mobile-compact') {
  :deep(.segmented-option) {
    padding: var(--space-xs) var(--space-1-5);
    font-size: var(--font-size-xs);
  }
}
</style>

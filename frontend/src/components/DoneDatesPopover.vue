<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import CheckboxCard from './primitives/CheckboxCard.vue';
import IconButton from './primitives/IconButton.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import type { PopoverPositionStyle } from '../composables/useDoneStatusPopovers';

export interface DoneDateChecklistItem {
  id: string | number;
  date: string;
  done: boolean;
  sourceClass: string;
  title?: string;
  statusLabel: string;
  jumpTitle: string;
  jumpAriaLabel: string;
}

defineProps<{
  open: boolean;
  popoverStyle: PopoverPositionStyle;
  popoverClass: string;
  heading: string;
  subtext: string;
  items: DoneDateChecklistItem[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle-item', item: DoneDateChecklistItem): void;
  (e: 'jump-item', item: DoneDateChecklistItem): void;
}>();
</script>

<template>
  <Teleport to="body">
    <PickerMenu v-if="open" :class="popoverClass" :style="popoverStyle" @close="emit('close')">
      <div class="dates-popover-content">
        <div class="popover-title-row">
          <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" />
          <span class="popover-heading">{{ heading }}</span>
        </div>
        <p class="popover-subtext">{{ subtext }}</p>
        <div v-if="items.length > 0" class="dates-checklist">
          <div
            v-for="item in items"
            :key="item.id"
            class="date-check-row"
            :class="item.sourceClass"
          >
            <CheckboxCard
              variant="popover"
              :model-value="item.done"
              :label="formatDateShared(item.date)"
              class="date-check-item"
              @update:model-value="emit('toggle-item', item)"
            >
              <template v-if="item.title" #description>
                <span :title="item.title">{{ item.title }}</span>
              </template>
              <template #extra>
                <span class="date-check-status">{{ item.statusLabel }}</span>
              </template>
            </CheckboxCard>
            <IconButton
              variant="ghost"
              size="sm"
              class="date-calendar-jump-btn"
              :title="item.jumpTitle"
              :aria-label="item.jumpAriaLabel"
              @click.stop="emit('jump-item', item)"
            >
              <slot name="jump-icon" :item="item">
                <AppIcon :icon="FORM_FIELD_ICONS.date" :size="16" group="formFields" />
              </slot>
            </IconButton>
          </div>
        </div>
        <div class="popover-buttons">
          <Button type="button" variant="secondary" size="sm" @click="emit('close')">
            Fertig
          </Button>
        </div>
      </div>
    </PickerMenu>
  </Teleport>
</template>

<style scoped lang="scss">
.dates-popover-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-1);
  width: min(324px, calc(100vw - 40px));
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
  line-height: var(--line-height-snug);
}

.popover-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.dates-checklist {
  @include uniform-height-list(var(--space-1));
  max-height: 220px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px;
  overscroll-behavior: contain;
}

.date-check-row {
  display: flex;
  align-items: stretch;
  gap: var(--space-1);
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.date-check-item {
  @include min-touch-target(44px);
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  margin: 0;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
}

.date-check-item :deep(.checkbox-card__control) {
  padding-top: 0;
}

.date-check-item :deep(.checkbox-card__label) {
  white-space: nowrap;
}

.date-check-item :deep(.checkbox-card__description) {
  margin-top: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
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
  align-self: center;
  color: var(--color-text-muted);
}

@include can-hover {
  .date-calendar-jump-btn:hover {
    color: var(--color-primary);
  }
}

.is-calendar .date-check-item:not(.is-checked) {
  border-color: color-mix(in srgb, var(--color-scheduled) 40%, transparent);
}

@include can-hover {
  .is-calendar .date-check-item:not(.is-checked):hover {
    border-color: var(--color-scheduled);
  }
}

.is-calendar .date-calendar-jump-btn {
  color: var(--color-scheduled);
}

.is-diary .date-check-item:not(.is-checked) {
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
}

@include can-hover {
  .is-diary .date-check-item:not(.is-checked):hover {
    border-color: var(--color-primary);
  }
}

.is-diary .date-calendar-jump-btn {
  color: var(--color-primary);
}

@include can-hover {
  .is-diary .date-calendar-jump-btn:hover {
    color: var(--color-primary-dark);
  }
}

.is-tour .date-check-item:not(.is-checked) {
  border-color: var(--color-tour-border);
}

@include can-hover {
  .is-tour .date-check-item:not(.is-checked):hover {
    border-color: var(--color-tour);
  }
}

.is-tour .date-calendar-jump-btn {
  color: var(--color-tour);
}

@include can-hover {
  .is-tour .date-calendar-jump-btn:hover {
    color: var(--color-tour-dark);
  }
}

.is-travel .date-check-item:not(.is-checked) {
  border-color: color-mix(in srgb, var(--color-travel) 40%, transparent);
}

@include can-hover {
  .is-travel .date-check-item:not(.is-checked):hover {
    border-color: var(--color-travel);
  }
}

.is-travel .date-calendar-jump-btn {
  color: var(--color-travel);
}

@include can-hover {
  .is-travel .date-calendar-jump-btn:hover {
    color: var(--color-travel-dark);
  }
}
</style>

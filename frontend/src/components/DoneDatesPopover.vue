<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
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
            <button
              type="button"
              class="date-check-item btn"
              :class="{ checked: item.done }"
              @click="emit('toggle-item', item)"
            >
              <AppIcon
                :icon="item.done ? ACTION_ICONS.done : ACTION_ICONS.notDone"
                :size="15"
                group="actions"
              />
              <span class="date-check-info">
                <span class="date-check-date">{{ formatDateShared(item.date) }}</span>
                <span v-if="item.title" class="date-check-title" :title="item.title">
                  {{ item.title }}
                </span>
              </span>
              <span class="date-check-status">{{ item.statusLabel }}</span>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon-only
              class="date-calendar-jump-btn"
              :title="item.jumpTitle"
              :aria-label="item.jumpAriaLabel"
              @click.stop="emit('jump-item', item)"
            >
              <slot name="jump-icon" :item="item">
                <AppIcon :icon="FORM_FIELD_ICONS.date" :size="16" group="formFields" />
              </slot>
            </Button>
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
  line-height: 1.3;
}

.popover-buttons {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-1);
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
  border-radius: var(--radius-pill);
  color: var(--color-text-muted);
}

.date-calendar-jump-btn:hover {
  color: var(--color-primary);
}

.is-calendar .date-check-item:not(.checked) {
  border-color: color-mix(in srgb, var(--color-scheduled) 40%, transparent);
}

.is-calendar .date-check-item:not(.checked):hover {
  border-color: var(--color-scheduled);
}

.is-calendar .date-calendar-jump-btn {
  color: var(--color-scheduled);
}

.is-diary .date-check-item:not(.checked) {
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
}

.is-diary .date-check-item:not(.checked):hover {
  border-color: var(--color-primary);
}

.is-diary .date-calendar-jump-btn {
  color: var(--color-primary);
}

.is-diary .date-calendar-jump-btn:hover {
  color: var(--color-primary-dark);
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

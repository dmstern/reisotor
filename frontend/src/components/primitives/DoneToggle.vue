<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

// Einheitliche, wiederverwendbare Status-Pill / Checkbox-Toggle (DRY gemäß AGENTS.md):
// Kombiniert Geplant-Status und Gemacht-Checkbox für Spots und Touren/Ausflüge mit
// zentrierter Flex-Ausrichtung für Text, Trennpunkte und Wetter-Icons.
// Unterstützt optionalen Split-Modus für getrennt klickbare Checkbox und Datums-/Aktions-Zone.
const props = withDefaults(
  defineProps<{
    done?: boolean;
    partiallyDone?: boolean;
    planned?: boolean;
    ariaLabel?: string;
    title?: string;
    showIcon?: boolean;
    split?: boolean;
    checkAriaLabel?: string;
    checkTitle?: string;
    actionAriaLabel?: string;
    actionTitle?: string;
  }>(),
  {
    done: false,
    partiallyDone: false,
    planned: false,
    showIcon: true,
    split: false,
  }
);

defineEmits<{
  (e: 'click', event: MouseEvent): void;
  (e: 'click-check', event: MouseEvent): void;
  (e: 'click-action', event: MouseEvent): void;
}>();

const isDoneOrPartial = computed(() => props.done || props.partiallyDone);
const icon = computed(() => (isDoneOrPartial.value ? ACTION_ICONS.done : ACTION_ICONS.notDone));
</script>

<template>
  <div
    v-if="split"
    class="done-toggle done-toggle--split"
    :class="{
      status: planned || isDoneOrPartial,
      planned: planned && !isDoneOrPartial,
      'status-done': isDoneOrPartial,
      active: done,
    }"
    role="group"
    :aria-label="ariaLabel"
  >
    <button
      type="button"
      class="done-toggle-btn done-toggle-btn--check"
      :class="{ active: done }"
      :aria-pressed="done"
      :aria-label="checkAriaLabel || ariaLabel"
      :title="checkTitle || title"
      @click.stop="$emit('click-check', $event)"
    >
      <AppIcon v-if="showIcon" :icon="icon" :size="14" group="actions" :active="done" />
    </button>
    <span class="done-toggle-divider" aria-hidden="true" />
    <button
      type="button"
      class="done-toggle-btn done-toggle-btn--action"
      :aria-label="actionAriaLabel"
      :title="actionTitle"
      @click.stop="$emit('click-action', $event)"
    >
      <span class="status-text">
        <slot />
      </span>
    </button>
  </div>
  <button
    v-else
    type="button"
    class="done-toggle"
    :class="{
      status: planned || isDoneOrPartial,
      planned: planned && !isDoneOrPartial,
      'status-done': isDoneOrPartial,
      active: done,
    }"
    :aria-pressed="done"
    :aria-label="ariaLabel"
    :title="title"
    @click.stop="$emit('click', $event)"
  >
    <AppIcon v-if="showIcon" :icon="icon" :size="14" group="actions" :active="done" />
    <span class="status-text">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.done-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  corner-shape: round;
  padding: 3px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.done-toggle:not(.done-toggle--split):hover {
  background: var(--color-surface);
  border-color: var(--toggle-hover-border, var(--color-primary));
  color: var(--color-text);
}

.done-toggle.planned {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-surface);
}

.done-toggle:not(.done-toggle--split).planned:hover {
  border-color: var(--color-success);
  color: var(--color-success);
}

.done-toggle.active,
.done-toggle.status-done {
  color: var(--color-success);
  font-weight: 600;
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  border-color: var(--color-success);
}

.done-toggle:not(.done-toggle--split).active:hover,
.done-toggle:not(.done-toggle--split).status-done:hover {
  background: color-mix(in srgb, var(--color-success) 22%, transparent);
}

/* Split-Pill Layout & Sub-Buttons */
.done-toggle--split {
  padding: 0;
  gap: 0;
  cursor: default;
  overflow: hidden;
  align-items: stretch;
}

.done-toggle-btn {
  appearance: none;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  position: relative;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.done-toggle-btn--check {
  padding: 3px 6px 3px 9px;
  justify-content: center;
}

.done-toggle-btn--check :deep(.app-icon) {
  transition: transform 0.15s ease;
}

.done-toggle-btn--check:hover {
  background: color-mix(in srgb, var(--color-success) 16%, transparent);
  color: var(--color-success);
}

.done-toggle-btn--check:hover :deep(.app-icon) {
  transform: scale(1.15);
}

.done-toggle-divider {
  width: 1px;
  height: 14px;
  background-color: var(--color-border);
  align-self: center;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.done-toggle--split.status-done .done-toggle-divider,
.done-toggle--split.active .done-toggle-divider {
  background-color: color-mix(in srgb, var(--color-success) 35%, transparent);
}

.done-toggle-btn--action {
  padding: 3px 10px 3px 6px;
  font-size: 0.75rem;
  font-weight: 500;
  min-width: 0;
}

.done-toggle-btn--action:hover {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-text);
}

.done-toggle--split.status-done .done-toggle-btn--action:hover,
.done-toggle--split.active .done-toggle-btn--action:hover {
  background: color-mix(in srgb, var(--color-success) 22%, transparent);
  color: var(--color-success);
}

.done-toggle-btn--action:hover :deep(.done-toggle-calendar-icon) {
  transform: scale(1.15);
  opacity: 1;
}

.done-toggle-btn--action:hover :deep(.done-toggle-date) {
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, currentColor 55%, transparent);
  text-underline-offset: 2px;
}

.done-toggle-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
  z-index: 1;
}

.done-toggle-btn--check:focus-visible {
  border-start-start-radius: 999px;
  border-end-start-radius: 999px;
}

.done-toggle-btn--action:focus-visible {
  border-start-end-radius: 999px;
  border-end-end-radius: 999px;
}

.status-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

:deep(.done-toggle-date) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
  white-space: nowrap;
}

:deep(.done-toggle-calendar-icon) {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.85;
}

:deep(.done-toggle-prefix) {
  display: inline;
}

:deep(.done-toggle-weather) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Auf schmalen Breiten (z. B. wenn der Spots-Drawer schmal gezogen wird <= 380px):
   Wort "Geplant für"/"Gemacht am"/"Besucht am" per Visually-Hidden ausblenden.
   Checkbox, Kalender-Icon, Datum und Wetter bleiben stets komplett sichtbar. */
@container spots-col (max-width: 380px) {
  .done-toggle:not(.done-toggle--split) {
    padding: 3px 8px;
    gap: 4px;
  }

  .done-toggle--split .done-toggle-btn--check {
    padding: 3px 5px 3px 7px;
  }

  .done-toggle--split .done-toggle-btn--action {
    padding: 3px 7px 3px 5px;
  }

  :deep(.done-toggle-prefix) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
}

@container spot-card (max-width: 360px) {
  .done-toggle:not(.done-toggle--split) {
    padding: 3px 8px;
    gap: 4px;
  }

  .done-toggle--split .done-toggle-btn--check {
    padding: 3px 5px 3px 7px;
  }

  .done-toggle--split .done-toggle-btn--action {
    padding: 3px 7px 3px 5px;
  }

  :deep(.done-toggle-prefix) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
}

@container excursion-card (max-width: 360px) {
  .done-toggle:not(.done-toggle--split) {
    padding: 3px 8px;
    gap: 4px;
  }

  .done-toggle--split .done-toggle-btn--check {
    padding: 3px 5px 3px 7px;
  }

  .done-toggle--split .done-toggle-btn--action {
    padding: 3px 7px 3px 5px;
  }

  :deep(.done-toggle-prefix) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
}

@container (max-width: 360px) {
  .done-toggle:not(.done-toggle--split) {
    padding: 3px 8px;
    gap: 4px;
  }

  .done-toggle--split .done-toggle-btn--check {
    padding: 3px 5px 3px 7px;
  }

  .done-toggle--split .done-toggle-btn--action {
    padding: 3px 7px 3px 5px;
  }

  :deep(.done-toggle-prefix) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
}

/* Virtuelles Touch-Target (mind. 44px Höhe gemäß DESIGN.md §7.1 / WCAG 2.5.5) */
.done-toggle:not(.done-toggle--split)::after,
.done-toggle-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  inset-inline: 0;
  height: 44px;
  min-height: 44px;
}

@media (pointer: fine) {
  .done-toggle:not(.done-toggle--split)::after,
  .done-toggle-btn::after {
    display: none;
  }
}
</style>

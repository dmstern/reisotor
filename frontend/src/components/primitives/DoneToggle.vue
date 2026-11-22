<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

// Einheitliche, wiederverwendbare Status-Pill / Checkbox-Toggle (DRY gemäß AGENTS.md):
// Kombiniert Geplant-Status und Gemacht-Checkbox für Spots und Touren/Ausflüge mit
// zentrierter Flex-Ausrichtung für Text, Trennpunkte und Wetter-Icons.
const props = withDefaults(
  defineProps<{
    id?: string;
    done?: boolean;
    partiallyDone?: boolean;
    planned?: boolean;
    ariaLabel?: string;
    title?: string;
    showIcon?: boolean;
    dropdown?: boolean;
    dropdownOpen?: boolean;
    size?: 'sm' | 'field';
    disabled?: boolean;
  }>(),
  {
    id: undefined,
    done: false,
    partiallyDone: false,
    planned: false,
    showIcon: true,
    dropdown: false,
    dropdownOpen: false,
    size: 'sm',
    disabled: false,
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const COMPACT_ICON_SIZE_PX = 14;
const FIELD_ICON_SIZE_PX = 16;

const isDoneOrPartial = computed(() => props.done || props.partiallyDone);
const icon = computed(() => (isDoneOrPartial.value ? ACTION_ICONS.done : ACTION_ICONS.notDone));
const iconSize = computed(() =>
  props.size === 'field' ? FIELD_ICON_SIZE_PX : COMPACT_ICON_SIZE_PX
);

function onClick(event: MouseEvent) {
  if (props.disabled) {
    return;
  }

  emit('click', event);
}
</script>

<template>
  <button
    :id="id"
    type="button"
    class="done-toggle"
    :class="{
      status: planned || isDoneOrPartial,
      planned: planned && !isDoneOrPartial,
      'status-done': isDoneOrPartial,
      active: done,
      'has-dropdown': dropdown,
      'is-dropdown-open': dropdownOpen,
      'done-toggle--field': size === 'field',
      'is-disabled': disabled,
    }"
    :disabled="disabled"
    :aria-pressed="dropdown ? undefined : done"
    :aria-haspopup="dropdown ? 'menu' : undefined"
    :aria-expanded="dropdown ? dropdownOpen : undefined"
    :aria-label="ariaLabel"
    :title="title"
    @click.stop="onClick"
  >
    <AppIcon v-if="showIcon" :icon="icon" :size="iconSize" group="actions" :active="done" />
    <span class="status-text">
      <slot />
    </span>
    <AppIcon
      v-if="dropdown"
      :icon="ACTION_ICONS.chevronDown"
      :size="12"
      group="actions"
      class="done-toggle-chevron"
      :class="{ 'is-open': dropdownOpen }"
      aria-hidden="true"
    />
  </button>
</template>

<style lang="scss" scoped>
.done-toggle {
  @include control-physics-raised('&:active:not(:disabled), &.is-dropdown-open');
  @include touch-target($expand: true);
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--control-gap-sm);
  min-height: var(--control-height-sm, 36px);
  background-color: var(--color-surface);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: var(--space-1) var(--space-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
}

.done-toggle--field {
  min-height: 44px;
  padding: var(--space-2) 14px;
  font-size: var(--font-size-sm);
}

.done-toggle.is-disabled,
.done-toggle:disabled {
  opacity: 0.72;
  cursor: default;
  pointer-events: none;
  box-shadow: none;
}

.done-toggle:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo), var(--shadow-control);
}

@include can-hover {
  .done-toggle:hover:not(:disabled) {
    background-color: var(--color-hover);
    border-color: var(--toggle-hover-border, var(--color-primary));
    color: var(--color-text);
  }
}

.done-toggle:active:not(:disabled) {
  background-color: var(--color-control-active-bg);
}

.done-toggle.planned {
  color: var(--color-text);
  border-color: var(--color-border-strong);
  background-color: var(--color-surface);
}

@include can-hover {
  .done-toggle.planned:hover:not(:disabled) {
    border-color: var(--color-success);
    color: var(--color-success);
  }
}

.done-toggle.active,
.done-toggle.status-done {
  color: var(--color-success);
  font-weight: 600;
  background-color: color-mix(in srgb, var(--color-success) 14%, transparent);
  border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
}

@include can-hover {
  .done-toggle.active:hover:not(:disabled),
  .done-toggle.status-done:hover:not(:disabled) {
    background-color: color-mix(in srgb, var(--color-success) 22%, transparent);
    border-color: var(--color-success);
  }
}

.done-toggle-chevron {
  margin-left: var(--space-2xs);
  opacity: 0.75;
  flex-shrink: 0;
  transition:
    transform 0.2s cubic-bezier(0.2, 0.8, 0.4, 1),
    opacity 0.15s ease;
}

@include can-hover {
  .done-toggle:hover .done-toggle-chevron {
    opacity: 1;
  }
}

.done-toggle-chevron.is-open,
.done-toggle.is-dropdown-open .done-toggle-chevron {
  transform: rotate(180deg);
}

.status-text {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
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
  gap: var(--space-xs);
  flex-shrink: 0;
  white-space: nowrap;
}

/* Auf schmalen Breiten (z. B. wenn der Spots-Drawer schmal gezogen wird <= 380px):
   Wort "Geplant für"/"Gemacht am"/"Besucht am" per Visually-Hidden ausblenden.
   Checkbox, Kalender-Icon, Datum und Wetter bleiben stets komplett sichtbar. */
@container spots-col (max-width: 380px) {
  .done-toggle {
    padding: 3px 8px;
    gap: var(--space-xs);
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
  .done-toggle {
    padding: 3px 8px;
    gap: var(--space-xs);
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
  .done-toggle {
    padding: 3px 8px;
    gap: var(--space-xs);
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
  .done-toggle {
    padding: 3px 8px;
    gap: var(--space-xs);
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

@media (prefers-reduced-motion: reduce) {
  .done-toggle,
  .done-toggle-chevron {
    transition: none;
  }
}
</style>

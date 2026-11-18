<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

// Einheitliche, wiederverwendbare Status-Pill / Checkbox-Toggle (DRY gemäß AGENTS.md):
// Kombiniert Geplant-Status und Gemacht-Checkbox für Spots und Touren/Ausflüge mit
// zentrierter Flex-Ausrichtung für Text, Trennpunkte und Wetter-Icons.
const props = withDefaults(
  defineProps<{
    done?: boolean;
    partiallyDone?: boolean;
    planned?: boolean;
    ariaLabel?: string;
    title?: string;
    showIcon?: boolean;
    dropdown?: boolean;
    dropdownOpen?: boolean;
  }>(),
  {
    done: false,
    partiallyDone: false,
    planned: false,
    showIcon: true,
    dropdown: false,
    dropdownOpen: false,
  }
);

defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const isDoneOrPartial = computed(() => props.done || props.partiallyDone);
const icon = computed(() => (isDoneOrPartial.value ? ACTION_ICONS.done : ACTION_ICONS.notDone));
</script>

<template>
  <button
    type="button"
    class="done-toggle"
    :class="{
      status: planned || isDoneOrPartial,
      planned: planned && !isDoneOrPartial,
      'status-done': isDoneOrPartial,
      active: done,
      'has-dropdown': dropdown,
      'is-dropdown-open': dropdownOpen,
    }"
    :aria-pressed="dropdown ? undefined : done"
    :aria-haspopup="dropdown ? 'menu' : undefined"
    :aria-expanded="dropdown ? dropdownOpen : undefined"
    :aria-label="ariaLabel"
    :title="title"
    @click.stop="$emit('click', $event)"
  >
    <AppIcon v-if="showIcon" :icon="icon" :size="14" group="actions" :active="done" />
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

<style scoped>
.done-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  background-color: transparent;
  background-image: var(--gradient-control-3d);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  corner-shape: round;
  padding: 4px 12px;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
  box-shadow: var(--shadow-control);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    translate 0.12s cubic-bezier(0.2, 0.8, 0.4, 1),
    transform 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);
}

.done-toggle:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.done-toggle:hover {
  background-color: var(--color-control-hover-bg);
  border-color: var(--toggle-hover-border, var(--color-primary));
  color: var(--color-text);
  box-shadow: var(--shadow-control-hover);
  translate: 0 -1px;
}

.done-toggle:active {
  background-color: var(--color-control-active-bg);
  transform: scale(0.98);
  translate: 0 0;
  box-shadow: var(--shadow-control-active);
}

.done-toggle.planned {
  color: var(--color-text);
  border-color: var(--color-border);
  background-color: transparent;
  box-shadow: var(--shadow-control);
}

.done-toggle.planned:hover {
  border-color: var(--color-success);
  color: var(--color-success);
  box-shadow: var(--shadow-control-hover);
}

.done-toggle.active,
.done-toggle.status-done {
  color: var(--color-success);
  font-weight: 600;
  background-color: color-mix(in srgb, var(--color-success) 14%, transparent);
  border-color: var(--color-success);
  box-shadow: var(--shadow-control);
}

.done-toggle.active:hover,
.done-toggle.status-done:hover {
  background-color: color-mix(in srgb, var(--color-success) 22%, transparent);
  box-shadow: var(--shadow-control-hover);
}

.done-toggle-chevron {
  margin-left: 2px;
  opacity: 0.75;
  flex-shrink: 0;
  transition:
    transform 0.2s cubic-bezier(0.2, 0.8, 0.4, 1),
    opacity 0.15s ease;
}

.done-toggle:hover .done-toggle-chevron {
  opacity: 1;
}

.done-toggle-chevron.is-open,
.done-toggle.is-dropdown-open .done-toggle-chevron {
  transform: rotate(180deg);
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
  .done-toggle {
    padding: 3px 8px;
    gap: 4px;
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
    gap: 4px;
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
    gap: 4px;
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
    gap: 4px;
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
.done-toggle::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  inset-inline: 0;
  height: 44px;
  min-height: 44px;
}

@media (pointer: fine) {
  .done-toggle::after {
    display: none;
  }
}
</style>

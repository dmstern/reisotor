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
  }>(),
  {
    done: false,
    partiallyDone: false,
    planned: false,
    showIcon: true,
  }
);

defineEmits<{ (e: 'click', event: MouseEvent): void }>();

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
  box-sizing: border-box;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.done-toggle:hover {
  background: var(--color-surface);
  border-color: var(--toggle-hover-border, var(--color-primary));
  color: var(--color-text);
}

.done-toggle.planned {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-surface);
}

.done-toggle.planned:hover {
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

.done-toggle.active:hover,
.done-toggle.status-done:hover {
  background: color-mix(in srgb, var(--color-success) 22%, transparent);
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

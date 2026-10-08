<script setup lang="ts">
import type { Spot } from '../api/types';
import { useSpotCalendarDrag } from '../composables/useSpotCalendarDrag';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

const props = defineProps<{
  spot: Spot;
}>();

const { dragging, ghostStyle, onPointerDown } = useSpotCalendarDrag({
  spot: () => props.spot,
});
</script>

<template>
  <button
    key="btn-calendar"
    type="button"
    class="calendar-drag-handle"
    :class="{ dragging }"
    aria-label="Auf Kalender ziehen zum spontanen Einplanen"
    title="Auf Kalender ziehen zum spontanen Einplanen"
    @pointerdown="onPointerDown"
    @click.stop
  >
    <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> Einplanen
  </button>

  <Teleport to="body">
    <div v-if="dragging" class="drag-ghost" :style="ghostStyle ?? {}">
      <AppIcon :icon="FORM_FIELD_ICONS.date" :size="14" group="formFields" /> {{ spot.title }}
    </div>
  </Teleport>
</template>

<style scoped>
.calendar-drag-handle {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  corner-shape: round;
  padding: 3px 10px 3px 8px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: grab;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  transition:
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.2s ease;
}

.calendar-drag-handle:active,
.calendar-drag-handle.dragging {
  cursor: grabbing;
  transform: scale(0.95) translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.calendar-drag-handle.dragging {
  opacity: 0.55;
}

.calendar-drag-handle:focus-visible {
  outline: 2px solid var(--color-scheduled);
  outline-offset: 2px;
}

.calendar-drag-handle::before {
  content: '';
  flex-shrink: 0;
  width: 6px;
  height: 12px;
  background-image:
    radial-gradient(circle, currentColor 1px, transparent 1.3px),
    radial-gradient(circle, currentColor 1px, transparent 1.3px);
  background-size:
    3px 4px,
    3px 4px;
  background-position:
    0 0,
    3px 0;
  background-repeat: repeat-y, repeat-y;
  opacity: 0.65;
  transition:
    transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.18s ease;
  transform-origin: center center;
}

.calendar-drag-handle :deep(.app-icon) {
  flex-shrink: 0;
  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: center bottom;
}

.calendar-drag-handle:hover {
  background: var(--color-scheduled-tint);
  border-color: color-mix(in srgb, var(--color-scheduled) 40%, transparent);
  color: var(--color-scheduled);
  transform: translateY(-1.5px);
  box-shadow:
    0 4px 12px -2px color-mix(in srgb, var(--color-scheduled) 22%, transparent),
    0 2px 4px rgba(0, 0, 0, 0.06);
}

.calendar-drag-handle:hover::before {
  opacity: 1;
  transform: scale(1.25);
}

.calendar-drag-handle:hover :deep(.app-icon) {
  transform: translateY(-0.5px) rotate(8deg) scale(1.15);
}

.calendar-drag-handle::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  inset-inline: 0;
  height: 44px;
  min-height: 44px;
}

@media (pointer: fine) {
  .calendar-drag-handle::after {
    display: none;
  }
}

.drag-ghost {
  position: fixed;
  z-index: 60;
  transform: translate(-50%, -130%);
  pointer-events: none;
  background: rgba(35, 34, 32, 0.92);
  color: #f2efe9;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
}
</style>

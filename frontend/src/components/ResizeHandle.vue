<script setup lang="ts">
defineProps<{
  label?: string;
  orientation?: 'vertical' | 'horizontal';
  isResizing?: boolean;
}>();

defineEmits<{
  (e: 'pointerdown', event: PointerEvent): void;
}>();
</script>

<template>
  <div
    class="resize-handle resize-grip"
    :class="{ resizing: isResizing }"
    role="separator"
    :aria-orientation="orientation ?? 'vertical'"
    :aria-label="label"
    @pointerdown="$emit('pointerdown', $event)"
  ></div>
</template>

<style scoped>
.resize-handle {
  width: var(--drawer-handle-gap, 12px);
  position: relative;
}

/* Unsichtbare Erweiterung der Greifzone für leichtere Bedienung */
.resize-handle::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -6px;
  right: -6px;
  cursor: col-resize;
}

.resize-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
  border-radius: var(--radius-pill);
  transition:
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.resize-grip:hover,
.resize-grip:active,
.resize-grip.resizing {
  background-color: color-mix(in srgb, var(--color-hover) 75%, transparent);
  box-shadow: var(--shadow-inset);
}

.resize-grip::after {
  content: '';
  width: 6px;
  height: var(--input-default-height, 46px);
  box-sizing: border-box;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-strong);
  background-color: var(--color-surface);
  background-image: linear-gradient(
    90deg,
    var(--gradient-control-top) 0%,
    var(--gradient-control-bottom) 100%
  );
  box-shadow:
    inset 1px 1px 0 var(--shadow-control-highlight),
    var(--shadow-control);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    height 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.resize-grip:hover::after {
  height: 54px;
  transform: scaleX(1.12);
  background-color: var(--color-primary-tint);
  border-color: var(--color-primary);
  box-shadow:
    inset 1px 1px 0 var(--shadow-control-highlight-strong),
    var(--shadow-control-hover);
}

.resize-grip:active::after,
.resize-grip.resizing::after {
  height: 50px;
  transform: scaleX(1.05) scaleY(0.96);
  background-color: var(--color-primary);
  border-color: var(--color-primary-dark);
  box-shadow: var(--shadow-control-active);
}
</style>

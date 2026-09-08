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
}

.resize-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}

.resize-grip:hover,
.resize-grip:active,
.resize-grip.resizing {
  background: var(--color-hover);
}

.resize-grip::after {
  content: '';
  width: 4px;
  height: var(--input-default-height);
  border-radius: 3px;
  background: var(--color-border);
  transition: background 0.15s ease;
}

.resize-grip:hover::after,
.resize-grip:active::after,
.resize-grip.resizing::after {
  background: var(--color-primary);
}
</style>

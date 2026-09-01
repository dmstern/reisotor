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
</style>

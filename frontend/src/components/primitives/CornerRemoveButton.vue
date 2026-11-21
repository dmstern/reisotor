<script setup lang="ts">
import IconButton from './IconButton.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

withDefaults(
  defineProps<{
    title?: string;
    ariaLabel?: string;
    disabled?: boolean;
  }>(),
  {
    title: 'Entfernen',
    ariaLabel: 'Entfernen',
    disabled: false,
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
  <IconButton
    variant="danger"
    shape="circle"
    size="xs"
    :icon="ACTION_ICONS.close"
    :title="title"
    :aria-label="ariaLabel"
    :disabled="disabled"
    class="corner-remove-btn"
    @click.stop="emit('click', $event)"
  />
</template>

<style scoped>
.corner-remove-btn {
  position: absolute;
  top: var(--corner-remove-top, var(--corner-remove-offset, -7px));
  right: var(--corner-remove-right, var(--corner-remove-offset, -7px));
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  border: 1.5px solid var(--corner-remove-ring, var(--color-surface, #ffffff));
  z-index: 12;
}

@media (prefers-reduced-motion: reduce) {
  .corner-remove-btn {
    animation: none !important;
    transition: none !important;
  }
}
</style>

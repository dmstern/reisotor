<script setup lang="ts">
import IconButton from './IconButton.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

withDefaults(
  defineProps<{
    /** Blätter-Richtung: 'prev' (zurück/links) oder 'next' (vor/rechts). */
    direction: 'prev' | 'next';
    /** Größe: 'sm' (36px, Standard für Leisten/Toolbars/Banner) oder 'md' (46px, für Vollbild-/Lightbox-Navigation). */
    size?: 'sm' | 'md';
    /** Variante: 'ghost' (Standard), 'overlay' (Frosted Glass über Fotos) oder 'secondary' (erhobene Toolbar-Buttons). */
    variant?: 'ghost' | 'overlay' | 'secondary';
    /** Deaktiviert-Zustand. */
    disabled?: boolean;
    /** Zugänglichkeits-Beschriftung. */
    ariaLabel?: string;
    /** Tooltip/Titel. */
    title?: string;
  }>(),
  {
    size: 'sm',
    variant: 'ghost',
    disabled: false,
    ariaLabel: undefined,
    title: undefined,
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
  <IconButton
    :variant="variant"
    :size="size"
    shape="squircle"
    :icon="direction === 'prev' ? ACTION_ICONS.scrollLeft : ACTION_ICONS.scrollRight"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :title="title"
    class="pager-btn"
    @click="emit('click', $event)"
  />
</template>

<style lang="scss" scoped>
.pager-btn {
  color: var(--color-text);
}
</style>

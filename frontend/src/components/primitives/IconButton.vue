<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import Button from './Button.vue';

// IconButton-Primitive für Icon-only-Buttons.
// Delegiert direkt an Button.vue (welches Icon-Only, Varianten und Zustände nun zentral verwaltet).

defineProps<{
  /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
  icon?: IconDef;
  /** Variante: 'ghost', 'secondary', 'danger' */
  variant?: 'ghost' | 'secondary' | 'danger';
  /** Größe des Buttons: 'sm' (28px), 'md' (36px), 'lg' (44px). */
  size?: 'sm' | 'md' | 'lg';
  /** Form-Variante: 'squircle' (Standard) oder 'circle' (kreisrund). */
  shape?: 'squircle' | 'circle';
  /** Ob der Button als aktiv/ausgewählt markiert ist. */
  active?: boolean;
  /** Deaktiviert-Zustand. */
  disabled?: boolean;
  /** Native Button-Type (Standard: 'button'). */
  type?: 'button' | 'submit' | 'reset';
  /** Zugänglichkeits-Beschriftung. */
  ariaLabel?: string;
  /** Tooltip/Titel. */
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
  <Button
    :icon="icon"
    :variant="variant"
    :size="size"
    :shape="shape"
    :active="active"
    :disabled="disabled"
    :type="type"
    :aria-label="ariaLabel"
    :title="title"
    @click="emit('click', $event)"
  >
    <slot />
  </Button>
</template>

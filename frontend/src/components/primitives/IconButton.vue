<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import Button from './Button.vue';

// IconButton-Primitive für Icon-only-Buttons (Tabler-Icons oder Emoji-Inhalte).
// Delegiert an Button.vue und erzwingt das quadratische Icon-Only-Layout (Sizing, Padding, Emoji-Font-Size).

defineProps<{
  /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
  icon?: IconDef;
  /** Variante: 'ghost', 'secondary', 'danger', 'primary', 'card-action', 'dropdown', 'floating' */
  variant?: 'ghost' | 'secondary' | 'danger' | 'primary' | 'card-action' | 'dropdown' | 'floating';
  /** Größe des Buttons: 'sm' (30px), 'md' (38px), 'lg' (46px). */
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
    :icon-only="true"
    @click="emit('click', $event)"
  >
    <slot />
  </Button>
</template>

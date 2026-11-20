<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import Button from './Button.vue';

// IconButton-Primitive für Icon-only-Buttons (Tabler-Icons oder Emoji-Inhalte).
// Delegiert an Button.vue und erzwingt das quadratische Icon-Only-Layout (Sizing, Padding, Emoji-Font-Size).

withDefaults(
  defineProps<{
    /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
    icon?: IconDef;
    /** Variante: 'ghost' (Standard), 'secondary', 'tonal', 'danger', 'primary', 'overlay' (+ Übergangs-Aliase) */
    variant?:
      | 'ghost'
      | 'secondary'
      | 'tonal'
      | 'danger'
      | 'primary'
      | 'overlay'
      | 'surface'
      | 'card-action'
      | 'floating'
      | 'glass';
    /** Ob der Button als Sekundär-Variante gestylt werden soll (z. B. in Kombination mit variant="danger"). */
    secondary?: boolean;
    /** Größe des Buttons: 'xs' (30px), 'sm' (36px), 'md' (46px), 'lg' (52px). */
    size?: 'xs' | 'sm' | 'md' | 'lg';
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
  }>(),
  {
    icon: undefined,
    variant: 'ghost',
    secondary: false,
    size: 'md',
    shape: 'squircle',
    active: false,
    disabled: false,
    type: 'button',
    ariaLabel: undefined,
    title: undefined,
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
  <Button
    :icon="icon"
    :variant="variant"
    :secondary="secondary"
    :size="size"
    :shape="shape"
    :active="active"
    :disabled="disabled"
    :type="type"
    :aria-label="ariaLabel"
    :title="title"
    :icon-only="true"
    class="icon-btn"
    @click="emit('click', $event)"
  >
    <slot v-if="$slots.default" />
  </Button>
</template>

<style lang="scss" scoped>
.icon-btn {
  flex-shrink: 0;
}
</style>

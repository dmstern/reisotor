<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import Button from './Button.vue';

// IconButton-Primitive für Icon-only-Buttons (Tabler-Icons oder Emoji-Inhalte).
// Delegiert an Button.vue und erzwingt das quadratische Icon-Only-Layout (Sizing, Padding, Emoji-Font-Size).

defineProps<{
  /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
  icon?: IconDef;
  /** Variante: 'ghost', 'secondary', 'danger', 'primary', 'card-action', 'floating' */
  variant?: 'ghost' | 'secondary' | 'danger' | 'primary' | 'card-action' | 'floating';
  /** Ob der Button als Sekundär-Variante gestylt werden soll (z. B. in Kombination mit variant="danger"). */
  secondary?: boolean;
  /** Größe des Buttons: 'sm' (38px), 'md' (46px), 'lg' (52px). */
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
  position: relative;
  width: var(--input-width, 46px);
  height: var(--input-height, 46px);
  min-width: var(--input-width, 46px);
  min-height: var(--input-height, 46px);
}

.icon-btn.btn--sm {
  width: var(--input-width-sm, 38px);
  height: var(--input-height-sm, 38px);
  min-width: var(--input-width-sm, 38px);
  min-height: var(--input-height-sm, 38px);
}

.icon-btn.btn--lg {
  width: var(--input-width-lg, 52px);
  height: var(--input-height-lg, 52px);
  min-width: var(--input-width-lg, 52px);
  min-height: var(--input-height-lg, 52px);
}

.icon-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.icon-btn.btn--sm {
  @include touch-target($expand: true);
}

.btn--ghost:not(.btn--circle),
:deep(.btn--ghost:not(.btn--circle)) {
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}
</style>

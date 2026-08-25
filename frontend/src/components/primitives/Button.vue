<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';
import { useSlots } from 'vue';

// Button-Primitive für alle Buttons (Formularknöpfe, Aktionsbuttons, Card-Actions, Icon-Only-Buttons) – siehe Issue #239.
// Unterstützt sowohl Text, Text + Icon als auch reine Icon-Buttons.

const props = withDefaults(
  defineProps<{
    /**
     * Button-Variante:
     * - 'primary': Haupt-Aktionsbutton (gefüllt mit --color-primary + Schatten)
     * - 'secondary': Sekundärbutton (transparenter Hintergrund, Rand in --color-border-strong, Schatten erst beim Hovern)
     * - 'danger': Gefahrenbutton (gefüllt mit --color-danger + Schatten)
     * - 'card-action': Kompakter Karten-Aktionsbutton (Hintergrund --color-primary-tint)
     * - 'ghost': Dezent ohne Rahmen/Schatten für Toolbars/Untermenüs
     */
    variant?: 'primary' | 'secondary' | 'danger' | 'card-action' | 'ghost';
    /** Button-Größe: 'sm' (klein), 'md' (Standard), 'lg' (groß). */
    size?: 'sm' | 'md' | 'lg';
    /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
    icon?: IconDef;
    /** Form-Variante: 'squircle' (Standard) oder 'circle' (kreisrund). */
    shape?: 'squircle' | 'circle';
    /** Ob der Button als aktiv/ausgewählt markiert ist (z. B. ausgewählter Avatar). */
    active?: boolean;
    /** Native Button-Type (Standard: 'button'). */
    type?: 'button' | 'submit' | 'reset';
    /** Deaktiviert-Zustand. */
    disabled?: boolean;
    /** Zugänglichkeits-Beschriftung (für Icon-only Buttons). */
    ariaLabel?: string;
    /** Tooltip/Titel. */
    title?: string;
    /** Ob der Button explizit im quadratischen Icon-Only-Modus gerendert werden soll. */
    iconOnly?: boolean;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    shape: 'squircle',
    active: false,
    type: 'button',
    disabled: false,
    iconOnly: false,
  }
);

const slots = useSlots();
const hasDefaultSlot = () =>
  !!slots.default && slots.default().some((node) => node.type !== Comment);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :title="title"
    class="btn"
    :class="[
      `btn--${variant}`,
      variant === 'card-action' ? 'card-action-btn' : undefined,
      size !== 'md' ? `btn--${size}` : undefined,
      shape !== 'squircle' ? `btn--${shape}` : undefined,
      {
        'is-disabled': disabled,
        'is-active': active,
        'icon-only': iconOnly || (!hasDefaultSlot() && !!icon),
      },
    ]"
  >
    <AppIcon
      v-if="icon"
      :icon="icon"
      group="actions"
      :size="size === 'sm' ? 15 : size === 'lg' ? 22 : 18"
    />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  box-shadow: none;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    transform 0.1s ease,
    box-shadow 0.15s ease,
    opacity 0.15s ease;
  user-select: none;
}

.btn:active:not(:disabled) {
  transform: scale(0.96);
  box-shadow: none;
}

.btn:disabled,
.btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  pointer-events: none !important;
  box-shadow: none !important;
  transform: none !important;
}

.btn.is-active {
  background: var(--color-primary-tint);
  border: 1.5px solid var(--color-primary);
  color: var(--color-primary-dark);
}

.btn--circle {
  border-radius: var(--radius-full);
  corner-shape: round;
}

.btn--primary {
  background: var(--color-primary);
  color: white;
  border: 1px solid var(--color-button-edge);
  box-shadow: var(--shadow-sm);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

/* Secondary Button: Schatten erst beim Hovern (Feedback #4) */
.btn--secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-border-strong);
  box-shadow: none;
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.btn--danger {
  background: var(--color-danger);
  color: white;
  border: 1px solid var(--color-button-edge);
  box-shadow: var(--shadow-sm);
}

.btn--danger:hover:not(:disabled) {
  background: var(--color-danger-dark, #b91c1c);
}

.btn--danger.btn--secondary {
  background: transparent;
  color: var(--color-danger);
  border-color: var(--color-danger);
  box-shadow: none;
}

.btn--danger.btn--secondary:hover:not(:disabled) {
  background: var(--color-danger-tint);
  box-shadow: var(--shadow-sm);
}

.btn--card-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  font-size: 0.85rem;
  box-shadow: none;
}

.btn--ghost {
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text);
  box-shadow: none;
}

.btn--ghost:hover:not(:disabled) {
  background: var(--color-hover);
}

.btn--sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.btn--lg {
  padding: 14px 24px;
  font-size: 1.1rem;
}

/* Icon-only Modus */
.btn.icon-only {
  padding: 0;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  min-width: 38px;
  min-height: 38px;
  font-size: 1.3rem;
}

.btn.icon-only.btn--sm {
  width: 30px;
  height: 30px;
  min-width: 30px;
  min-height: 30px;
  font-size: 1.1rem;
}

.btn.icon-only.btn--lg {
  width: 46px;
  height: 46px;
  min-width: 46px;
  min-height: 46px;
  font-size: 1.5rem;
}
</style>

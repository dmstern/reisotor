<script setup lang="ts">
// Button-Primitive für alle Buttons (Formularknöpfe, Aktionsbuttons, Card-Actions, …) – siehe Issue #239.
// Primitive-Styles (Schatten, Varianten) leben direkt in dieser Komponente statt in style.css.

withDefaults(
  defineProps<{
    /**
     * Button-Variante:
     * - 'primary': Haupt-Aktionsbutton (Standard, gefüllt mit --color-primary + Schatten)
     * - 'secondary': Sekundärbutton (transparenter Hintergrund, Rand in --color-border-strong)
     * - 'danger': Gefahrenbutton (gefüllt mit --color-danger)
     * - 'card-action': Kompakter Karten-Aktionsbutton (Hintergrund --color-primary-tint)
     * - 'ghost': Dezent ohne Rahmen/Schatten für Toolbars/Untermenüs
     */
    variant?: 'primary' | 'secondary' | 'danger' | 'card-action' | 'ghost';
    /** Button-Größe: 'sm' (klein), 'md' (Standard), 'lg' (groß). */
    size?: 'sm' | 'md' | 'lg';
    /** Native Button-Type (Standard: 'button'). */
    type?: 'button' | 'submit' | 'reset';
    /** Deaktiviert-Zustand. */
    disabled?: boolean;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    type: 'button',
    disabled: false,
  },
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="btn"
    :class="[
      `btn--${variant}`,
      variant === 'card-action' ? 'card-action-btn' : undefined,
      size !== 'md' ? `btn--${size}` : undefined,
      { 'is-disabled': disabled },
    ]"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  /* Schatten standardmäßig auf Buttons der Primitive (primary, secondary, danger) */
  box-shadow: var(--shadow-sm);
}

.btn:disabled,
.btn.is-disabled {
  opacity: 0.5;
  cursor: not-allowed !important;
  pointer-events: none !important;
  box-shadow: none !important;
  transform: none !important;
}

.btn--primary {
  background: var(--color-primary);
  color: white;
  border: 1px solid var(--color-button-edge);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn--secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-border-strong);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-surface);
}

.btn--danger {
  background: var(--color-danger);
  color: white;
  border: 1px solid var(--color-button-edge);
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
  border-color: transparent;
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
</style>

<script setup lang="ts">
// Button-Primitive für alle Buttons (Formularknöpfe, Aktionsbuttons, Card-Actions, …) – siehe Issue #239.
// Greift auf die bestehenden Basis-Styles für <button>, .secondary, .danger und .card-action-btn aus style.css zu,
// um keine konkurrierenden Styles mit höherer Spezifität zu erzeugen.

defineProps<{
  /**
   * Button-Variante:
   * - 'primary': Haupt-Aktionsbutton (Standard, gefüllt mit --color-primary)
   * - 'secondary': Sekundärbutton (transparenter Hintergrund, Rand in --color-border-strong)
   * - 'danger': Gefahrenbutton (gefüllt mit --color-danger)
   * - 'card-action': Kompakter Karten-Aktionsbutton (Hintergrund --color-primary-tint)
   * - 'ghost': Dezent ohne Rahmen/Schatten für Untermenüs
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'card-action' | 'ghost';
  /** Button-Größe: 'sm' (klein), 'md' (Standard), 'lg' (groß). */
  size?: 'sm' | 'md' | 'lg';
  /** Native Button-Type (Standard: 'button'). */
  type?: 'button' | 'submit' | 'reset';
  /** Deaktiviert-Zustand. */
  disabled?: boolean;
}>();
</script>

<template>
  <button
    :type="type || 'button'"
    :disabled="disabled"
    :class="[
      variant && variant !== 'primary' ? (variant === 'card-action' ? 'card-action-btn' : variant) : undefined,
      size && size !== 'md' ? `btn--${size}` : undefined,
    ]"
  >
    <slot />
  </button>
</template>

<style scoped>
/* Größen- & Zusatz-Varianten scoped in der Komponente */
.btn--sm {
  padding: 6px 12px;
  font-size: 0.85rem;
}

.btn--lg {
  padding: 14px 24px;
  font-size: 1.1rem;
}

.ghost {
  background: transparent;
  border-color: transparent;
  color: var(--color-text);
  box-shadow: none;
}

.ghost:hover {
  background: var(--color-hover);
}
</style>

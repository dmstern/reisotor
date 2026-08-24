<script setup lang="ts">
// IconButton-Primitive für Icon-only- und Emoji-Buttons (Avatar-Auswahl, Verschiebe-Buttons, Quick-Toggles, …) – siehe Issue #239.
// Kapselt randlose, schattenlose Klick-Buttons ohne Hintergrund (Ghost-Standard), mit dezentem Squircle-Hover- und Active-Status.

withDefaults(
  defineProps<{
    /**
     * Variante:
     * - 'ghost': Standard (vollständig transparent, kein Schatten, kein Rand)
     * - 'secondary': dezenter Rahmen
     * - 'danger': rote Hover-/Aktiv-Zustände
     */
    variant?: 'ghost' | 'secondary' | 'danger';
    /** Größe des Buttons: 'sm' (28px), 'md' (36px), 'lg' (44px). */
    size?: 'sm' | 'md' | 'lg';
    /** Ob der Button als aktiv/ausgewählt markiert ist (z. B. ausgewählter Avatar). */
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
    variant: 'ghost',
    size: 'md',
    active: false,
    disabled: false,
    type: 'button',
  },
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :title="title"
    class="icon-btn"
    :class="[
      `icon-btn--${variant}`,
      size !== 'md' ? `icon-btn--${size}` : undefined,
      { active },
    ]"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  box-shadow: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 0;
  margin: 0;
  color: var(--color-text);
  font-weight: normal;
  cursor: pointer;
  line-height: 1;
  font-family: inherit;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
  user-select: none;
  flex-shrink: 0;
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-hover);
}

.icon-btn:active:not(:disabled) {
  transform: scale(0.95);
}

.icon-btn.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.icon-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  background: transparent;
}

/* Varianten */
.icon-btn--secondary {
  border-color: var(--color-border-strong);
}

.icon-btn--danger:hover:not(:disabled) {
  background: var(--color-danger-tint, rgba(239, 68, 68, 0.1));
  color: var(--color-danger);
}

.icon-btn--danger.active {
  background: var(--color-danger-tint, rgba(239, 68, 68, 0.1));
  border-color: var(--color-danger);
  color: var(--color-danger);
}

/* Größen */
.icon-btn--sm {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  font-size: 0.9rem;
}

.icon-btn {
  width: 36px;
  height: 36px;
  min-width: 36px;
  min-height: 36px;
  font-size: 1.25rem;
}

.icon-btn--lg {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  font-size: 1.5rem;
}
</style>

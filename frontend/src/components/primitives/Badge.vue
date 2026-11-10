<script setup lang="ts">
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

withDefaults(
  defineProps<{
    variant?:
      | 'default'
      | 'primary'
      | 'success'
      | 'danger'
      | 'accent'
      | 'warning'
      | 'accent-secondary'
      | 'custom';
    size?: 'sm' | 'md';
    as?: string;
    interactive?: boolean;
    /** Wenn true, wird ein Schließen-/Entfernen-Button gerendert */
    closable?: boolean;
    /** Zugänglichkeits-Label für den Schließen-Button */
    closeAriaLabel?: string;
    /** Titel / Tooltip für den Schließen-Button */
    closeTitle?: string;
    /** Zusätzliche CSS-Klassen für den Schließen-Button (z. B. für bestehende Selektoren) */
    closeButtonClass?: string;
  }>(),
  {
    variant: 'default',
    size: 'sm',
    as: 'span',
    interactive: false,
    closable: false,
    closeAriaLabel: 'Entfernen',
    closeTitle: 'Entfernen',
    closeButtonClass: '',
  }
);

const emit = defineEmits<{
  (e: 'close', event: MouseEvent): void;
}>();
</script>

<template>
  <component
    :is="as"
    class="badge"
    :class="[
      `badge--${variant}`,
      `badge--size-${size}`,
      {
        'badge--interactive': interactive || as === 'button',
        'badge--closable': closable,
      },
    ]"
    :type="as === 'button' ? 'button' : undefined"
  >
    <slot />
    <button
      v-if="closable"
      type="button"
      class="badge__close-btn"
      :class="closeButtonClass"
      :aria-label="closeAriaLabel"
      :title="closeTitle"
      @click.stop="emit('close', $event)"
    >
      <AppIcon :icon="ACTION_ICONS.close" :size="size === 'md' ? 13 : 11" group="actions" />
    </button>
  </component>
</template>

<style lang="scss" scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: inherit;
  font-weight: 600;
  border-radius: var(--radius-pill);
  line-height: 1.2;
  white-space: nowrap;
  background: var(--color-hover);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-strong);
  margin: 0;
}

.badge--size-sm {
  padding: 2px 8px;
  font-size: var(--font-size-xs);
}

.badge--size-md {
  padding: 4px 10px;
  font-size: var(--font-size-sm);
}

.badge--closable.badge--size-sm {
  padding-right: 3px;
}

.badge--closable.badge--size-md {
  padding-right: 4px;
}

.badge--primary {
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  border-color: transparent;
}

.badge--success {
  background: var(--color-success-tint);
  color: var(--color-success-dark, var(--color-success));
  border-color: transparent;
}

.badge--danger {
  background: var(--color-danger-tint);
  color: var(--color-danger-dark, var(--color-danger));
  border-color: transparent;
}

.badge--accent {
  background: var(--color-highlight);
  color: var(--color-accent-dark, var(--color-accent));
  border-color: var(--color-highlight-border);
}

.badge--warning {
  background: var(--color-warning-tint);
  color: var(--color-warning-dark);
  border-color: transparent;
}

.badge--accent-secondary {
  background: var(--color-accent-secondary-bg);
  color: var(--color-accent-secondary);
  border-color: transparent;
}

.badge--custom {
  background: var(--badge-bg, var(--color-hover));
  color: var(--badge-color, var(--color-text));
  border-color: var(--badge-border, transparent);
}

.badge--interactive {
  cursor: pointer;
  text-align: left;
  user-select: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.badge--interactive:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.badge--interactive:active {
  transform: translateY(0);
}

.badge--interactive:focus-visible,
.badge:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.badge__close-btn {
  @include touch-target($expand: true);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  color: inherit;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
  margin-left: 2px;
  flex-shrink: 0;
  transition:
    background-color var(--transition-fast),
    opacity var(--transition-fast),
    transform var(--transition-fast);

  &:hover {
    opacity: 1;
    background-color: color-mix(in srgb, currentColor 16%, transparent);
  }

  &:active {
    opacity: 1;
    transform: scale(0.92);
    background-color: color-mix(in srgb, currentColor 24%, transparent);
  }

  &:focus-visible {
    outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
    outline-offset: 1px;
    box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
  }
}

.badge--size-sm .badge__close-btn {
  width: 18px;
  height: 18px;
  min-width: 18px;
  min-height: 18px;
}

.badge--size-md .badge__close-btn {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
}

@media (prefers-reduced-motion: reduce) {
  .badge__close-btn {
    transition: none;
  }
}
</style>

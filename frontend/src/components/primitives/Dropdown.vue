<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import { ACTION_ICONS } from '../../utils/actionIcons';
import AppIcon from '../AppIcon.vue';
import Button from './Button.vue';

// Dropdown-Primitive: Kapselt Dropdown-Trigger-Container, .dropdown__field und .dropdown__button (Issue #391).
// Entspricht BEM-System: .dropdown (Block), .dropdown__field und .dropdown__button (Elemente).
withDefaults(
  defineProps<{
    label?: string;
    icon?: IconDef;
    disabled?: boolean;
    open?: boolean;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    label: '',
    icon: undefined,
    disabled: false,
    open: false,
    size: 'md',
  }
);

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();
</script>

<template>
  <div
    class="dropdown"
    :class="[{ 'dropdown--open': open }, size !== 'md' ? `dropdown--${size}` : undefined]"
  >
    <slot name="trigger" :open="open" :toggle="() => emit('toggle')">
      <Button
        variant="ghost"
        :size="size"
        class="dropdown__button dropdown__field"
        :disabled="disabled"
        :aria-expanded="open"
        @click="emit('toggle')"
      >
        <AppIcon v-if="icon" :icon="icon" group="actions" :size="16" />
        <span class="dropdown__label">
          <slot name="label">{{ label }}</slot>
        </span>
        <AppIcon
          :icon="ACTION_ICONS.chevronDown"
          :size="14"
          group="actions"
          class="dropdown__caret"
          :class="{ 'is-open': open }"
        />
      </Button>
    </slot>
    <slot />
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown--open,
.dropdown:has([aria-expanded='true']) {
  z-index: var(--z-dropdown, 500);
}

.dropdown__button.dropdown__field {
  padding: 9px 12px;
  border: max(1.5px, var(--ui-border-width, 1.5px)) solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 5%, var(--color-surface)) 0%,
    var(--color-surface) 100%
  );
  color: var(--color-text);
  box-shadow: var(--shadow-control);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 500;
  height: var(--input-height, 46px);
  min-height: var(--input-height, 46px);
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s cubic-bezier(0.2, 0.8, 0.4, 1),
    translate 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);
}

.dropdown--sm .dropdown__button.dropdown__field,
.dropdown__button.dropdown__field.btn--sm {
  padding: 6px 10px;
  height: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  font-size: var(--font-size-sm);
}

.dropdown--lg .dropdown__button.dropdown__field,
.dropdown__button.dropdown__field.btn--lg {
  padding: 12px 16px;
  height: var(--input-height-lg, 52px);
  min-height: var(--input-height-lg, 52px);
  font-size: var(--font-size-md);
}

.dropdown__button.dropdown__field:hover:not(:disabled) {
  translate: 0 -1px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 8%, var(--color-surface)) 0%,
    var(--color-surface) 100%
  );
  border-color: var(--color-primary);
  box-shadow: var(--shadow-control-hover);
}

.dropdown__button.dropdown__field:active:not(:disabled),
.dropdown--open .dropdown__button.dropdown__field,
.dropdown__button.dropdown__field[aria-expanded='true'] {
  transform: translateY(1px);
  translate: 0 0;
  border-color: var(--color-primary);
  box-shadow: var(--shadow-control-active);
}

.dropdown__button.dropdown__field:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.dropdown__button.dropdown__field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.dropdown__button.dropdown__field :deep(.app-icon) {
  color: var(--color-primary);
  opacity: 0.8;
}

.dropdown__label {
  flex: 1;
  text-align: left;
}

.dropdown__caret {
  transition: transform 0.2s ease;
  margin-left: auto;
}

.dropdown__caret.is-open {
  transform: rotate(180deg);
}
</style>

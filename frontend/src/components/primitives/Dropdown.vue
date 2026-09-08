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
  }>(),
  {
    label: '',
    icon: undefined,
    disabled: false,
    open: false,
  }
);

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();
</script>

<template>
  <div class="dropdown" :class="{ 'dropdown--open': open }">
    <slot name="trigger" :open="open" :toggle="() => emit('toggle')">
      <Button
        variant="ghost"
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

.dropdown__button.dropdown__field {
  padding: 9px 12px;
  border: var(--ui-border-width, 1px) solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  height: var(--input-height, var(--input-default-height));
  min-height: var(--input-height, var(--input-default-height));
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.dropdown__button.dropdown__field:hover:not(:disabled) {
  background: var(--color-hover);
}

.dropdown__button.dropdown__field:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.dropdown__button.dropdown__field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

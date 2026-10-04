<script setup lang="ts">
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';

withDefaults(
  defineProps<{
    loading?: boolean;
    disabled?: boolean;
    title?: string;
    ariaLabel?: string;
    dataTestid?: string;
    iconSize?: number;
    variant?: 'address' | 'category' | 'coords' | 'default';
  }>(),
  {
    loading: false,
    disabled: false,
    title: undefined,
    ariaLabel: undefined,
    dataTestid: undefined,
    iconSize: 13,
    variant: 'default',
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<template>
  <button
    type="button"
    class="sparkle-suggest-btn"
    :class="[`sparkle-suggest-btn--${variant}`, { 'is-loading': loading }]"
    :title="title"
    :aria-label="ariaLabel || title"
    :data-testid="dataTestid"
    :disabled="disabled || loading"
    @mousedown.prevent
    @click="emit('click', $event)"
  >
    <AppIcon
      :icon="ACTION_ICONS.sparkles"
      :size="iconSize"
      group="actions"
      :class="{ 'sparkle-spin': loading }"
    />
  </button>
</template>

<style scoped>
.sparkle-suggest-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  transition:
    transform 0.15s ease,
    color 0.15s ease,
    background-color 0.15s ease;
  z-index: 2;
}

/* Unsichtbare Berührungsflächenerweiterung für Touchscreens */
.sparkle-suggest-btn::before {
  content: '';
  position: absolute;
  top: -8px;
  bottom: -8px;
  left: -8px;
  right: -8px;
}

.address-sparkle-btn,
.sparkle-suggest-btn--address {
  right: 6px;
}

.category-sparkle-btn,
.sparkle-suggest-btn--category {
  right: 24px;
}

.coords-sparkle-btn,
.sparkle-suggest-btn--coords {
  position: static;
  transform: none;
  margin-left: auto;
  flex-shrink: 0;
}

.sparkle-suggest-btn:hover:not(:disabled) {
  background-color: var(--color-hover);
  color: var(--color-primary-dark);
  transform: translateY(-50%) scale(1.12);
}

.coords-sparkle-btn:hover:not(:disabled),
.sparkle-suggest-btn--coords:hover:not(:disabled) {
  transform: scale(1.15);
}

.sparkle-suggest-btn:active:not(:disabled) {
  transform: translateY(-50%) scale(0.95);
}

.coords-sparkle-btn:active:not(:disabled),
.sparkle-suggest-btn--coords:active:not(:disabled) {
  transform: scale(0.95);
}

.sparkle-suggest-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.sparkle-suggest-btn:disabled {
  cursor: default;
  opacity: 0.8;
}

@keyframes sparkleRotate {
  0% {
    transform: rotate(0deg) scale(0.9);
  }
  50% {
    transform: rotate(180deg) scale(1.15);
  }
  100% {
    transform: rotate(360deg) scale(0.9);
  }
}

.sparkle-spin {
  animation: sparkleRotate 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
</style>

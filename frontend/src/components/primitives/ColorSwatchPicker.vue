<script setup lang="ts">
import { CATEGORY_COLOR_PALETTE } from '../../utils/categoryIcons';

withDefaults(
  defineProps<{
    modelValue: string;
    colors?: string[];
    ariaLabel?: string;
  }>(),
  {
    colors: () => CATEGORY_COLOR_PALETTE,
    ariaLabel: 'Farbe auswählen',
  }
);

defineEmits<{
  (e: 'update:modelValue', color: string): void;
}>();
</script>

<template>
  <div class="color-swatch-picker" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="color in colors"
      :key="color"
      type="button"
      role="radio"
      class="swatch-btn"
      :class="{ selected: modelValue.toLowerCase() === color.toLowerCase() }"
      :style="{ backgroundColor: color }"
      :title="color"
      :aria-label="`Farbe ${color}`"
      :aria-checked="modelValue.toLowerCase() === color.toLowerCase()"
      @click="$emit('update:modelValue', color)"
    />
  </div>
</template>

<style scoped>
.color-swatch-picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.swatch-btn {
  position: relative;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  corner-shape: round;
  border: 2px solid transparent;
  cursor: pointer;
  box-shadow: none;
  flex-shrink: 0;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.swatch-btn::after {
  content: '';
  position: absolute;
  inset: -6px;
}

@media (pointer: coarse) {
  .swatch-btn::after {
    top: 50%;
    left: 50%;
    right: auto;
    bottom: auto;
    transform: translate(-50%, -50%);
    min-width: 44px;
    min-height: 44px;
    width: 100%;
    height: 100%;
  }
}

.swatch-btn:hover {
  transform: scale(1.2);
  box-shadow: var(--shadow-sm);
}

.swatch-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.swatch-btn.selected {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-surface);
  transform: scale(1.15);
}
</style>

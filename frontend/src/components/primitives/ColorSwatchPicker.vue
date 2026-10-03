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
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  corner-shape: round;
  border: 2px solid transparent;
  cursor: pointer;
  box-shadow: none;
  transition:
    transform var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.swatch-btn:hover {
  transform: scale(1.15);
  box-shadow: var(--shadow-sm);
}

.swatch-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.swatch-btn.selected {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-surface);
  transform: scale(1.1);
}
</style>

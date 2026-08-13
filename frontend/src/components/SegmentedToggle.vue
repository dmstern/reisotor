<script setup lang="ts">
import { computed } from 'vue';

// Echter schiebender Segmented-Control (statt zweier unabhängig hervorgehobener Buttons wie
// bisher, siehe ExcursionsView.vue's Gruppieren/Sortieren-Umschalter): eine per CSS transform
// animierte Hintergrund-Pille gleitet zwischen den Optionen statt nur die Farbe hart umzuschalten -
// näher an nativen iOS-Segmented-Controls, ohne eine neue Interaktion (weiterhin ein einzelner
// Klick pro Option) einzuführen. Generisch für beliebig viele Optionen, aktuell überall mit genau
// zwei genutzt.
const props = defineProps<{
  modelValue: string;
  options: { value: string; label: string }[];
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const activeIndex = computed(() => Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)));
</script>

<template>
  <div class="segmented-toggle" :style="{ '--count': options.length, '--active-index': activeIndex }">
    <span class="segmented-thumb" aria-hidden="true"></span>
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="segmented-option"
      :class="{ active: option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented-toggle {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--count), 1fr);
  background: var(--color-hover);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: 3px;
  gap: 2px;
}

/* Gleitet per transform statt left/width-Änderungen - eine Eigenschaft zu animieren reicht,
   läuft dadurch auf dem Compositor statt bei jedem Frame Layout neu zu berechnen. */
.segmented-thumb {
  position: absolute;
  inset: 3px;
  width: calc((100% - 6px) / var(--count));
  background: var(--color-surface);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  transform: translateX(calc(var(--active-index) * 100%));
  transition: transform 0.2s ease;
}

.segmented-option {
  position: relative;
  z-index: 1;
  padding: 5px 10px;
  border: none;
  background: none;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease;
}

.segmented-option.active {
  color: var(--color-primary-dark);
}
</style>

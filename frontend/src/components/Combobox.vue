<script setup lang="ts">
import { computed, ref } from 'vue';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Combobox.vue: Custom Dropdown-/Freitext-Auswahlfeld mit einheitlichem Styling.
// Unterstützt sowohl v-model-Freitext als auch Dropdown-Ausstattung (Optionsliste + Caret-Icon).

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: string[];
    placeholder?: string;
    iconFor?: (option: string) => string;
    iconDefFor?: (option: string) => IconDef | undefined;
    colorFor?: (option: string) => string | undefined;
  }>(),
  { modelValue: '' }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', value: string): void;
}>();

const open = ref(false);

const filteredOptions = computed(() => {
  const q = props.modelValue.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => o.toLowerCase().includes(q));
});

function selectOption(option: string) {
  emit('update:modelValue', option);
  emit('select', option);
  open.value = false;
}

function onBlur() {
  window.setTimeout(() => {
    open.value = false;
  }, 150);
}

defineExpose({
  close: () => {
    open.value = false;
  },
});
</script>

<template>
  <div class="combobox" :class="{ open }">
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @focus="open = true"
      @blur="onBlur"
    />
    <AppIcon
      :icon="ACTION_ICONS.chevronDown"
      :size="14"
      group="actions"
      class="combobox-caret"
      :class="{ open }"
    />
    <ul class="options" v-if="open && filteredOptions.length">
      <li v-for="option in filteredOptions" :key="option" @mousedown.prevent="selectOption(option)">
        <span
          v-if="iconDefFor?.(option) || iconFor?.(option) || colorFor?.(option)"
          class="option-icon"
          :style="colorFor?.(option) ? { color: colorFor(option) } : {}"
        >
          <AppIcon
            v-if="iconDefFor?.(option)"
            :icon="iconDefFor(option)!"
            :size="16"
            group="categories"
          />
          <span v-else-if="iconFor?.(option)">{{ iconFor(option) }}</span>
        </span>
        <span class="option-label">{{ option }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.combobox {
  position: relative;
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: center;
}

.combobox input {
  width: 100%;
  padding-right: 36px;
}

.combobox-caret {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-primary);
  transition: transform 0.2s ease;
}

.combobox-caret.open {
  transform: translateY(-50%) rotate(180deg);
}

.options {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 20;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
}

.options li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  font-size: 0.9rem;
  cursor: pointer;
}

.option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  flex-shrink: 0;
}

.option-label {
  flex: 1;
}

.options li:hover {
  background: var(--color-hover);
}
</style>

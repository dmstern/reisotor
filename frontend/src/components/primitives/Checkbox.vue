<script setup lang="ts">
import { computed } from 'vue';

// Checkbox-Primitive für alle Abhake- und Auswahl-Interaktionen der App (ToDo, Packliste,
// Einkauf, Einstellungen etc.) – kapselt Custom-Häkchen, Fokus- und Deaktiviert-Zustände.
const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    checked?: unknown;
    value?: unknown;
    trueValue?: boolean | string | number;
    falseValue?: boolean | string | number;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
  }>(),
  {
    trueValue: true,
    falseValue: false,
    disabled: false,
    required: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void;
  (e: 'change', event: Event): void;
}>();

const isChecked = computed(() => {
  if (props.checked !== undefined) {
    return Boolean(props.checked);
  }
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.includes(props.value);
  }
  return props.modelValue === props.trueValue;
});

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (Array.isArray(props.modelValue)) {
    const arr = [...props.modelValue];
    if (target.checked) {
      if (!arr.includes(props.value)) arr.push(props.value);
    } else {
      const idx = arr.indexOf(props.value);
      if (idx !== -1) arr.splice(idx, 1);
    }
    emit('update:modelValue', arr);
  } else {
    emit('update:modelValue', target.checked ? props.trueValue : props.falseValue);
  }
  emit('change', event);
}
</script>

<template>
  <input
    :id="id"
    :name="name"
    type="checkbox"
    :checked="isChecked"
    :value="value"
    :disabled="disabled"
    :required="required"
    :aria-label="ariaLabel"
    class="checkbox"
    @change="onChange"
  />
</template>

<style scoped>
.checkbox {
  appearance: none;
  -webkit-appearance: none;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-xs-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  cursor: pointer;
  position: relative;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.checkbox:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.checkbox:checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.checkbox:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 16px;
  height: 16px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.6 8.2C4.5 9.3 5.7 11 6.8 11.4C7.8 11.4 9.8 9.2 12.4 4.6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  pointer-events: none;
}

.checkbox:focus-visible {
  outline: 2px solid var(--color-focus-ring, var(--color-primary));
  outline-offset: 2px;
}

.checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

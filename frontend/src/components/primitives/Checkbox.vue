<script setup lang="ts">
import { computed } from 'vue';

// Checkbox-Primitive für alle Abhake- und Auswahl-Interaktionen der App (ToDo, Packliste,
// Einkauf, Einstellungen etc.) – kapselt Custom-Häkchen, Fokus- und Deaktiviert-Zustände.
const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    checked?: boolean;
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
    return props.checked;
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
  border-radius: 6px;
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
  width: 5px;
  height: 10px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  position: absolute;
  left: 6px;
  top: 2px;
  transform: rotate(45deg);
}

.checkbox:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

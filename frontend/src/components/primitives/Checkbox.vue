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
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    trueValue: true,
    falseValue: false,
    disabled: false,
    required: false,
    size: 'md',
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
      if (!arr.includes(props.value)) {
        arr.push(props.value);
      }
    } else {
      const idx = arr.indexOf(props.value);

      if (idx !== -1) {
        arr.splice(idx, 1);
      }
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
    :class="`checkbox--${size}`"
    @change="onChange"
  />
</template>

<style lang="scss" scoped>
.checkbox {
  @include touch-target($pseudo: 'before', $expand: true);
  appearance: none;
  -webkit-appearance: none;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-xs-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  box-shadow: var(--shadow-control-choice);
  cursor: pointer;
  position: relative;
  box-sizing: border-box;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.checkbox--sm {
  width: 20px;
  height: 20px;
}

.checkbox--md {
  width: 24px;
  height: 24px;
}

.checkbox--lg {
  width: 28px;
  height: 28px;
}

.checkbox:hover:not(:disabled) {
  border-color: var(--color-primary);
}

.checkbox:checked {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, white 10%, var(--color-primary)) 0%,
    var(--color-primary) 100%
  );
  border-color: var(--color-button-edge, var(--color-primary));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 1px 2px rgba(0, 0, 0, 0.15);
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

.checkbox--sm:checked::after {
  width: 14px;
  height: 14px;
}

.checkbox--lg:checked::after {
  width: 18px;
  height: 18px;
}

.checkbox:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

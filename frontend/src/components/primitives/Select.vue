<script setup lang="ts">
// Select-Primitive für Dropdown-Auswahlfelder – kapselt Squircle-Styling, Pfeil-Icon,
// Höhenkonsistenz mit Text-Inputs und Theme-Unterstützung (Issue #239).

withDefaults(
  defineProps<{
    modelValue?: string | number | null;
    options?: Array<{ value: string | number; label: string; disabled?: boolean }>;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
    size?: 'sm' | 'md' | 'lg';
    invalid?: boolean;
  }>(),
  {
    disabled: false,
    required: false,
    size: 'md',
    invalid: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'change', event: Event): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
}>();

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
  emit('change', event);
}
</script>

<template>
  <select
    :id="id"
    :name="name"
    :value="modelValue"
    :disabled="disabled"
    :required="required"
    :aria-label="ariaLabel"
    :aria-invalid="invalid || undefined"
    class="select"
    :class="[
      size !== 'md' ? `select--${size}` : undefined,
      invalid ? 'select--invalid' : undefined,
    ]"
    @change="onChange"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
  >
    <slot>
      <option v-for="opt in options" :key="opt.value" :value="opt.value" :disabled="opt.disabled">
        {{ opt.label }}
      </option>
    </slot>
  </select>
</template>

<style scoped>
.select {
  padding: 9px 12px;
  border: var(--ui-border-width, 1px) solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 400;
  height: var(--input-height, var(--input-default-height));
  min-height: var(--input-height, var(--input-default-height));
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%232a7f74' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px 16px;
  padding-right: 36px;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

[data-theme='dark'] .select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234fd1c5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

.select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-hover);
}

.select--invalid {
  border-color: var(--color-danger);
}

.select--invalid:focus {
  outline-color: var(--color-danger);
}

.select--sm {
  padding: 6px 10px;
  padding-right: 30px;
  background-position: right 8px center;
  background-size: 14px 14px;
  height: 36px;
  min-height: 36px;
  font-size: 0.85rem;
}

.select--lg {
  padding: 12px 16px;
  padding-right: 42px;
  height: 50px;
  min-height: 50px;
  font-size: 1.1rem;
}
</style>

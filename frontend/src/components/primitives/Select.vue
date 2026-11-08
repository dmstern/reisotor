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
    modified?: boolean;
  }>(),
  {
    disabled: false,
    required: false,
    size: 'md',
    invalid: false,
    modified: false,
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
      modified ? 'select--modified' : undefined,
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
  border: max(1.5px, var(--ui-border-width, 1.5px)) solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background-color: var(--color-surface);
  color: var(--color-text);
  box-shadow: none;
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 500;
  height: var(--input-height, 46px);
  min-height: var(--input-height, 46px);
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23726e66' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px 16px;
  padding-right: 36px;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}

[data-theme='dark'] .select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a8a29a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

.select:hover:not(:disabled):not(:focus):not(:focus-visible) {
  background-color: var(--color-hover);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-sm);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239141ac' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

[data-theme='dark'] .select:hover:not(:disabled):not(:focus):not(:focus-visible) {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23c061cb' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

.select:focus-visible,
.select:focus {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239141ac' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

[data-theme='dark'] .select:focus-visible,
[data-theme='dark'] .select:focus {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23c061cb' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

.select:active:not(:disabled) {
  transform: scale(0.995);
  box-shadow: var(--shadow-sm);
}

.select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--color-hover);
  box-shadow: none;
}

.select--invalid {
  border-color: var(--color-danger);
}

.select--invalid:focus,
.select--invalid:focus-visible {
  outline-color: var(--color-danger);
}

.select--modified {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 1px var(--color-accent);
}

.select--modified:hover:not(:disabled),
.select--modified:focus,
.select--modified:focus-visible,
.select--modified:active:not(:disabled) {
  outline-color: var(--color-accent);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface)), var(--shadow-sm);
}

.select--sm {
  padding: 6px 10px;
  padding-right: 30px;
  background-position: right 8px center;
  background-size: 14px 14px;
  height: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  font-size: var(--font-size-sm);
}

.select--lg {
  padding: 12px 16px;
  padding-right: 42px;
  height: var(--input-height-lg, 52px);
  min-height: var(--input-height-lg, 52px);
  font-size: var(--font-size-md);
}
</style>

<script setup lang="ts">
// Select-Primitive: Formularfeld für Einzelauswahl aus fester Optionsliste via nativem <select> (Issue #239, #721).
// Kapselt Squircle-Styling, Pfeil-Icon, Höhenkonsistenz mit Text-Inputs und Theme-Unterstützung via _controls.scss.
// Nutzt auf mobilen Geräten (iOS/Android) den nativen OS-Picker.
// Abgrenzung: Für freie Texteingabe mit Vorschlägen -> Combobox.vue; für Aktions-/Flyout-Menüs -> DropdownMenu.vue.

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

<style scoped lang="scss">
.select {
  @include control-field-inset;
  padding: 9px 12px;
  color: var(--color-text);
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
}

[data-theme='dark'] .select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a8a29a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a8a29a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  }
}

.select--sm {
  padding: 6px 10px;
  padding-right: 30px;
  background-position: right 8px center;
  background-size: 14px 14px;
  height: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  font-size: var(--font-size-sm);

  /* iOS/WebKit Auto-Zoom-Prävention: Auf Mobilgeräten & Touchscreens mindestens 16px (1rem) */
  @include media-down('desktop-sm') {
    font-size: var(--font-size-md);
  }

  @media (pointer: coarse) {
    font-size: var(--font-size-md);
  }
}

.select--lg {
  padding: 12px 16px;
  padding-right: 42px;
  height: var(--input-height-lg, 52px);
  min-height: var(--input-height-lg, 52px);
  font-size: var(--font-size-md);
}
</style>

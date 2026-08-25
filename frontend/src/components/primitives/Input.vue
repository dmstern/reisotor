<script setup lang="ts">
// Input-Primitive für einzeilige Eingabefelder (Text, Zahl, Datum, Zeit, URL, E-Mail, …) – siehe Issue #239.
// Primitive-Styles kapseln Standard-Squircle-Styling, Maße, Fokus- und Deaktiviert-Zustände.

withDefaults(
  defineProps<{
    /** Eingabewert (v-model). */
    modelValue?: string | number | null;
    /** HTML-Input-Type (Standard: 'text'). */
    type?:
      | 'text'
      | 'number'
      | 'date'
      | 'time'
      | 'datetime-local'
      | 'email'
      | 'url'
      | 'search'
      | 'password'
      | 'month'
      | 'week'
      | 'tel';
    /** Platzhaltertext. */
    placeholder?: string;
    /** Deaktiviert-Zustand. */
    disabled?: boolean;
    /** Pflichtfeld. */
    required?: boolean;
    /** Nur lesbar. */
    readonly?: boolean;
    /** Schrittweite für Zahlen/Zeiten. */
    step?: string | number;
    /** Mindestwert. */
    min?: string | number;
    /** Maximalwert. */
    max?: string | number;
    /** Maximale Zeichenlänge. */
    maxlength?: number;
    /** Input-Größe: 'sm' (kompakt), 'md' (Standard 44px), 'lg' (groß). */
    size?: 'sm' | 'md' | 'lg';
    /** Fehler-/Ungültig-Zustand. */
    invalid?: boolean;
    /** Automatische Vervollständigung. */
    autocomplete?: string;
    /** Name-Attribut. */
    name?: string;
    /** ID-Attribut. */
    id?: string;
  }>(),
  {
    modelValue: '',
    type: 'text',
    disabled: false,
    required: false,
    readonly: false,
    size: 'md',
    invalid: false,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'change', event: Event): void;
  (e: 'keydown', event: KeyboardEvent): void;
  (e: 'keyup', event: KeyboardEvent): void;
}>();

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <input
    :id="id"
    :name="name"
    :type="type"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :disabled="disabled"
    :required="required"
    :readonly="readonly"
    :step="step"
    :min="min"
    :max="max"
    :maxlength="maxlength"
    :autocomplete="autocomplete"
    :aria-invalid="invalid || undefined"
    class="input"
    :class="[size !== 'md' ? `input--${size}` : undefined, invalid ? 'input--invalid' : undefined]"
    @input="onInput"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
    @change="emit('change', $event)"
    @keydown="emit('keydown', $event)"
    @keyup="emit('keyup', $event)"
  />
</template>

<style scoped>
.input {
  /* Basis-Styles für Input-Primitive */
  padding: 9px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
  min-width: 0;
  max-width: 100%;
  min-height: 44px;
  font-family: inherit;
  font-size: 1rem;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.input:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-hover);
}

.input--invalid {
  border-color: var(--color-danger);
}

.input--invalid:focus {
  outline-color: var(--color-danger);
}

.input--sm {
  padding: 6px 10px;
  min-height: 36px;
  font-size: 0.85rem;
}

.input--lg {
  padding: 12px 16px;
  min-height: 50px;
  font-size: 1.1rem;
}

/* Spezifische Handhabung für Datums-/Zeiteingaben (Chromium-Picker-Höhenausgleich) */
.input[type='date'],
.input[type='time'],
.input[type='datetime-local'],
.input[type='month'],
.input[type='week'] {
  height: 44px;
}

.input[type='date']::-webkit-calendar-picker-indicator,
.input[type='time']::-webkit-calendar-picker-indicator,
.input[type='datetime-local']::-webkit-calendar-picker-indicator,
.input[type='month']::-webkit-calendar-picker-indicator,
.input[type='week']::-webkit-calendar-picker-indicator {
  padding: 0;
  margin-left: 4px;
  width: 16px;
  height: 16px;
}
</style>

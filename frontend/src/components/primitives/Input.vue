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
    /** Geändert-Zustand (orange Markierung). */
    modified?: boolean;
    /** Automatische Vervollständigung. */
    autocomplete?: string;
    /** Virtual Keyboard Mode ('decimal', 'numeric', 'search', 'email', 'tel', 'url', 'text', 'none'). */
    inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
    /** Auto-Capitalization ('off', 'none', 'sentences', 'words', 'characters'). */
    autocapitalize?: string;
    /** Auto-Correction ('on', 'off'). */
    autocorrect?: string;
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
    modified: false,
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
    :inputmode="inputmode"
    :autocapitalize="autocapitalize"
    :autocorrect="autocorrect"
    :aria-invalid="invalid || undefined"
    class="input"
    :class="[
      size !== 'md' ? `input--${size}` : undefined,
      invalid ? 'input--invalid' : undefined,
      modified ? 'input--modified' : undefined,
    ]"
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
  /* Basis-Styles für Input-Primitive mit 3D-Look (#701 & #729) */
  padding: 9px 12px;
  border: max(1.5px, var(--ui-border-width, 1.5px)) solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: none;
  min-width: 0;
  max-width: 100%;
  min-height: var(--input-height, 46px);
  box-sizing: border-box;
  font-family: inherit;
  font-size: var(--font-size-md);
  transition: var(--transition-control);
}

.input:hover:not(:disabled):not(:focus):not(:focus-visible) {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border-strong));
  box-shadow: var(--shadow-control-inset-hover);
}

.input:focus,
.input:focus-visible,
.input:active:not(:disabled) {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface)), var(--shadow-control-inset);
}

.input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-hover);
  box-shadow: none;
}

.input--invalid {
  border-color: var(--color-danger);
}

.input--invalid:hover:not(:disabled):not(:focus):not(:focus-visible) {
  border-color: var(--color-danger);
}

.input--invalid:focus,
.input--invalid:focus-visible,
.input--invalid:active:not(:disabled) {
  border-color: var(--color-border-strong);
  outline-color: var(--color-danger);
}

.input--modified {
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 1px var(--color-accent),
    var(--shadow-control-inset);
}

.input--modified:hover:not(:disabled):not(:focus):not(:focus-visible) {
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 1px var(--color-accent),
    var(--shadow-control-inset-hover);
}

.input--modified:focus,
.input--modified:focus-visible,
.input--modified:active:not(:disabled) {
  border-color: var(--color-border-strong) !important;
  outline-color: var(--color-accent);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface)), var(--shadow-control-inset);
}

.input--sm {
  padding: 6px 10px;
  min-height: var(--input-height-sm, 38px);
  font-size: var(--font-size-sm);
}

.input--lg {
  padding: 12px 16px;
  min-height: var(--input-height-lg, 52px);
  font-size: var(--font-size-md);
}

/* Spezifische Handhabung für Datums-/Zeiteingaben (Chromium-Picker-Höhenausgleich) */
.input[type='date'],
.input[type='time'],
.input[type='datetime-local'],
.input[type='month'],
.input[type='week'] {
  height: var(--input-height, 46px);
}

.input--sm[type='date'],
.input--sm[type='time'],
.input--sm[type='datetime-local'],
.input--sm[type='month'],
.input--sm[type='week'] {
  height: var(--input-height-sm, 38px);
}

.input--lg[type='date'],
.input--lg[type='time'],
.input--lg[type='datetime-local'],
.input--lg[type='month'],
.input--lg[type='week'] {
  height: var(--input-height-lg, 52px);
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

/* Spezifische Handhabung für Suchfelder (Pill-Form) */
.input[type='search'] {
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding-left: 14px;
  padding-right: 14px;
}

.input--sm[type='search'] {
  padding-left: 12px;
  padding-right: 12px;
}

.input--lg[type='search'] {
  padding-left: 18px;
  padding-right: 18px;
}

.input[type='search']::-webkit-search-decoration,
.input[type='search']::-webkit-search-cancel-button,
.input[type='search']::-webkit-search-results-button,
.input[type='search']::-webkit-search-results-decoration {
  -webkit-appearance: none;
  display: none;
}
</style>

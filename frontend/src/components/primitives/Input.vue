<script setup lang="ts">
import { ref } from 'vue';

// Input-Primitive für einzeilige Eingabefelder (Text, Zahl, Datum, Zeit, URL, E-Mail, …) – siehe Issue #239.
// Primitive-Styles kapseln Standard-Squircle-Styling, Maße, Fokus- und Deaktiviert-Zustände via _controls.scss.

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
    /** Formgebung: 'squircle' (Standard) oder 'pill' (abgerundet für Suchfelder). */
    shape?: 'squircle' | 'pill';
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
    shape: 'squircle',
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

const inputRef = ref<HTMLInputElement | null>(null);

function onInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  el: inputRef,
});
</script>

<template>
  <input
    :id="id"
    ref="inputRef"
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
      shape === 'pill' ? 'input--pill' : undefined,
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

<style scoped lang="scss">
.input {
  /* Basis-Styles für Input-Primitive mit 3D-Look via _controls.scss (#701 & #729) */
  @include control-field-inset;
  padding: 9px 12px;
  color: var(--color-text);
  min-width: 0;
  max-width: 100%;
  min-height: var(--input-height, 46px);
  box-sizing: border-box;
  font-family: inherit;
  font-size: var(--font-size-md);
}

.input--sm {
  padding: 6px 10px;
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

.input--lg {
  padding: 12px 16px;
  min-height: var(--input-height-lg, 52px);
  font-size: var(--font-size-md);
}

/* Spezifische Handhabung für Datums-/Zeiteingaben (Chromium-Picker-Höhenausgleich & WebKit/iOS) */
.input[type='date'],
.input[type='time'],
.input[type='datetime-local'],
.input[type='month'],
.input[type='week'] {
  height: var(--input-height, 46px);
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.input[type='date']::-webkit-date-and-time-value,
.input[type='time']::-webkit-date-and-time-value,
.input[type='datetime-local']::-webkit-date-and-time-value {
  text-align: inherit;
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
.input--pill,
.input[type='search'] {
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding-left: 14px;
  padding-right: 14px;
}

.input--pill.input--sm,
.input--sm[type='search'] {
  padding-left: 12px;
  padding-right: 12px;
}

.input--pill.input--lg,
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

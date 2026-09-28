<script setup lang="ts">
// Textarea-Primitive für mehrzeilige Eingabefelder – kapselt Squircle-Styling,
// Padding, Schriftart, Fokus- und Deaktiviert-Zustände.

withDefaults(
  defineProps<{
    modelValue?: string | null;
    placeholder?: string;
    rows?: number;
    disabled?: boolean;
    required?: boolean;
    readonly?: boolean;
    maxlength?: number;
    invalid?: boolean;
    modified?: boolean;
    name?: string;
    id?: string;
    ariaLabel?: string;
  }>(),
  {
    modelValue: '',
    rows: 3,
    disabled: false,
    required: false,
    readonly: false,
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
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
}
</script>

<template>
  <textarea
    :id="id"
    :name="name"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :rows="rows"
    :disabled="disabled"
    :required="required"
    :readonly="readonly"
    :maxlength="maxlength"
    :aria-label="ariaLabel"
    :aria-invalid="invalid || undefined"
    class="textarea"
    :class="[
      invalid ? 'textarea--invalid' : undefined,
      modified ? 'textarea--modified' : undefined,
    ]"
    @input="onInput"
    @blur="emit('blur', $event)"
    @focus="emit('focus', $event)"
    @change="emit('change', $event)"
    @keydown="emit('keydown', $event)"
    @keyup="emit('keyup', $event)"
  ></textarea>
</template>

<style scoped>
.textarea {
  padding: 9px 12px;
  border: var(--ui-border-width, 1px) solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: none;
  font-family: inherit;
  font-size: 1rem;
  line-height: 1.5;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  resize: vertical;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.textarea:hover:not(:disabled) {
  box-shadow: var(--shadow-sm);
}

.textarea:focus,
.textarea:active:not(:disabled) {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  box-shadow: var(--shadow-sm);
}

.textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--color-hover);
  box-shadow: none;
}

.textarea--invalid {
  border-color: var(--color-danger);
}

.textarea--invalid:focus {
  outline-color: var(--color-danger);
}

.textarea--modified {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 1px var(--color-accent);
}

.textarea--modified:hover:not(:disabled),
.textarea--modified:focus,
.textarea--modified:active:not(:disabled) {
  outline-color: var(--color-accent);
  box-shadow:
    0 0 0 1px var(--color-accent),
    var(--shadow-sm);
}
</style>

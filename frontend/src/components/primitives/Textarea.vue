<script setup lang="ts">
// Textarea-Primitive für mehrzeilige Eingabefelder – kapselt Squircle-Styling,
// Padding, Schriftart, Fokus- und Deaktiviert-Zustände via _controls.scss.

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

<style scoped lang="scss">
.textarea {
  @include control-field-inset;
  padding: 9px 12px;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-md);
  line-height: 1.5;
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  resize: vertical;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';

// Radio-Primitive für Optionen und Einzelauswahlen der App (Formulare, Routen-Auswahl,
// Einstellungen etc.) – kapselt Custom-Radio-Kreis, weichen Fokus-, Hover- und
// Checked-Zustand mit animiertem inneren Punkt per CSS-Transform/Opacity.
const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    checked?: unknown;
    value?: unknown;
    disabled?: boolean;
    required?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
    size?: 'sm' | 'md' | 'lg';
    /**
     * Wenn true, wird das Element als rein visuelles <span> (aria-hidden) gerendert,
     * um es barrierefrei innerhalb von bereits interaktiven Buttons oder Custom-Cards
     * einzubetten, ohne verschachtelte interaktive HTML-Elemente zu erzeugen.
     */
    visualOnly?: boolean;
  }>(),
  {
    disabled: false,
    required: false,
    size: 'md',
    visualOnly: false,
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
  if (props.modelValue !== undefined && props.value !== undefined) {
    return props.modelValue === props.value;
  }
  return Boolean(props.modelValue);
});

function onChange(event: Event) {
  const val = props.value !== undefined ? props.value : true;
  emit('update:modelValue', val);
  emit('change', event);
}
</script>

<template>
  <span
    v-if="visualOnly"
    class="radio"
    :class="[
      `radio--${size}`,
      {
        'is-checked': isChecked,
        'is-disabled': disabled,
      },
    ]"
    aria-hidden="true"
  />
  <input
    v-else
    :id="id"
    :name="name"
    type="radio"
    :checked="isChecked"
    :value="value"
    :disabled="disabled"
    :required="required"
    :aria-label="ariaLabel"
    class="radio"
    :class="`radio--${size}`"
    @change="onChange"
  />
</template>

<style scoped>
.radio {
  appearance: none;
  -webkit-appearance: none;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  cursor: pointer;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  vertical-align: middle;
  transition:
    border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Größen-Varianten */
.radio--sm {
  width: 16px;
  height: 16px;
}

.radio--md {
  width: 18px;
  height: 18px;
}

.radio--lg {
  width: 22px;
  height: 22px;
}

.radio:hover:not(:disabled):not(.is-disabled) {
  border-color: var(--color-primary-light, var(--color-primary));
}

.radio:checked,
.radio.is-checked {
  border-color: var(--color-primary);
}

/* Innerer Punkt: Animiert per Transform (Scale) und Opacity für weiche, sprungfreie Übergänge */
.radio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  background: var(--color-primary);
  transform: translate(-50%, -50%) scale(0);
  opacity: 0;
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}

.radio--sm::after {
  width: 7px;
  height: 7px;
}

.radio--md::after {
  width: 8px;
  height: 8px;
}

.radio--lg::after {
  width: 10px;
  height: 10px;
}

.radio:checked::after,
.radio.is-checked::after {
  transform: translate(-50%, -50%) scale(1);
  opacity: 1;
}

.radio:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.radio:disabled,
.radio.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .radio,
  .radio::after {
    transition: none !important;
  }
}
</style>

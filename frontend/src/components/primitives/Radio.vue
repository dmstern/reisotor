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
  border: 0;
  box-shadow: inset 0 0 0 2px var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  cursor: pointer;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  vertical-align: middle;
  transition:
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Größen-Varianten (Vielfache von 8 für perfekte Subpixel-/DPI-Skalierung bei 100%, 125%, 150%, 200%) */
.radio--sm {
  width: 16px;
  height: 16px;
}

.radio--md {
  width: 16px;
  height: 16px;
}

.radio--lg {
  width: 24px;
  height: 24px;
}

.radio:hover:not(:disabled):not(.is-disabled) {
  box-shadow: inset 0 0 0 2px var(--color-primary-light, var(--color-primary));
}

.radio:checked,
.radio.is-checked {
  box-shadow: inset 0 0 0 2px var(--color-primary);
}

/* Innerer Punkt: Zentriert via inset: 0 + margin: auto.
   Weil der Außenring als inset-box-shadow statt CSS-Border gerendert wird und die
   Außenmaße auf 8er-Potenzen basieren (16px für md mit 8px-Punkt, 24px für lg mit 12px-Punkt),
   skalieren sowohl Container als auch Punkt bei allen gängigen Skalierungsfaktoren (100%,
   125%, 150%, 200%) exakt zu geraden ganzzahligen physikalischen Pixeln:
   - 100%: 16px Außen / 8px Punkt -> 4px Margin ringsum (2px Ring + 2px Luft)
   - 125%: 20px Außen / 10px Punkt -> 5px Margin ringsum (2px Ring + 3px Luft)
   - 150%: 24px Außen / 12px Punkt -> 6px Margin ringsum (3px Ring + 3px Luft)
   - 200%: 32px Außen / 16px Punkt -> 8px Margin ringsum (4px Ring + 4px Luft)
   Dadurch entstehen keinerlei Rundungsasymmetrien (kein 3px vs 4px Versatz). */
.radio::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  transform: scale(0);
  transform-origin: center center;
  opacity: 0;
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease;
}

.radio--sm::after {
  width: 6px;
  height: 6px;
}

.radio--md::after {
  width: 8px;
  height: 8px;
}

.radio--lg::after {
  width: 12px;
  height: 12px;
}

.radio:checked::after,
.radio.is-checked::after {
  transform: scale(1);
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

@media (forced-colors: active) {
  .radio {
    border: 2px solid CanvasText;
  }

  .radio:checked,
  .radio.is-checked {
    border-color: Highlight;
  }
}

@media (prefers-reduced-motion: reduce) {
  .radio,
  .radio::after {
    transition: none !important;
  }
}
</style>

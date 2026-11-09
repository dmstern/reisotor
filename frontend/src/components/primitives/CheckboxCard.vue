<script setup lang="ts">
import { computed, useId } from 'vue';
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';
import Checkbox from './Checkbox.vue';

// CheckboxCard.vue: Modernes, zugängliches Kachel- und Zeilen-Primitive für Einstellungen,
// Optionen und Formular-Toggles (Reise-Optionen, Benachrichtigungen, Anzeige-Optionen etc.).
// Verhindert Layout-Clips, sorgt für konsistente Abstände nach oben und unten und bietet
// eine großzügige, taktile Klickfläche.
const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    checked?: unknown;
    value?: unknown;
    trueValue?: boolean | string | number;
    falseValue?: boolean | string | number;
    disabled?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
    /** Hauptbeschriftung */
    label?: string;
    /** Optionale Detailbeschreibung oder Hilfstext */
    description?: string;
    /** Optionales Icon vor dem Label */
    icon?: IconDef;
    /**
     * Darstellungsvariante:
     * - 'card': Moderne, taktile Kachel mit weichem Hintergrund, Rand und Hover-Feedback
     * - 'row': Flache Zeile ohne Hintergrund für kompakte Dialoge oder dichte Listen
     * - 'muted': Dezente hinterlegte Fläche mit taktilem 3D-Feedback
     * - 'popover': Taktile Kachel optimiert für dichte Dialoge, Modals und Popover-Menüs
     */
    variant?: 'card' | 'row' | 'muted' | 'popover';
  }>(),
  {
    trueValue: true,
    falseValue: false,
    disabled: false,
    label: '',
    description: '',
    icon: undefined,
    variant: 'card',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void;
  (e: 'change', event: Event): void;
}>();

const autoId = useId();
const inputId = computed(() => props.id || autoId);

const isChecked = computed(() => {
  if (props.checked !== undefined) {
    return Boolean(props.checked);
  }

  if (Array.isArray(props.modelValue)) {
    return props.modelValue.includes(props.value);
  }

  return props.modelValue === props.trueValue;
});

function onUpdateModel(val: unknown) {
  emit('update:modelValue', val);
}

function onChange(event: Event) {
  emit('change', event);
}
</script>

<template>
  <label
    :for="inputId"
    class="checkbox-card"
    :class="[
      `checkbox-card--${variant}`,
      {
        'is-checked': isChecked,
        'is-disabled': disabled,
      },
    ]"
  >
    <div class="checkbox-card__control">
      <Checkbox
        :id="inputId"
        :name="name"
        :model-value="modelValue"
        :checked="checked"
        :value="value"
        :true-value="trueValue"
        :false-value="falseValue"
        :disabled="disabled"
        :aria-label="ariaLabel || label"
        @update:model-value="onUpdateModel"
        @change="onChange"
      />
    </div>
    <div class="checkbox-card__body">
      <div class="checkbox-card__header">
        <AppIcon v-if="icon" :icon="icon" :size="16" group="actions" class="checkbox-card__icon" />
        <span class="checkbox-card__label">
          <slot name="label">{{ label }}</slot>
        </span>
      </div>
      <p v-if="description || $slots.description" class="checkbox-card__description">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot />
    </div>
    <div v-if="$slots.extra" class="checkbox-card__extra">
      <slot name="extra" />
    </div>
  </label>
</template>

<style scoped>
.checkbox-card {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--space-3);
  text-align: left;
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  width: 100%;
  transition:
    background 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.18s ease,
    box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Card-Variante: Die moderne Einstellungs-Kachel */
.checkbox-card--card {
  padding: var(--space-3) var(--space-4);
  margin: var(--space-3) 0;
  background-color: var(--color-surface);
  /* Initial flach (wie Dropdowns/Inputs) - der 3D-Look entsteht erst bei Hover/Fokus */
  background-image: none;
  box-shadow: none;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.checkbox-card--card:hover:not(.is-disabled),
.checkbox-card--card:focus-within:not(.is-disabled) {
  background-color: color-mix(in srgb, white 2.5%, var(--color-surface));
  border-color: var(--color-primary-dark);
}

.checkbox-card--card:active:not(.is-disabled) {
  background-color: color-mix(in srgb, black 2%, var(--color-surface));
}

.checkbox-card--card.is-checked {
  background-color: color-mix(in srgb, var(--color-primary-tint) 45%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
}

.checkbox-card--card.is-checked:hover:not(.is-disabled) {
  background-color: color-mix(in srgb, var(--color-primary-tint) 65%, var(--color-surface));
  border-color: var(--color-primary);
}

/* Muted- & Popover-Variante: Taktile Kachel für dichte Dialoge, Modals und Popover-Menüs */
.checkbox-card--muted,
.checkbox-card--popover {
  padding: var(--space-3);
  margin: var(--space-2) 0;
  background-color: var(--color-hover);
  /* Initial flach (wie Dropdowns/Inputs) - der 3D-Look entsteht erst bei Hover/Fokus */
  background-image: none;
  box-shadow: none;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.checkbox-card--muted:hover:not(.is-disabled),
.checkbox-card--popover:hover:not(.is-disabled),
.checkbox-card--muted:focus-within:not(.is-disabled),
.checkbox-card--popover:focus-within:not(.is-disabled) {
  background-color: color-mix(in srgb, var(--color-primary-tint) 20%, var(--color-hover));
  border-color: var(--color-primary);
}

.checkbox-card--muted:active:not(.is-disabled),
.checkbox-card--popover:active:not(.is-disabled) {
  background-color: color-mix(in srgb, black 3%, var(--color-hover));
}

.checkbox-card--muted.is-checked,
.checkbox-card--popover.is-checked {
  background-color: color-mix(in srgb, var(--color-primary-tint) 45%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-border));
}

.checkbox-card--muted.is-checked:hover:not(.is-disabled),
.checkbox-card--popover.is-checked:hover:not(.is-disabled) {
  background-color: color-mix(in srgb, var(--color-primary-tint) 65%, var(--color-surface));
  border-color: var(--color-primary);
}

/* Row-Variante für kompakte Einbettung in Modals oder dichte Listen */
.checkbox-card--row {
  padding: var(--space-2) 0;
  margin: var(--space-2) 0;
  background: transparent;
  border: none;
}

.checkbox-card--row:hover:not(.is-disabled) .checkbox-card__label {
  color: var(--color-primary);
}

/* Checkbox-Container: Vertikal feinjustiert mit der Text-Grundlinie */
.checkbox-card__control {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding-top: 1px;
}

.checkbox-card__control :deep(.checkbox) {
  width: 24px;
  height: 24px;
  border-width: 2px;
}

.checkbox-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checkbox-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.checkbox-card__icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.checkbox-card__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text);
  transition: color 0.15s ease;
}

.checkbox-card__description {
  margin: 2px 0 0;
  font-size: var(--font-size-xs);
  font-weight: normal;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.checkbox-card__extra {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-left: auto;
}

/* Focus-Visible über Checkbox hebt die Karte hervor */
.checkbox-card:focus-visible,
.checkbox-card:has(:focus-visible) {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

/* Deaktivierter Zustand */
.checkbox-card.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .checkbox-card {
    transition: none !important;
    transform: none !important;
  }
}
</style>

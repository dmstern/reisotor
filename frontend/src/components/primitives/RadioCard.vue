<script setup lang="ts">
import { computed, useId } from 'vue';
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';
import Radio from './Radio.vue';

// RadioCard.vue: Zugängliche Einzelauswahl-Kachel (Pendant zu CheckboxCard.vue).
// Kapselt eine native <Radio>-Steuerung in einer taktilen, gut erkennbaren Kachel
// mit optionaler Icon-Box, Badge-Slot, Beschreibung und einheitlichen Theme-Tokens.
const props = withDefaults(
  defineProps<{
    modelValue?: unknown;
    checked?: unknown;
    value?: unknown;
    disabled?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
    /** Hauptbeschriftung */
    label?: string;
    /** Optionale Detailbeschreibung oder Hilfstext */
    description?: string;
    /** Optionales Icon in einer abgesetzten Squircle-Box */
    icon?: IconDef;
    /**
     * Darstellungsvariante:
     * - 'card': Taktile Kachel mit gut sichtbarem Kontrast-Hintergrund, Rand und 3D-Tiefe
     * - 'muted': Dezente hinterlegte Fläche mit taktilem 3D-Feedback für dichte Dialoge
     * - 'row': Flache Zeile ohne Hintergrund für kompakte Listen
     */
    variant?: 'card' | 'muted' | 'row';
    /** Position des Radio-Indikators innerhalb der Kachel */
    radioPosition?: 'left' | 'right';
    /** Größe des Radio-Indikators */
    radioSize?: 'sm' | 'md' | 'lg';
  }>(),
  {
    disabled: false,
    label: '',
    description: '',
    icon: undefined,
    variant: 'card',
    radioPosition: 'left',
    radioSize: 'sm',
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

  if (props.modelValue !== undefined && props.value !== undefined) {
    return props.modelValue === props.value;
  }

  return Boolean(props.modelValue);
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
    class="radio-card"
    :class="[
      `radio-card--${variant}`,
      `radio-card--radio-${radioPosition}`,
      {
        'is-checked': isChecked,
        'is-disabled': disabled,
      },
    ]"
  >
    <div v-if="icon || $slots.icon" class="radio-card__icon-box" aria-hidden="true">
      <slot name="icon">
        <AppIcon v-if="icon" :icon="icon" :size="20" group="actions" />
      </slot>
    </div>

    <div class="radio-card__body">
      <div class="radio-card__header">
        <span class="radio-card__label">
          <slot name="label">{{ label }}</slot>
        </span>
        <slot name="badge" />
      </div>
      <p v-if="description || $slots.description" class="radio-card__description">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot />
    </div>

    <div v-if="$slots.extra" class="radio-card__extra">
      <slot name="extra" />
    </div>

    <div class="radio-card__control">
      <Radio
        :id="inputId"
        :name="name"
        :model-value="modelValue"
        :checked="checked"
        :value="value"
        :disabled="disabled"
        :size="radioSize"
        :aria-label="ariaLabel || label"
        @update:model-value="onUpdateModel"
        @change="onChange"
      />
    </div>
  </label>
</template>

<style lang="scss" scoped>
.radio-card {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--space-3);
  text-align: left;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  box-sizing: border-box;
  width: 100%;
  transition:
    background-color 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.18s ease,
    box-shadow 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    translate 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Radio-Platzierung links vs. rechts */
.radio-card--radio-left .radio-card__control {
  order: -1;
}

.radio-card--radio-right .radio-card__control {
  order: 10;
  margin-left: auto;
}

/* Card-Variante: Deutlich abgesetzte Fläche + sichtbare Kontrast-Umrandung */
.radio-card--card {
  padding: var(--space-3) var(--space-4);
  background-color: color-mix(in srgb, var(--color-hover) 70%, var(--color-surface));
  background-image: var(--gradient-surface-3d);
  box-shadow: var(--shadow-card);
  border: 1.5px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.radio-card--card:hover:not(.is-disabled),
.radio-card--card:focus-within:not(.is-disabled) {
  background-color: var(--color-hover);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card-hover);
  translate: 0 -1px;
}

.radio-card--card:active:not(.is-disabled) {
  background-color: color-mix(in srgb, black 2%, var(--color-hover));
  box-shadow: var(--shadow-card-active);
  transform: translateY(1px) scale(0.99);
  translate: 0 0;
}

.radio-card--card.is-checked {
  background-color: color-mix(in srgb, var(--color-primary-tint) 60%, var(--color-surface));
  border-color: var(--color-primary);
  box-shadow:
    0 0 0 1px var(--color-primary),
    var(--shadow-card);
}

.radio-card--card.is-checked:hover:not(.is-disabled) {
  background-color: color-mix(in srgb, var(--color-primary-tint) 80%, var(--color-surface));
  border-color: var(--color-primary);
}

/* Muted-Variante: Taktile Kachel für kompakte Dialoge & Popovers */
.radio-card--muted {
  @include control-3d-raised;
  padding: var(--space-3);
  background-color: var(--color-hover);
  border: var(--border-width) solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.radio-card--muted:hover:not(.is-disabled),
.radio-card--muted:focus-within:not(.is-disabled) {
  background-color: color-mix(in srgb, var(--color-primary-tint) 25%, var(--color-hover));
  border-color: var(--color-primary);
}

.radio-card--muted.is-checked {
  background-color: color-mix(in srgb, var(--color-primary-tint) 60%, var(--color-surface));
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

/* Row-Variante: Kompakte Zeile ohne Kachel-Hintergrund */
.radio-card--row {
  padding: var(--space-2) 0;
  background: transparent;
  border: none;
}

.radio-card--row:hover:not(.is-disabled) .radio-card__label {
  color: var(--color-primary);
}

/* Optionale Icon-Box */
.radio-card__icon-box {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border-divider);
  color: var(--color-text-muted);
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}

.radio-card.is-checked .radio-card__icon-box {
  background: color-mix(in srgb, var(--color-primary) 16%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 40%, transparent);
  color: var(--color-primary);
}

.radio-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.radio-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  min-width: 0;
}

.radio-card__label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: var(--line-height-snug);
  color: var(--color-text);
  transition: color 0.15s ease;
}

.radio-card__description {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: normal;
  line-height: var(--line-height-snug);
  color: var(--color-text-muted);
}

.radio-card__extra {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.radio-card__control {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding-top: var(--space-2xs);
}

/* Focus-Visible über das innere Radio-Input hebt die Karte hervor */
.radio-card:focus-visible,
.radio-card:has(:focus-visible) {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.radio-card.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .radio-card,
  .radio-card__icon-box {
    transition: none !important;
    transform: none !important;
  }
}
</style>

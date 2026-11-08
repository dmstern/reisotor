<script setup lang="ts">
import { computed, useId } from 'vue';

// ToggleSwitch.vue: Moderner, zugänglicher Umschalter (Apple-Style Toggle Switch)
// für boolesche Optionen (z. B. "Teil der Urlaubsregion"). Gleitender Knopf (Pille)
// ohne störenden "an/aus"-Text, mit sauberem Fokusring und Barrierefreiheit (role="switch").
const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    disabled?: boolean;
    id?: string;
    name?: string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    ariaDescribedby?: string;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    modelValue: false,
    disabled: false,
    id: undefined,
    name: undefined,
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    ariaDescribedby: undefined,
    size: 'md',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'change', value: boolean): void;
}>();

const autoId = useId();
const switchId = computed(() => props.id || autoId);

function onToggle() {
  if (props.disabled) return;
  const nextValue = !props.modelValue;
  emit('update:modelValue', nextValue);
  emit('change', nextValue);
}
</script>

<template>
  <button
    :id="switchId"
    :name="name"
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="ariaLabel"
    :aria-labelledby="ariaLabelledby"
    :aria-describedby="ariaDescribedby"
    :disabled="disabled"
    class="toggle-switch"
    :class="[
      `toggle-switch--${size}`,
      {
        'is-active': modelValue,
        'is-disabled': disabled,
      },
    ]"
    @click="onToggle"
  >
    <span class="toggle-switch__thumb" aria-hidden="true" />
  </button>
</template>

<style lang="scss" scoped>
.toggle-switch {
  @include touch-target($pseudo: 'before', $expand: true);
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 2px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background-color: color-mix(in srgb, var(--color-text-muted) 28%, var(--color-surface));
  cursor: pointer;
  user-select: none;
  transition:
    background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.15s ease;
}

.toggle-switch--sm {
  width: 34px;
  height: 20px;
}

.toggle-switch--md {
  width: 44px;
  height: 24px;
}

.toggle-switch--lg {
  width: 52px;
  height: 28px;
}

.toggle-switch:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--color-text-muted) 38%, var(--color-surface));
}

.toggle-switch.is-active {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

.toggle-switch.is-active:hover:not(:disabled) {
  background-color: var(--color-primary-dark);
  border-color: var(--color-primary-dark);
}

.toggle-switch__thumb {
  display: block;
  border-radius: var(--radius-pill);
  background-color: #ffffff;
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.28),
    0 1px 1px rgba(0, 0, 0, 0.1);
  transform: translateX(0);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.toggle-switch--sm .toggle-switch__thumb {
  width: 14px;
  height: 14px;
}

.toggle-switch--md .toggle-switch__thumb {
  width: 18px;
  height: 18px;
}

.toggle-switch--lg .toggle-switch__thumb {
  width: 22px;
  height: 22px;
}

.toggle-switch--sm.is-active .toggle-switch__thumb {
  transform: translateX(14px);
}

.toggle-switch--md.is-active .toggle-switch__thumb {
  transform: translateX(20px);
}

.toggle-switch--lg.is-active .toggle-switch__thumb {
  transform: translateX(24px);
}

.toggle-switch:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.toggle-switch.is-disabled,
.toggle-switch:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

@media (forced-colors: active) {
  .toggle-switch {
    border: 2px solid CanvasText;
  }

  .toggle-switch.is-active {
    border-color: Highlight;
  }

  .toggle-switch__thumb {
    background-color: CanvasText;
  }

  .toggle-switch.is-active .toggle-switch__thumb {
    background-color: Highlight;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toggle-switch,
  .toggle-switch__thumb {
    transition: none !important;
  }
}
</style>

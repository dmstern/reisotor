<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from './Button.vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';

const props = withDefaults(
  defineProps<{
    modelValue?: boolean;
    open?: boolean;
    openInitial?: boolean;
    label?: string;
    count?: string | number;
    icon?: IconDef;
    iconGroup?: IconGroup;
    contentClass?: string;
    disabled?: boolean;
    title?: string;
  }>(),
  {
    modelValue: undefined,
    open: undefined,
    openInitial: false,
    label: '',
    count: undefined,
    icon: undefined,
    iconGroup: 'actions',
    contentClass: undefined,
    disabled: false,
    title: undefined,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'update:open', value: boolean): void;
  (e: 'toggle', value: boolean): void;
}>();

const internalOpen = ref(props.openInitial ?? false);

const isOpen = computed({
  get: () => {
    if (props.modelValue !== undefined) {
      return props.modelValue;
    }

    if (props.open !== undefined) {
      return props.open;
    }

    return internalOpen.value;
  },
  set: (val: boolean) => {
    internalOpen.value = val;
    emit('update:modelValue', val);
    emit('update:open', val);
    emit('toggle', val);
  },
});

function toggle() {
  if (props.disabled) {
    return;
  }

  isOpen.value = !isOpen.value;
}
</script>

<template>
  <fieldset
    class="collapsible-fieldset"
    :class="{ 'is-open': isOpen, 'is-closed': !isOpen, 'is-disabled': disabled }"
  >
    <legend :title="title">
      <Button
        type="button"
        variant="secondary"
        surface="opaque"
        shape="pill"
        size="sm"
        class="collapsible-toggle"
        :aria-expanded="isOpen"
        :disabled="disabled"
        :title="title"
        @click="toggle"
      >
        <span class="label-inner">
          <AppIcon v-if="icon" :icon="icon" :size="14" :group="iconGroup" />
          <slot name="label">
            <span>{{ label }}</span>
          </slot>
          <slot name="badge" />
          <slot name="count">
            <span v-if="count !== undefined && count !== ''" class="picker-count">{{ count }}</span>
          </slot>
        </span>
        <AppIcon
          :icon="ACTION_ICONS.chevronDown"
          :size="14"
          group="actions"
          class="caret"
          :class="{ open: isOpen }"
        />
      </Button>
    </legend>

    <div class="collapsible-anim-wrapper" :class="{ 'is-open': isOpen }" :aria-hidden="!isOpen">
      <div class="collapsible-anim-inner">
        <div class="collapsible-content" :class="contentClass">
          <slot />
        </div>
      </div>
    </div>
  </fieldset>
</template>

<style scoped lang="scss">
.collapsible-fieldset {
  @include surface-sunken-box;
  padding: var(--space-2) var(--space-3) var(--space-3);
  margin: var(--space-2) 0;
  min-inline-size: 0;
  max-inline-size: 100%;
  box-sizing: border-box;
  transition:
    border-color 0.22s ease,
    background-color 0.22s ease,
    padding 0.26s cubic-bezier(0.32, 0.72, 0, 1),
    margin 0.26s cubic-bezier(0.32, 0.72, 0, 1);
}

.collapsible-fieldset.is-closed {
  border-color: transparent;
  background: transparent;
  padding: 0;
  margin: var(--space-1) 0;
}

.collapsible-fieldset legend {
  padding: 0;
  margin: 0;
}

.collapsible-toggle {
  padding-inline: 14px;
  font-weight: 500;
  color: var(--color-text);
  border-width: var(--border-width);
  border-color: var(--color-border-strong);
}

.collapsible-fieldset.is-disabled legend {
  cursor: not-allowed;
}

.label-inner {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.picker-count {
  font-size: var(--font-size-sm);
  font-weight: 400;
  color: var(--color-text-muted);
}

.caret {
  flex-shrink: 0;
  transition: var(--transition-caret, transform 0.24s cubic-bezier(0.34, 1.4, 0.64, 1));
}

.caret.open {
  transform: rotate(180deg);
}

/* ==========================================================================
   Smooth CSS Grid 0fr <-> 1fr Animation
   ========================================================================== */
.collapsible-anim-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  min-width: 0;
  max-width: 100%;
  transition: var(
    --transition-accordion-close,
    grid-template-rows 0.26s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease
  );
  opacity: 0;
  visibility: hidden;
}

.collapsible-anim-wrapper:not(.is-open) {
  overflow: hidden;
}

.collapsible-anim-wrapper.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition: var(
    --transition-accordion-open,
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.25s ease
  );
}

.collapsible-anim-inner {
  min-height: 0;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  /* 4px Padding + -4px Margin reservieren Platz für Fokus-Rahmen von Kind-Elementen (z. B. Input-Felder
     mit 2px outline + 1px outline-offset = 3px), damit diese an den Rändern nicht durch overflow: hidden
     abgeschnitten werden, während der visuelle Inhalt exakt ausgerichtet bleibt. */
  padding: var(--space-xs) 0;
  margin: calc(-1 * var(--space-xs)) 0;
  transition: overflow 0s 0s;
}

.collapsible-anim-wrapper.is-open .collapsible-anim-inner {
  overflow: visible;
  transition: overflow 0s var(--duration-accordion-open, 0.35s) allow-discrete;
}

.collapsible-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
  min-width: 0;
  max-width: 100%;
}

@media (prefers-reduced-motion: reduce) {
  .collapsible-fieldset,
  .caret,
  .collapsible-anim-wrapper,
  .collapsible-anim-inner,
  .collapsible-anim-wrapper.is-open .collapsible-anim-inner {
    transition: none !important;
  }
}
</style>

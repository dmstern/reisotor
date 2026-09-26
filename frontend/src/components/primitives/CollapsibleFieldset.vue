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
    if (props.modelValue !== undefined) return props.modelValue;
    if (props.open !== undefined) return props.open;
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
  isOpen.value = !isOpen.value;
}
</script>

<template>
  <fieldset class="collapsible-fieldset" :class="{ 'is-open': isOpen, 'is-closed': !isOpen }">
    <legend>
      <Button
        type="button"
        variant="ghost"
        class="collapsible-toggle"
        :aria-expanded="isOpen"
        @click="toggle"
      >
        <span class="label-inner">
          <AppIcon v-if="icon" :icon="icon" :size="14" :group="iconGroup" />
          <slot name="label">
            <span>{{ label }}</span>
          </slot>
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

<style scoped>
.collapsible-fieldset {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: var(--space-2) var(--space-3) var(--space-3);
  margin: var(--space-2) 0;
  background: var(--color-bg);
  min-inline-size: auto;
  transition:
    border-color 0.22s ease,
    background-color 0.22s ease,
    padding 0.26s cubic-bezier(0.32, 0.72, 0, 1),
    margin 0.26s cubic-bezier(0.32, 0.72, 0, 1);
}

.collapsible-fieldset.is-closed {
  border-color: transparent;
  background: transparent;
  padding-top: 0;
  padding-bottom: 0;
  margin: var(--space-1) 0;
}

.collapsible-fieldset legend {
  padding: 0 var(--space-1);
  margin: 0;
}

.collapsible-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  background: var(--color-surface) !important;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  box-shadow: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.collapsible-toggle:hover {
  background: var(--color-hover) !important;
}

.label-inner {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.picker-count {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--color-text-muted);
}

.caret {
  flex-shrink: 0;
  transition: transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1);
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
  transition:
    grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.22s ease;
  opacity: 0;
  visibility: hidden;
}

.collapsible-anim-wrapper.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
}

.collapsible-anim-inner {
  overflow: hidden;
  /* 4px Padding + -4px Margin reservieren Platz für Fokus-Rahmen von Kind-Elementen (z. B. Input-Felder
     mit 2px outline + 1px outline-offset = 3px), damit diese an den Rändern nicht durch overflow: hidden
     abgeschnitten werden, während der visuelle Inhalt exakt ausgerichtet bleibt. */
  padding: var(--space-1, 4px);
  margin: calc(-1 * var(--space-1, 4px));
}

.collapsible-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

@media (prefers-reduced-motion: reduce) {
  .collapsible-fieldset,
  .caret,
  .collapsible-anim-wrapper {
    transition: none !important;
  }
}
</style>

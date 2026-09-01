<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';
import AppIcon from '../AppIcon.vue';

const props = withDefaults(
  defineProps<{
    /** Beschriftung des Menüeintrags (alternativ Standard-Slot) */
    label?: string;
    /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
    icon?: IconDef;
    /** Icon-Gruppe für AppIcon (Standard: 'actions') */
    iconGroup?: IconGroup;
    /** Icon-Größe in Pixeln (Standard: 14) */
    iconSize?: number;
    /** Ob der Menüeintrag als aktiv/ausgewählt markiert ist */
    active?: boolean;
    /** Deaktiviert-Zustand */
    disabled?: boolean;
    /** Ziel-URL, falls der Eintrag als Link <a> gerendert werden soll */
    href?: string;
    /** Link-Ziel (z. B. '_blank') */
    target?: string;
    /** Link-Rel (z. B. 'noopener') */
    rel?: string;
    /** Multiselect-Modus mit Checkbox (<label for="auto-id-1788301175442-17"> statt <button>/<a>) */
    multiselect?: boolean;
    /** Checkbox-Zustand für Multiselect */
    checked?: boolean;
    /** Wert für Checkbox */
    value?: unknown;
  }>(),
  {
    iconGroup: 'actions',
    iconSize: 14,
    active: false,
    disabled: false,
    multiselect: false,
    checked: false,
  }
);

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
  (e: 'update:checked', value: boolean): void;
}>();

function handleClick(event: MouseEvent) {
  if (props.disabled) {
    event.preventDefault();
    return;
  }
  emit('click', event);
}
</script>

<template>
  <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
  <label
    v-if="multiselect"
    class="dropdown-item"
    :class="{ 'is-active': active, 'is-disabled': disabled }"
  >
    <slot name="checkbox">
      <input
        id="auto-id-1788301175442-17"
        type="checkbox"
        :checked="checked"
        :disabled="disabled"
        :value="value"
        @change="$emit('update:checked', ($event.target as HTMLInputElement).checked)"
      />
    </slot>
    <AppIcon
      v-if="icon"
      :icon="icon"
      :group="iconGroup"
      :size="iconSize"
      class="dropdown-item-icon"
    />
    <span class="dropdown-item-label">
      <slot>{{ label }}</slot>
    </span>
  </label>
  <a
    v-else-if="href"
    :href="href"
    :target="target"
    :rel="rel"
    class="dropdown-item"
    :class="{ 'is-active': active, 'is-disabled': disabled }"
    @click="handleClick"
  >
    <AppIcon
      v-if="icon"
      :icon="icon"
      :group="iconGroup"
      :size="iconSize"
      class="dropdown-item-icon"
    />
    <span class="dropdown-item-label">
      <slot>{{ label }}</slot>
    </span>
  </a>
  <button
    v-else
    type="button"
    :disabled="disabled"
    class="dropdown-item"
    :class="{ 'is-active': active, 'is-disabled': disabled }"
    @click="handleClick"
  >
    <AppIcon
      v-if="icon"
      :icon="icon"
      :group="iconGroup"
      :size="iconSize"
      class="dropdown-item-icon"
    />
    <span class="dropdown-item-label">
      <slot>{{ label }}</slot>
    </span>
  </button>
</template>

<style scoped>
.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.3;
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  user-select: none;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.dropdown-item:hover:not(.is-disabled) {
  background: var(--color-hover);
}

.dropdown-item.is-active {
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  font-weight: 600;
}

.dropdown-item.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropdown-item-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dropdown-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-item input[type='checkbox'] {
  margin: 0;
  flex-shrink: 0;
}
</style>

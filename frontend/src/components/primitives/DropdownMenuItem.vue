<script setup lang="ts">
import { computed, useId } from 'vue';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';
import AppIcon from '../AppIcon.vue';
import Checkbox from './Checkbox.vue';

// DropdownMenuItem-Primitive: Wiederverwendbarer Menüeintrag für PickerMenu.vue / DropdownMenu.vue (Issue #721).
// Unterstützt Buttons, Links (<a>) und Multiselect-Checkbox-Zeilen mit konsistentem Hover-, Fokus- und Active-Styling.

const generatedInputId = useId();

const props = withDefaults(
  defineProps<{
    /** Beschriftung des Menüeintrags (alternativ Standard-Slot) */
    label?: string;
    /** Optionale IconDef-Definition für Tabler-Icon Rendering via AppIcon.vue */
    icon?: IconDef;
    /** Icon-Gruppe für AppIcon (Standard: 'actions') */
    iconGroup?: IconGroup;
    /** Optionales Erzwingen des Icon-Stils ('icons' oder 'emoji') */
    iconForceStyle?: 'icons' | 'emoji';
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
    /** Multiselect-Modus mit Checkbox (<label :for="resolvedInputId"> statt <button>/<a>) */
    multiselect?: boolean;
    /** Optionale explizite ID für die Multiselect-Checkbox */
    inputId?: string;
    /** Checkbox-Zustand für Multiselect */
    checked?: boolean;
    /** Wert für Checkbox */
    value?: unknown;
    /** Optionale IconDef-Definition für nachgestelltes Icon (z. B. Häkchen bei ausgewählter Option) */
    trailingIcon?: IconDef;
    /** Icon-Gruppe für nachgestelltes Icon (Standard: 'actions') */
    trailingIconGroup?: IconGroup;
    /** Optionale Icon-Größe für nachgestelltes Icon in Pixeln (Standard: 14) */
    trailingIconSize?: number;
    /** Tooltip / Mouseover-Text */
    title?: string;
  }>(),
  {
    iconGroup: 'actions',
    iconSize: 14,
    trailingIconGroup: 'actions',
    trailingIconSize: 14,
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

const resolvedInputId = computed(() => props.inputId || generatedInputId);

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
    :for="resolvedInputId"
    :title="title"
    class="dropdown-item dropdown-item--multiselect"
    :class="{ 'is-active': active, 'is-disabled': disabled }"
  >
    <slot name="checkbox">
      <Checkbox
        :id="resolvedInputId"
        :checked="checked"
        :disabled="disabled"
        :value="value"
        @change="$emit('update:checked', ($event.target as HTMLInputElement).checked)"
      />
    </slot>
    <div class="dropdown-item-body">
      <div class="dropdown-item-main">
        <span class="dropdown-item-title-row">
          <AppIcon
            v-if="icon"
            :icon="icon"
            :group="iconGroup"
            :force-style="iconForceStyle"
            :size="iconSize"
            :active="active"
            class="dropdown-item-icon"
          />
          <span class="dropdown-item-label">
            <slot>{{ label }}</slot>
          </span>
        </span>
        <span v-if="$slots.subtitle" class="dropdown-item-subtitle">
          <slot name="subtitle" />
        </span>
      </div>
      <div v-if="$slots.trailing || trailingIcon" class="dropdown-item-trailing">
        <slot name="trailing">
          <AppIcon
            v-if="trailingIcon"
            :icon="trailingIcon"
            :group="trailingIconGroup"
            :size="trailingIconSize"
            :active="active"
            class="dropdown-item-trailing-icon"
          />
        </slot>
      </div>
    </div>
  </label>
  <a
    v-else-if="href"
    :href="href"
    :target="target"
    :rel="rel"
    :title="title"
    class="dropdown-item"
    :class="{ 'is-active': active, 'is-disabled': disabled }"
    @click="handleClick"
  >
    <AppIcon
      v-if="icon"
      :icon="icon"
      :group="iconGroup"
      :force-style="iconForceStyle"
      :size="iconSize"
      :active="active"
      class="dropdown-item-icon"
    />
    <span class="dropdown-item-label">
      <slot>{{ label }}</slot>
    </span>
    <slot name="trailing">
      <AppIcon
        v-if="trailingIcon"
        :icon="trailingIcon"
        :group="trailingIconGroup"
        :size="trailingIconSize"
        :active="active"
        class="dropdown-item-trailing-icon"
      />
    </slot>
  </a>
  <button
    v-else
    type="button"
    :disabled="disabled"
    :title="title"
    class="dropdown-item"
    :class="{ 'is-active': active, 'is-disabled': disabled }"
    @click="handleClick"
  >
    <AppIcon
      v-if="icon"
      :icon="icon"
      :group="iconGroup"
      :force-style="iconForceStyle"
      :size="iconSize"
      :active="active"
      class="dropdown-item-icon"
    />
    <span class="dropdown-item-label">
      <slot>{{ label }}</slot>
    </span>
    <slot name="trailing">
      <AppIcon
        v-if="trailingIcon"
        :icon="trailingIcon"
        :group="trailingIconGroup"
        :size="trailingIconSize"
        :active="active"
        class="dropdown-item-trailing-icon"
      />
    </slot>
  </button>
</template>

<style scoped lang="scss">
.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-2);
  width: 100%;
  min-height: 44px;
  padding: 10px var(--space-md);
  border: none;
  background: transparent;
  border-radius: var(--control-radius-sm);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  line-height: var(--line-height-snug);
  text-decoration: none;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  user-select: none;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    transform 0.12s cubic-bezier(0.2, 0.8, 0.4, 1);
}

@include can-hover {
  .dropdown-item:hover:not(.is-disabled) {
    background: var(--color-menu-item-hover);
  }
}

.dropdown-item:active:not(.is-disabled) {
  background: var(--color-menu-item-active);
  transform: scale(0.99);
}

.dropdown-item:focus-visible,
.dropdown-item--multiselect:has(:focus-visible) {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: -3px;
}

.dropdown-item.is-active {
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  font-weight: 600;
}

@include can-hover {
  .dropdown-item.is-active:hover:not(.is-disabled) {
    background: var(--color-control-active-tint-hover);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dropdown-item:active:not(.is-disabled) {
    transform: none;
  }
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

.dropdown-item-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs) var(--space-sm);
  flex: 1;
  min-width: 0;
}

.dropdown-item-main {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  flex: 1;
  min-width: 0;
}

.dropdown-item-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.dropdown-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-item-subtitle {
  font-size: var(--font-size-xs);
  font-weight: 400;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  line-height: var(--line-height-snug);
}

.dropdown-item-trailing {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1-5);
  flex-shrink: 0;
  max-width: 100%;
}

@include container-down('mobile-sm') {
  .dropdown-item-body {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2xs);
  }

  .dropdown-item-main {
    flex: none;
    width: 100%;
  }
}

.dropdown-item-trailing-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  color: var(--color-primary);
}
</style>

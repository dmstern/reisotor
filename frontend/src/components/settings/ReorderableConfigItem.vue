<script setup lang="ts">
import IconButton from '../primitives/IconButton.vue';
import Checkbox from '../primitives/Checkbox.vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';

withDefaults(
  defineProps<{
    itemKey: string;
    label: string;
    visible: boolean;
    icon?: IconDef | null;
    iconGroup?: IconGroup;
    index: number;
    total: number;
    idPrefix: string;
    rowClass?: string;
    checkboxAriaLabel?: string;
  }>(),
  {
    icon: undefined,
    iconGroup: 'navigation',
    rowClass: 'nav-config-row',
    checkboxAriaLabel: undefined,
  }
);

const emit = defineEmits<{
  (e: 'move-up'): void;
  (e: 'move-down'): void;
  (e: 'toggle-visible', visible: boolean): void;
}>();
</script>

<template>
  <li :class="[rowClass, { disabled: !visible }]">
    <AppIcon v-if="icon" class="nav-config-icon" :icon="icon" :group="iconGroup" />
    <span class="nav-config-label" :class="{ hidden: !visible }">{{ label }}</span>
    <div class="nav-config-actions">
      <IconButton
        variant="ghost"
        size="sm"
        :disabled="index === 0"
        aria-label="Nach oben verschieben"
        title="Nach oben verschieben"
        @click="emit('move-up')"
      >
        <AppIcon :icon="ACTION_ICONS.chevronUp" :size="14" group="actions" />
      </IconButton>
      <IconButton
        variant="ghost"
        size="sm"
        :disabled="index === total - 1"
        aria-label="Nach unten verschieben"
        title="Nach unten verschieben"
        @click="emit('move-down')"
      >
        <AppIcon :icon="ACTION_ICONS.chevronDown" :size="14" group="actions" />
      </IconButton>
      <label :for="idPrefix + itemKey" class="nav-config-visible">
        <Checkbox
          :id="idPrefix + itemKey"
          :checked="visible"
          :aria-label="checkboxAriaLabel ?? `${label} anzeigen`"
          @change="emit('toggle-visible', ($event.target as HTMLInputElement).checked)"
        />
      </label>
    </div>
  </li>
</template>

<style scoped lang="scss">
li {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  @include divider-engraved-row;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }
}

.nav-config-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4em;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.nav-config-label {
  flex: 1;
  min-width: 0;
  overflow-wrap: break-word;
}

.nav-config-label.hidden {
  color: var(--color-text-muted);
  text-decoration: line-through;
}

.nav-config-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-shrink: 0;
}

.nav-config-visible {
  display: flex;
  align-items: center;
  margin-left: var(--space-sm);
  flex-shrink: 0;
}
</style>

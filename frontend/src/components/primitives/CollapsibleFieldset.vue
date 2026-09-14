<script setup lang="ts">
import { ref } from 'vue';
import Button from './Button.vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';

const props = defineProps<{
  label: string;
  icon?: IconDef;
  iconGroup?: IconGroup;
  openInitial?: boolean;
}>();

const open = ref(props.openInitial ?? false);
</script>

<template>
  <fieldset class="collapsible-fieldset">
    <legend>
      <Button
        type="button"
        variant="ghost"
        class="collapsible-toggle"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="label-inner">
          <AppIcon v-if="icon" :icon="icon" :size="14" :group="iconGroup ?? 'actions'" />
          {{ label }}
        </span>
        <AppIcon
          :icon="ACTION_ICONS.chevronDown"
          :size="14"
          group="actions"
          class="caret"
          :class="{ open: open }"
        />
      </Button>
    </legend>
    <div v-if="open" class="collapsible-content">
      <slot />
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
}

.collapsible-fieldset:not(:has(.collapsible-content)) {
  border-color: transparent;
  background: transparent;
  padding: 0;
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
  color: var(--color-text-muted);
}

.label-inner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.caret {
  transition: transform 0.2s ease;
}

.caret.open {
  transform: rotate(180deg);
}

.collapsible-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-1);
}
</style>

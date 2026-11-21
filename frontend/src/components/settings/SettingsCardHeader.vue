<script setup lang="ts">
import Button from '../primitives/Button.vue';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import type { IconDef } from '../../utils/icon';
import type { IconGroup } from '../../stores/iconStyle';

withDefaults(
  defineProps<{
    title: string;
    icon?: IconDef;
    iconGroup?: IconGroup;
    iconSize?: number;
    showReset?: boolean;
    isDefault?: boolean;
    resetTitle?: string;
  }>(),
  {
    icon: undefined,
    iconGroup: 'navigation',
    iconSize: 20,
    showReset: false,
    isDefault: false,
    resetTitle: undefined,
  }
);

defineEmits<{
  (e: 'reset'): void;
}>();
</script>

<template>
  <div class="card-header-row">
    <h2>
      <AppIcon v-if="icon" :icon="icon" :group="iconGroup" :size="iconSize" />
      {{ title }}
    </h2>
    <Button
      v-if="showReset"
      variant="ghost"
      size="sm"
      :icon="ACTION_ICONS.restore"
      :disabled="isDefault"
      aria-label="Auf Standard zurücksetzen"
      :title="resetTitle ?? (isDefault ? 'Bereits auf Standard' : 'Auf Standard zurücksetzen')"
      class="card-reset-btn"
      @click="$emit('reset')"
    >
      <span class="card-reset-btn-label">Zurücksetzen</span>
    </Button>
    <slot name="actions" />
  </div>
</template>

<style lang="scss" scoped>
.card-header-row {
  container-type: inline-size;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.card-header-row h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  word-break: break-word;
}

.card-reset-btn {
  flex-shrink: 0;
}

@include container-down('mobile-compact') {
  .card-reset-btn-label {
    display: none;
  }
}
</style>

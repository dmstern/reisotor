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

<style scoped>
.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.card-header-row h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  word-break: break-word;
}

@container app-main (max-width: 420px) {
  .card-reset-btn-label {
    display: none;
  }
}
@media (max-width: 420px) {
  .card-reset-btn-label {
    display: none;
  }
}
</style>

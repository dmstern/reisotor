<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

withDefaults(
  defineProps<{
    severity?: 'warning' | 'danger';
    title?: string;
    description?: string;
  }>(),
  {
    severity: 'warning',
    title: '',
    description: '',
  }
);
</script>

<template>
  <div class="weather-alert-card" :class="`weather-alert-card--${severity}`">
    <AppIcon :icon="ACTION_ICONS.warning" :size="18" group="actions" />
    <div class="weather-alert-card__alert-content">
      <strong v-if="title">{{ title }}</strong>
      <slot>
        <span v-if="description">{{ description }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.weather-alert-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  font-size: 0.85rem;
}

.weather-alert-card--warning {
  background: var(--color-warning-tint);
  color: var(--color-warning-dark);
  border: 1px solid var(--color-warning);
}

.weather-alert-card--danger {
  background: var(--color-danger-tint);
  color: var(--color-danger-dark);
  border: 1px solid var(--color-danger);
}

.weather-alert-card__alert-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.weather-alert-card__alert-content strong {
  font-size: 0.85rem;
  font-weight: 600;
}
</style>

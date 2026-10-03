<script setup lang="ts">
import { computed } from 'vue';
import type { IconDef } from '../../utils/icon';
import { ACTION_ICONS } from '../../utils/actionIcons';
import AppIcon from '../AppIcon.vue';

export type AlertVariant = 'info' | 'warning' | 'success' | 'danger' | 'neutral';

const props = withDefaults(
  defineProps<{
    variant?: AlertVariant;
    size?: 'sm' | 'md';
    title?: string;
    description?: string;
    icon?: IconDef | boolean;
  }>(),
  {
    variant: 'info',
    size: 'md',
    title: '',
    description: '',
    icon: true,
  }
);

const resolvedIcon = computed<IconDef | null>(() => {
  if (props.icon === false) return null;
  if (typeof props.icon === 'object') return props.icon;
  switch (props.variant) {
    case 'warning':
      return ACTION_ICONS.warning;
    case 'danger':
      return ACTION_ICONS.warning;
    case 'success':
      return ACTION_ICONS.done;
    case 'info':
      return ACTION_ICONS.info;
    case 'neutral':
    default:
      return null;
  }
});
</script>

<template>
  <div class="alert" :class="[`alert--${variant}`, `alert--${size}`]" role="status">
    <div class="alert__main">
      <slot name="icon">
        <span v-if="resolvedIcon" class="alert__icon">
          <AppIcon :icon="resolvedIcon" :size="size === 'sm' ? 15 : 18" group="actions" />
        </span>
      </slot>
      <div class="alert__content">
        <slot name="title">
          <strong v-if="title" class="alert__title">{{ title }}</strong>
        </slot>
        <div v-if="$slots.default || description" class="alert__desc">
          <slot>{{ description }}</slot>
        </div>
      </div>
    </div>
    <div v-if="$slots.actions" class="alert__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
  line-height: 1.4;
  border: 1px solid var(--color-border);
}

.alert--sm {
  padding: 6px 10px;
  font-size: 0.75rem;
}

.alert--md {
  padding: 10px 14px;
  font-size: 0.8125rem;
}

.alert__main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.alert__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.alert__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.alert__title {
  font-weight: 600;
  font-size: inherit;
  color: inherit;
}

.alert__desc {
  color: inherit;
  line-height: 1.45;
}

.alert__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* Varianten – nutzen konsequent Design-Tokens für Light & Dark Mode */
.alert--warning {
  background: var(--color-warning-tint);
  border-color: var(--color-warning);
  color: var(--color-warning-dark);
}

.alert--warning .alert__icon {
  color: var(--color-warning);
}

.alert--danger {
  background: var(--color-danger-tint);
  border-color: var(--color-danger);
  color: var(--color-danger-dark);
}

.alert--danger .alert__icon {
  color: var(--color-danger);
}

.alert--success {
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
  color: var(--color-text);
}

.alert--success .alert__icon {
  color: var(--color-success);
}

.alert--info {
  background: var(--color-primary-tint);
  border-color: color-mix(in srgb, var(--color-primary) 35%, transparent);
  color: var(--color-text);
}

.alert--info .alert__icon {
  color: var(--color-primary);
}

.alert--neutral {
  background: var(--color-hover);
  border-color: var(--color-border);
  color: var(--color-text-muted);
}

.alert--neutral .alert__icon {
  color: var(--color-text-muted);
}
</style>

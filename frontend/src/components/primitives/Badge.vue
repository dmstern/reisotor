<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?:
      'default' | 'primary' | 'success' | 'danger' | 'accent' | 'warning' | 'accent-secondary';
    size?: 'sm' | 'md';
  }>(),
  {
    variant: 'default',
    size: 'sm',
  }
);
</script>

<template>
  <span class="badge" :class="[`badge--${variant}`, `badge--size-${size}`]">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 600;
  border-radius: var(--radius-pill);
  line-height: 1.2;
  white-space: nowrap;
  background: var(--color-hover);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.badge--size-sm {
  padding: 2px 8px;
  font-size: var(--font-size-xs);
}

.badge--size-md {
  padding: 4px 10px;
  font-size: 0.85rem;
}

.badge--primary {
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  border-color: transparent;
}

.badge--success {
  background: var(--color-primary-tint);
  color: var(--color-success);
  border-color: transparent;
}

.badge--danger {
  background: var(--color-danger-tint);
  color: var(--color-danger);
  border-color: transparent;
}

.badge--accent {
  background: var(--color-highlight);
  color: var(--color-accent);
  border-color: var(--color-highlight-border);
}

.badge--warning {
  background: var(--color-warning-tint);
  color: var(--color-warning-dark);
  border-color: transparent;
}

.badge--accent-secondary {
  background: var(--color-accent-secondary-bg);
  color: var(--color-accent-secondary);
  border-color: transparent;
}
</style>

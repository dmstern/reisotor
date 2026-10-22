<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?:
      | 'default'
      | 'primary'
      | 'success'
      | 'danger'
      | 'accent'
      | 'warning'
      | 'accent-secondary'
      | 'custom';
    size?: 'sm' | 'md';
    as?: string;
    interactive?: boolean;
  }>(),
  {
    variant: 'default',
    size: 'sm',
    as: 'span',
    interactive: false,
  }
);
</script>

<template>
  <component
    :is="as"
    class="badge"
    :class="[
      `badge--${variant}`,
      `badge--size-${size}`,
      { 'badge--interactive': interactive || as === 'button' },
    ]"
    :type="as === 'button' ? 'button' : undefined"
  >
    <slot />
  </component>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: inherit;
  font-weight: 600;
  border-radius: var(--radius-pill);
  line-height: 1.2;
  white-space: nowrap;
  background: var(--color-hover);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  margin: 0;
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
  color: var(--color-danger-dark, var(--color-danger));
  border-color: transparent;
}

.badge--accent {
  background: var(--color-highlight);
  color: var(--color-accent-dark, var(--color-accent));
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

.badge--custom {
  background: var(--badge-bg, var(--color-hover));
  color: var(--badge-color, var(--color-text));
  border-color: var(--badge-border, transparent);
}

.badge--interactive {
  cursor: pointer;
  text-align: left;
  user-select: none;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.badge--interactive:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.badge--interactive:active {
  transform: translateY(0);
}

.badge--interactive:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>

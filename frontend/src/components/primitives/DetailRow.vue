<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string;
    tag?: string;
  }>(),
  {
    label: '',
    tag: 'p',
  }
);
</script>

<template>
  <component :is="tag" class="detail-row">
    <slot name="label">
      <span v-if="label" class="detail-label">{{ label }}</span>
    </slot>
    <slot />
  </component>
</template>

<style>
.detail-row {
  margin: 0 0 var(--space-2);
  font-size: 0.92rem;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
</style>

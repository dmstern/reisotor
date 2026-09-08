<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: string;
  }>(),
  {
    tag: 'span',
  }
);
</script>

<template>
  <component :is="tag" class="kicker">
    <slot />
  </component>
</template>

<style scoped>
.kicker {
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
  display: block;
}
</style>

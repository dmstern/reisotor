<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: string;
  }>(),
  {
    tag: 'p',
  }
);
</script>

<template>
  <component :is="tag" class="empty">
    <slot />
  </component>
</template>

<style>
.empty {
  color: var(--color-text-muted);
  padding: var(--space-4);
  text-align: center;
}
</style>

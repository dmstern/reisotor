<script setup lang="ts">
withDefaults(
  defineProps<{
    tag?: string;
  }>(),
  {
    tag: 'div',
  }
);
</script>

<template>
  <component :is="tag" class="page">
    <slot />
  </component>
</template>

<style>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-4);
  padding-bottom: calc(var(--navbar-bottom-offset, 88px) + var(--space-4));
}
</style>

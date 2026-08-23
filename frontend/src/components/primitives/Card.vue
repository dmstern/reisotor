<template>
  <div class="r-pr-card" v-bind="$attrs">
    <slot />
  </div>
</template>

<script setup lang="ts">
// Minimal surface/card primitive
</script>

<style scoped>
.r-pr-card {
  background: var(--color-surface, #fff);
  color: var(--color-on-surface, #222);
  border-radius: var(--radius-md, 8px);
  padding: 1rem;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05));
}
</style>

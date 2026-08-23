<template>
  <button class="r-pr-button" :class="variant" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup lang="ts">
// Minimal primitive button — uses CSS tokens from /src/style.css
defineProps({
  variant: { type: String, default: 'primary' }
})
</script>

<style scoped>
.r-pr-button {
  font: inherit;
  border: none;
  border-radius: var(--radius-md, 8px);
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.r-pr-button.primary {
  background: var(--color-primary, #4a3aa7);
  color: var(--color-on-primary, #fff);
}
.r-pr-button.ghost {
  background: transparent;
  color: var(--color-text, #222);
  border: 1px solid var(--color-surface-muted, rgba(0,0,0,0.06));
}
</style>

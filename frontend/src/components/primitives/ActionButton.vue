<template>
  <button class="r-pr-action" :class="variant" v-bind="$attrs">
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps({ variant: { type: String, default: 'primary' } });
</script>

<style scoped>
.r-pr-action {
  height: 40px;
  padding: 0 12px;
  border-radius: var(--radius-md, 16px);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}
.r-pr-action.primary { background: var(--color-primary, #4a3aa7); color: var(--color-on-primary, #fff); }
.r-pr-action.ghost { background: transparent; color: var(--color-text, #222); border-color: var(--color-border-strong, rgba(0,0,0,0.06)); }
</style>

<script setup lang="ts">
import LoadingSpinner from './primitives/LoadingSpinner.vue';

withDefaults(
  defineProps<{
    message?: string;
  }>(),
  {
    message: 'Lädt…',
  }
);
</script>

<template>
  <div class="view-loading" role="status" aria-live="polite">
    <LoadingSpinner size="lg" />
    <span class="text">{{ message }}</span>
  </div>
</template>

<style scoped>
.view-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
  color: var(--color-text-muted);
}
</style>

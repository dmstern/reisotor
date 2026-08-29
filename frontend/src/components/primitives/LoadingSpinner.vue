<script setup lang="ts">
// LoadingSpinner-Primitive für rotierende Lade-Indikatoren – siehe Issue #239 / PR Feedback.

withDefaults(
  defineProps<{
    /** Spinner-Größe: 'sm' (14px), 'md' (20px), 'lg' (28px). */
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    size: 'md',
  }
);
</script>

<template>
  <span class="spinner" :class="`spinner--${size}`" role="status" aria-label="Lädt…" />
</template>

<style scoped>
.spinner {
  display: inline-block;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
  box-sizing: border-box;
}

.spinner--sm {
  width: 14px;
  height: 14px;
  border-width: 2px;
}

.spinner--md {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.spinner--lg {
  width: 28px;
  height: 28px;
  border-width: 3px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>

<script setup lang="ts">
export type DividerSpacing = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl';

withDefaults(
  defineProps<{
    /**
     * Vertikaler Außenabstand (margin-block) ober- und unterhalb der Trennlinie.
     * In Flex-/Grid-Containern mit `gap` empfiehlt sich der Standard `'none'`.
     */
    spacing?: DividerSpacing;
  }>(),
  {
    spacing: 'none',
  }
);
</script>

<template>
  <hr class="divider" :class="`divider--spacing-${spacing}`" />
</template>

<style lang="scss" scoped>
.divider {
  display: block;
  width: 100%;
  height: 0;
  margin: 0;
  border: none;
  flex-shrink: 0;
  @include divider-engraved('bottom');
}

.divider--spacing-xs {
  margin-block: var(--space-xs);
}

.divider--spacing-sm {
  margin-block: var(--space-sm);
}

.divider--spacing-md {
  margin-block: var(--space-md);
}

.divider--spacing-lg {
  margin-block: var(--space-lg);
}

.divider--spacing-xl {
  margin-block: var(--space-xl);
}
</style>

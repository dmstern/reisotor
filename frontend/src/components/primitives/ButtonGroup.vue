<script setup lang="ts">
// ButtonGroup-Primitive: strukturiertes Layout für Button-Reihen (z. B. Modal-Aktionen, Dialog-Footer).
// Kapselt konsistente Abstände (--space-2 Gap, --space-4 Abstand nach oben) und Ausrichtungen.

withDefaults(
  defineProps<{
    /** Ausrichtung: 'start', 'center', 'end' (Standard) oder 'stretch' (Buttons füllen die Breite). */
    align?: 'start' | 'center' | 'end' | 'stretch';
    /** Optionaler Verzicht auf den oberen Abstand (z. B. wenn die Gruppe inline eingebettet ist). */
    noMargin?: boolean;
  }>(),
  {
    align: 'end',
    noMargin: false,
  }
);
</script>

<template>
  <div
    class="button-group"
    :class="[`button-group--align-${align}`, { 'button-group--no-margin': noMargin }]"
  >
    <slot />
  </div>
</template>

<style scoped>
.button-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.button-group--no-margin {
  margin-top: 0;
}

.button-group--align-start {
  justify-content: flex-start;
}

.button-group--align-center {
  justify-content: center;
}

.button-group--align-end {
  justify-content: flex-end;
}

.button-group--align-stretch {
  justify-content: stretch;
}

.button-group--align-stretch :deep(button),
.button-group--align-stretch :deep(.btn) {
  flex: 1;
}
</style>

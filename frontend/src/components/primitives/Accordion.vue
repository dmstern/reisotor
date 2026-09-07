<script setup lang="ts">
interface Props {
  /** Ob das Akkordion geöffnet ist */
  expanded?: boolean;
  /**
   * Setzt das HTML `inert`-Attribut im geschlossenen Zustand,
   * sodass der Inhalt nicht per Tab-Taste fokussiert werden kann.
   */
  inertWhenClosed?: boolean;
  /** Ob Kindelemente beim Einblenden zeitlich versetzt auffächern sollen */
  stagger?: boolean;
}

withDefaults(defineProps<Props>(), {
  expanded: false,
  inertWhenClosed: true,
  stagger: false,
});
</script>

<template>
  <div
    class="accordion"
    :class="{ 'is-expanded': expanded }"
    :inert="inertWhenClosed && !expanded ? true : undefined"
  >
    <div class="accordion-inner" :class="{ 'accordion-stagger': stagger }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* App-weites Akkordion-Muster mit sanfter Grid-Höhenanimation (0fr -> 1fr) */
.accordion {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.accordion.is-expanded {
  grid-template-rows: 1fr;
}

.accordion-inner {
  overflow: hidden;
}

/* Gestaffeltes Auffächern von Kindelementen im Akkordion (Stagger-Effekt) */
:deep(.accordion-stagger > *),
.accordion :deep(.staggered-item) {
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  transform: translateY(-16px) scale(0.98);
  transition-delay: calc((var(--stagger-total, 10) - var(--stagger-idx, 0) - 1) * 25ms);
}

.accordion.is-expanded :deep(.accordion-stagger > *),
.accordion.is-expanded :deep(.staggered-item) {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx, 0) * 45ms);
}

/* Nth-child Fallback für Listen ohne explizites inline --stagger-idx */
:deep(.accordion-stagger > :nth-child(1)) {
  --stagger-idx: 0;
}
:deep(.accordion-stagger > :nth-child(2)) {
  --stagger-idx: 1;
}
:deep(.accordion-stagger > :nth-child(3)) {
  --stagger-idx: 2;
}
:deep(.accordion-stagger > :nth-child(4)) {
  --stagger-idx: 3;
}
:deep(.accordion-stagger > :nth-child(5)) {
  --stagger-idx: 4;
}
:deep(.accordion-stagger > :nth-child(6)) {
  --stagger-idx: 5;
}
:deep(.accordion-stagger > :nth-child(7)) {
  --stagger-idx: 6;
}
:deep(.accordion-stagger > :nth-child(8)) {
  --stagger-idx: 7;
}
:deep(.accordion-stagger > :nth-child(9)) {
  --stagger-idx: 8;
}
:deep(.accordion-stagger > :nth-child(10)) {
  --stagger-idx: 9;
}
:deep(.accordion-stagger > :nth-child(11)) {
  --stagger-idx: 10;
}
:deep(.accordion-stagger > :nth-child(12)) {
  --stagger-idx: 11;
}
:deep(.accordion-stagger > :nth-child(13)) {
  --stagger-idx: 12;
}
:deep(.accordion-stagger > :nth-child(14)) {
  --stagger-idx: 13;
}
:deep(.accordion-stagger > :nth-child(15)) {
  --stagger-idx: 14;
}
:deep(.accordion-stagger > :nth-child(16)) {
  --stagger-idx: 15;
}
:deep(.accordion-stagger > :nth-child(17)) {
  --stagger-idx: 16;
}
:deep(.accordion-stagger > :nth-child(18)) {
  --stagger-idx: 17;
}
:deep(.accordion-stagger > :nth-child(19)) {
  --stagger-idx: 18;
}
:deep(.accordion-stagger > :nth-child(20)) {
  --stagger-idx: 19;
}

@media (prefers-reduced-motion: reduce) {
  .accordion {
    transition: none;
  }
  :deep(.accordion-stagger > *),
  .accordion :deep(.staggered-item) {
    transition: none;
    transform: none;
    opacity: 1;
  }
}
</style>

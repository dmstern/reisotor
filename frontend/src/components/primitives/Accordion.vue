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
  /** Optionale Zusatzklasse(n) für den inneren Grid-Container (.accordion-inner) */
  innerClass?: string;
}

withDefaults(defineProps<Props>(), {
  expanded: false,
  inertWhenClosed: true,
  stagger: false,
  innerClass: undefined,
});
</script>

<template>
  <div
    class="accordion"
    :class="{ 'is-expanded': expanded }"
    :inert="inertWhenClosed && !expanded ? true : undefined"
  >
    <div class="accordion-inner" :class="[{ 'accordion-stagger': stagger }, innerClass]">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* App-weites Akkordion-Muster mit sanfter Grid-Höhenanimation (0fr -> 1fr),
   zentral gesteuert über die CSS-Variablen in style.css */
.accordion {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition: var(
    --transition-accordion-close,
    grid-template-rows 0.26s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease
  );
}

.accordion.is-expanded {
  grid-template-rows: 1fr;
  opacity: 1;
  transition: var(
    --transition-accordion-open,
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.25s ease
  );
}

.accordion:not(.is-expanded) {
  overflow: hidden;
}

@keyframes accordion-reveal-overflow {
  from,
  99% {
    overflow: hidden;
  }
  to {
    overflow: visible;
  }
}

.accordion-inner {
  min-height: 0;
  overflow: hidden;
  visibility: hidden;
  transition: visibility 0s var(--duration-accordion-close, 0.26s);
}

.accordion.is-expanded > .accordion-inner {
  visibility: visible;
  animation: accordion-reveal-overflow var(--duration-accordion-open, 0.35s) forwards;
  transition: visibility 0s 0s;
}

/* Gestaffeltes Auffächern von Kindelementen im Akkordion (Stagger-Effekt) */
.accordion > .accordion-inner.accordion-stagger > :deep(*),
.accordion :deep(.staggered-item) {
  transition:
    opacity 0.2s ease 0s,
    transform 0.2s ease 0s,
    background-color var(--transition-fast, 0.15s ease),
    color var(--transition-fast, 0.15s ease);
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

.accordion.is-expanded > .accordion-inner.accordion-stagger > :deep(*),
.accordion.is-expanded :deep(.staggered-item) {
  transition:
    opacity var(--duration-accordion-open, 0.35s)
      var(--ease-accordion-stagger, cubic-bezier(0.16, 1, 0.3, 1)),
    transform var(--duration-accordion-open, 0.35s)
      var(--ease-accordion-stagger, cubic-bezier(0.16, 1, 0.3, 1)),
    background-color var(--transition-fast, 0.15s ease),
    color var(--transition-fast, 0.15s ease);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay:
    calc(var(--stagger-idx, 0) * var(--stagger-step-open, 35ms)),
    calc(var(--stagger-idx, 0) * var(--stagger-step-open, 35ms)), 0s, 0s;
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
  .accordion,
  .accordion.is-expanded {
    transition: none;
  }
  .accordion-inner {
    transition: none;
  }
  .accordion.is-expanded > .accordion-inner {
    animation: none;
    overflow: visible;
    transition: none;
  }
  .accordion > .accordion-inner.accordion-stagger > :deep(*),
  .accordion.is-expanded > .accordion-inner.accordion-stagger > :deep(*),
  .accordion :deep(.staggered-item),
  .accordion.is-expanded :deep(.staggered-item) {
    transition: none;
    transform: none;
    opacity: 1;
  }
}
</style>

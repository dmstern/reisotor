<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = withDefaults(
  defineProps<{
    label: string;
    spent: number;
    target: number;
    // Akzeptiert sowohl Hex-Strings (z. B. Kategoriefarben aus categoryColors.ts) als auch
    // CSS-Variablen-Referenzen (z. B. "var(--color-primary-dark)") - die Track-Farbe unten nutzt
    // deshalb color-mix() statt eines Hex-Alpha-Suffix (`${color}26`), das bei einer var()-Referenz
    // nur ein ungültiges "var(...)26" ergäbe und stillschweigend keinen sichtbaren Track zeichnet.
    color: string;
    /** 'currency' (Standard, mit €) oder 'count' für einfache Stückzahlen (z. B. Dashboard-Widgets). */
    format?: 'currency' | 'count';
    /** Optionaler Verzögerungs-Offset in ms für gestaffelte Animationen mehrerer Meter. */
    delay?: number;
    /** Wenn false, wird die Wachstumsanimation übersprungen (sofort voll dargestellt). */
    animated?: boolean;
    /** Optionaler Warnhinweis (z. B. wenn Kategorie mehreren Budgets zugeordnet ist). */
    warning?: string;
    /** Hebt den Meter optisch hervor (z. B. für Gesamtbudget in Töpfen mit Kategorien). */
    prominent?: boolean;
  }>(),
  {
    format: 'currency',
    delay: 0,
    animated: true,
    prominent: false,
  }
);

const isMounted = ref(props.animated === false);

onMounted(() => {
  if (props.animated !== false) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isMounted.value = true;
      });
    });
  }
});

const hasTarget = computed(() => props.target > 0);
const ratio = computed(() => (hasTarget.value ? props.spent / props.target : 0));
const fillPercent = computed(() => Math.min(100, ratio.value * 100));
const isOver = computed(() => hasTarget.value && props.spent > props.target);
const overBy = computed(() => props.spent - props.target);

function fmt(n: number) {
  return props.format === 'count' ? String(n) : `${n.toFixed(2)}\u00A0€`;
}
</script>

<template>
  <div
    class="meter-row"
    :class="{ 'has-target': hasTarget, 'is-over': isOver, 'is-prominent': prominent }"
  >
    <div class="meter-head">
      <span class="dot" :style="{ background: color }"></span>
      <span class="label">
        {{ label }}
        <span
          v-if="warning"
          class="category-warning-icon"
          :title="warning"
          :aria-label="warning"
          tabindex="0"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
        </span>
      </span>
      <span class="values">
        <strong>{{ fmt(spent) }}</strong>
        <span v-if="hasTarget" class="of"> / {{ fmt(target) }}</span>
      </span>
    </div>
    <div class="track" :style="{ background: `color-mix(in srgb, ${color} 15%, transparent)` }">
      <div
        class="fill"
        :class="{ 'fill-over': isOver, 'fill-untargeted': !hasTarget }"
        :style="{
          width: isMounted ? (hasTarget ? `${fillPercent}%` : '100%') : '0%',
          background: isOver ? 'var(--color-danger)' : color,
          transitionDelay: `${delay}ms`,
        }"
      >
        <span class="fill-shimmer" aria-hidden="true"></span>
      </div>
    </div>
    <p v-if="!hasTarget" class="no-target">Kein Ziel gesetzt</p>
    <p v-if="isOver" class="over-badge">
      <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
      <span class="nobr">{{ fmt(overBy) }}</span> über
      {{ format === 'count' ? 'Ziel' : 'Budget' }}
    </p>
  </div>
</template>

<style scoped>
.meter-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) 0;
  transition: transform 0.15s ease;
}

.meter-row.is-prominent {
  padding: var(--space-1) 0;
}

.meter-row.is-prominent .label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
}

.meter-row.is-prominent .values {
  font-size: 0.92rem;
}

.meter-row.is-prominent .values strong {
  font-weight: 700;
}

.meter-row.is-prominent .track {
  height: 10px;
}

.meter-row.is-prominent .dot {
  width: 12px;
  height: 12px;
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.meter-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  row-gap: 2px;
  gap: var(--space-2);
  font-size: 0.9rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.meter-row:hover .dot {
  transform: scale(1.2);
}

.label {
  font-weight: 600;
  flex: 1;
  /* Erst ab deutlich weniger als diesem Wert wird der Name selbst abgeschnitten - reicht der Platz
     für Label UND Werte nicht (z. B. schmale Karte + lange Zahl), rutschen die Werte per
     flex-wrap (siehe .meter-head) stattdessen in eine eigene Zeile, statt den Namen unleserlich
     kurz zu quetschen. */
  min-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.category-warning-icon {
  display: inline-flex;
  align-items: center;
  margin-left: 0.35rem;
  color: var(--color-warning, #f59e0b);
  vertical-align: middle;
  cursor: help;
}

.category-warning-icon:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}

.values {
  color: var(--color-text);
  font-size: 0.85rem;
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

.of {
  color: var(--color-text-muted);
}

.no-target {
  margin: 0;
  font-size: 0.78rem;
  font-style: italic;
  color: var(--color-text-muted);
}

.track {
  height: 8px;
  border-radius: var(--radius-pill);
  overflow: hidden;
  position: relative;
}

.fill {
  height: 100%;
  border-radius: var(--radius-pill);
  position: relative;
  overflow: hidden;
  transition:
    width 0.95s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.3s ease;
}

.fill.fill-untargeted {
  opacity: 0.6;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 8px,
    rgba(255, 255, 255, 0.18) 8px,
    rgba(255, 255, 255, 0.18) 16px
  );
}

.fill-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.25) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: bar-shimmer 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  pointer-events: none;
}

@keyframes bar-shimmer {
  0% {
    transform: translateX(-100%);
  }
  60%,
  100% {
    transform: translateX(200%);
  }
}

.over-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-danger);
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none !important;
  }
  .fill-shimmer {
    display: none !important;
    animation: none !important;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
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
}>();

const hasTarget = computed(() => props.target > 0);
const ratio = computed(() => (hasTarget.value ? props.spent / props.target : 0));
const fillPercent = computed(() => Math.min(100, ratio.value * 100));
const isOver = computed(() => hasTarget.value && props.spent > props.target);
const overBy = computed(() => props.spent - props.target);

function fmt(n: number) {
  return props.format === 'count' ? String(n) : `${n.toFixed(2)} €`;
}
</script>

<template>
  <div class="meter-row">
    <div class="meter-head">
      <span class="dot" :style="{ background: color }"></span>
      <span class="label">{{ label }}</span>
      <span class="values">
        <strong>{{ fmt(spent) }}</strong>
        <span v-if="hasTarget" class="of"> / {{ fmt(target) }}</span>
      </span>
    </div>
    <div class="track" :style="{ background: `color-mix(in srgb, ${color} 15%, transparent)` }">
      <div
        class="fill"
        :style="{ width: hasTarget ? fillPercent + '%' : '100%', background: color }"
      ></div>
    </div>
    <p v-if="!hasTarget" class="no-target">Kein Ziel gesetzt</p>
    <p v-if="isOver" class="over-badge">
      <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> {{ fmt(overBy) }} über {{ format === 'count' ? 'Ziel' : 'Budget' }}
    </p>
  </div>
</template>

<style scoped>
.meter-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) 0;
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
  border-radius: 999px;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.over-badge {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-danger);
}
</style>

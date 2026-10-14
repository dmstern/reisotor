<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';
import type { IconGroup } from '../stores/iconStyle';

const props = withDefaults(
  defineProps<{
    label: string;
    spent: number;
    target: number;
    // Optional. Wenn nicht angegeben oder im Budget-Modus (trafficLight), wird ein fließender
    // Ampel-Farbverlauf genutzt: 50-100% Grün, 50-15% Grün->Gelb, 15-0% Gelb->Orange,
    // bei Überschreitung bis 20% Orange->Rot und 20-50%+ Rot->Dunkelrot.
    color?: string;
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
    /**
     * 'drain': Budget-Modus (Balken beginnt bei 100% und leert sich mit Ausgaben, 100% Rot bei Überzug).
     * 'fill': Fortschritts-Modus (0% bis 100%, z. B. für Packlisten/Aufgaben).
     * Standard: 'drain' bei currency, 'fill' bei count.
     */
    mode?: 'drain' | 'fill';
    /**
     * Ob das Ampel-Farbschema (Grün / Orange / Rot) aktiv ist.
     * Standard: true im 'drain'-Modus, false im 'fill'-Modus.
     */
    trafficLight?: boolean;
    /** Optionales Kategorie- oder Bereichs-Icon statt des farbigen Punkts. */
    icon?: IconDef;
    /** Icon-Gruppe für AppIcon (Standard: 'categories'). */
    iconGroup?: IconGroup;
  }>(),
  {
    color: undefined,
    format: 'currency',
    delay: 0,
    animated: true,
    prominent: false,
    mode: undefined,
    trafficLight: undefined,
    icon: undefined,
    iconGroup: 'categories',
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

const resolvedMode = computed<'drain' | 'fill'>(
  () => props.mode ?? (props.format === 'currency' ? 'drain' : 'fill')
);

const useTrafficLight = computed(() => props.trafficLight ?? resolvedMode.value === 'drain');

const hasTarget = computed(() => props.target > 0);
const isOver = computed(() => hasTarget.value && props.spent > props.target);
const overBy = computed(() => Math.max(0, props.spent - props.target));
const overRatio = computed(() => (hasTarget.value ? overBy.value / props.target : 0));
const remaining = computed(() => (hasTarget.value ? props.target - props.spent : 0));
const remainingRatio = computed(() => (hasTarget.value ? remaining.value / props.target : 0));

const fillPercent = computed(() => {
  if (!hasTarget.value) return 100;
  if (resolvedMode.value === 'drain') {
    if (isOver.value) {
      // Füllstand zeigt das relative Ausmaß der Budgetüberschreitung:
      // z. B. 50 % Überschreitung = 50 % gefüllt, 100 % (oder mehr) Überschreitung = 100 % gefüllt.
      return Math.max(2, Math.min(100, overRatio.value * 100));
    }
    // Entleert sich mit Ausgaben (100% -> 0%)
    return Math.max(0, Math.min(100, remainingRatio.value * 100));
  }
  // mode === 'fill' (Fortschritt 0% -> 100%)
  const fillRatio = props.spent / props.target;
  return Math.max(0, Math.min(100, fillRatio * 100));
});

const effectiveColor = computed(() => {
  if (useTrafficLight.value) {
    if (isOver.value) {
      // Bis 20 % Überschreitung: Sanfter Übergang von Orange nach Kräftiges Rot (Danger)
      if (overRatio.value <= 0.2) {
        const redPct = Math.max(0, Math.min(100, Math.round((overRatio.value / 0.2) * 100)));
        if (redPct <= 0) return 'var(--color-meter-orange, #ea580c)';
        if (redPct >= 100) return 'var(--color-danger)';
        return `color-mix(in srgb, var(--color-danger) ${redPct}%, var(--color-meter-orange, #ea580c))`;
      }
      // Ab 20 % bis 50 %+ Überschreitung: Sanfter Übergang von Kräftigem Rot in tiefes Dunkelrot
      const darkRedPct = Math.max(
        0,
        Math.min(100, Math.round(((overRatio.value - 0.2) / 0.3) * 100))
      );
      if (darkRedPct <= 0) return 'var(--color-danger)';
      if (darkRedPct >= 100) return 'var(--color-meter-dark-red, #7f1d1d)';
      return `color-mix(in srgb, var(--color-meter-dark-red, #7f1d1d) ${darkRedPct}%, var(--color-danger))`;
    }
    if (hasTarget.value) {
      // 50 % bis 100 % Restbudget: Vollständig Grün
      if (remainingRatio.value >= 0.5) {
        return 'var(--color-success)';
      }
      // 15 % bis 50 % Restbudget: Sanfter Übergang von Grün nach Gelb
      if (remainingRatio.value >= 0.15) {
        const greenPct = Math.max(
          0,
          Math.min(100, Math.round(((remainingRatio.value - 0.15) / 0.35) * 100))
        );
        if (greenPct >= 100) return 'var(--color-success)';
        if (greenPct <= 0) return 'var(--color-meter-yellow, #eab308)';
        return `color-mix(in srgb, var(--color-success) ${greenPct}%, var(--color-meter-yellow, #eab308))`;
      }
      // 0 % bis 15 % Restbudget: Sanfter Übergang von Gelb nach Orange (bei 0 % = Orange)
      const yellowPct = Math.max(0, Math.min(100, Math.round((remainingRatio.value / 0.15) * 100)));
      if (yellowPct >= 100) return 'var(--color-meter-yellow, #eab308)';
      if (yellowPct <= 0) return 'var(--color-meter-orange, #ea580c)';
      return `color-mix(in srgb, var(--color-meter-yellow, #eab308) ${yellowPct}%, var(--color-meter-orange, #ea580c))`;
    }
    return props.color ?? 'var(--color-text-muted)';
  }
  if (isOver.value) {
    return 'var(--color-danger)';
  }
  return props.color ?? 'var(--color-primary-dark)';
});

const trackBackground = computed(() => {
  if (isOver.value) {
    return `color-mix(in srgb, ${effectiveColor.value} 18%, transparent)`;
  }
  return `color-mix(in srgb, ${effectiveColor.value} 15%, transparent)`;
});

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
      <AppIcon
        v-if="icon"
        :icon="icon"
        :size="prominent ? 18 : 16"
        :group="iconGroup"
        class="meter-icon"
      />
      <span
        v-else-if="props.color || !icon"
        class="dot"
        :style="{ background: effectiveColor }"
      ></span>
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
    <div class="track" :style="{ background: trackBackground }">
      <div
        class="fill"
        :class="{ 'fill-over': isOver, 'fill-untargeted': !hasTarget }"
        :style="{
          width: isMounted ? (hasTarget ? `${fillPercent}%` : '100%') : '0%',
          background: effectiveColor,
          boxShadow: isOver
            ? `0 0 8px color-mix(in srgb, ${effectiveColor} 35%, transparent)`
            : undefined,
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
  align-items: center;
  flex-wrap: wrap;
  row-gap: 2px;
  gap: var(--space-2);
  font-size: 0.9rem;
}

.meter-icon {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.meter-row:hover .meter-icon {
  transform: scale(1.15);
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
  background-color: color-mix(in srgb, var(--color-text) 8%, transparent);
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

.fill.fill-over {
  min-width: 6px;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 8px,
    rgba(255, 255, 255, 0.15) 8px,
    rgba(255, 255, 255, 0.15) 16px
  );
  box-shadow: 0 0 8px color-mix(in srgb, var(--color-danger) 35%, transparent);
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

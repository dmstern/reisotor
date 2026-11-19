<script setup lang="ts">
// LoadingSpinner-Primitive im Reisotor-Optik-Ladesystem (Primary + Liquid Glass):
// - 'default': Glass Lens (bei 'sm' cleaner Glass Halo, ab 'md'/'lg' mit Robo-Linsenkern & Reflex)
// - 'search':  Visier-Scan für aktive Suche / Autocomplete (Orte, Adressen, Bilder, Nutzer)
// - 'radar':   Spot-Radar für externe Live-Daten & Ortung (Wetter, GPS)
import { computed, useId } from 'vue';

export type LoadingSpinnerSize = 'sm' | 'md' | 'lg';
export type LoadingSpinnerVariant = 'default' | 'search' | 'radar';

const props = withDefaults(
  defineProps<{
    /** Spinner-Größe: 'sm' (14px), 'md' (20px), 'lg' (28px). */
    size?: LoadingSpinnerSize;
    /** Semantische Variante: 'default' (Glass Lens), 'search' (Visier-Scan), 'radar' (Spot-Radar). */
    variant?: LoadingSpinnerVariant;
    /** Invertierte Darstellung über currentColor für farbige Flächen (Buttons, Toast-Pill). */
    inverted?: boolean;
    /** Dekorativ (aria-hidden), wenn ein umschließendes Element bereits role="status" trägt. */
    decorative?: boolean;
    /** Zugängliche Beschriftung für Screenreader. */
    label?: string;
  }>(),
  {
    size: 'md',
    variant: 'default',
    inverted: false,
    decorative: false,
    label: 'Lädt…',
  }
);

const STROKE_WIDTH_BY_SIZE: Record<LoadingSpinnerSize, number> = {
  sm: 3,
  md: 2.6,
  lg: 2.3,
};

const TRACK_STROKE_OFFSET = 0.3;
const INNER_ARC_STROKE_OFFSET = 0.6;

const uid = useId();
const gradientId = computed(() => `spinner-grad-${uid}`);
const showLensCore = computed(() => props.size !== 'sm');
const strokeWidth = computed(() => STROKE_WIDTH_BY_SIZE[props.size]);
const trackStrokeWidth = computed(() => strokeWidth.value - TRACK_STROKE_OFFSET);
const innerArcStrokeWidth = computed(() => strokeWidth.value - INNER_ARC_STROKE_OFFSET);
</script>

<template>
  <span
    class="spinner"
    :class="[`spinner--${size}`, `spinner--${variant}`, { 'spinner--inverted': inverted }]"
    :role="decorative ? undefined : 'status'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <!-- 1. Standard: Glass Lens (Glass Halo + Kamera-Fokus via optischem Scaling) -->
    <svg
      v-if="variant === 'default'"
      class="spinner-svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient :id="gradientId" x1="10%" y1="95%" x2="90%" y2="5%">
          <stop offset="0%" stop-color="var(--spinner-primary)" />
          <stop offset="100%" stop-color="var(--spinner-primary-light)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13.5" class="spinner-disc" />
      <circle cx="16" cy="16" r="12" class="spinner-track" :stroke-width="trackStrokeWidth" />
      <circle
        class="spinner-arc-outer"
        cx="16"
        cy="16"
        r="12"
        pathLength="100"
        :stroke="inverted ? 'currentColor' : `url(#${gradientId})`"
        :stroke-width="strokeWidth"
        stroke-dasharray="34 66"
        stroke-linecap="round"
      />
      <circle
        class="spinner-arc-inner"
        :class="{ 'is-subtle': showLensCore }"
        cx="16"
        cy="16"
        r="8.1"
        pathLength="100"
        :stroke-width="innerArcStrokeWidth"
        stroke-dasharray="28 72"
        stroke-linecap="round"
      />
      <template v-if="showLensCore">
        <circle class="spinner-lens-core" cx="16" cy="16" r="4.6" />
        <g class="spinner-glint-orbit">
          <circle class="spinner-glint" cx="17.6" cy="14.3" r="1.25" />
        </g>
      </template>
    </svg>

    <!-- 2. Suche: Visier-Scan (Liquid-Glass-Kapsel mit optischem Scan-Punkt) -->
    <svg
      v-else-if="variant === 'search'"
      class="spinner-svg"
      viewBox="0 0 32 20"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient :id="gradientId" x1="10%" y1="95%" x2="90%" y2="5%">
          <stop offset="0%" stop-color="var(--spinner-primary)" />
          <stop offset="100%" stop-color="var(--spinner-primary-light)" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2.5"
        width="28"
        height="15"
        rx="7.5"
        class="spinner-visor"
        :stroke="inverted ? 'currentColor' : `url(#${gradientId})`"
        stroke-width="2.2"
      />
      <line x1="8.5" y1="10" x2="23.5" y2="10" class="spinner-scan-rail" stroke-linecap="round" />
      <circle class="spinner-scan-glow" cx="16" cy="10" r="3.8" />
      <circle class="spinner-scan-dot" cx="16" cy="10" r="2.6" />
      <circle class="spinner-scan-spark" cx="16" cy="10" r="1.05" />
    </svg>

    <!-- 3. Extern / Live: Spot-Radar (Glass-Scheibe mit konzentrischen Sonar-Wellen) -->
    <svg v-else class="spinner-svg" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient :id="gradientId" x1="10%" y1="95%" x2="90%" y2="5%">
          <stop offset="0%" stop-color="var(--spinner-primary)" />
          <stop offset="100%" stop-color="var(--spinner-primary-light)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13.5" class="spinner-disc" />
      <circle
        class="spinner-radar-ring spinner-radar-ring--1"
        cx="16"
        cy="16"
        r="12.5"
        :stroke="inverted ? 'currentColor' : `url(#${gradientId})`"
        stroke-width="2.4"
      />
      <circle
        class="spinner-radar-ring spinner-radar-ring--2"
        cx="16"
        cy="16"
        r="12.5"
        stroke-width="2.2"
      />
      <circle
        class="spinner-radar-core"
        cx="16"
        cy="16"
        r="3.8"
        :fill="inverted ? 'currentColor' : `url(#${gradientId})`"
      />
      <circle class="spinner-radar-glint" cx="17.1" cy="14.9" r="1" />
    </svg>
  </span>
</template>

<style scoped>
.spinner {
  --spinner-primary: var(--color-primary);
  --spinner-primary-light: color-mix(in srgb, var(--color-primary) 62%, white);
  --spinner-accent: var(--color-scheduled);
  --spinner-disc: var(--color-primary-tint);
  --spinner-track: color-mix(in srgb, var(--color-primary) 18%, transparent);
  --spinner-lens-core: color-mix(in srgb, var(--color-primary) 30%, black);
  --spinner-glint: var(--color-scheduled);
  --spinner-visor-bg: var(--color-primary-tint);
  --spinner-spark: white;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  line-height: 0;
}

.spinner--inverted {
  --spinner-primary: currentColor;
  --spinner-primary-light: currentColor;
  --spinner-accent: color-mix(in srgb, currentColor 72%, transparent);
  --spinner-disc: color-mix(in srgb, currentColor 15%, transparent);
  --spinner-track: color-mix(in srgb, currentColor 26%, transparent);
  --spinner-lens-core: color-mix(in srgb, currentColor 24%, transparent);
  --spinner-glint: currentColor;
  --spinner-visor-bg: color-mix(in srgb, currentColor 16%, transparent);
  --spinner-spark: currentColor;
}

.spinner-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* Größen für runde Varianten (default, radar) */
.spinner--sm {
  width: 14px;
  height: 14px;
}

.spinner--md {
  width: 20px;
  height: 20px;
}

.spinner--lg {
  width: 28px;
  height: 28px;
}

/* Größen für Kapsel-Variante (search) */
.spinner--search.spinner--sm {
  width: 22px;
  height: 14px;
}

.spinner--search.spinner--md {
  width: 30px;
  height: 19px;
}

.spinner--search.spinner--lg {
  width: 40px;
  height: 25px;
}

/* Gemeinsame Glass-Basis */
.spinner-disc {
  fill: var(--spinner-disc);
}

.spinner-track {
  stroke: var(--spinner-track);
}

/* 1. Glass Lens */
.spinner-arc-outer {
  transform-origin: 16px 16px;
  animation: spinner-spin 1.25s cubic-bezier(0.52, 0.14, 0.48, 0.86) infinite;
}

.spinner-arc-inner {
  stroke: var(--spinner-accent);
  opacity: 0.85;
  transform-origin: 16px 16px;
  animation: spinner-spin-rev 1.8s linear infinite;
}

.spinner-arc-inner.is-subtle {
  opacity: 0.65;
}

.spinner-lens-core {
  fill: var(--spinner-lens-core);
  transform-origin: 16px 16px;
  animation: spinner-breathe 1.6s ease-in-out infinite;
}

.spinner-glint-orbit {
  transform-origin: 16px 16px;
  animation: spinner-spin-rev 2.5s linear infinite;
}

.spinner-glint {
  fill: var(--spinner-glint);
}

/* 2. Visier-Scan */
.spinner-visor {
  fill: var(--spinner-visor-bg);
}

.spinner-scan-rail {
  stroke: var(--spinner-accent);
  stroke-opacity: 0.22;
  stroke-width: 2;
}

.spinner-scan-glow {
  fill: var(--spinner-accent);
  opacity: 0.28;
  animation: spinner-scan 1.35s cubic-bezier(0.45, 0.05, 0.55, 0.95) 0.06s infinite;
}

.spinner-scan-dot {
  fill: var(--spinner-accent);
  animation: spinner-scan 1.35s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

.spinner-scan-spark {
  fill: var(--spinner-spark);
  animation: spinner-scan 1.35s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

/* 3. Spot-Radar */
.spinner-radar-ring {
  transform-origin: 16px 16px;
}

.spinner-radar-ring--1 {
  animation: spinner-radar-ping 1.65s cubic-bezier(0.15, 0.7, 0.35, 1) infinite;
}

.spinner-radar-ring--2 {
  stroke: var(--spinner-accent);
  animation: spinner-radar-ping 1.65s cubic-bezier(0.15, 0.7, 0.35, 1) 0.82s infinite;
}

.spinner-radar-core {
  transform-origin: 16px 16px;
  animation: spinner-breathe 1.65s ease-in-out infinite;
}

.spinner-radar-glint {
  fill: var(--spinner-spark);
  opacity: 0.9;
}

@keyframes spinner-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes spinner-spin-rev {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes spinner-breathe {
  0%,
  100% {
    transform: scale(0.86);
  }

  50% {
    transform: scale(1.1);
  }
}

@keyframes spinner-scan {
  0%,
  100% {
    transform: translateX(-6px);
  }

  50% {
    transform: translateX(6px);
  }
}

@keyframes spinner-radar-ping {
  0% {
    transform: scale(0.32);
    opacity: 0.85;
  }

  100% {
    transform: scale(1);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner-arc-outer,
  .spinner-arc-inner,
  .spinner-lens-core,
  .spinner-glint-orbit,
  .spinner-scan-glow,
  .spinner-scan-dot,
  .spinner-scan-spark,
  .spinner-radar-ring,
  .spinner-radar-core {
    animation: none;
  }

  .spinner-radar-ring--1 {
    transform: scale(0.76);
    opacity: 0.45;
  }

  .spinner-radar-ring--2 {
    opacity: 0;
  }
}
</style>

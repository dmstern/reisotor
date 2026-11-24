<script setup lang="ts">
// LoadingSpinner-Primitive im Reisotor-Optik-Ladesystem (Primary + Liquid Glass):
// Einheitlicher Visier-Scan (Liquid-Glass-Kapsel mit optischem Scan-Punkt).
import { computed, useId } from 'vue';

export type LoadingSpinnerSize = 'sm' | 'md' | 'lg';

withDefaults(
  defineProps<{
    /** Spinner-Größe: 'sm' (22x14px), 'md' (30x19px), 'lg' (40x25px). */
    size?: LoadingSpinnerSize;
    /** Invertierte Darstellung über currentColor für farbige Flächen (Buttons, Toast-Pill). */
    inverted?: boolean;
    /** Dekorativ (aria-hidden), wenn ein umschließendes Element bereits role="status" trägt. */
    decorative?: boolean;
    /** Zugängliche Beschriftung für Screenreader. */
    label?: string;
  }>(),
  {
    size: 'md',
    inverted: false,
    decorative: false,
    label: 'Lädt…',
  }
);

const uid = useId();
const gradientId = computed(() => `spinner-grad-${uid}`);
</script>

<template>
  <span
    class="spinner"
    :class="[`spinner--${size}`, { 'spinner--inverted': inverted }]"
    :role="decorative ? undefined : 'status'"
    :aria-label="decorative ? undefined : label"
    :aria-hidden="decorative ? 'true' : undefined"
  >
    <!-- Visier-Scan (Liquid-Glass-Kapsel mit optischem Scan-Punkt) -->
    <svg class="spinner-svg" viewBox="0 0 32 20" fill="none" aria-hidden="true">
      <defs v-if="!inverted">
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
  </span>
</template>

<style scoped>
.spinner {
  --spinner-primary: var(--color-primary);
  --spinner-primary-light: color-mix(in srgb, var(--color-primary) 62%, white);
  --spinner-accent: var(--color-scheduled);
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
  --spinner-visor-bg: color-mix(in srgb, currentColor 16%, transparent);
  --spinner-spark: currentColor;
}

.spinner-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.spinner--sm {
  width: 22px;
  height: 14px;
}

.spinner--md {
  width: 30px;
  height: 19px;
}

.spinner--lg {
  width: 40px;
  height: 25px;
}

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
  animation: spinner-scan 1.35s cubic-bezier(0.45, 0.05, 0.55, 0.95) 0.06s infinite backwards;
}

.spinner-scan-dot {
  fill: var(--spinner-accent);
  animation: spinner-scan 1.35s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
}

.spinner-scan-spark {
  fill: var(--spinner-spark);
  animation: spinner-scan 1.35s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
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

@media (prefers-reduced-motion: reduce) {
  .spinner-scan-glow,
  .spinner-scan-dot,
  .spinner-scan-spark {
    animation: none;
  }
}
</style>

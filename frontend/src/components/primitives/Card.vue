<script setup lang="ts">
/**
 * Surface-Primitive für alle Karten im Reisotor (SpotCard, ExcursionCard, BudgetPotCard,
 * Tages-Stationen, Focus-Panels, …) – siehe Issue #239.
 */
withDefaults(
  defineProps<{
    /** Card-Variante:
     * - 'default': Standard-Fläche (weiß/surface, shadow-sm, padding var(--space-4))
     * - 'muted': Hinterlegte Fläche (background var(--color-hover))
     * - 'condensed': Kompaktes Padding (var(--space-2) var(--space-3)) für dichte Listen
     * - 'flat': Flacher Rand ohne Schatten
     * - 'elevated': Erhöhter Schatten (shadow-md) für schwebende Overlays
     */
    variant?: 'default' | 'muted' | 'condensed' | 'flat' | 'elevated';
    /** Optionale URL für ein Bild-Banner am oberen Rand der Karte. */
    bannerUrl?: string;
    /** Alt-Text für das Bild-Banner. */
    bannerAlt?: string;
    /** Hebt die Karte mit dem Notiz/Live-Sync Highlight-Rand hervor (.new-highlight). */
    highlight?: boolean;
  }>(),
  {
    variant: 'default',
    bannerAlt: '',
    highlight: false,
  },
);
</script>

<template>
  <div
    class="card"
    :class="[
      variant !== 'default' ? `card--${variant}` : undefined,
      { 'new-highlight': highlight, 'card--has-banner': bannerUrl || $slots.banner },
    ]"
  >
    <div v-if="bannerUrl || $slots.banner" class="card-banner">
      <slot name="banner">
        <img v-if="bannerUrl" :src="bannerUrl" :alt="bannerAlt" class="card-banner-img" />
      </slot>
    </div>
    <div v-if="$slots.header" class="card-header">
      <slot name="header" />
    </div>
    <div class="card-body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
/* Varianten-Styles von Card.vue */
.card--muted {
  background: var(--color-hover);
}

.card--condensed {
  padding: var(--space-2) var(--space-3);
}

.card--flat {
  box-shadow: none;
  border-color: var(--color-border);
}

.card--elevated {
  box-shadow: var(--shadow-md);
}

.card--has-banner {
  padding-top: 0;
  overflow: hidden;
}

.card-banner {
  width: calc(100% + var(--space-4) * 2);
  margin-left: calc(-1 * var(--space-4));
  margin-right: calc(-1 * var(--space-4));
  margin-bottom: var(--space-3);
  height: 140px;
  overflow: hidden;
  position: relative;
  background: var(--color-hover);
}

.card--condensed .card-banner {
  width: calc(100% + var(--space-3) * 2);
  margin-left: calc(-1 * var(--space-3));
  margin-right: calc(-1 * var(--space-3));
  margin-bottom: var(--space-2);
  height: 90px;
}

.card-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-header {
  margin-bottom: var(--space-2);
}

.card-footer {
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
</style>

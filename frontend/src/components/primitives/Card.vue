<script setup lang="ts">
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';

/**
 * Surface-Primitive für alle Karten im Reisotor (SpotCard, ExcursionCard, BudgetPotCard,
 * Dashboard-Kacheln, Tages-Stationen, Focus-Panels, …) – siehe Issue #239.
 */
withDefaults(
  defineProps<{
    /** Card-Variante:
     * - 'default': Standard-Fläche (weiß/surface, shadow-sm, padding var(--space-4))
     * - 'muted': Hinterlegte Fläche (background var(--color-hover))
     * - 'condensed': Kompaktes Padding (var(--space-2) var(--space-3)) für dichte Listen & Mini-Karten
     * - 'flat': Flacher Rand ohne Schatten
     * - 'elevated': Erhöhter Schatten (shadow-md) für schwebende Overlays
     * - 'tile': Dashboard-Kachel mit leicht transparentem Hintergrund, schwebendem Kreis-Icon & Hover-Lift
     */
    variant?: 'default' | 'muted' | 'condensed' | 'flat' | 'elevated' | 'tile';
    /** Optionale URL für ein Bild-Banner am oberen oder linken Rand der Karte. */
    bannerUrl?: string;
    /** Alt-Text für das Bild-Banner. */
    bannerAlt?: string;
    /** Ausrichtung des Banners: 'top' (oben, Standard) oder 'left' (links als schmale Miniatur/Vorschaubild). */
    bannerPosition?: 'top' | 'left';
    /** Hebt die Karte mit dem Notiz/Live-Sync Highlight-Rand hervor (.new-highlight). */
    highlight?: boolean;
    /** Akzentfarbe für die 'tile'-Variante (Hex oder CSS var). */
    tileColor?: string;
    /** IconDef für das runde Schwebelogo der 'tile'-Variante. */
    tileIcon?: IconDef;
  }>(),
  {
    variant: 'default',
    bannerAlt: '',
    bannerPosition: 'top',
    highlight: false,
    tileColor: '#2a7f74',
  },
);
</script>

<template>
  <div
    class="card"
    :class="[
      variant !== 'default' ? `card--${variant}` : undefined,
      {
        'new-highlight': highlight,
        'card--has-banner': bannerUrl || $slots.banner,
        'card--banner-left': (bannerUrl || $slots.banner) && bannerPosition === 'left',
      },
    ]"
    :style="variant === 'tile' && tileColor ? { background: tileColor.startsWith('#') ? `${tileColor}0d` : tileColor } : undefined"
  >
    <!-- Tile Badge Icon (Dashboard Style) -->
    <div
      v-if="variant === 'tile' && (tileIcon || $slots['tile-icon'])"
      class="card-tile-icon"
      :style="{ background: tileColor.startsWith('#') ? `${tileColor}26` : 'var(--color-primary-tint)', borderColor: tileColor }"
    >
      <slot name="tile-icon">
        <AppIcon v-if="tileIcon" :icon="tileIcon" group="navigation" :size="18" :color="tileColor" />
      </slot>
    </div>

    <!-- Banner (Top oder Left) -->
    <div v-if="bannerUrl || $slots.banner" class="card-banner">
      <slot name="banner">
        <img v-if="bannerUrl" :src="bannerUrl" :alt="bannerAlt" class="card-banner-img" />
      </slot>
    </div>

    <div class="card-content">
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

.card--tile {
  position: relative;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  margin-top: 18px;
}

.card--tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card-tile-icon {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Banner Top Styles */
.card--has-banner:not(.card--banner-left) {
  padding-top: 0;
  overflow: hidden;
}

.card--has-banner:not(.card--banner-left) .card-banner {
  width: calc(100% + var(--space-4) * 2);
  margin-left: calc(-1 * var(--space-4));
  margin-right: calc(-1 * var(--space-4));
  margin-bottom: var(--space-3);
  height: 140px;
  overflow: hidden;
  position: relative;
  background: var(--color-hover);
}

.card--condensed.card--has-banner:not(.card--banner-left) .card-banner {
  width: calc(100% + var(--space-3) * 2);
  margin-left: calc(-1 * var(--space-3));
  margin-right: calc(-1 * var(--space-3));
  margin-bottom: var(--space-2);
  height: 90px;
}

/* Banner Left Styles (Mini / Horizontal Layout) */
.card--banner-left {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  padding: 0;
  overflow: hidden;
}

.card--banner-left .card-banner {
  width: 120px;
  min-width: 120px;
  flex: 0 0 120px;
  height: auto;
  min-height: 100%;
  margin: 0;
  position: relative;
  overflow: hidden;
  background: var(--color-hover);
}

.card--banner-left.card--condensed .card-banner {
  width: 90px;
  min-width: 90px;
  flex: 0 0 90px;
}

.card-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card--banner-left .card-content {
  flex: 1;
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.card--banner-left.card--condensed .card-content {
  padding: var(--space-2) var(--space-3);
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

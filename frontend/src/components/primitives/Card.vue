<script setup lang="ts">
import { ref, computed, useAttrs } from 'vue';
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { TILE_SHADOW_ALPHA } from '../../utils/widgetColors';

/**
 * Surface-Primitive für alle Karten im Reisotor (SpotCard, ExcursionCard, BudgetPotCard,
 * Dashboard-Kacheln, Tages-Stationen, Focus-Panels, …) – siehe Issue #239.
 */
const props = withDefaults(
  defineProps<{
    /** Card-Variante:
     * - 'default': Standard-Fläche (weiß/surface, shadow-sm, padding var(--space-4))
     * - 'muted': Hinterlegte Fläche (background var(--color-hover))
     * - 'flat': Flacher Rand ohne Schatten
     * - 'elevated': Erhöhter Schatten (shadow-md) für schwebende Overlays
     * - 'tile': Dashboard-Kachel mit leicht transparentem Hintergrund, schwebendem Kreis-Icon & Hover-Lift
     * - 'polaroid': Authentische Polaroid-Fotokarte mit breitem weißem Papierrahmen, tiefem Schatten & Vintage-Haptik
     */
    variant?: 'default' | 'muted' | 'flat' | 'elevated' | 'tile' | 'polaroid';
    /** Ob die Karte sich im komprimierten/kompakten Zustand befindet. */
    condensed?: boolean;
    /** Ob die Karte sich im aufgeklappten Zustand befindet (Invers zu condensed). */
    expanded?: boolean;
    /** Ob die Karte interaktiv per Klick aufklappbar/zuklappbar ist (wie SpotCard/ExcursionCard in der Karten-View). */
    expandable?: boolean;
    /** Ob die Karte generell interaktiv/anklickbar ist (Hover-Lift & Pointer). */
    interactive?: boolean;
    /** Optionale URL für ein Bild-Banner der Karte. */
    bannerUrl?: string;
    /** Alt-Text für das Bild-Banner. */
    bannerAlt?: string;
    /** Ausrichtung des Banners: 'top' (oben), 'left' (links als Schmal-Vorschaubild) oder 'auto' (links wenn condensed, oben wenn expanded). */
    bannerPosition?: 'top' | 'left' | 'auto';
    /** Hebt die Karte mit dem Notiz/Live-Sync Highlight-Rand hervor (.new-highlight). */
    highlight?: boolean;
    /** Hebt die Karte mit einem eleganten Brand-Fokus-Rand hervor (.is-map-focused), wenn sie auf der Karte fokussiert ist. */
    mapFocused?: boolean;
    /** Akzentfarbe für die 'tile'-Variante (Hex oder CSS var). */
    tileColor?: string;
    /** Alpha-Hex für den Box-Shadow der 'tile'-Variante (Standard: TILE_SHADOW_ALPHA aus widgetColors.ts). */
    tileShadowAlpha?: string;
    /** IconDef für das runde Schwebelogo der 'tile'-Variante. */
    tileIcon?: IconDef;
    /** HTML-Tag für das Card-Wurzelelement (Standard: 'div', z. B. 'section', 'li'). */
    tag?: string;
  }>(),
  {
    variant: 'default',
    condensed: undefined,
    expanded: undefined,
    expandable: false,
    interactive: false,
    bannerAlt: '',
    bannerPosition: 'auto',
    highlight: false,
    mapFocused: false,
    tileColor: '#9141AC',
    tileShadowAlpha: TILE_SHADOW_ALPHA,
    tag: 'div',
  }
);

const emit = defineEmits<{
  (e: 'update:condensed', value: boolean): void;
  (e: 'update:expanded', value: boolean): void;
  (e: 'toggle-expand', value: boolean): void;
  (e: 'click', event: MouseEvent): void;
}>();

// Interner Zustand, falls condensed/expanded nicht direkt per Prop/v-model gesteuert werden
const internalCondensed = ref(true);

const isCondensed = computed(() => {
  if (props.condensed !== undefined) {
    return props.condensed;
  }

  if (props.expanded !== undefined) {
    return !props.expanded;
  }

  return props.expandable ? internalCondensed.value : false;
});

const isExpanded = computed(() => {
  if (props.expanded !== undefined) {
    return props.expanded;
  }

  if (props.condensed !== undefined) {
    return !props.condensed;
  }

  return props.expandable ? !internalCondensed.value : false;
});

const effectiveBannerPosition = computed(() => {
  if (props.bannerPosition !== 'auto') {
    return props.bannerPosition;
  }

  return isCondensed.value ? 'left' : 'top';
});

function handleCardClick(event: MouseEvent) {
  emit('click', event);

  if (!props.expandable) {
    return;
  }

  const target = event.target as HTMLElement | null;

  if (
    target &&
    target !== event.currentTarget &&
    target.closest('button, a, input, textarea, select, [role="button"]')
  ) {
    return;
  }

  const nextCondensed = !isCondensed.value;
  internalCondensed.value = nextCondensed;
  emit('update:condensed', nextCondensed);
  emit('update:expanded', !nextCondensed);
  emit('toggle-expand', !nextCondensed);
}

function handleCardKeydown(event: KeyboardEvent) {
  if (!props.expandable) {
    return;
  }

  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  const target = event.target as HTMLElement | null;

  if (
    target &&
    target !== event.currentTarget &&
    target.closest('button, a, input, textarea, select, [role="button"]')
  ) {
    return;
  }

  event.preventDefault();
  handleCardClick(event as unknown as MouseEvent);
}

const attrs = useAttrs();
const isNewHighlight = computed(() => {
  if (props.highlight) {
    return true;
  }

  const cls = attrs.class;

  if (!cls) {
    return false;
  }

  if (typeof cls === 'string') {
    return cls.split(/\s+/).includes('new-highlight');
  }

  if (Array.isArray(cls)) {
    return cls.includes('new-highlight');
  }

  if (typeof cls === 'object') {
    return Boolean((cls as Record<string, unknown>)['new-highlight']);
  }

  return false;
});
</script>

<template>
  <component
    :is="tag"
    class="card"
    :class="[
      variant !== 'default' ? `card--${variant}` : undefined,
      {
        'card--condensed':
          (props.condensed !== undefined || props.expanded !== undefined || props.expandable) &&
          isCondensed,
        'card--expanded':
          (props.condensed !== undefined || props.expanded !== undefined || props.expandable) &&
          isExpanded,
        'card--expandable': expandable,
        'card--interactive': interactive,
        'new-highlight': isNewHighlight,
        'is-map-focused': mapFocused,
        'card--has-banner': bannerUrl || $slots.banner,
        'card--banner-left': (bannerUrl || $slots.banner) && effectiveBannerPosition === 'left',
      },
    ]"
    :style="
      variant === 'tile' && tileColor
        ? {
            background: tileColor.startsWith('#') ? `${tileColor}0d` : tileColor,
            borderColor: tileColor,
            '--tile-shadow': tileColor.startsWith('#')
              ? `${tileColor}${tileShadowAlpha}`
              : tileColor,
          }
        : undefined
    "
    :role="expandable || interactive ? 'button' : undefined"
    :tabindex="expandable || interactive ? 0 : undefined"
    :aria-expanded="expandable ? isExpanded : undefined"
    @click="handleCardClick"
    @keydown="handleCardKeydown"
  >
    <!-- Sparkle Badge für Echtzeit-Updates von anderen Nutzern -->
    <span
      v-if="isNewHighlight"
      class="card-sparkle-badge"
      title="Neu von Mitreisenden hinzugefügt oder geändert"
      aria-label="Neu aktualisiert"
    >
      <AppIcon :icon="ACTION_ICONS.sparkles" :size="13" group="actions" />
    </span>

    <!-- Tile Badge Icon (Dashboard Style) -->
    <div
      v-if="variant === 'tile' && (tileIcon || $slots['tile-icon'])"
      class="card-tile-icon"
      :style="{
        background: tileColor.startsWith('#') ? `${tileColor}26` : 'var(--color-primary-tint)',
        borderColor: tileColor,
        '--tile-icon-shadow': tileColor.startsWith('#')
          ? `${tileColor}26`
          : 'var(--color-primary-tint)',
      }"
    >
      <slot name="tile-icon">
        <AppIcon
          v-if="tileIcon"
          :icon="tileIcon"
          group="navigation"
          :size="18"
          :color="tileColor"
        />
      </slot>
    </div>

    <!-- Banner (Top oder Left) -->
    <div v-if="bannerUrl || $slots.banner" class="card-banner">
      <slot name="banner">
        <img v-if="bannerUrl" :src="bannerUrl" :alt="bannerAlt" class="card-banner-img" />
      </slot>
    </div>

    <template v-if="bannerUrl || $slots.banner || $slots.header || $slots.footer">
      <div class="card-content">
        <div v-if="$slots.header" class="card-header">
          <slot name="header" />
        </div>

        <div class="card-body">
          <slot />

          <div v-if="isCondensed && $slots.condensed" class="card-condensed-slot">
            <slot name="condensed" />
          </div>

          <div v-if="isExpanded && ($slots.expanded || $slots.details)" class="card-expanded-slot">
            <slot name="expanded">
              <slot name="details" />
            </slot>
          </div>
        </div>

        <div v-if="$slots.footer" class="card-footer">
          <slot name="footer" />
        </div>
      </div>
    </template>
    <template v-else>
      <slot />

      <div v-if="isCondensed && $slots.condensed" class="card-condensed-slot">
        <slot name="condensed" />
      </div>

      <div v-if="isExpanded && ($slots.expanded || $slots.details)" class="card-expanded-slot">
        <slot name="expanded">
          <slot name="details" />
        </slot>
      </div>
    </template>
  </component>
</template>

<style>
.card {
  position: relative;
  background-color: var(--color-surface);
  background-image: var(--gradient-surface-3d);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: var(--space-4);
  box-shadow: var(--shadow-card);
  transition:
    padding 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.2s ease,
    --surface-grad-top 0.2s ease,
    --surface-grad-bottom 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.card:focus-within {
  z-index: var(--z-card-elevated, 5);
}

.card.is-map-focused {
  position: relative;
  z-index: var(--z-map-focus, 6);
  border-color: var(--color-primary) !important;
  box-shadow:
    0 0 0 2px var(--color-primary),
    0 8px 24px -4px color-mix(in srgb, var(--color-primary) 32%, transparent),
    0 2px 8px -1px color-mix(in srgb, var(--color-primary) 20%, transparent) !important;
  animation: cardMapFocusPulse 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (hover: hover) {
  .card.is-map-focused:hover {
    border-color: var(--color-primary) !important;
    box-shadow:
      0 0 0 2.5px var(--color-primary),
      0 12px 28px -4px color-mix(in srgb, var(--color-primary) 40%, transparent),
      0 4px 12px -1px color-mix(in srgb, var(--color-primary) 25%, transparent) !important;
  }
}

@keyframes cardMapFocusPulse {
  0% {
    box-shadow:
      0 0 0 0px var(--color-primary),
      0 0 0 0 transparent;
  }
  50% {
    box-shadow:
      0 0 0 3.5px var(--color-primary),
      0 0 24px 4px color-mix(in srgb, var(--color-primary) 45%, transparent);
  }
  100% {
    box-shadow:
      0 0 0 2px var(--color-primary),
      0 8px 24px -4px color-mix(in srgb, var(--color-primary) 32%, transparent),
      0 2px 8px -1px color-mix(in srgb, var(--color-primary) 20%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card.is-map-focused {
    animation: none;
  }
}
</style>

<style scoped>
/* Varianten-Styles von Card.vue */
.card--muted {
  background: var(--color-hover);
}

.card--flat {
  background-image: none;
  box-shadow: none;
  border-color: var(--color-border);
}

.card--elevated {
  box-shadow: var(--shadow-card-elevated);
}

.card--polaroid {
  background-color: #ffffff;
  background-image: var(--gradient-surface-3d);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-card-polaroid);
  padding: 8px 8px 14px 8px;
  transform: rotate(var(--card-rotate, -0.75deg));
  transform-origin: center center;
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease,
    background-color 0.2s ease,
    --surface-grad-top 0.2s ease,
    --surface-grad-bottom 0.2s ease;
}

/* Subtile Fächer-Drehung für Geschwister-Polaroids ohne explizites --card-rotate (z. B. in Storybook/Listen) */
.card--polaroid:nth-child(2n) {
  --card-rotate: 0.75deg;
}
.card--polaroid:nth-child(3n) {
  --card-rotate: -0.6deg;
}
.card--polaroid:nth-child(4n) {
  --card-rotate: 0.95deg;
}
.card--polaroid:nth-child(5n) {
  --card-rotate: -1.1deg;
}
.card--polaroid:nth-child(6n) {
  --card-rotate: 0.65deg;
}

@media (hover: hover) {
  .card--polaroid:not(.card--expanded):not(.expanded):hover {
    transform: translateY(-4px) rotate(calc(var(--card-rotate, -0.75deg) * 0.4)) scale(1.02);
    box-shadow: var(--shadow-card-polaroid-hover);
    --surface-grad-top: var(--gradient-surface-hover-top);
    --surface-grad-bottom: var(--gradient-surface-hover-bottom);
    z-index: 5;
  }
}

.card--polaroid:not(.card--expanded):not(.expanded):active {
  transform: translateY(1px) rotate(var(--card-rotate, -0.75deg)) scale(0.985);
  box-shadow: var(--shadow-card-polaroid-active);
  --surface-grad-top: rgba(0, 0, 0, 0.04);
  --surface-grad-bottom: transparent;
}

.card--polaroid.card--expanded,
.card--polaroid.expanded {
  transform: translateY(0) rotate(0deg) scale(1);
}

:root[data-theme='dark'] .card--polaroid {
  background-color: #2a2825;
  box-shadow: var(--shadow-card-polaroid);
}

@media (hover: hover) {
  :root[data-theme='dark'] .card--polaroid:not(.card--expanded):not(.expanded):hover {
    box-shadow: var(--shadow-card-polaroid-hover);
    background-color: #2e2b28;
  }
}

:root[data-theme='dark'] .card--polaroid:not(.card--expanded):not(.expanded):active {
  box-shadow: var(--shadow-card-polaroid-active);
  --surface-grad-top: rgba(0, 0, 0, 0.06);
  --surface-grad-bottom: transparent;
  background-color: #252320;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .card--polaroid {
    background-color: #2a2825;
    box-shadow: var(--shadow-card-polaroid);
  }

  @media (hover: hover) {
    :root:not([data-theme='light']) .card--polaroid:not(.card--expanded):not(.expanded):hover {
      box-shadow: var(--shadow-card-polaroid-hover);
      background-color: #2e2b28;
    }
  }

  :root:not([data-theme='light']) .card--polaroid:not(.card--expanded):not(.expanded):active {
    box-shadow: var(--shadow-card-polaroid-active);
    --surface-grad-top: rgba(0, 0, 0, 0.06);
    --surface-grad-bottom: transparent;
    background-color: #252320;
  }
}

.card--tile {
  position: relative;
  background-color: var(--color-surface);
  background-image: var(--gradient-surface-3d);
  box-shadow:
    inset 0 1px 0 var(--shadow-control-highlight),
    0 2px 6px var(--tile-shadow, var(--shadow-sm));
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.2s ease,
    --surface-grad-top 0.2s ease,
    --surface-grad-bottom 0.2s ease;
  margin-top: 18px;
}

@media (hover: hover) {
  .card--tile:hover {
    transform: translateY(-4px) scale(1.015);
    box-shadow:
      inset 0 1px 0 var(--shadow-control-highlight-strong),
      0 10px 28px var(--tile-shadow, var(--shadow-md));
    --surface-grad-top: var(--gradient-surface-hover-top);
    --surface-grad-bottom: var(--gradient-surface-hover-bottom);
    z-index: 5;
  }
}

.card--tile:active {
  transform: translateY(1px) scale(0.985);
  box-shadow:
    inset 0 1.5px 3px rgba(0, 0, 0, 0.25),
    0 1px 2px var(--tile-shadow, var(--shadow-xs));
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
  box-shadow: 0 2px 6px var(--tile-icon-shadow, var(--shadow-sm));
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

/* Expandable & Interactive Card (Hover-Lift & 3D-Kanten) */
.card--expandable,
.card--interactive {
  cursor: pointer;
  user-select: none;
  box-shadow: var(--shadow-card-interactive);
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease,
    background 0.2s ease;
}

.card:focus-visible,
.card--expandable:focus-visible,
.card--interactive:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

@media (hover: hover) {
  .card--expandable:not(.card--expanded):hover,
  .card--interactive:not(.card--expanded):hover {
    transform: translateY(-3px) scale(1.012);
    border-color: var(--color-primary-dark);
    box-shadow: var(--shadow-card-hover);
    background-color: color-mix(in srgb, white 2.5%, var(--color-surface));
    z-index: 5;
  }
}

.card--expandable:not(.card--expanded):active,
.card--interactive:not(.card--expanded):active {
  transform: translateY(1px) scale(0.988);
  box-shadow: var(--shadow-card-active);
  background-color: color-mix(in srgb, black 2%, var(--color-surface));
}

.card--expandable.card--expanded {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-card-elevated);
  transform: translateY(0) scale(1);
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card--expandable,
  .card--interactive,
  .card--tile,
  .card--polaroid {
    transform: none !important;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      box-shadow 0.15s ease !important;
  }
}

/* Condensed (Kompakter Zustand) */
.card--condensed:not(.card--banner-left) {
  padding: var(--space-2) var(--space-3);
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
  transition: height 0.2s ease;
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
  width: 140px;
  min-width: 140px;
  flex: 0 0 140px;
  height: auto;
  position: relative;
  background: var(--color-hover);
  transition:
    width 0.2s ease,
    min-width 0.2s ease,
    flex-basis 0.2s ease;
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

.card-expanded-slot {
  margin-top: var(--space-2);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card--polaroid,
  .card--expandable,
  .card--interactive,
  .card--tile {
    transition: none !important;
    transform: none !important;
  }
}
</style>

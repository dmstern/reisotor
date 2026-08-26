<script setup lang="ts">
import { ref, computed } from 'vue';
import type { IconDef } from '../../utils/icon';
import AppIcon from '../AppIcon.vue';

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
     */
    variant?: 'default' | 'muted' | 'flat' | 'elevated' | 'tile';
    /** Ob die Karte sich im komprimierten/kompakten Zustand befindet. */
    condensed?: boolean;
    /** Ob die Karte sich im aufgeklappten Zustand befindet (Invers zu condensed). */
    expanded?: boolean;
    /** Ob die Karte interaktiv per Klick aufklappbar/zuklappbar ist (wie SpotCard/ExcursionCard in der Karten-View). */
    expandable?: boolean;
    /** Optionale URL für ein Bild-Banner der Karte. */
    bannerUrl?: string;
    /** Alt-Text für das Bild-Banner. */
    bannerAlt?: string;
    /** Ausrichtung des Banners: 'top' (oben), 'left' (links als Schmal-Vorschaubild) oder 'auto' (links wenn condensed, oben wenn expanded). */
    bannerPosition?: 'top' | 'left' | 'auto';
    /** Hebt die Karte mit dem Notiz/Live-Sync Highlight-Rand hervor (.new-highlight). */
    highlight?: boolean;
    /** Akzentfarbe für die 'tile'-Variante (Hex oder CSS var). */
    tileColor?: string;
    /** IconDef für das runde Schwebelogo der 'tile'-Variante. */
    tileIcon?: IconDef;
  }>(),
  {
    variant: 'default',
    condensed: undefined,
    expanded: undefined,
    expandable: false,
    bannerAlt: '',
    bannerPosition: 'auto',
    highlight: false,
    tileColor: '#2a7f74',
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
  if (props.condensed !== undefined) return props.condensed;
  if (props.expanded !== undefined) return !props.expanded;
  return props.expandable ? internalCondensed.value : false;
});

const isExpanded = computed(() => {
  if (props.expanded !== undefined) return props.expanded;
  if (props.condensed !== undefined) return !props.condensed;
  return props.expandable ? !internalCondensed.value : false;
});

const effectiveBannerPosition = computed(() => {
  if (props.bannerPosition !== 'auto') return props.bannerPosition;
  return isCondensed.value ? 'left' : 'top';
});

function handleCardClick(event: MouseEvent) {
  emit('click', event);
  if (props.expandable) {
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
}

function handleCardKeydown(event: KeyboardEvent) {
  if (!props.expandable) return;
  if (event.key === 'Enter' || event.key === ' ') {
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
}
</script>

<template>
  <div
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
        'new-highlight': highlight,
        'card--has-banner': bannerUrl || $slots.banner,
        'card--banner-left': (bannerUrl || $slots.banner) && effectiveBannerPosition === 'left',
      },
    ]"
    :style="
      variant === 'tile' && tileColor
        ? { background: tileColor.startsWith('#') ? `${tileColor}0d` : tileColor }
        : undefined
    "
    :role="expandable ? 'button' : undefined"
    :tabindex="expandable ? 0 : undefined"
    :aria-expanded="expandable ? isExpanded : undefined"
    @click="handleCardClick"
    @keydown="handleCardKeydown"
  >
    <!-- Tile Badge Icon (Dashboard Style) -->
    <div
      v-if="variant === 'tile' && (tileIcon || $slots['tile-icon'])"
      class="card-tile-icon"
      :style="{
        background: tileColor.startsWith('#') ? `${tileColor}26` : 'var(--color-primary-tint)',
        borderColor: tileColor,
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
  </div>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  transition:
    padding 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Varianten-Styles von Card.vue */
.card--muted {
  background: var(--color-hover);
}

.card--flat {
  box-shadow: none;
  border-color: var(--color-border);
}

.card--elevated {
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.06),
    0 12px 28px rgba(0, 0, 0, 0.08);
}

.card--tile {
  position: relative;
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
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

/* Expandable Interactive Card (Karten-View Spot/Tour Verhalten) */
.card--expandable {
  cursor: pointer;
  user-select: none;
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease,
    background 0.2s ease;
}

.card--expandable:hover {
  transform: translateY(-2px);
  border-color: var(--color-primary-dark);
  box-shadow: var(--shadow-md);
}

.card--expandable:active {
  transform: scale(0.98) translateY(0);
}

.card--expandable.card--expanded {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
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
</style>

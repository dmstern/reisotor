<script setup lang="ts">
import type { ExcursionLeg, Spot } from '../api/types';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIcon } from '../utils/travelTypeIcon';
import { getLegDurationParts, getLegTooltip } from '../composables/useTourSerpentine';

defineProps<{
  variant: 'horizontal' | 'row-break';
  fromSpot: Spot;
  toSpot: Spot;
  leg?: ExcursionLeg | null;
  isRtl?: boolean;
  alignSide?: 'left' | 'right';
  singleCol?: boolean;
}>();

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<template>
  <!-- Horizontaler Teilstrecken-Verbinder zwischen zwei Kacheln -->
  <div
    v-if="variant === 'horizontal'"
    class="tour-leg-connector is-horizontal"
    :class="{ 'is-rtl': isRtl }"
  >
    <div
      v-if="leg"
      class="tour-leg-pill is-horizontal-leg"
      tabindex="0"
      role="button"
      :title="getLegTooltip(leg, fromSpot, toSpot)"
      :aria-label="`Weg von ${fromSpot.title} nach ${toSpot.title} bearbeiten`"
      @click.stop="emit('click')"
      @keydown.enter.self="emit('click')"
      @keydown.space.self.prevent="emit('click')"
    >
      <span class="leg-pill-icon">
        {{ travelTypeIcon(leg.transport_type ?? null) }}
      </span>
      <span v-if="getLegDurationParts(leg)" class="leg-pill-duration">
        <span
          v-for="(part, pIdx) in getLegDurationParts(leg)"
          :key="pIdx"
          class="leg-duration-part"
        >
          {{ part }}
        </span>
      </span>
      <span v-else-if="leg.departure_time" class="leg-pill-duration">
        <span class="leg-duration-part">{{ leg.departure_time }}</span>
      </span>
      <span v-if="leg.amount != null" class="leg-pill-cost nobr">
        {{ leg.amount.toFixed(2).replace('.', ',') }}&nbsp;€
      </span>
    </div>

    <button
      v-else
      type="button"
      class="tour-leg-add-btn is-horizontal-leg"
      title="Weg-Details eintragen"
      :aria-label="`Weg-Details zwischen ${fromSpot.title} und ${toSpot.title} eintragen`"
      @click.stop="emit('click')"
    >
      <AppIcon :icon="ACTION_ICONS.add" :size="12" group="actions" />
      <span class="leg-add-text">Weg</span>
    </button>
  </div>

  <!-- Zeilenumbruch-Verbinder im Schlangen-Layout -->
  <div
    v-else-if="variant === 'row-break'"
    class="tour-row-break"
    :class="[alignSide ? 'align-' + alignSide : '', { 'single-col': singleCol }]"
  >
    <div class="tour-row-break-inner">
      <div
        v-if="leg"
        :key="`leg-${fromSpot.id}-${toSpot.id}`"
        class="tour-leg-pill is-row-break"
        tabindex="0"
        role="button"
        :title="getLegTooltip(leg, fromSpot, toSpot)"
        :aria-label="`Weg von ${fromSpot.title} nach ${toSpot.title} bearbeiten`"
        @click.stop="emit('click')"
        @keydown.enter.self="emit('click')"
        @keydown.space.self.prevent="emit('click')"
      >
        <span class="leg-pill-icon">
          {{ travelTypeIcon(leg.transport_type ?? null) }}
        </span>
        <span v-if="leg.transport_type" class="leg-pill-type">
          {{ leg.transport_type }}
        </span>
        <span v-if="getLegDurationParts(leg)" class="leg-pill-duration">
          <span
            v-for="(part, pIdx) in getLegDurationParts(leg)"
            :key="pIdx"
            class="leg-duration-part"
          >
            {{ part }}
          </span>
        </span>
        <span v-else-if="leg.departure_time" class="leg-pill-duration">
          <span class="leg-duration-part">{{ leg.departure_time }}</span>
        </span>
        <span v-if="leg.amount != null" class="leg-pill-cost nobr">
          {{ leg.amount.toFixed(2).replace('.', ',') }}&nbsp;€
        </span>
      </div>

      <div v-else class="tour-leg-add-wrap">
        <button
          type="button"
          class="tour-leg-add-btn is-row-break"
          title="Weg-Details eintragen"
          :aria-label="`Weg-Details zwischen ${fromSpot.title} und ${toSpot.title} eintragen`"
          @click.stop="emit('click')"
        >
          <AppIcon :icon="ACTION_ICONS.add" :size="12" group="actions" />
          <span class="leg-add-text">Weg-Details eintragen</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Horizontaler Teilstrecken-Verbinder ("hochkant" zwischen 2 Kacheln) */
.tour-leg-connector.is-horizontal {
  flex: 0 0 var(--tour-conn-width, 76px);
  width: var(--tour-conn-width, 76px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  padding: 0 4px;
}

/* Zeilenumbruch-Verbinder im Schlangen-Layout */
.tour-row-break {
  display: flex;
  width: 100%;
  position: relative;
  z-index: 2;
  margin: var(--space-2) 0;
}

.tour-row-break.align-right {
  justify-content: flex-end;
}

.tour-row-break.align-left {
  justify-content: flex-start;
}

.tour-row-break-inner {
  width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  max-width: calc(
    (100% - (var(--tour-cols, 1) - 1) * var(--tour-conn-width, 76px)) / var(--tour-cols, 1)
  );
  display: flex;
  justify-content: center;
  align-items: center;
}

.tour-row-break.single-col .tour-row-break-inner {
  width: 100%;
  max-width: 100%;
}

/* Teilstrecken-Pill für vorhandene Teilstrecken */
.tour-leg-pill {
  @include control-physics-progressive;
  @include touch-target($expand: true);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height-sm, 36px);
  background-color: var(--color-surface);
  border: 1.5px solid var(--color-border-strong);
  cursor: pointer;
}

@include can-hover {
  .tour-leg-pill:hover {
    background-color: var(--color-hover);
    border-color: var(--tour-theme-color, var(--color-primary));
  }
}

.tour-leg-pill:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.tour-leg-pill.is-horizontal-leg {
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-1);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  width: 100%;
  max-width: 68px;
  text-align: center;
}

.tour-leg-pill.is-row-break {
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  corner-shape: round;
  max-width: 90%;
  text-align: center;
}

/* Button für noch nicht erfasste Teilstrecke */
.tour-leg-add-btn {
  @include control-physics-progressive;
  @include touch-target($expand: true);
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-height-sm, 36px);
  border: 1.5px dashed var(--color-border-strong);
  background-color: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
}

@include can-hover {
  .tour-leg-add-btn:hover {
    background-color: var(--tour-theme-tint, var(--color-hover));
    border-color: var(--tour-theme-color, var(--color-primary));
    color: var(--tour-theme-color, var(--color-primary));
  }
}

.tour-leg-add-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.tour-leg-add-btn.is-horizontal-leg {
  flex-direction: column;
  gap: 3px;
  padding: var(--space-2) 3px;
  width: 100%;
  max-width: 68px;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  text-align: center;
}

.tour-leg-add-btn.is-row-break {
  flex-direction: row;
  gap: 6px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  corner-shape: round;
}

.tour-leg-add-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.leg-add-text {
  font-size: 0.65rem;
  font-weight: 500;
  line-height: 1.1;
  white-space: nowrap;
}

.tour-leg-add-btn.is-row-break .leg-add-text {
  font-size: var(--font-size-xs);
}

.leg-pill-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  line-height: 1;
  color: var(--tour-theme-color, var(--color-primary));
}

.leg-pill-type {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.15;
  white-space: nowrap;
}

.leg-pill-duration {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  column-gap: var(--space-1);
  row-gap: 1px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1.15;
  text-align: center;
}

.leg-duration-part {
  white-space: nowrap;
}

.leg-pill-cost {
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--tour-theme-color, var(--color-primary));
  line-height: 1.1;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .tour-leg-pill,
  .tour-leg-add-btn {
    transition: none;
  }
}
</style>

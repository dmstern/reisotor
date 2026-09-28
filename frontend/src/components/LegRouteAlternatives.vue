<script setup lang="ts">
import { computed } from 'vue';
import type { RouteResult } from '../api/types';
import type { IconDef } from '../utils/icon';
import { IconBolt } from '@tabler/icons-vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { ROUTE_PREFERENCE_OPTIONS } from '../utils/legTransportConfig';
import { formatDistance, formatDuration, formatDiffDuration } from '../utils/formatRoute';
import SegmentedToggle from './SegmentedToggle.vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{
  routes: RouteResult[];
  selectedRouteIndex: number;
  routePreference: 'fastest' | 'shortest';
  fastestRouteIndex: number;
  shortestRouteIndex: number;
  suggestedRouteIndex: number;
  calculatedDistanceMeters?: number | null;
  calculatedDurationSeconds?: number | null;
}>();

const emit = defineEmits<{
  (e: 'select-route', index: number): void;
  (e: 'update:routePreference', pref: 'fastest' | 'shortest'): void;
}>();

const fastestRouteIconDef: IconDef = {
  id: 'bolt',
  emoji: '⚡',
  outline: IconBolt,
};

const preferenceLabel = computed(() => {
  return props.routes.length > 1 ? 'Bevorzugen:' : 'Berechnete Route:';
});

const singleRouteDuration = computed(() => {
  return props.routes[0]?.duration_seconds ?? props.calculatedDurationSeconds ?? null;
});

const singleRouteDistance = computed(() => {
  return props.routes[0]?.distance_meters ?? props.calculatedDistanceMeters ?? null;
});

function onPreferenceChange(val: string) {
  emit('update:routePreference', val as 'fastest' | 'shortest');
}
</script>

<template>
  <div class="leg-route-alternatives">
    <!-- Präferenz-Umschalter (Schnellste vs Kürzeste) -->
    <div class="route-preference-row">
      <span class="route-preference-label">{{ preferenceLabel }}</span>
      <SegmentedToggle
        class="route-preference-toggle"
        :model-value="props.routePreference"
        :options="ROUTE_PREFERENCE_OPTIONS"
        aria-label="Routenpräferenz"
        @update:model-value="onPreferenceChange"
      />
    </div>

    <!-- Mehrere Routenalternativen (bis zu 3) als interaktive Liste -->
    <div
      v-if="props.routes.length > 1"
      class="route-alternatives-list"
      role="radiogroup"
      aria-label="Verfügbare Routenalternativen"
    >
      <button
        v-for="(r, idx) in props.routes"
        :key="idx"
        type="button"
        class="route-alt-card"
        :class="{ 'is-selected': idx === props.selectedRouteIndex }"
        role="radio"
        :aria-checked="idx === props.selectedRouteIndex"
        @click="emit('select-route', idx)"
      >
        <div class="route-alt-radio" aria-hidden="true">
          <span v-if="idx === props.selectedRouteIndex" class="route-alt-radio-dot"></span>
        </div>
        <div class="route-alt-content">
          <div class="route-alt-title-row">
            <span class="route-alt-name">Route {{ idx + 1 }}</span>
            <div class="route-alt-badges">
              <span
                v-if="idx === props.fastestRouteIndex"
                class="route-alt-badge badge-fastest"
                title="Schnellste Reisedauer"
              >
                <AppIcon :icon="fastestRouteIconDef" :size="11" group="actions" />
                Schnellste
              </span>
              <span
                v-if="idx === props.shortestRouteIndex"
                class="route-alt-badge badge-shortest"
                title="Kürzeste Fahrtstrecke"
              >
                <AppIcon :icon="ACTION_ICONS.distance" :size="11" group="actions" />
                Kürzeste
              </span>
              <span
                v-if="idx === props.suggestedRouteIndex"
                class="route-alt-badge badge-suggested"
                title="Empfehlung anhand gewählter Präferenz"
              >
                <AppIcon :icon="ACTION_ICONS.recommended" :size="11" group="actions" />
                Vorschlag
              </span>
            </div>
          </div>
          <div class="route-alt-stats">
            <span class="route-alt-duration">{{ formatDuration(r.duration_seconds) }}</span>
            <span class="route-alt-sep">•</span>
            <span class="route-alt-distance">{{ formatDistance(r.distance_meters) }}</span>
            <span
              v-if="
                idx !== props.fastestRouteIndex &&
                props.fastestRouteIndex >= 0 &&
                props.routes[props.fastestRouteIndex] &&
                r.duration_seconds > props.routes[props.fastestRouteIndex].duration_seconds
              "
              class="route-alt-diff"
            >
              (+{{
                formatDiffDuration(
                  r.duration_seconds - props.routes[props.fastestRouteIndex].duration_seconds
                )
              }})
            </span>
          </div>
        </div>
      </button>
    </div>

    <!-- Nur 1 Route vorhanden -> Kasten im gleichen Stil wie die Alternativen (ohne Radio-Button) -->
    <div v-else class="route-alt-card route-alt-card--single is-selected">
      <div class="route-alt-content">
        <div class="route-alt-title-row">
          <span class="route-alt-name">Route 1</span>
        </div>
        <div class="route-alt-stats route-calc-stats">
          <span class="route-alt-duration">{{ formatDuration(singleRouteDuration) }}</span>
          <span
            v-if="singleRouteDuration != null && singleRouteDistance != null"
            class="route-alt-sep"
          >
            •
          </span>
          <span class="route-alt-distance">{{ formatDistance(singleRouteDistance) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leg-route-alternatives {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.route-preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
}

.route-preference-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.route-preference-toggle {
  flex: 1;
  max-width: 320px;
}

.route-preference-toggle :deep(.segmented-option) {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.route-alternatives-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-alt-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
  width: 100%;
}

.route-alt-card:hover {
  border-color: var(--color-primary-light);
  background: var(--color-hover);
}

.route-alt-card.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.route-alt-radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: border-color 0.15s ease;
}

.route-alt-card.is-selected .route-alt-radio {
  border-color: var(--color-primary);
}

.route-alt-radio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary);
}

.route-alt-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.route-alt-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.route-alt-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.route-alt-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.route-alt-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 999px;
  line-height: 1.3;
}

.badge-fastest {
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  color: var(--color-primary-dark);
}

.badge-shortest {
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  color: var(--color-success);
}

.badge-suggested {
  background: var(--color-warning-tint);
  color: var(--color-warning-dark);
}

:root[data-theme='dark'] .badge-fastest {
  color: var(--color-primary-light);
}

.route-alt-stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.route-alt-duration {
  font-weight: 600;
  color: var(--color-text);
}

.route-alt-card.is-selected .route-alt-duration {
  color: var(--color-primary);
}

.route-alt-diff {
  color: var(--color-text-muted);
  font-style: italic;
}

.route-alt-card--single {
  cursor: default;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-alt-card--single:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

@keyframes route-content-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .route-alternatives-list,
  .route-alt-card--single {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}

@media (max-width: 600px) {
  .route-preference-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .route-preference-toggle {
    max-width: 100%;
    width: 100%;
  }
}
</style>

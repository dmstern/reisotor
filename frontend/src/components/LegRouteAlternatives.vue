<script setup lang="ts">
import { computed } from 'vue';
import type { RouteResult } from '../api/types';
import type { IconDef } from '../utils/icon';
import { IconBolt } from '@tabler/icons-vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDistance, formatDuration, formatDiffDuration } from '../utils/formatRoute';
import AppIcon from './AppIcon.vue';
import Radio from './primitives/Radio.vue';

const props = withDefaults(
  defineProps<{
    routes: RouteResult[];
    selectedRouteIndex?: number;
    routePreference?: 'fastest' | 'shortest';
    fastestRouteIndex?: number;
    shortestRouteIndex?: number;
    suggestedRouteIndex?: number;
    calculatedDistanceMeters?: number | null;
    calculatedDurationSeconds?: number | null;
  }>(),
  {
    selectedRouteIndex: 0,
    routePreference: 'fastest',
    fastestRouteIndex: -1,
    shortestRouteIndex: -1,
    suggestedRouteIndex: -1,
    calculatedDistanceMeters: null,
    calculatedDurationSeconds: null,
  }
);

const emit = defineEmits<{
  (e: 'select-route', index: number): void;
  (e: 'update:routePreference', pref: 'fastest' | 'shortest'): void;
}>();

const fastestRouteIconDef: IconDef = {
  id: 'bolt',
  emoji: '⚡',
  outline: IconBolt,
};

const singleRouteDuration = computed(() => {
  return props.routes[0]?.duration_seconds ?? props.calculatedDurationSeconds ?? null;
});

const singleRouteDistance = computed(() => {
  return props.routes[0]?.distance_meters ?? props.calculatedDistanceMeters ?? null;
});
</script>

<template>
  <div class="leg-route-alternatives">
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
        <Radio
          :checked="idx === props.selectedRouteIndex"
          visual-only
          size="sm"
          class="route-alt-radio"
        />
        <div class="route-alt-content">
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
          <div
            v-if="idx === props.fastestRouteIndex || idx === props.shortestRouteIndex"
            class="route-alt-badges"
          >
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
          </div>
        </div>
      </button>
    </div>

    <!-- Nur 1 Route vorhanden -> Kasten im gleichen Stil wie die Alternativen (ohne Radio-Button) -->
    <div v-else class="route-alt-card route-alt-card--single is-selected">
      <div class="route-alt-content">
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

.route-alternatives-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  padding: 1px;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-alt-card {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: none;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  box-sizing: border-box;
  transition:
    border-color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    background-color 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.16s cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
}

.route-alt-card:hover:not(.is-selected) {
  border-color: var(--color-primary);
  background: var(--color-hover);
}

.route-alt-card:active {
  transform: scale(0.995);
}

.route-alt-card.is-selected {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.route-alt-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.route-alt-badges {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  flex-shrink: 0;
}

.route-alt-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px var(--space-1);
  font-size: var(--font-size-xs);
  font-weight: 600;
  border-radius: var(--radius-pill);
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

:root[data-theme='dark'] .badge-fastest {
  color: var(--color-primary);
}

.route-alt-stats {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.route-alt-duration {
  font-weight: 600;
  color: var(--color-text);
  transition: color 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.route-alt-card.is-selected .route-alt-duration {
  color: var(--color-primary);
}

.route-alt-diff {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-style: italic;
}

.route-alt-card--single {
  cursor: default;
  border: 1.5px solid var(--color-primary);
  background: var(--color-primary-tint);
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-alt-card--single:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
  transform: none;
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
  .route-alt-card,
  .route-alt-duration,
  .route-alt-card--single {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}
</style>

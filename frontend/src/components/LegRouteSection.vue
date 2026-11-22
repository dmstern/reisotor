<script setup lang="ts">
import { computed } from 'vue';
import type { RouteResult, Spot } from '../api/types';
import Alert from './primitives/Alert.vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import LegMiniMap from './LegMiniMap.vue';
import LegRouteAlternatives from './LegRouteAlternatives.vue';
import { ROUTE_MODE_OPTIONS, ROUTE_PREFERENCE_OPTIONS } from '../utils/legTransportConfig';
import { createCapturedError, type CapturedError } from '../composables/useErrorNotifier';

export type RoutePreference = 'fastest' | 'shortest';
export type RouteDisplayMode = 'exact' | 'direct';

const routePreference = defineModel<RoutePreference>('routePreference', { default: 'fastest' });
const routeDisplayMode = defineModel<RouteDisplayMode>('routeDisplayMode', { default: 'exact' });

const props = defineProps<{
  isDisabled?: boolean;
  isCalculatingRoute: boolean;
  hasExactRoute: boolean;
  routeCalculationError: string | null;
  routeCalculationErrorDetails?: CapturedError | null;
  transportType: string;
  fromSpot?: Spot | null;
  toSpot?: Spot | null;
  calculatedRoutes: RouteResult[];
  selectedRouteIndex: number;
  fastestRouteIndex: number;
  shortestRouteIndex: number;
  suggestedRouteIndex: number;
  calculatedDistanceMeters: number | null;
  calculatedDurationSeconds: number | null;
}>();

const emit = defineEmits<{
  (e: 'calculateRoute'): void;
  (e: 'selectRoute', index: number): void;
}>();

const resolvedRouteErrorDetails = computed<CapturedError | undefined>(() => {
  if (!props.routeCalculationError) {
    return undefined;
  }

  return (
    props.routeCalculationErrorDetails ??
    createCapturedError(new Error(props.routeCalculationError), {
      kind: 'api',
      componentInfo: `LegRouteSection (transport=${props.transportType}, preference=${routePreference.value})`,
      summaryOverride: `Routenberechnung (${props.transportType}): ${props.routeCalculationError}`,
    })
  );
});
</script>

<template>
  <section v-if="!isDisabled" class="route-calc-fieldset" aria-label="Routenführung">
    <!-- Zustand 1: Noch keine Route berechnet -> Aufforderung zur Berechnung -->
    <div v-if="!hasExactRoute" class="route-calc-empty">
      <div class="route-calc-header">
        <div class="route-calc-info">
          <span class="route-calc-hint">
            Exakte Route, Distanz und Fahrzeit für {{ transportType }} berechnen.
          </span>
          <Badge
            v-if="isCalculatingRoute"
            variant="primary"
            size="sm"
            class="route-calc-badge route-calc-badge--loading"
          >
            <LoadingSpinner size="sm" decorative />
            Route wird berechnet…
          </Badge>
        </div>
        <div class="route-calc-init-controls">
          <SegmentedToggle
            class="route-preference-toggle"
            :model-value="routePreference"
            :options="ROUTE_PREFERENCE_OPTIONS"
            aria-label="Routenpräferenz"
            @update:model-value="(val) => (routePreference = val as RoutePreference)"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            class="btn-calc-route"
            :loading="isCalculatingRoute"
            @click="emit('calculateRoute')"
          >
            Route berechnen
          </Button>
        </div>
      </div>

      <Alert
        v-if="routeCalculationError"
        variant="danger"
        size="sm"
        reportable
        :description="routeCalculationError"
        :error-details="resolvedRouteErrorDetails"
        :error-context="`Routenberechnung (${transportType})`"
        class="route-calc-error-alert"
      />
    </div>

    <!-- Zustand 2: Route liegt vor -> Vollflächige Mini-Map mit schwebender Mini-Card -->
    <div v-else class="route-calc-active route-calc-map-wrap">
      <!-- Mini-Map der Teilstrecke mit Start-, Ziel-Pins und gerouteten Alternativen -->
      <div class="route-mini-map-container">
        <LegMiniMap
          :from-spot="fromSpot"
          :to-spot="toSpot"
          :routes="calculatedRoutes"
          :selected-route-index="selectedRouteIndex"
          :transport-type="transportType"
          :route-display-mode="routeDisplayMode"
          @select-route="(idx) => emit('selectRoute', idx)"
        />
      </div>

      <!-- Schwebende Mini-Card (analog Polaroid-Card in LocationPicker.vue) -->
      <div class="route-floating-card">
        <!-- 1. Routen-Modus Umschalter (Exakte Route / Luftlinie) -->
        <SegmentedToggle
          class="route-mode-toggle"
          :model-value="routeDisplayMode"
          :options="ROUTE_MODE_OPTIONS"
          aria-label="Routenführung auf der Karte"
          @update:model-value="(val) => (routeDisplayMode = val as RouteDisplayMode)"
        />

        <!-- 2. Routen-Suchergebnisse / Luftlinie-Hinweis -->
        <div class="route-card-body">
          <!-- Exakte Route: Routenberechnung & Alternativen -->
          <div
            class="route-mode-pane route-mode-pane--exact"
            :class="{ 'is-active': routeDisplayMode === 'exact' }"
            :inert="routeDisplayMode !== 'exact' ? true : undefined"
          >
            <div class="route-mode-pane-inner">
              <LegRouteAlternatives
                :routes="calculatedRoutes"
                :selected-route-index="selectedRouteIndex"
                :route-preference="routePreference"
                :fastest-route-index="fastestRouteIndex"
                :shortest-route-index="shortestRouteIndex"
                :suggested-route-index="suggestedRouteIndex"
                :calculated-distance-meters="calculatedDistanceMeters"
                :calculated-duration-seconds="calculatedDurationSeconds"
                @select-route="(idx) => emit('selectRoute', idx)"
                @update:route-preference="(pref) => (routePreference = pref)"
              />
            </div>
          </div>

          <!-- Luftlinie: Info-Hinweis -->
          <div
            class="route-mode-pane route-mode-pane--direct"
            :class="{ 'is-active': routeDisplayMode === 'direct' }"
            :inert="routeDisplayMode !== 'direct' ? true : undefined"
          >
            <div class="route-mode-pane-inner">
              <div class="route-direct-detail">
                <span class="route-calc-hint">
                  Gestrichelte Verbindung auf der Karte (ungefähre Luftlinie).
                </span>
              </div>
            </div>
          </div>

          <Alert
            v-if="routeCalculationError"
            variant="danger"
            size="sm"
            reportable
            :description="routeCalculationError"
            :error-details="resolvedRouteErrorDetails"
            :error-context="`Routenberechnung (${transportType})`"
            report-label="Fehler melden"
            class="route-calc-error-alert"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.route-calc-fieldset {
  flex-shrink: 0;
  min-width: 0;
}

.route-calc-empty {
  @include surface-sunken-box;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  min-width: 0;
}

.route-calc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  min-width: 0;
}

.route-calc-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  flex: 1 1 200px;
  min-width: 0;
  min-height: 40px;
  justify-content: center;
}

.route-calc-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.btn-calc-route {
  flex-shrink: 0;
  min-width: 125px;
  justify-content: center;
}

.route-calc-active.route-calc-map-wrap {
  position: relative;
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  overflow: hidden;
  isolation: isolate;
  display: block;
  container-type: inline-size;
  container-name: route-map;
}

.route-calc-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2xs) var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: var(--radius-pill);
  background: var(--color-primary-tint);
  color: var(--color-primary);
  line-height: var(--line-height-tight);
}

.route-calc-badge--loading {
  gap: var(--space-1);
  background: var(--color-primary-tint);
  color: var(--color-primary);
}

.route-floating-card {
  position: absolute;
  top: 12px;
  left: 12px;
  right: auto;
  width: 260px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - 24px);
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
  gap: var(--space-2);
  transition:
    border-color var(--transition-fast, 0.15s ease),
    box-shadow var(--transition-fast, 0.15s ease);
  z-index: var(--z-card-elevated, 5);
}

/* Mobile: Card gestapelt über der (gesperrten) Karte statt schwebend – wie im Spot-Dialog. */
@include container-down('route-map', 'tablet-sm') {
  .route-calc-active.route-calc-map-wrap {
    display: flex;
    flex-direction: column;
  }

  .route-floating-card {
    position: static;
    width: 100%;
    max-width: none;
    max-height: none;
    overflow: visible;
    border: none;
    border-bottom: 1px solid var(--color-border);
    border-radius: 0;
    box-shadow: none;
  }
}

.route-mode-toggle {
  width: 100%;
}

.route-calc-init-controls {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}

.route-mini-map-container {
  width: 100%;
  height: 100%;
  position: relative;
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.route-direct-detail {
  padding: var(--space-1) var(--space-1-5);
}

.route-direct-detail .route-calc-hint {
  color: var(--color-text);
  font-weight: 500;
}

.route-mode-pane {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    visibility 0s linear 0.35s;
}

.route-mode-pane.is-active {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1) 0.06s,
    visibility 0s linear 0s;
}

.route-mode-pane-inner {
  min-height: 0;
  overflow: hidden;
  transform: translateY(-4px);
  opacity: 0;
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.route-mode-pane.is-active .route-mode-pane-inner {
  transform: translateY(0);
  opacity: 1;
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.route-calc-error-alert {
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
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
  .route-mode-pane,
  .route-mode-pane-inner,
  .route-calc-hint,
  .route-calc-error-alert {
    transition: none !important;
    animation: none !important;
    transform: none !important;
  }
}

@container (max-width: 480px) {
  .route-calc-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .route-calc-init-controls {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .route-mode-toggle :deep(.segmented-option) {
    padding: var(--space-1-5) var(--space-1);
    font-size: var(--font-size-xs);
    gap: var(--space-1);
  }
}
</style>

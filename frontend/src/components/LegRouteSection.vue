<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import type { RouteResult, Spot } from '../api/types';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import AppIcon from './AppIcon.vue';
import LegMiniMap from './LegMiniMap.vue';
import LegRouteAlternatives from './LegRouteAlternatives.vue';
import { IconMapRoute } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { ROUTE_MODE_OPTIONS, ROUTE_PREFERENCE_OPTIONS } from '../utils/legTransportConfig';
import type { MiniMapHandle } from '../composables/useLegRoutingAccordion';

export type RoutePreference = 'fastest' | 'shortest';
export type RouteDisplayMode = 'exact' | 'direct';

const isOpen = defineModel<boolean>('isOpen', { default: true });
const routePreference = defineModel<RoutePreference>('routePreference', { default: 'fastest' });
const routeDisplayMode = defineModel<RouteDisplayMode>('routeDisplayMode', { default: 'exact' });

defineProps<{
  isDisabled: boolean;
  disabledTitle?: string;
  isCalculatingRoute: boolean;
  hasExactRoute: boolean;
  routeCalculationError: string | null;
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

const miniMapRef = ref<MiniMapHandle | null>(null);

watch(isOpen, async (open) => {
  if (open) {
    await nextTick();
    setTimeout(() => {
      miniMapRef.value?.invalidateSize?.();
      miniMapRef.value?.render?.();
    }, 150);
  }
});

const routeHeadingIconDef: IconDef = {
  id: 'map-route',
  emoji: '🗺️',
  outline: IconMapRoute,
};
</script>

<template>
  <CollapsibleFieldset
    v-model="isOpen"
    label="Routenführung"
    :icon="routeHeadingIconDef"
    :disabled="isDisabled"
    :title="disabledTitle"
    class="route-calc-fieldset"
    :class="{ 'route-calc-fieldset--has-route': hasExactRoute }"
  >
    <template v-if="!isDisabled && isCalculatingRoute" #badge>
      <Badge variant="primary" size="sm" class="route-calc-badge route-calc-badge--loading">
        <AppIcon
          :icon="ACTION_ICONS.refresh"
          :size="12"
          group="actions"
          class="route-calc-spinner"
        />
        Route wird berechnet…
      </Badge>
    </template>

    <!-- Zustand 1: Noch keine Route berechnet -> Aufforderung zur Berechnung -->
    <div v-if="!hasExactRoute" class="route-calc-header">
      <div class="route-calc-info">
        <span class="route-calc-hint">
          Exakte Route, Distanz und Fahrzeit für {{ transportType }} berechnen.
        </span>
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

      <p v-if="routeCalculationError" class="route-calc-error">
        <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
        <span>{{ routeCalculationError }}</span>
      </p>
    </div>

    <!-- Zustand 2: Route liegt vor -> Vollflächige Mini-Map mit schwebender Mini-Card -->
    <div v-else class="route-calc-active route-calc-map-wrap">
      <!-- Mini-Map der Teilstrecke mit Start-, Ziel-Pins und gerouteten Alternativen -->
      <div class="route-mini-map-container">
        <LegMiniMap
          ref="miniMapRef"
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

          <p v-if="routeCalculationError" class="route-calc-error">
            <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
            <span>{{ routeCalculationError }}</span>
          </p>
        </div>
      </div>
    </div>
  </CollapsibleFieldset>
</template>

<style scoped>
.route-calc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.route-calc-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.route-calc-fieldset--has-route {
  position: relative;
  padding: 0;
  border-color: transparent;
  background: transparent;
  margin: 14px 0 var(--space-2) 0;
}

.route-calc-fieldset--has-route.is-closed {
  margin: var(--space-1) 0;
}

.route-calc-fieldset--has-route:not(.is-closed) :deep(legend) {
  position: absolute;
  top: -14px;
  left: 12px;
  z-index: var(--z-dropdown, 500);
  padding: 0;
  margin: 0;
}

.route-calc-fieldset--has-route :deep(.collapsible-anim-wrapper) {
  min-height: 0;
}

.route-calc-fieldset--has-route.is-closed :deep(.collapsible-anim-wrapper) {
  height: 0;
  min-height: 0;
  overflow: hidden;
}

.route-calc-fieldset--has-route :deep(.collapsible-anim-inner) {
  padding: 0;
  margin: 0;
  overflow: hidden;
  min-height: 0;
}

.route-calc-fieldset--has-route :deep(.collapsible-content) {
  margin-top: 0;
  padding: 0;
  gap: 0;
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
  padding: 2px var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: 700;
  letter-spacing: 0.03em;
  border-radius: var(--radius-pill);
  background: var(--color-primary-tint);
  color: var(--color-primary);
  line-height: 1.2;
}

.route-calc-badge--loading {
  gap: var(--space-1);
  background: var(--color-primary-tint);
  color: var(--color-primary);
}

.route-calc-spinner {
  animation: route-spin 1s linear infinite;
}

@keyframes route-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.route-floating-card {
  position: absolute;
  top: 22px;
  left: 12px;
  right: auto;
  width: 260px;
  max-width: calc(100% - 24px);
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

@container route-map (max-width: 400px), (max-width: 400px) {
  .route-floating-card {
    position: absolute;
    top: 22px;
    left: 12px;
    right: 12px;
    width: auto;
    max-width: none;
    max-height: calc(100% - 160px);
    overflow-y: auto;
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
  padding: var(--space-1) 6px;
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

.route-calc-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-danger);
  animation: route-content-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.route-floating-card .route-calc-error {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-danger);
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
  .route-calc-error {
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

  .route-calc-body {
    flex-direction: column;
    align-items: stretch;
    gap: 0;
  }

  .route-mode-toggle :deep(.segmented-option) {
    padding: 6px var(--space-1);
    font-size: var(--font-size-xs);
    gap: var(--space-1);
  }
}
</style>

<script setup lang="ts">
import FormField from './FormField.vue';
import Select from './primitives/Select.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import { travelTypeIcon } from '../utils/travelTypeIcon';
import {
  TRANSPORT_MODE_OPTIONS,
  DEFAULT_TRANSIT_OPTIONS,
  type TransportCategory,
} from '../utils/legTransportConfig';

withDefaults(
  defineProps<{
    category: TransportCategory;
    transitType: string;
    transitOptions?: readonly string[];
  }>(),
  {
    transitOptions: () => DEFAULT_TRANSIT_OPTIONS,
  }
);

const emit = defineEmits<{
  (e: 'selectCategory', cat: TransportCategory): void;
  (e: 'selectTransit', type: string): void;
}>();
</script>

<template>
  <div class="leg-transport-mode-selector">
    <SegmentedToggle
      class="transport-toggle"
      :model-value="category"
      :options="TRANSPORT_MODE_OPTIONS"
      aria-label="Fortbewegungsart"
      @update:model-value="(val) => emit('selectCategory', val as TransportCategory)"
    />

    <!-- Öffi-Detail-Dropdown (nur wenn ÖPNV ausgewählt ist) -->
    <div
      class="transit-dropdown-wrapper"
      :class="{ 'is-expanded': category === 'ÖPNV' }"
      :inert="category !== 'ÖPNV' ? true : undefined"
    >
      <div class="transit-dropdown-inner">
        <FormField icon="category" label="Verkehrsmittel">
          <Select
            :model-value="transitType"
            class="transit-select"
            @update:model-value="(val) => emit('selectTransit', val)"
          >
            <option v-for="t in transitOptions" :key="t" :value="t">
              {{ travelTypeIcon(t) }} {{ t }}
            </option>
          </Select>
        </FormField>
      </div>
    </div>
  </div>
</template>

<style scoped>
.leg-transport-mode-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.transport-toggle {
  width: 100%;
}

.transport-toggle :deep(.segmented-option) {
  padding: 6px var(--space-2);
}

.transit-dropdown-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  margin-top: calc(-1 * var(--space-3));
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.25s ease,
    visibility 0s linear 0.35s;
}

.transit-dropdown-wrapper.is-expanded {
  grid-template-rows: 1fr;
  margin-top: 0;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.35s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.28s ease,
    visibility 0s linear 0s;
}

.transit-dropdown-inner {
  min-height: 0;
  overflow: hidden;
  padding: var(--space-1);
  margin: calc(-1 * var(--space-1));
}

.transit-dropdown-wrapper:not(.is-expanded) .transit-dropdown-inner {
  transform: translateY(-6px);
  opacity: 0;
  pointer-events: none;
}

.transit-dropdown-wrapper.is-expanded .transit-dropdown-inner {
  transform: translateY(0);
  opacity: 1;
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (prefers-reduced-motion: reduce) {
  .transit-dropdown-wrapper,
  .transit-dropdown-inner {
    transition: none !important;
    transform: none !important;
  }
}

@container (max-width: 480px) {
  .transport-toggle :deep(.segmented-option) {
    padding: 6px var(--space-1);
    font-size: var(--font-size-xs);
    gap: var(--space-1);
  }
}
</style>

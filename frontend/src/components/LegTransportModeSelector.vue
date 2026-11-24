<script setup lang="ts">
import { ref } from 'vue';
import FormField from './FormField.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import AppIcon from './AppIcon.vue';
import DropdownMenu from './primitives/DropdownMenu.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import {
  TRANSPORT_MODE_OPTIONS,
  DEFAULT_TRANSIT_OPTIONS,
  type TransportCategory,
} from '../utils/legTransportConfig';

const props = withDefaults(
  defineProps<{
    category: TransportCategory;
    transitType: string;
    transitOptions?: readonly string[];
    categoryModified?: boolean;
    transitModified?: boolean;
  }>(),
  {
    transitOptions: () => DEFAULT_TRANSIT_OPTIONS,
    categoryModified: false,
    transitModified: false,
  }
);

const emit = defineEmits<{
  (e: 'selectCategory', cat: TransportCategory): void;
  (e: 'selectTransit', type: string): void;
}>();

const isOpen = ref(false);

function toggle() {
  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function selectOption(val: string) {
  emit('selectTransit', val);
  close();
}

function onNativeSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  emit('selectTransit', target.value);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();

    if (!isOpen.value) {
      isOpen.value = true;
    } else {
      const idx = props.transitOptions.indexOf(props.transitType);
      const len = props.transitOptions.length;

      if (len > 0) {
        const nextIdx = event.key === 'ArrowDown' ? (idx + 1) % len : (idx - 1 + len) % len;
        selectOption(props.transitOptions[nextIdx]);
      }
    }
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault();
    close();
  }
}
</script>

<template>
  <div class="leg-transport-mode-selector">
    <SegmentedToggle
      class="transport-toggle"
      :model-value="category"
      :options="TRANSPORT_MODE_OPTIONS"
      :modified="categoryModified"
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
        <FormField icon="category" label="Verkehrsmittel" :modified="transitModified">
          <div class="transit-picker-wrap">
            <DropdownMenu
              block
              :open="isOpen"
              aria-label="Verkehrsmittel auswählen"
              aria-haspopup="listbox"
              trigger-class="transit-trigger"
              :modified="transitModified"
              @toggle="toggle"
              @keydown="onKeyDown"
            >
              <template #label>
                <div class="transit-trigger-content">
                  <AppIcon
                    :icon="travelTypeIconDef(transitType)"
                    group="actions"
                    force-style="icons"
                    :size="16"
                    class="transit-trigger-icon"
                    aria-hidden="true"
                  />
                  <span class="transit-trigger-label">{{ transitType }}</span>
                </div>
              </template>

              <PickerMenu
                v-if="isOpen"
                position="absolute"
                class="transit-menu"
                role="listbox"
                aria-label="Verkehrsmittel"
                @close="close"
              >
                <DropdownMenuItem
                  v-for="t in transitOptions"
                  :key="t"
                  :label="t"
                  :icon="travelTypeIconDef(t)"
                  icon-group="actions"
                  icon-force-style="icons"
                  :icon-size="16"
                  :active="transitType === t"
                  :trailing-icon="transitType === t ? ACTION_ICONS.done : undefined"
                  trailing-icon-group="actions"
                  :trailing-icon-size="14"
                  role="option"
                  :aria-selected="transitType === t"
                  @click="selectOption(t)"
                />
              </PickerMenu>
            </DropdownMenu>

            <!-- Verstecktes Select für Barrierefreiheit, Formulare & Test-Kompatibilität -->
            <!-- eslint-disable-next-line vuejs-accessibility/no-onchange -->
            <select
              :value="transitType"
              class="transit-select transit-hidden-select"
              aria-label="Verkehrsmittel"
              tabindex="-1"
              @change="onNativeSelectChange"
            >
              <option v-for="t in transitOptions" :key="t" :value="t">
                {{ t }}
              </option>
            </select>
          </div>
        </FormField>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.leg-transport-mode-selector {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.transport-toggle {
  width: 100%;
}

.transport-toggle :deep(.segmented-option) {
  padding: var(--space-1-5) var(--space-2);
}

.transit-picker-wrap {
  position: relative;
  width: 100%;
}

.transit-trigger-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.transit-trigger-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.transit-trigger-label {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transit-menu {
  width: 100%;
  min-width: 100%;
  box-sizing: border-box;
}

.transit-hidden-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.001;
  pointer-events: none;
  z-index: -1;
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
  overflow: visible;
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
    padding: var(--space-1-5) var(--space-1);
    font-size: var(--font-size-xs);
    gap: var(--space-1);
  }
}
</style>

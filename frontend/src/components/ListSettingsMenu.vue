<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { computePopoverPosition } from '../utils/popoverPosition';

export interface ListOption {
  value: string;
  label: string;
  icon?: IconDef;
}

const props = withDefaults(
  defineProps<{
    /** Aktueller Gruppierungs-Wert */
    groupBy?: string;
    /** Verfügbare Gruppierungs-Optionen */
    groupByOptions?: ListOption[];
    /** Standardwert für Gruppierung (um aktive Änderungen zu erkennen) */
    defaultGroupBy?: string;

    /** Aktueller Sortier-Wert */
    sortBy?: string;
    /** Verfügbare Sortier-Optionen */
    sortByOptions?: ListOption[];
    /** Standardwert für Sortierung (um aktive Änderungen zu erkennen) */
    defaultSortBy?: string;

    /** Ob erledigte/gepackte Einträge ausgeblendet sind */
    hideCompleted?: boolean;
    /** Label für den Ausblenden-Toggle (z. B. "Erledigte ausblenden", "Gepackte ausblenden") */
    hideCompletedLabel?: string;

    /** Titel/Tooltip des Menü-Buttons */
    title?: string;
    /** ARIA-Label des Menü-Buttons */
    ariaLabel?: string;
    /** Icon des Menü-Buttons (Standard: ACTION_ICONS.filterSettings / IconAdjustments) */
    icon?: IconDef;
  }>(),
  {
    groupBy: undefined,
    groupByOptions: () => [],
    defaultGroupBy: undefined,
    sortBy: undefined,
    sortByOptions: () => [],
    defaultSortBy: undefined,
    hideCompleted: undefined,
    hideCompletedLabel: 'Erledigte ausblenden',
    title: 'Ansichts- und Filtereinstellungen',
    ariaLabel: 'Ansichts- und Filtereinstellungen anpassen',
    icon: () => ACTION_ICONS.filterSettings,
  }
);

const emit = defineEmits<{
  (e: 'update:groupBy', value: string): void;
  (e: 'update:sortBy', value: string): void;
  (e: 'update:hideCompleted', value: boolean): void;
  (e: 'reset'): void;
}>();

const open = ref(false);
const btnRef = ref<HTMLElement | ComponentPublicInstance | null>(null);
const menuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

const isHideCompletedActive = computed(() => props.hideCompleted === true);
const isGroupByActive = computed(
  () =>
    props.defaultGroupBy !== undefined &&
    props.groupBy !== undefined &&
    props.groupBy !== props.defaultGroupBy
);
const isSortByActive = computed(
  () =>
    props.defaultSortBy !== undefined &&
    props.sortBy !== undefined &&
    props.sortBy !== props.defaultSortBy
);

const activeCount = computed(() => {
  let count = 0;
  if (isHideCompletedActive.value) count += 1;
  if (isGroupByActive.value) count += 1;
  if (isSortByActive.value) count += 1;
  return count;
});

function toggleMenu(event?: MouseEvent) {
  if (!open.value) {
    const target =
      (event?.currentTarget as HTMLElement) ||
      ((btnRef.value as ComponentPublicInstance)?.$el as HTMLElement) ||
      (btnRef.value as HTMLElement);

    if (target) {
      menuStyle.value = computePopoverPosition(target, {
        menuWidth: 220,
        menuHeight: 200,
        align: 'right',
        offset: 6,
        viewportPadding: 8,
      });
    }
    open.value = true;
  } else {
    open.value = false;
  }
}

function selectGroupBy(val: string) {
  emit('update:groupBy', val);
}

function selectSortBy(val: string) {
  emit('update:sortBy', val);
}

function onToggleHideCompleted(val: boolean) {
  emit('update:hideCompleted', val);
}

function resetDefaults() {
  if (props.defaultGroupBy !== undefined) {
    emit('update:groupBy', props.defaultGroupBy);
  }
  if (props.defaultSortBy !== undefined) {
    emit('update:sortBy', props.defaultSortBy);
  }
  if (props.hideCompleted !== undefined) {
    emit('update:hideCompleted', false);
  }
  emit('reset');
}
</script>

<template>
  <div class="dropdown list-settings-dropdown">
    <Button
      ref="btnRef"
      variant="secondary"
      shape="circle"
      :active="activeCount > 0"
      :icon="icon"
      :title="title"
      :aria-label="ariaLabel"
      class="bar-icon-btn list-settings-trigger"
      @click="toggleMenu($event)"
    >
      <Badge v-if="activeCount > 0" variant="primary" class="active-badge">
        {{ activeCount }}
      </Badge>
    </Button>

    <Teleport to="body">
      <PickerMenu
        v-if="open"
        class="list-settings-popover-menu"
        origin="top-right"
        :style="menuStyle"
        @close="open = false"
      >
        <!-- Anzeige -->
        <template v-if="hideCompleted !== undefined">
          <div class="popover-section-header">Anzeige</div>
          <div class="popover-options-list">
            <DropdownItem
              multiselect
              :label="hideCompletedLabel"
              :checked="hideCompleted"
              @update:checked="onToggleHideCompleted"
            />
          </div>
        </template>

        <!-- Gruppieren -->
        <template v-if="groupByOptions && groupByOptions.length > 0">
          <div class="popover-section-header">Gruppieren nach</div>
          <div class="popover-options-list">
            <DropdownItem
              v-for="opt in groupByOptions"
              :key="opt.value"
              :label="opt.label"
              :active="groupBy === opt.value"
              :icon="groupBy === opt.value ? ACTION_ICONS.done : opt.icon || undefined"
              @click="selectGroupBy(opt.value)"
            />
          </div>
        </template>

        <!-- Sortieren -->
        <template v-if="sortByOptions && sortByOptions.length > 0">
          <div class="popover-section-header">Sortieren nach</div>
          <div class="popover-options-list">
            <DropdownItem
              v-for="opt in sortByOptions"
              :key="opt.value"
              :label="opt.label"
              :active="sortBy === opt.value"
              :icon="sortBy === opt.value ? ACTION_ICONS.done : opt.icon || undefined"
              @click="selectSortBy(opt.value)"
            />
          </div>
        </template>

        <!-- Reset Button -->
        <div v-if="activeCount > 0" class="popover-footer">
          <button type="button" class="reset-settings-btn" @click="resetDefaults">
            Standard wiederherstellen
          </button>
        </div>
      </PickerMenu>
    </Teleport>
  </div>
</template>

<style scoped>
.dropdown {
  position: relative;
  display: inline-flex;
}

.bar-icon-btn {
  position: relative;
}

.active-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

:global(.list-settings-popover-menu) {
  min-width: 210px;
  max-width: 280px;
  max-height: calc(100vh - 70px);
  overflow-y: auto;
}

.popover-section-header {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  padding: var(--space-1) var(--space-2) var(--space-1);
  margin-top: var(--space-1);
  border-top: 1px solid var(--color-border);
}

.popover-section-header:first-child {
  margin-top: 0;
  border-top: none;
  padding-top: 2px;
}

.popover-options-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.popover-footer {
  margin-top: var(--space-2);
  padding-top: var(--space-1);
  border-top: 1px solid var(--color-border);
}

.reset-settings-btn {
  width: 100%;
  padding: var(--space-1) var(--space-2);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  border-radius: var(--radius-sm-squircle);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.reset-settings-btn:hover {
  color: var(--color-danger);
  background: var(--color-hover);
}
</style>

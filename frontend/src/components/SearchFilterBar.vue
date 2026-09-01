<script setup lang="ts">
import { ref, computed, type ComponentPublicInstance } from 'vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { spotCategoryMeta } from '../utils/spotCategory';

export interface SortOption {
  value: 'alpha' | 'likes' | 'date';
  label: string;
}

const props = withDefaults(
  defineProps<{
    searchQuery?: string;
    searchPlaceholder?: string;
    sortMode?: 'alpha' | 'likes' | 'date';
    categoryFilter?: string[];
    categoryOptions?: string[];
    statusFilter?: ('planned' | 'unplanned' | 'done')[];
  }>(),
  {
    searchQuery: '',
    searchPlaceholder: 'Spots oder Touren suchen...',
    sortMode: 'date',
    categoryFilter: () => [],
    categoryOptions: () => [],
    statusFilter: () => [],
  }
);

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:sortMode', value: 'alpha' | 'likes' | 'date'): void;
  (e: 'update:categoryFilter', value: string[]): void;
  (e: 'update:statusFilter', value: ('planned' | 'unplanned' | 'done')[]): void;
}>();

// Popover states
const filterMenuOpen = ref(false);
const filterBtnRef = ref<HTMLElement | ComponentPublicInstance | null>(null);
const filterMenuStyle = ref({ top: '0px', left: '0px' });

const sortMenuOpen = ref(false);
const sortBtnRef = ref<HTMLElement | ComponentPublicInstance | null>(null);
const sortMenuStyle = ref({ top: '0px', left: '0px' });

function computeMenuStyle(
  targetEl: HTMLElement | null,
  minWidth = 220
): { top: string; left: string } {
  if (!targetEl || typeof targetEl.getBoundingClientRect !== 'function') {
    return { top: '0px', left: '0px' };
  }
  const rect = targetEl.getBoundingClientRect();
  const leftPos = Math.max(8, Math.min(rect.right - minWidth, window.innerWidth - minWidth - 8));
  return {
    top: `${rect.bottom + 6}px`,
    left: `${leftPos}px`,
  };
}

function toggleFilterMenu(event?: MouseEvent) {
  if (!filterMenuOpen.value) {
    sortMenuOpen.value = false;
    const target =
      (event?.currentTarget as HTMLElement) ||
      (filterBtnRef.value as ComponentPublicInstance)?.$el ||
      (filterBtnRef.value as HTMLElement);
    filterMenuStyle.value = computeMenuStyle(target, 230);
    filterMenuOpen.value = true;
  } else {
    filterMenuOpen.value = false;
  }
}

function toggleSortMenu(event?: MouseEvent) {
  if (!sortMenuOpen.value) {
    filterMenuOpen.value = false;
    const target =
      (event?.currentTarget as HTMLElement) ||
      (sortBtnRef.value as ComponentPublicInstance)?.$el ||
      (sortBtnRef.value as HTMLElement);
    sortMenuStyle.value = computeMenuStyle(target, 180);
    sortMenuOpen.value = true;
  } else {
    sortMenuOpen.value = false;
  }
}

function groupIconDef(category: string) {
  return spotCategoryMeta(category).tabler;
}

const activeFilterCount = computed(() => {
  return (props.categoryFilter?.length || 0) + (props.statusFilter?.length || 0);
});

const isSortActive = computed(() => props.sortMode !== 'date');

function toggleCategory(cat: string) {
  const current = [...(props.categoryFilter || [])];
  const idx = current.indexOf(cat);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(cat);
  }
  emit('update:categoryFilter', current);
}

function toggleStatus(st: 'planned' | 'unplanned' | 'done') {
  const current = [...(props.statusFilter || [])];
  const idx = current.indexOf(st);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(st);
  }
  emit('update:statusFilter', current);
}

function selectSort(mode: 'alpha' | 'likes' | 'date') {
  emit('update:sortMode', mode);
  sortMenuOpen.value = false;
}

function clearFilters() {
  emit('update:categoryFilter', []);
  emit('update:statusFilter', []);
}
</script>

<template>
  <div class="search-filter-bar">
    <!-- Suchleiste -->
    <div class="search-input-wrapper">
      <AppIcon :icon="ACTION_ICONS.search" :size="15" group="actions" class="search-icon" />
      <input
        :value="searchQuery"
        type="text"
        class="search-input"
        :placeholder="searchPlaceholder"
        aria-label="Suchen"
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="search-clear-btn"
        title="Suche löschen"
        aria-label="Suche löschen"
        @click="emit('update:searchQuery', '')"
      >
        <AppIcon :icon="ACTION_ICONS.close" :size="13" group="actions" />
      </button>
    </div>

    <!-- Filter Button + Popover -->
    <div class="dropdown filter-dropdown">
      <Button
        ref="filterBtnRef"
        variant="secondary"
        shape="circle"
        :active="activeFilterCount > 0"
        :icon="ACTION_ICONS.filter"
        title="Nach Kategorie filtern"
        aria-label="Nach Kategorie filtern"
        class="bar-icon-btn"
        @click="toggleFilterMenu($event)"
      >
        <span v-if="activeFilterCount > 0" class="active-badge">{{ activeFilterCount }}</span>
      </Button>

      <Teleport to="body">
        <template v-if="filterMenuOpen">
          <div
            class="picker-backdrop"
            role="button"
            tabindex="0"
            @click="filterMenuOpen = false"
            @keydown.enter.prevent="filterMenuOpen = false"
            @keydown.space.prevent="filterMenuOpen = false"
          ></div>
          <div class="picker-menu filter-popover-menu" :style="filterMenuStyle">
            <div class="popover-section-header">Filtern nach</div>

            <template v-if="categoryOptions.length">
              <div class="popover-group-title">Kategorie</div>
              <div class="popover-options-list">
                <DropdownItem
                  v-for="cat in categoryOptions"
                  :key="cat"
                  class="category-option"
                  multiselect
                  :icon="groupIconDef(cat)"
                  icon-group="categories"
                  :label="cat"
                  :checked="categoryFilter.includes(cat)"
                  @update:checked="toggleCategory(cat)"
                />
              </div>
            </template>

            <div class="popover-group-title">Status</div>
            <div class="popover-options-list">
              <DropdownItem
                multiselect
                :icon="FORM_FIELD_ICONS.date"
                icon-group="formFields"
                label="Geplant"
                :checked="statusFilter.includes('planned')"
                @update:checked="toggleStatus('planned')"
              />

              <DropdownItem
                multiselect
                :icon="FORM_FIELD_ICONS.note"
                icon-group="formFields"
                label="Ungeplant"
                :checked="statusFilter.includes('unplanned')"
                @update:checked="toggleStatus('unplanned')"
              />

              <DropdownItem
                multiselect
                :icon="ACTION_ICONS.done"
                label="Gemacht"
                :checked="statusFilter.includes('done')"
                @update:checked="toggleStatus('done')"
              />
            </div>

            <div v-if="activeFilterCount > 0" class="popover-footer">
              <button type="button" class="clear-filters-btn" @click="clearFilters">
                Filter zurücksetzen
              </button>
            </div>
          </div>
        </template>
      </Teleport>
    </div>

    <!-- Sortieren Button + Popover -->
    <div class="dropdown sort-dropdown">
      <Button
        ref="sortBtnRef"
        variant="secondary"
        shape="circle"
        :active="isSortActive"
        :icon="ACTION_ICONS.sort"
        title="Sortieren"
        aria-label="Sortieren"
        class="bar-icon-btn"
        @click="toggleSortMenu($event)"
      />

      <Teleport to="body">
        <template v-if="sortMenuOpen">
          <div
            class="picker-backdrop"
            role="button"
            tabindex="0"
            @click="sortMenuOpen = false"
            @keydown.enter.prevent="sortMenuOpen = false"
            @keydown.space.prevent="sortMenuOpen = false"
          ></div>
          <div class="picker-menu sort-popover-menu" :style="sortMenuStyle">
            <div class="popover-section-header">Sortieren nach</div>
            <button
              type="button"
              class="sort-option-item"
              :class="{ selected: sortMode === 'date' }"
              @click="selectSort('date')"
            >
              <span>Nach Datum</span>
              <AppIcon
                v-if="sortMode === 'date'"
                :icon="ACTION_ICONS.done"
                :size="14"
                group="actions"
                class="check-icon"
              />
            </button>
            <button
              type="button"
              class="sort-option-item"
              :class="{ selected: sortMode === 'alpha' }"
              @click="selectSort('alpha')"
            >
              <span>Alphabetisch</span>
              <AppIcon
                v-if="sortMode === 'alpha'"
                :icon="ACTION_ICONS.done"
                :size="14"
                group="actions"
                class="check-icon"
              />
            </button>
            <button
              type="button"
              class="sort-option-item"
              :class="{ selected: sortMode === 'likes' }"
              @click="selectSort('likes')"
            >
              <span>Nach Likes</span>
              <AppIcon
                v-if="sortMode === 'likes'"
                :icon="ACTION_ICONS.done"
                :size="14"
                group="actions"
                class="check-icon"
              />
            </button>
          </div>
        </template>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  width: 100%;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
  z-index: 1;
}

.search-input {
  width: 100%;
  height: 38px;
  min-height: 38px;
  padding: 0 32px 0 36px;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  border: var(--ui-border-width, 1px) solid var(--color-border-strong);
  color: var(--color-text);
  font-size: 0.9rem;
  box-shadow: var(--shadow-sm);
  box-sizing: border-box;
}

.search-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-tint);
  outline: none;
}

.search-clear-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 50%;
  z-index: 1;
}

.search-clear-btn:hover {
  color: var(--color-text);
  background: var(--color-hover);
}

.dropdown {
  position: relative;
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
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

:global(.picker-backdrop) {
  position: fixed;
  inset: 0;
  z-index: 110;
}

:global(.picker-menu) {
  position: fixed;
  min-width: 180px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 111;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:global(.filter-popover-menu),
:global(.sort-popover-menu) {
  min-width: 210px;
  max-width: 280px;
  max-height: calc(100vh - 70px);
  overflow-y: auto;
}

.popover-section-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  padding: 4px 8px 8px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 4px;
}

.popover-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary, var(--color-text-muted));
  padding: 6px 8px 2px;
}

.popover-options-list {
  display: flex;
  flex-direction: column;
  max-height: 140px;
  overflow-y: auto;
}

.popover-footer {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid var(--color-border);
}

.clear-filters-btn {
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  cursor: pointer;
  text-align: center;
  border-radius: var(--radius-sm-squircle);
}

.clear-filters-btn:hover {
  color: var(--color-danger, #ef4444);
  background: var(--color-hover);
}

.sort-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 0.85rem;
  cursor: pointer;
  border-radius: var(--radius-sm-squircle);
  text-align: left;
}

.sort-option-item:hover {
  background: var(--color-hover);
}

.sort-option-item.selected {
  font-weight: 600;
  color: var(--color-primary);
}

.check-icon {
  color: var(--color-primary);
}
</style>

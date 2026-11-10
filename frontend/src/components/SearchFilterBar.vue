<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount, type ComponentPublicInstance } from 'vue';
import AppIcon from './AppIcon.vue';
import Accordion from './primitives/Accordion.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import Input from './primitives/Input.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { spotCategoryMeta } from '../utils/spotCategory';
import { TOUR_ROLE_META, TOUR_ROLE_OPTIONS, type TourRoleFilterOption } from '../utils/travelRole';
import { observePopoverPosition, type PopoverPositionResult } from '../utils/popoverPosition';

export interface SortOption {
  value: 'alpha' | 'likes' | 'date';
  label: string;
}

export type FilterSectionKey = 'sort' | 'spots' | 'status' | 'tours';

const DEFAULT_FILTER_MENU_WIDTH_PX = 240;
const DEFAULT_FILTER_MENU_HEIGHT_PX = 260;
const FILTER_MENU_OFFSET_PX = 6;
const FILTER_MENU_VIEWPORT_PADDING_PX = 8;

const SORT_SHORT_LABELS: Record<'alpha' | 'likes' | 'date', string> = {
  date: 'Datum',
  alpha: 'A–Z',
  likes: 'Likes',
};

const props = withDefaults(
  defineProps<{
    searchQuery?: string;
    searchPlaceholder?: string;
    sortMode?: 'alpha' | 'likes' | 'date';
    categoryFilter?: string[];
    categoryOptions?: string[];
    statusFilter?: ('planned' | 'unplanned' | 'done')[] | undefined;
    tourRoleFilter?: TourRoleFilterOption[];
  }>(),
  {
    searchQuery: '',
    searchPlaceholder: 'Spots oder Touren suchen...',
    sortMode: 'date',
    categoryFilter: () => [],
    categoryOptions: () => [],
    statusFilter: () => [],
    tourRoleFilter: () => [],
  }
);

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:sortMode', value: 'alpha' | 'likes' | 'date'): void;
  (e: 'update:categoryFilter', value: string[]): void;
  (e: 'update:statusFilter', value: ('planned' | 'unplanned' | 'done')[]): void;
  (e: 'update:tourRoleFilter', value: TourRoleFilterOption[]): void;
}>();

const searchInputRef = ref<InstanceType<typeof Input> | null>(null);

function focusInput() {
  searchInputRef.value?.focus();
}

defineExpose({ focusInput });

// Popover state für den kombinierten Filter- & Sortierungs-Button (#684, #744)
const filterMenuOpen = ref(false);
const filterBtnRef = ref<HTMLElement | ComponentPublicInstance | null>(null);
const filterMenuRef = ref<InstanceType<typeof PickerMenu> | ComponentPublicInstance | null>(null);
const filterMenuStyle = ref<PopoverPositionResult>({
  top: '0px',
  left: '0px',
  maxHeight: 'calc(100dvh - 16px)',
});
let stopObserveFilterMenu: (() => void) | null = null;

// Aufklapp-Zustand der 4 Sektionen (Smart-Default: Sortierung + aktive Filter-Sektionen offen)
const openSections = ref<Record<FilterSectionKey, boolean>>({
  sort: true,
  spots: (props.categoryFilter?.length || 0) > 0,
  status: (props.statusFilter?.length || 0) > 0,
  tours: (props.tourRoleFilter?.length || 0) > 0,
});

watch(
  () => props.categoryFilter?.length || 0,
  (count) => {
    if (count > 0) {
      openSections.value.spots = true;
    }
  }
);

watch(
  () => props.statusFilter?.length || 0,
  (count) => {
    if (count > 0) {
      openSections.value.status = true;
    }
  }
);

watch(
  () => props.tourRoleFilter?.length || 0,
  (count) => {
    if (count > 0) {
      openSections.value.tours = true;
    }
  }
);

function toggleSection(section: FilterSectionKey) {
  openSections.value[section] = !openSections.value[section];
}

function resolveTriggerEl(fallbackTarget?: HTMLElement | null): HTMLElement | null {
  return (
    fallbackTarget ||
    ((filterBtnRef.value as ComponentPublicInstance | null)?.$el as HTMLElement | null) ||
    (filterBtnRef.value as HTMLElement | null)
  );
}

function resolveMenuEl(): HTMLElement | null {
  const menuInstance = filterMenuRef.value as
    (ComponentPublicInstance & { el?: HTMLElement | null }) | null;
  return menuInstance?.el ?? (menuInstance?.$el as HTMLElement | null) ?? null;
}

function startFilterMenuObserver(fallbackTarget?: HTMLElement | null) {
  stopObserveFilterMenu?.();
  stopObserveFilterMenu = observePopoverPosition({
    getTrigger: () => resolveTriggerEl(fallbackTarget),
    getMenu: resolveMenuEl,
    menuWidth: DEFAULT_FILTER_MENU_WIDTH_PX,
    menuHeight: DEFAULT_FILTER_MENU_HEIGHT_PX,
    align: 'right',
    offset: FILTER_MENU_OFFSET_PX,
    viewportPadding: FILTER_MENU_VIEWPORT_PADDING_PX,
    onUpdate: (coords) => {
      filterMenuStyle.value = coords;
    },
  });
}

function toggleFilterMenu(event?: MouseEvent) {
  if (!filterMenuOpen.value) {
    const target = (event?.currentTarget as HTMLElement | null) ?? null;

    if ((props.categoryFilter?.length || 0) > 0) {
      openSections.value.spots = true;
    }

    if ((props.statusFilter?.length || 0) > 0) {
      openSections.value.status = true;
    }

    if ((props.tourRoleFilter?.length || 0) > 0) {
      openSections.value.tours = true;
    }

    startFilterMenuObserver(target);
    filterMenuOpen.value = true;
    nextTick(() => startFilterMenuObserver(target));
  } else {
    filterMenuOpen.value = false;
  }
}

watch(filterMenuOpen, (isOpen) => {
  if (!isOpen) {
    stopObserveFilterMenu?.();
    stopObserveFilterMenu = null;
  }
});

onBeforeUnmount(() => {
  stopObserveFilterMenu?.();
  stopObserveFilterMenu = null;
});

function groupIconDef(category: string) {
  return spotCategoryMeta(category).tabler;
}

const activeFilterCount = computed(() => {
  return (
    (props.categoryFilter?.length || 0) +
    (props.statusFilter?.length || 0) +
    (props.tourRoleFilter?.length || 0)
  );
});

const isSortActive = computed(() => props.sortMode !== 'date');

const activeSortShortLabel = computed(() => SORT_SHORT_LABELS[props.sortMode ?? 'date']);

const totalActiveCount = computed(() => activeFilterCount.value + (isSortActive.value ? 1 : 0));

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

function toggleTourRole(role: TourRoleFilterOption) {
  const current = [...(props.tourRoleFilter || [])];
  const idx = current.indexOf(role);

  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(role);
  }

  emit('update:tourRoleFilter', current);
}

function selectSort(mode: 'alpha' | 'likes' | 'date') {
  emit('update:sortMode', mode);
}

function clearFilters() {
  emit('update:categoryFilter', []);
  emit('update:statusFilter', []);
  emit('update:tourRoleFilter', []);
  emit('update:sortMode', 'date');
}
</script>

<template>
  <div class="search-filter-bar">
    <!-- Suchleiste -->
    <div class="search-input-wrapper">
      <AppIcon :icon="ACTION_ICONS.search" :size="15" group="actions" class="search-icon" />
      <Input
        ref="searchInputRef"
        :model-value="searchQuery"
        type="search"
        shape="pill"
        class="search-input"
        :placeholder="searchPlaceholder"
        aria-label="Suchen"
        @update:model-value="emit('update:searchQuery', $event)"
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

    <!-- Kombinierter Filter- & Sortieren-Button + Popover (#684) -->
    <div class="dropdown filter-dropdown">
      <Button
        ref="filterBtnRef"
        variant="secondary"
        shape="circle"
        :active="totalActiveCount > 0"
        :icon="ACTION_ICONS.filterSettings"
        :title="
          totalActiveCount > 0
            ? `Filtern & Sortieren (${totalActiveCount} aktiv)`
            : 'Filtern & Sortieren'
        "
        :aria-label="
          totalActiveCount > 0
            ? `Filtern & Sortieren (${totalActiveCount} aktiv)`
            : 'Filtern & Sortieren'
        "
        class="bar-icon-btn"
        @click="toggleFilterMenu($event)"
      >
        <Badge v-if="totalActiveCount > 0" variant="primary" class="active-badge">{{
          totalActiveCount
        }}</Badge>
      </Button>

      <Teleport to="body">
        <template v-if="filterMenuOpen">
          <PickerMenu
            ref="filterMenuRef"
            class="filter-popover-menu"
            origin="top-right"
            :style="filterMenuStyle"
            @close="filterMenuOpen = false"
          >
            <!-- Sektion 1: Sortieren nach -->
            <div class="popover-section">
              <button
                type="button"
                class="popover-section-header popover-section-toggle"
                :aria-expanded="openSections.sort"
                @click="toggleSection('sort')"
              >
                <AppIcon
                  :icon="ACTION_ICONS.sort"
                  group="actions"
                  :size="13"
                  class="section-icon"
                />
                <span class="popover-section-title">Sortieren nach</span>
                <span class="popover-section-hint" :class="{ 'is-active': isSortActive }">
                  {{ activeSortShortLabel }}
                </span>
                <AppIcon
                  :icon="ACTION_ICONS.chevronDown"
                  group="actions"
                  :size="13"
                  class="section-chevron"
                  :class="{ 'is-open': openSections.sort }"
                />
              </button>
              <Accordion :expanded="openSections.sort" stagger inner-class="popover-options-list">
                <DropdownMenuItem
                  label="Nach Datum"
                  :active="sortMode === 'date'"
                  :trailing-icon="sortMode === 'date' ? ACTION_ICONS.done : undefined"
                  trailing-icon-group="actions"
                  :trailing-icon-size="14"
                  @click="selectSort('date')"
                />
                <DropdownMenuItem
                  label="Alphabetisch"
                  :active="sortMode === 'alpha'"
                  :trailing-icon="sortMode === 'alpha' ? ACTION_ICONS.done : undefined"
                  trailing-icon-group="actions"
                  :trailing-icon-size="14"
                  @click="selectSort('alpha')"
                />
                <DropdownMenuItem
                  label="Nach Likes"
                  :active="sortMode === 'likes'"
                  :trailing-icon="sortMode === 'likes' ? ACTION_ICONS.done : undefined"
                  trailing-icon-group="actions"
                  :trailing-icon-size="14"
                  @click="selectSort('likes')"
                />
              </Accordion>
            </div>

            <!-- Sektion 2: Spots (Kategorien) -->
            <div v-if="categoryOptions.length" class="popover-section">
              <button
                type="button"
                class="popover-section-header popover-section-toggle"
                :aria-expanded="openSections.spots"
                @click="toggleSection('spots')"
              >
                <AppIcon
                  :icon="ACTION_ICONS.filter"
                  group="actions"
                  :size="13"
                  class="section-icon"
                />
                <span class="popover-section-title">Spots</span>
                <Badge
                  v-if="categoryFilter.length > 0"
                  variant="primary"
                  class="section-active-badge"
                >
                  {{ categoryFilter.length }}
                </Badge>
                <AppIcon
                  :icon="ACTION_ICONS.chevronDown"
                  group="actions"
                  :size="13"
                  class="section-chevron"
                  :class="{ 'is-open': openSections.spots }"
                />
              </button>
              <Accordion :expanded="openSections.spots" stagger inner-class="popover-options-list">
                <DropdownMenuItem
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
              </Accordion>
            </div>

            <!-- Sektion 3: Status -->
            <div class="popover-section">
              <button
                type="button"
                class="popover-section-header popover-section-toggle"
                :aria-expanded="openSections.status"
                @click="toggleSection('status')"
              >
                <AppIcon
                  :icon="ACTION_ICONS.done"
                  group="actions"
                  :size="13"
                  class="section-icon"
                />
                <span class="popover-section-title">Status</span>
                <Badge
                  v-if="statusFilter.length > 0"
                  variant="primary"
                  class="section-active-badge"
                >
                  {{ statusFilter.length }}
                </Badge>
                <AppIcon
                  :icon="ACTION_ICONS.chevronDown"
                  group="actions"
                  :size="13"
                  class="section-chevron"
                  :class="{ 'is-open': openSections.status }"
                />
              </button>
              <Accordion :expanded="openSections.status" stagger inner-class="popover-options-list">
                <DropdownMenuItem
                  multiselect
                  :icon="FORM_FIELD_ICONS.date"
                  icon-group="formFields"
                  label="Geplant"
                  :checked="statusFilter.includes('planned')"
                  @update:checked="toggleStatus('planned')"
                />

                <DropdownMenuItem
                  multiselect
                  :icon="FORM_FIELD_ICONS.note"
                  icon-group="formFields"
                  label="Ungeplant"
                  :checked="statusFilter.includes('unplanned')"
                  @update:checked="toggleStatus('unplanned')"
                />

                <DropdownMenuItem
                  multiselect
                  :icon="ACTION_ICONS.done"
                  label="Gemacht"
                  :checked="statusFilter.includes('done')"
                  @update:checked="toggleStatus('done')"
                />
              </Accordion>
            </div>

            <!-- Sektion 4: Touren -->
            <div class="popover-section">
              <button
                type="button"
                class="popover-section-header popover-section-toggle"
                :aria-expanded="openSections.tours"
                @click="toggleSection('tours')"
              >
                <AppIcon
                  :icon="TOUR_ROLE_META.excursion.tabler"
                  group="categories"
                  :size="13"
                  class="section-icon"
                />
                <span class="popover-section-title">Touren</span>
                <Badge
                  v-if="tourRoleFilter.length > 0"
                  variant="primary"
                  class="section-active-badge"
                >
                  {{ tourRoleFilter.length }}
                </Badge>
                <AppIcon
                  :icon="ACTION_ICONS.chevronDown"
                  group="actions"
                  :size="13"
                  class="section-chevron"
                  :class="{ 'is-open': openSections.tours }"
                />
              </button>
              <Accordion :expanded="openSections.tours" stagger inner-class="popover-options-list">
                <DropdownMenuItem
                  v-for="role in TOUR_ROLE_OPTIONS"
                  :key="role"
                  multiselect
                  :icon="TOUR_ROLE_META[role].tabler"
                  icon-group="categories"
                  :label="TOUR_ROLE_META[role].label"
                  :checked="tourRoleFilter.includes(role)"
                  @update:checked="toggleTourRole(role)"
                />
              </Accordion>
            </div>

            <div v-if="totalActiveCount > 0" class="popover-footer">
              <button type="button" class="clear-filters-btn" @click="clearFilters">
                <AppIcon
                  :icon="ACTION_ICONS.refresh"
                  group="actions"
                  :size="13"
                  class="reset-icon"
                />
                <span>Filter & Sortierung zurücksetzen</span>
              </button>
            </div>
          </PickerMenu>
        </template>
      </Teleport>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.search-filter-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-top: 6px;
  margin-top: -6px;
  margin-bottom: var(--space-2);
  width: 100%;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
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

/* Höhere Spezifität nötig: Input.vue setzt für shape="pill" eigenes seitliches Padding, das sonst den Platz für die Lupe überschreibt. */
.search-input-wrapper .search-input {
  width: 100%;
  padding: 0 36px 0 38px;
  font-size: var(--font-size-sm);
  text-overflow: ellipsis;
}

.search-clear-btn {
  @include touch-target;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-pill);
  z-index: 1;
}

.search-clear-btn:hover {
  color: var(--color-text);
  background: var(--color-hover);
}

.search-clear-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.dropdown {
  position: relative;
}

.bar-icon-btn {
  @include touch-target;
  position: relative;
  width: var(--input-width, 46px);
  height: var(--input-height, 46px);
  min-width: var(--input-width, 46px);
  min-height: var(--input-height, 46px);
}

/* Responsiver Fallback auf schmalen Viewports und Containern (<= 360px) (#684) */
@include media-down('mobile-compact') {
  .search-filter-bar {
    gap: 6px;
  }

  .search-input-wrapper .search-input {
    height: var(--input-height-sm, 38px);
    min-height: var(--input-height-sm, 38px);
    padding: 0 32px 0 34px;
  }

  .bar-icon-btn {
    width: var(--input-width-sm, 38px);
    height: var(--input-height-sm, 38px);
    min-width: var(--input-width-sm, 38px);
    min-height: var(--input-height-sm, 38px);
  }
}

@include container-spots-col-down('mobile-compact') {
  .search-filter-bar {
    gap: 6px;
  }

  .search-input-wrapper .search-input {
    height: var(--input-height-sm, 38px);
    min-height: var(--input-height-sm, 38px);
    padding: 0 32px 0 34px;
  }

  .bar-icon-btn {
    width: var(--input-width-sm, 38px);
    height: var(--input-height-sm, 38px);
    min-width: var(--input-width-sm, 38px);
    min-height: var(--input-height-sm, 38px);
  }
}

.active-badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  font-size: var(--font-size-xs);
  font-weight: 700;
  line-height: 18px;
  text-align: center;
}

:global(.filter-popover-menu) {
  min-width: 220px;
  max-width: min(290px, calc(100vw - var(--space-4)));
  max-height: calc(100vh - 16px);
  max-height: calc(100dvh - 16px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  interpolate-size: allow-keywords;
}

.popover-section {
  display: flex;
  flex-direction: column;
}

.popover-section + .popover-section {
  border-top: 1px solid var(--color-border);
  margin-top: 2px;
  padding-top: 2px;
}

button.popover-section-header.popover-section-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 36px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: var(--font-size-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

button.popover-section-header.popover-section-toggle:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

button.popover-section-header.popover-section-toggle:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: -2px;
}

.section-icon {
  opacity: 0.8;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}

.popover-section-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-section-hint {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
  color: var(--color-text-muted);
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: var(--color-surface-sunken, var(--color-hover));
  flex-shrink: 0;
}

.popover-section-hint.is-active {
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
}

.section-active-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  flex-shrink: 0;
}

.section-chevron {
  flex-shrink: 0;
  opacity: 0.7;
  transition: var(--transition-caret, transform 0.24s cubic-bezier(0.34, 1.4, 0.64, 1));
}

.section-chevron.is-open {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .section-chevron {
    transition: none !important;
  }
}

:deep(.popover-options-list) {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-top: 2px;
  padding-bottom: 2px;
}

.popover-footer {
  position: sticky;
  bottom: calc(-1 * var(--space-2));
  margin: var(--space-1) calc(-1 * var(--space-2)) calc(-1 * var(--space-2));
  padding: var(--space-1) var(--space-2) var(--space-2);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  z-index: 2;
}

button.clear-filters-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: var(--input-height-sm, 38px);
  padding: var(--space-1) var(--space-2);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  text-align: center;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.reset-icon {
  opacity: 0.75;
  flex-shrink: 0;
}

button.clear-filters-btn:hover {
  color: var(--color-danger);
  background: var(--color-hover);
}

button.clear-filters-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--color-danger);
  outline-offset: var(--focus-ring-offset, 2px);
}
</style>

import { ref, computed, watch, nextTick, type Ref } from 'vue';
import type { RouteLocationNormalizedLoaded, Router } from 'vue-router';
import type { Excursion, IdeaRole, Spot } from '../api/types';
import {
  TRAVEL_ROLE_META,
  TOUR_ROLE_META,
  TOUR_ROLE_OPTIONS,
  type TourRoleFilterOption,
} from '../utils/travelRole';
import { spotCategoryMeta, SPOT_CATEGORY_SUGGESTIONS } from '../utils/spotCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';
import { usePersistedRef } from './usePersistedRef';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useScheduleStore } from '../stores/schedule';
import { useIconStyleStore } from '../stores/iconStyle';
import { useLiveSyncStore } from '../stores/liveSync';

export type SpotsGroupItem = { kind: 'spot'; spot: Spot };

export const STATUS_FILTER_LABEL: Record<'planned' | 'unplanned' | 'done', string> = {
  planned: 'Geplant',
  unplanned: 'Ungeplant',
  done: 'Gemacht',
};

export const STATUS_FILTER_ICON: Record<'planned' | 'unplanned' | 'done', IconDef> = {
  planned: FORM_FIELD_ICONS.date,
  unplanned: FORM_FIELD_ICONS.note,
  done: ACTION_ICONS.done,
};

export const UNASSIGNED_TOUR_GROUP = 'Ohne Tour';

export const CATEGORY_GROUP_ORDER = [...new Set(['Unterkunft', ...SPOT_CATEGORY_SUGGESTIONS])];

export interface UseExcursionsFilterOptions {
  route: RouteLocationNormalizedLoaded;
  router: Router;
  highlightedIds?: Ref<Set<number>>;
}

export function useExcursionsFilter(options: UseExcursionsFilterOptions) {
  const { route, router, highlightedIds } = options;

  const spotsStore = useSpotsStore();
  const excursionsStore = useExcursionsStore();
  const scheduleStore = useScheduleStore();
  const iconStyle = useIconStyleStore();
  const liveSync = useLiveSyncStore();

  const sortMode = usePersistedRef<'alpha' | 'likes' | 'date'>(
    'reisotor-excursions-sort-mode',
    'date'
  );

  const groupMode = usePersistedRef<'category' | 'tours' | 'tracks'>(
    'reisotor-excursions-group-mode',
    'category'
  );

  const categoryFilter = usePersistedRef<string[]>('reisotor-excursions-category-filter', []);
  const statusFilter = usePersistedRef<('planned' | 'unplanned' | 'done')[]>(
    'reisotor-excursions-status-filter',
    []
  );
  const tourRoleFilter = ref<TourRoleFilterOption[]>([]);
  const searchQuery = ref('');

  function markSeenForGroupMode(mode: 'category' | 'tours' | 'tracks') {
    if (mode === 'tracks' || !highlightedIds) return;
    const domain = mode === 'category' ? 'spots' : 'ideas';
    for (const id of liveSync.markSeen(domain)) highlightedIds.value.add(id);
  }

  watch(groupMode, (mode) => markSeenForGroupMode(mode));

  const spotScheduledDates = computed(() => {
    const map = new Map<number, string>();
    for (const item of scheduleStore.items) {
      if (item.spot_id == null) continue;
      const existing = map.get(item.spot_id);
      if (!existing || item.date < existing) map.set(item.spot_id, item.date);
    }
    return map;
  });

  function itemStatus(item: SpotsGroupItem): 'planned' | 'unplanned' {
    return spotScheduledDates.value.has(item.spot.id) ? 'planned' : 'unplanned';
  }

  function itemCategory(item: SpotsGroupItem): string {
    return item.spot.category ?? 'Sonstiges';
  }

  function itemTitle(item: SpotsGroupItem): string {
    return item.spot.title;
  }

  function itemLikeCount(item: SpotsGroupItem): number {
    return spotsStore.likeCountFor(item.spot.id);
  }

  function itemDone(item: SpotsGroupItem): boolean {
    return !!item.spot.done;
  }

  function groupIconDef(category: string): IconDef {
    if (category === 'Unterkunft') return spotCategoryMeta('Unterkunft').tabler;
    return spotCategoryMeta(category).tabler;
  }

  function groupIconColor(grp: {
    category: string;
    excursion: Excursion | null;
  }): string | undefined {
    if (groupMode.value === 'tours') return undefined;
    return iconStyle.colorizeCategories ? spotCategoryMeta(grp.category).color : undefined;
  }

  function removeCategoryFilter(cat: string) {
    categoryFilter.value = categoryFilter.value.filter((c) => c !== cat);
  }

  function removeStatusFilter(status: 'planned' | 'unplanned' | 'done') {
    statusFilter.value = statusFilter.value.filter((s) => s !== status);
  }

  function removeTourRoleFilter(role: TourRoleFilterOption) {
    tourRoleFilter.value = tourRoleFilter.value.filter((r) => r !== role);
  }

  function tourRoleIconDef(role: TourRoleFilterOption): IconDef {
    return TOUR_ROLE_META[role].tabler;
  }

  function tourRoleLabel(role: TourRoleFilterOption): string {
    return TOUR_ROLE_META[role].label;
  }

  let isSyncingQuery = false;

  function applyRouteQuery() {
    isSyncingQuery = true;
    const q = route.query;

    if (q.group === 'tours') {
      groupMode.value = 'tours';
    } else if (q.group === 'tracks') {
      groupMode.value = 'tracks';
    } else if (q.group === 'category') {
      groupMode.value = 'category';
    } else if (q.group === 'travel') {
      groupMode.value = 'tours';
    }

    if (q.tourRole) {
      const roles = String(q.tourRole)
        .split(',')
        .filter((r): r is TourRoleFilterOption =>
          TOUR_ROLE_OPTIONS.includes(r as TourRoleFilterOption)
        );
      tourRoleFilter.value = roles;
    } else if (q.group === 'travel') {
      tourRoleFilter.value = ['arrival', 'departure', 'onward'];
    } else {
      tourRoleFilter.value = [];
    }

    if (q.category) {
      categoryFilter.value = String(q.category).split(',').filter(Boolean);
      if (q.group !== 'tours') {
        groupMode.value = 'category';
      }
    } else {
      categoryFilter.value = [];
    }
    if (q.status) {
      statusFilter.value = String(q.status)
        .split(',')
        .filter((s): s is 'planned' | 'unplanned' | 'done' =>
          ['planned', 'unplanned', 'done'].includes(s)
        );
    } else {
      statusFilter.value = [];
    }

    nextTick(() => {
      isSyncingQuery = false;
    });
  }

  function updateRouteQuery() {
    if (isSyncingQuery) return;
    const newQuery: Record<string, string> = {};
    for (const [k, v] of Object.entries(route.query)) {
      if (v != null) newQuery[k] = Array.isArray(v) ? v.join(',') : String(v);
    }

    if (groupMode.value === 'tours') {
      newQuery.group = 'tours';
    } else if (groupMode.value === 'tracks') {
      newQuery.group = 'tracks';
    } else {
      delete newQuery.group;
    }

    if (tourRoleFilter.value.length) {
      newQuery.tourRole = tourRoleFilter.value.join(',');
    } else {
      delete newQuery.tourRole;
    }

    if (categoryFilter.value.length) {
      newQuery.category = categoryFilter.value.join(',');
    } else {
      delete newQuery.category;
    }

    if (statusFilter.value.length) {
      newQuery.status = statusFilter.value.join(',');
    } else {
      delete newQuery.status;
    }

    const currentEntries = Object.entries(route.query);
    const newEntries = Object.entries(newQuery);
    const isDiff =
      currentEntries.length !== newEntries.length ||
      newEntries.some(([k, v]) => route.query[k] !== v);

    if (isDiff) {
      router.replace({ query: newQuery, hash: route.hash });
    }
  }

  watch([groupMode, tourRoleFilter, categoryFilter, statusFilter], () => {
    updateRouteQuery();
  });

  watch(
    () => route.query,
    () => {
      applyRouteQuery();
    }
  );

  const hasActiveFilters = computed(() => {
    return (
      searchQuery.value.trim().length > 0 ||
      categoryFilter.value.length > 0 ||
      statusFilter.value.length > 0 ||
      tourRoleFilter.value.length > 0
    );
  });

  function clearAllFilters() {
    searchQuery.value = '';
    categoryFilter.value = [];
    statusFilter.value = [];
    tourRoleFilter.value = [];
  }

  const allSpotItems = computed<SpotsGroupItem[]>(() =>
    spotsStore.spots.map((spot): SpotsGroupItem => ({ kind: 'spot', spot }))
  );

  function tourTitlesForItem(item: SpotsGroupItem): string[] {
    return excursionsStore.excursions
      .filter((e) => e.spot_ids.includes(item.spot.id))
      .map((e) => e.title);
  }

  const filteredSpotItems = computed(() =>
    allSpotItems.value.filter((item) => {
      if (categoryFilter.value.length && !categoryFilter.value.includes(itemCategory(item)))
        return false;
      const status = itemStatus(item);
      if (statusFilter.value.length) {
        const matchesStatus = statusFilter.value.includes(status);
        const matchesDone = statusFilter.value.includes('done') && itemDone(item);
        if (!matchesStatus && !matchesDone) return false;
      }
      if (tourRoleFilter.value.length) {
        const spotTours = excursionsStore.excursions.filter((e) =>
          e.spot_ids.includes(item.spot.id)
        );
        const matchesTourRole = spotTours.some((t) =>
          t.role
            ? tourRoleFilter.value.includes(t.role)
            : tourRoleFilter.value.includes('excursion')
        );
        if (!matchesTourRole) return false;
      }
      if (searchQuery.value.trim()) {
        const q = searchQuery.value.trim().toLowerCase();
        const title = itemTitle(item).toLowerCase();
        const category = itemCategory(item).toLowerCase();
        const note = (item.spot.note ?? '').toLowerCase();
        if (!title.includes(q) && !category.includes(q) && !note.includes(q)) return false;
      }
      return true;
    })
  );

  function sortedCategoryKeys(categories: Iterable<string>): string[] {
    const set = new Set(categories);
    const known = CATEGORY_GROUP_ORDER.filter((c) => set.has(c));
    const custom = [...set]
      .filter((c) => !CATEGORY_GROUP_ORDER.includes(c) && c !== 'Sonstiges')
      .sort();
    return [...known, ...custom, ...(set.has('Sonstiges') ? ['Sonstiges'] : [])];
  }

  function excursionForGroupTitle(title: string): Excursion | null {
    return excursionsStore.excursions.find((e) => e.title === title) ?? null;
  }

  const spotGroups = computed(() => {
    if (groupMode.value === 'tracks') return [];
    const groups = new Map<string, SpotsGroupItem[]>();
    if (groupMode.value === 'tours') {
      const isTourRoleMatch = (role: IdeaRole | null | undefined) => {
        if (!tourRoleFilter.value.length) return true;
        return role
          ? tourRoleFilter.value.includes(role)
          : tourRoleFilter.value.includes('excursion');
      };
      const matchingExcursions = excursionsStore.excursions.filter((ex) =>
        isTourRoleMatch(ex.role)
      );
      const matchingTitles = new Set(matchingExcursions.map((e) => e.title));
      for (const item of filteredSpotItems.value) {
        const keys = tourTitlesForItem(item).filter((t) => matchingTitles.has(t));
        if (keys.length === 0 && !tourRoleFilter.value.length) {
          keys.push(UNASSIGNED_TOUR_GROUP);
        }
        for (const key of keys) {
          const list = groups.get(key) ?? [];
          list.push(item);
          groups.set(key, list);
        }
      }
      const q = searchQuery.value.trim().toLowerCase();
      for (const ex of matchingExcursions) {
        if (!groups.has(ex.title)) {
          if (
            !q ||
            ex.title.toLowerCase().includes(q) ||
            (ex.note ?? '').toLowerCase().includes(q)
          ) {
            groups.set(ex.title, []);
          }
        }
      }
    } else {
      for (const item of filteredSpotItems.value) {
        const keys = [itemCategory(item)];
        for (const key of keys) {
          const list = groups.get(key) ?? [];
          list.push(item);
          groups.set(key, list);
        }
      }
    }
    for (const [key, list] of groups) {
      const excursion =
        groupMode.value === 'tours' && key !== UNASSIGNED_TOUR_GROUP
          ? excursionForGroupTitle(key)
          : null;
      if (excursion) {
        const order = new Map<number, number>();
        excursion.spot_ids.forEach((id, idx) => {
          if (!order.has(id)) order.set(id, idx);
        });
        list.sort((a, b) => {
          const ai = a.kind === 'spot' ? (order.get(a.spot.id) ?? Infinity) : Infinity;
          const bi = b.kind === 'spot' ? (order.get(b.spot.id) ?? Infinity) : Infinity;
          return ai - bi;
        });
      } else {
        list.sort((a, b) => {
          if (sortMode.value === 'date') {
            const dateA = spotScheduledDates.value.get(a.spot.id) || '\uFFFF';
            const dateB = spotScheduledDates.value.get(b.spot.id) || '\uFFFF';
            return dateA.localeCompare(dateB) || itemTitle(a).localeCompare(itemTitle(b));
          }
          if (sortMode.value === 'likes') {
            return itemLikeCount(b) - itemLikeCount(a) || itemTitle(a).localeCompare(itemTitle(b));
          }
          return itemTitle(a).localeCompare(itemTitle(b));
        });
      }
    }
    if (groupMode.value === 'tours') {
      const known = [...groups.keys()]
        .filter((k) => k !== UNASSIGNED_TOUR_GROUP)
        .sort((a, b) => {
          if (sortMode.value === 'date') {
            const ea = excursionForGroupTitle(a);
            const eb = excursionForGroupTitle(b);
            const da = ea?.date || '\uFFFF';
            const db = eb?.date || '\uFFFF';
            return da.localeCompare(db) || a.localeCompare(b);
          }
          return a.localeCompare(b);
        });
      const keys = groups.has(UNASSIGNED_TOUR_GROUP) ? [...known, UNASSIGNED_TOUR_GROUP] : known;
      return keys.map((title) => {
        const excursion = title === UNASSIGNED_TOUR_GROUP ? null : excursionForGroupTitle(title);
        let iconDef = FORM_FIELD_ICONS.location;
        if (title !== UNASSIGNED_TOUR_GROUP) {
          if (excursion?.role && TRAVEL_ROLE_META[excursion.role]) {
            iconDef = TRAVEL_ROLE_META[excursion.role].tabler;
          } else {
            iconDef = SECTION_ICON_DEFS.excursions;
          }
        }
        return {
          category: title,
          iconDef,
          items: groups.get(title)!,
          excursion,
        };
      });
    }
    return sortedCategoryKeys(groups.keys()).map((category) => ({
      category,
      iconDef: groupIconDef(category),
      items: groups.get(category)!,
      excursion: null as Excursion | null,
    }));
  });

  const filterCategoryOptions = computed(() =>
    sortedCategoryKeys(allSpotItems.value.map(itemCategory))
  );

  function getTourTotalSpotsCount(excursion: Excursion): number {
    if (!excursion.spot_ids.length) return 0;
    const count = spotsStore.spots.filter((s) => excursion.spot_ids.includes(s.id)).length;
    return count > 0 ? count : excursion.spot_ids.length;
  }

  function isTourAllSpotsFiltered(excursion: Excursion, itemsCount: number): boolean {
    return itemsCount === 0 && getTourTotalSpotsCount(excursion) > 0 && hasActiveFilters.value;
  }

  function isTourPartiallyFiltered(excursion: Excursion, itemsCount: number): boolean {
    const total = getTourTotalSpotsCount(excursion);
    return itemsCount > 0 && itemsCount < total && hasActiveFilters.value;
  }

  function tourFilterReason(): string {
    const hasSearch = searchQuery.value.trim().length > 0;
    const hasCategoryOrStatus = categoryFilter.value.length > 0 || statusFilter.value.length > 0;

    if (hasCategoryOrStatus && !hasSearch) {
      return 'den Kategorie-/Status-Filter';
    }
    if (hasSearch && !hasCategoryOrStatus) {
      return 'den Suchfilter';
    }
    return 'aktive Filter';
  }

  function tourPartialFilteredPrefix(excursion: Excursion, itemsCount: number): string {
    const total = getTourTotalSpotsCount(excursion);
    const hiddenCount = total - itemsCount;
    const countText =
      hiddenCount === 1 ? 'Ein Spot dieser Tour ist' : 'Einige Spots dieser Tour sind';
    return `${countText} gerade durch ${tourFilterReason()} ausgeblendet – `;
  }

  return {
    sortMode,
    groupMode,
    categoryFilter,
    statusFilter,
    tourRoleFilter,
    searchQuery,
    spotScheduledDates,
    hasActiveFilters,
    clearAllFilters,
    removeCategoryFilter,
    removeStatusFilter,
    removeTourRoleFilter,
    tourRoleIconDef,
    tourRoleLabel,
    itemStatus,
    itemCategory,
    itemTitle,
    itemLikeCount,
    itemDone,
    groupIconDef,
    groupIconColor,
    applyRouteQuery,
    updateRouteQuery,
    allSpotItems,
    filteredSpotItems,
    spotGroups,
    filterCategoryOptions,
    excursionForGroupTitle,
    tourTitlesForItem,
    getTourTotalSpotsCount,
    isTourAllSpotsFiltered,
    isTourPartiallyFiltered,
    tourFilterReason,
    tourPartialFilteredPrefix,
    markSeenForGroupMode,
  };
}

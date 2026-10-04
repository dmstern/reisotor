import { computed, ref, watch, type ComputedRef } from 'vue';
import { useRouter } from 'vue-router';
import type { CalendarEntry, ScheduleItem, Spot, Excursion } from '../api/types';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useScheduleStore } from '../stores/schedule';
import { useDrawersStore } from '../stores/drawers';
import { spotCategoryMeta } from '../utils/spotCategory';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import type { DayWeatherEntry } from '../utils/dayWeather';
import { formatDate } from '../utils/dateFormat';

export interface UseScheduleItemDetailOptions {
  allEntries: ComputedRef<CalendarEntry[]>;
  weatherEntriesFor: (date: string) => DayWeatherEntry[];
  onStartEdit?: (item: ScheduleItem) => void;
}

const weekdayShortFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

/**
 * Verwaltet den Zustand des Termin-Detailmodals (Anzeige eines Termins,
 * Verknüpfungen mit Spot/Tour, Headerbild/Collage, Wetter und Aktionen).
 */
export function useScheduleItemDetail(options: UseScheduleItemDetailOptions) {
  const { allEntries, weatherEntriesFor, onStartEdit } = options;
  const router = useRouter();
  const spotsStore = useSpotsStore();
  const excursionsStore = useExcursionsStore();
  const scheduleStore = useScheduleStore();
  const drawers = useDrawersStore();

  const viewingItem = ref<ScheduleItem | null>(null);

  watch(
    [() => scheduleStore.selectedItemId, () => scheduleStore.items],
    ([id]) => {
      if (id != null) {
        const item = scheduleStore.items.find((i: ScheduleItem) => i.id === id);
        if (item) {
          viewingItem.value = item;
        }
      }
    },
    { immediate: true }
  );

  watch(viewingItem, (val) => {
    if (val === null && scheduleStore.selectedItemId !== null) {
      scheduleStore.closeDetail();
    }
  });

  const viewingEntry = computed(() =>
    viewingItem.value
      ? (allEntries.value.find((e) => e.scheduleItem?.id === viewingItem.value!.id) ?? null)
      : null
  );

  const viewingLinkedSpot = computed<Spot | null>(() => {
    const spotId = viewingEntry.value?.spotId ?? viewingItem.value?.spot_id;
    if (spotId == null) return null;
    return spotsStore.spots.find((s) => s.id === spotId) ?? null;
  });

  const viewingLinkedExcursion = computed<Excursion | null>(() => {
    const ideaId = viewingEntry.value?.ideaId ?? viewingItem.value?.idea_id;
    if (ideaId == null) return null;
    return excursionsStore.excursions.find((e) => e.id === ideaId) ?? null;
  });

  const viewingImageUrl = computed(() => {
    if (viewingLinkedSpot.value?.image_url) {
      return viewingLinkedSpot.value.image_url;
    }
    if (viewingLinkedExcursion.value?.image_url) {
      return viewingLinkedExcursion.value.image_url;
    }
    return null;
  });

  const viewingCollageImages = computed<string[]>(() => {
    if (viewingImageUrl.value) return [];
    if (viewingLinkedExcursion.value?.spot_ids?.length) {
      const urls: string[] = [];
      for (const spotId of viewingLinkedExcursion.value.spot_ids) {
        const spot = spotsStore.spots.find((s) => s.id === spotId);
        if (spot?.image_url && !urls.includes(spot.image_url)) {
          urls.push(spot.image_url);
        }
      }
      return urls;
    }
    return [];
  });

  const viewingCategoryInfo = computed(() => {
    if (viewingLinkedSpot.value) {
      const meta = spotCategoryMeta(viewingLinkedSpot.value.category);
      return {
        label: viewingLinkedSpot.value.category || 'Ort',
        icon: viewingEntry.value?.iconDef ?? meta.tabler,
        themeColor: meta.color,
        themeTint: undefined as string | undefined,
      };
    }
    if (viewingLinkedExcursion.value) {
      if (viewingLinkedExcursion.value.role) {
        return {
          label: viewingLinkedExcursion.value.transport_type || 'Reise',
          icon: travelTypeIconDef(viewingLinkedExcursion.value.transport_type),
          themeColor: 'var(--color-travel)',
          themeTint: 'var(--color-travel-tint)',
        };
      }
      return {
        label: 'Tour',
        icon: viewingEntry.value?.iconDef ?? SCHEDULE_CATEGORY_META.excursion.tabler,
        themeColor: 'var(--color-tour)',
        themeTint: 'var(--color-tour-tint)',
      };
    }
    if (viewingEntry.value) {
      const meta =
        SCHEDULE_CATEGORY_META[viewingEntry.value.category] ?? SCHEDULE_CATEGORY_META.other;
      return {
        label: meta.label,
        icon: viewingEntry.value.iconDef ?? meta.tabler,
        themeColor: meta.color,
        themeTint: undefined as string | undefined,
      };
    }
    return {
      label: 'Termin',
      icon: SCHEDULE_CATEGORY_META.other.tabler,
      themeColor: SCHEDULE_CATEGORY_META.other.color,
      themeTint: undefined as string | undefined,
    };
  });

  const viewingWeatherEntry = computed(() => {
    if (!viewingItem.value?.date) return null;
    const entries = weatherEntriesFor(viewingItem.value.date);
    return entries.length > 0 ? entries[0] : null;
  });

  const viewingEffectiveCoords = computed(() => {
    if (viewingItem.value?.lat != null && viewingItem.value?.lng != null) {
      return {
        lat: viewingItem.value.lat,
        lng: viewingItem.value.lng,
        mapsLink: viewingItem.value.maps_link,
        title: viewingItem.value.title,
      };
    }
    if (viewingLinkedSpot.value?.lat != null && viewingLinkedSpot.value?.lng != null) {
      return {
        lat: viewingLinkedSpot.value.lat,
        lng: viewingLinkedSpot.value.lng,
        mapsLink: viewingLinkedSpot.value.maps_link,
        title: viewingLinkedSpot.value.title,
      };
    }
    return null;
  });

  function formatViewingDate(dateStr: string) {
    const d = new Date(`${dateStr}T00:00:00`);
    return `${weekdayShortFormatter.format(d)}, ${formatDate(dateStr)}`;
  }

  function linkedTitleFor(entry: CalendarEntry | null): string | null {
    if (!entry) return null;
    if (entry.spotId != null)
      return spotsStore.spots.find((s) => s.id === entry.spotId)?.title ?? null;
    if (entry.ideaId != null)
      return excursionsStore.excursions.find((e) => e.id === entry.ideaId)?.title ?? null;
    return null;
  }

  function navigateToLinkedEntity() {
    const entry = viewingEntry.value;
    if (!entry) return;
    viewingItem.value = null;
    if (entry.spotId != null) {
      drawers.openMapAt(`spot-${entry.spotId}`);
      drawers.calendarOpen = false;
      router.push(`/excursions#spot-${entry.spotId}`);
    } else if (entry.ideaId != null) {
      drawers.openMapForExcursion(entry.ideaId);
      drawers.calendarOpen = false;
      router.push(`/excursions#excursion-${entry.ideaId}`);
    }
  }

  function openAccommodationSpot(spotId: number) {
    drawers.openMapAt(`spot-${spotId}`);
    drawers.calendarOpen = false;
    router.push(`/excursions#spot-${spotId}`);
  }

  function editViewingItem() {
    if (!viewingItem.value) return;
    const item = viewingItem.value;
    viewingItem.value = null;
    onStartEdit?.(item);
  }

  function closeDetail() {
    viewingItem.value = null;
  }

  return {
    viewingItem,
    viewingEntry,
    viewingLinkedSpot,
    viewingLinkedExcursion,
    viewingImageUrl,
    viewingCollageImages,
    viewingCategoryInfo,
    viewingWeatherEntry,
    viewingEffectiveCoords,
    formatViewingDate,
    linkedTitleFor,
    navigateToLinkedEntity,
    openAccommodationSpot,
    editViewingItem,
    closeDetail,
  };
}

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import type { Trip } from '../api/types';
import { fetchRegionInfo, type RegionInfo } from '../utils/regionInfo';
import { useHomeCurrencyStore } from '../stores/homeCurrency';

export interface UseRegionInfoReturn {
  regionInfo: Ref<RegionInfo | null>;
  regionError: Ref<string | null>;
  regionLoading: Ref<boolean>;
  regionSourceParts: ComputedRef<string[]>;
  regionShowsExchange: ComputedRef<boolean>;
  loadRegionInfo: () => Promise<void>;
}

export function useRegionInfo(
  trip: Ref<Trip | null | undefined> | ComputedRef<Trip | null | undefined>
): UseRegionInfoReturn {
  const homeCurrency = useHomeCurrencyStore();

  const regionInfo = ref<RegionInfo | null>(null);
  const regionError = ref<string | null>(null);
  const regionLoading = ref(false);

  // Eigenständig geladen: ein externer Dienst soll das Laden des restlichen Dashboards nicht blockieren
  async function loadRegionInfo() {
    if (!trip.value) return;
    regionLoading.value = true;
    regionError.value = null;
    try {
      regionInfo.value = await fetchRegionInfo(trip.value.id);
    } catch {
      regionError.value = 'Regionsinfos konnten nicht geladen werden.';
    } finally {
      regionLoading.value = false;
    }
  }

  // Neu laden, wenn sich der Urlaub oder die Heimatwährung (Wechselkurs-Vergleich) ändert.
  watch(
    () => [trip.value?.id, homeCurrency.currency],
    () => {
      regionInfo.value = null;
      loadRegionInfo();
    }
  );

  // Sprache/Währung/Sicherheitshinweis sind je nach Land oft nur teilweise oder gar nicht verfügbar
  const regionSourceParts = computed(() => {
    if (!regionInfo.value) return [];
    const parts: string[] = [];
    if (regionInfo.value.languages.length || regionInfo.value.currency)
      parts.push('REST Countries');
    if (regionInfo.value.currency && regionInfo.value.exchangeRate != null)
      parts.push('open.er-api.com');
    if (regionInfo.value.advisory) parts.push('travel-advisory.info');
    return parts;
  });

  const regionShowsExchange = computed(
    () => !!(regionInfo.value?.currency && regionInfo.value.exchangeRate != null)
  );

  return {
    regionInfo,
    regionError,
    regionLoading,
    regionSourceParts,
    regionShowsExchange,
    loadRegionInfo,
  };
}

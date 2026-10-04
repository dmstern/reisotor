import { computed, nextTick, ref, watch, type Ref } from 'vue';
import type { PlaceSearchResult } from './usePlaceSearch';

export interface SuggestionCache {
  title: string;
  biasKey: string;
  places: PlaceSearchResult[];
  addresses: string[];
  categories: string[];
}

export interface UseLocationSuggestionsOptions {
  title?: Ref<string | undefined>;
  editTitleInput: Ref<string>;
  address?: Ref<string | undefined>;
  editAddressInput: Ref<string>;
  category?: Ref<string | undefined>;
  editCategoryInput: Ref<string>;
  modelValue: Ref<{ lat: number; lng: number } | null | undefined>;
  proximityBias?: Ref<{ lat: number; lng: number } | null | undefined>;
  center?: Ref<{ lat: number; lng: number } | undefined>;
  isEditingAddress: Ref<boolean>;
  isEditingCategory: Ref<boolean>;
  onApplyAddress?: (address: string) => void;
  onApplyCategory?: (category: string) => void;
  onSearchCandidate?: (query: string) => void;
}

export function useLocationSuggestions(options: UseLocationSuggestionsOptions) {
  const currentTitle = computed(
    () => (options.title?.value?.trim() || options.editTitleInput.value?.trim()) ?? ''
  );

  const suggestionCache = ref<SuggestionCache | null>(null);
  const isFetchingAddressSuggestion = ref(false);
  const isFetchingCategorySuggestion = ref(false);
  const addressSuggestionIndex = ref(-1);
  const categorySuggestionIndex = ref(-1);
  const locationSearchCandidateIndex = ref(-1);

  watch(currentTitle, (newTitle, oldTitle) => {
    if (newTitle !== oldTitle) {
      suggestionCache.value = null;
      addressSuggestionIndex.value = -1;
      categorySuggestionIndex.value = -1;
    }
  });

  async function fetchSuggestionsForTitle(title: string): Promise<SuggestionCache> {
    const bias = options.modelValue.value ?? options.proximityBias?.value ?? options.center?.value;
    const biasKey =
      bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)
        ? `${bias.lat.toFixed(4)},${bias.lng.toFixed(4)}`
        : '';

    if (
      suggestionCache.value &&
      suggestionCache.value.title === title &&
      suggestionCache.value.biasKey === biasKey
    ) {
      return suggestionCache.value;
    }

    let places: PlaceSearchResult[] = [];
    try {
      let url = `/api/places/search?q=${encodeURIComponent(title)}&limit=10`;
      if (biasKey && bias) {
        url += `&lat=${bias.lat}&lng=${bias.lng}`;
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as PlaceSearchResult[];
        if (Array.isArray(data)) {
          places = data;
        }
      }
      // Fallback: Wenn Suche mit Proximity-Bias 0 Treffer liefert, nochmals ohne Bias suchen
      if (places.length === 0 && biasKey) {
        const fbRes = await fetch(`/api/places/search?q=${encodeURIComponent(title)}&limit=10`, {
          signal: AbortSignal.timeout(5000),
        });
        if (fbRes.ok) {
          const fbData = (await fbRes.json()) as PlaceSearchResult[];
          if (Array.isArray(fbData)) {
            places = fbData;
          }
        }
      }
    } catch {
      places = [];
    }

    const addresses: string[] = [];
    for (const p of places) {
      const addr = (p.formatted_address || p.address || '').trim();
      if (addr && !addresses.includes(addr)) {
        addresses.push(addr);
      }
    }

    const categories: string[] = [];
    for (const p of places) {
      const cat = (p.category || '').trim();
      if (cat && !categories.includes(cat)) {
        categories.push(cat);
      }
    }

    const cache: SuggestionCache = {
      title,
      biasKey,
      places,
      addresses,
      categories,
    };
    suggestionCache.value = cache;
    return cache;
  }

  const showAddressSparkle = computed(() => {
    if (!currentTitle.value) return false;
    if (!options.isEditingAddress.value && options.address?.value) return false;
    return (
      !options.address?.value ||
      !options.editAddressInput.value.trim() ||
      (suggestionCache.value?.addresses.length ?? 0) > 0
    );
  });

  const addressSparkleTitle = computed(() => {
    if (isFetchingAddressSuggestion.value) return 'Suche Adress-Vorschläge...';
    const addresses = suggestionCache.value?.addresses ?? [];
    if (addresses.length > 0 && addressSuggestionIndex.value >= 0) {
      return `Vorschlag ${addressSuggestionIndex.value + 1} von ${addresses.length}: "${addresses[addressSuggestionIndex.value]}" (Klicken für nächsten Vorschlag)`;
    }
    return 'Adresse anhand des Titels automatisch vorschlagen';
  });

  async function cycleAddressSuggestion() {
    const title = currentTitle.value;
    if (!title || isFetchingAddressSuggestion.value) return;

    isFetchingAddressSuggestion.value = true;
    try {
      const cache = await fetchSuggestionsForTitle(title);
      if (cache.addresses.length > 0) {
        addressSuggestionIndex.value = (addressSuggestionIndex.value + 1) % cache.addresses.length;
        const nextAddr = cache.addresses[addressSuggestionIndex.value];
        options.editAddressInput.value = nextAddr;
        options.isEditingAddress.value = true;
        options.onApplyAddress?.(nextAddr);
      }
    } finally {
      isFetchingAddressSuggestion.value = false;
    }
  }

  const showCategorySparkle = computed(() => {
    if (!currentTitle.value || options.category?.value === undefined) return false;
    if (!options.isEditingCategory.value && options.category.value) return false;
    return (
      !options.category.value ||
      !options.editCategoryInput.value.trim() ||
      (suggestionCache.value?.categories.length ?? 0) > 0
    );
  });

  const categorySparkleTitle = computed(() => {
    if (isFetchingCategorySuggestion.value) return 'Suche Kategorie-Vorschläge...';
    const categories = suggestionCache.value?.categories ?? [];
    if (categories.length > 0 && categorySuggestionIndex.value >= 0) {
      return `Vorschlag ${categorySuggestionIndex.value + 1} von ${categories.length}: "${categories[categorySuggestionIndex.value]}" (Klicken für nächsten Vorschlag)`;
    }
    return 'Kategorie anhand des Titels automatisch vorschlagen';
  });

  async function cycleCategorySuggestion() {
    const title = currentTitle.value;
    if (!title || isFetchingCategorySuggestion.value) return;

    isFetchingCategorySuggestion.value = true;
    try {
      const cache = await fetchSuggestionsForTitle(title);
      if (cache.categories.length > 0) {
        categorySuggestionIndex.value =
          (categorySuggestionIndex.value + 1) % cache.categories.length;
        const nextCat = cache.categories[categorySuggestionIndex.value];
        options.editCategoryInput.value = nextCat;
        options.isEditingCategory.value = true;
        options.onApplyCategory?.(nextCat);
      }
    } finally {
      isFetchingCategorySuggestion.value = false;
    }
  }

  // --- Location Search Sparkle Feature (Issue: Missing Spot Location) ---
  const locationSearchCandidates = computed(() => {
    const t = (options.title?.value?.trim() || options.editTitleInput.value?.trim()) ?? '';
    const c = (options.category?.value?.trim() || options.editCategoryInput.value?.trim()) ?? '';
    const a = (options.address?.value?.trim() || options.editAddressInput.value?.trim()) ?? '';

    const candidates: string[] = [];

    // 1. Titel + Kategorie (falls vorhanden und noch nicht im Titel enthalten) bzw. reiner Titel
    if (t) {
      if (c && !t.toLowerCase().includes(c.toLowerCase())) {
        candidates.push(`${t} ${c}`);
      }
      candidates.push(t);
    }

    // 2. Adresse (falls vorhanden)
    if (a) {
      candidates.push(a);
      if (t) {
        candidates.push(`${t}, ${a}`);
      }
    }

    return Array.from(new Set(candidates));
  });

  const showLocationSparkle = computed(() => {
    return !options.modelValue.value && locationSearchCandidates.value.length > 0;
  });

  const locationSparkleTitle = computed(() => {
    const candidates = locationSearchCandidates.value;
    if (candidates.length === 0) {
      return 'Standort anhand von Titel oder Adresse suchen';
    }
    if (locationSearchCandidateIndex.value >= 0) {
      const current = candidates[locationSearchCandidateIndex.value];
      return `Suche nach "${current}" (${locationSearchCandidateIndex.value + 1}/${candidates.length}, Klicken für nächsten Suchbegriff)`;
    }
    return 'Standort anhand von Titel oder Adresse in die Suche übernehmen';
  });

  watch([currentTitle, () => options.address?.value, () => options.category?.value], () => {
    locationSearchCandidateIndex.value = -1;
  });

  function cycleLocationSearch() {
    const candidates = locationSearchCandidates.value;
    if (candidates.length === 0) return;

    locationSearchCandidateIndex.value =
      (locationSearchCandidateIndex.value + 1) % candidates.length;
    const query = candidates[locationSearchCandidateIndex.value];

    options.onSearchCandidate?.(query);
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>(
        '.location-picker-input input, input.location-picker-input'
      );
      el?.focus();
    });
  }

  function resetSuggestions() {
    suggestionCache.value = null;
    addressSuggestionIndex.value = -1;
    categorySuggestionIndex.value = -1;
    locationSearchCandidateIndex.value = -1;
  }

  return {
    currentTitle,
    suggestionCache,
    isFetchingAddressSuggestion,
    isFetchingCategorySuggestion,
    addressSuggestionIndex,
    categorySuggestionIndex,
    showAddressSparkle,
    addressSparkleTitle,
    cycleAddressSuggestion,
    showCategorySparkle,
    categorySparkleTitle,
    cycleCategorySuggestion,
    locationSearchCandidates,
    showLocationSparkle,
    locationSparkleTitle,
    cycleLocationSearch,
    resetSuggestions,
  };
}

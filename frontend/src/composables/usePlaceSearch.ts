import { getCurrentInstance, onUnmounted, ref, watch, type Ref } from 'vue';
import { classifyLocationInput } from '../utils/locationInputClassifier';

export interface PlaceSearchResult {
  id?: string;
  name: string;
  formatted_address: string;
  address?: string;
  lat: number;
  lng: number;
  category?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  postcode?: string;
}

export interface UsePlaceSearchOptions {
  modelValue?: Ref<{ lat: number; lng: number } | null | undefined>;
  title?: Ref<string | undefined>;
  address?: Ref<string | undefined>;
  mapsLink?: Ref<string | undefined>;
  proximityBias?: Ref<{ lat: number; lng: number } | null | undefined>;
  center?: Ref<{ lat: number; lng: number } | undefined>;
  onSelectPlace?: (place: PlaceSearchResult) => void;
  onMapsLinkResolved?: (coords: { lat: number; lng: number }, url: string) => void;
  onMapsLinkInput?: (url: string) => void;
}

export function usePlaceSearch(options: UsePlaceSearchOptions = {}) {
  const inputText = ref('');
  const isSearching = ref(false);
  const isOpen = ref(false);
  const results = ref<PlaceSearchResult[]>([]);
  const activeIndex = ref(-1);
  const selectedPlace = ref<PlaceSearchResult | null>(null);
  const shortlinkDetected = ref(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeAbortController: AbortController | null = null;

  // Initialisiere Textfeld mit übergebenem Link oder Adresse nur, wenn noch kein Standort gesetzt ist
  if (options.mapsLink) {
    watch(
      options.mapsLink,
      (link) => {
        if (
          link &&
          !inputText.value &&
          !options.modelValue?.value &&
          options.title?.value === undefined
        ) {
          inputText.value = link;
        }
      },
      { immediate: true }
    );
  }

  if (options.address) {
    watch(
      options.address,
      (addr) => {
        if (
          addr &&
          !inputText.value &&
          !options.modelValue?.value &&
          !options.mapsLink?.value &&
          options.title?.value === undefined
        ) {
          inputText.value = addr;
        }
      },
      { immediate: true }
    );
  }

  function cancelDebounceAndInFlight() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
  }

  function handleInput(val: string, immediate = false) {
    inputText.value = val;
    shortlinkDetected.value = false;

    cancelDebounceAndInFlight();

    const classification = classifyLocationInput(val);

    if (classification.type === 'empty') {
      isSearching.value = false;
      isOpen.value = false;
      results.value = [];
      activeIndex.value = -1;
      return;
    }

    if (classification.type === 'maps_link') {
      isSearching.value = false;
      isOpen.value = false;
      results.value = [];
      activeIndex.value = -1;

      options.onMapsLinkInput?.(classification.url);

      if (classification.coords) {
        options.onMapsLinkResolved?.(classification.coords, classification.url);
      } else if (classification.isShortlink) {
        shortlinkDetected.value = true;
      }
      return;
    }

    // Free-text search query
    const trimmed = classification.query.trim();
    if (trimmed.length < 2) {
      isSearching.value = false;
      isOpen.value = false;
      results.value = [];
      activeIndex.value = -1;
      return;
    }

    isSearching.value = true;
    activeIndex.value = -1;

    const runSearch = async () => {
      try {
        activeAbortController = new AbortController();
        const bias = options.proximityBias?.value ?? options.center?.value;
        let url = `/api/places/search?q=${encodeURIComponent(trimmed)}`;
        if (bias && Number.isFinite(bias.lat) && Number.isFinite(bias.lng)) {
          url += `&lat=${bias.lat}&lng=${bias.lng}`;
        }

        const res = await fetch(url, { signal: activeAbortController.signal });
        if (!res.ok) {
          results.value = [];
          isOpen.value = true;
          return;
        }
        const data = (await res.json()) as PlaceSearchResult[];
        results.value = Array.isArray(data) ? data : [];
        isOpen.value = true;
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        results.value = [];
      } finally {
        isSearching.value = false;
      }
    };

    if (immediate) {
      void runSearch();
    } else {
      debounceTimer = setTimeout(runSearch, 300);
    }
  }

  function selectPlace(place: PlaceSearchResult) {
    selectedPlace.value = place;
    inputText.value = '';
    isOpen.value = false;
    results.value = [];
    activeIndex.value = -1;
    options.onSelectPlace?.(place);
  }

  function resetSearch() {
    selectedPlace.value = null;
    isOpen.value = false;
    results.value = [];
    activeIndex.value = -1;
    shortlinkDetected.value = false;
    cancelDebounceAndInFlight();
    inputText.value = '';
  }

  function clearSearch() {
    resetSearch();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      if (!isOpen.value) {
        if (results.value.length > 0) {
          isOpen.value = true;
          activeIndex.value = 0;
        }
      } else {
        e.preventDefault();
        activeIndex.value = (activeIndex.value + 1) % results.value.length;
      }
    } else if (e.key === 'ArrowUp') {
      if (isOpen.value) {
        e.preventDefault();
        activeIndex.value =
          activeIndex.value <= 0 ? results.value.length - 1 : activeIndex.value - 1;
      }
    } else if (e.key === 'Enter') {
      if (isOpen.value && activeIndex.value >= 0 && activeIndex.value < results.value.length) {
        e.preventDefault();
        selectPlace(results.value[activeIndex.value]);
      }
    } else if (e.key === 'Escape') {
      if (isOpen.value) {
        e.preventDefault();
        isOpen.value = false;
      }
    }
  }

  function onBlur(e: FocusEvent, onEmitBlur?: (e: FocusEvent) => void) {
    window.setTimeout(() => {
      isOpen.value = false;
    }, 200);
    onEmitBlur?.(e);
  }

  function onFocus() {
    if (results.value.length > 0 && inputText.value.trim().length >= 2) {
      isOpen.value = true;
    }
  }

  if (getCurrentInstance()) {
    onUnmounted(() => {
      cancelDebounceAndInFlight();
    });
  }

  return {
    inputText,
    isSearching,
    isOpen,
    results,
    activeIndex,
    selectedPlace,
    shortlinkDetected,
    handleInput,
    selectPlace,
    resetSearch,
    clearSearch,
    onKeydown,
    onBlur,
    onFocus,
  };
}

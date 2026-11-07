import { computed, nextTick, ref, watch, type Ref } from 'vue';
import type { PlaceSearchResult } from './usePlaceSearch';

export interface UseLocationDetailsOptions {
  modelValue: Ref<{ lat: number; lng: number } | null | undefined>;
  title?: Ref<string | undefined>;
  address?: Ref<string | undefined>;
  category?: Ref<string | undefined>;
  mapsLink?: Ref<string | undefined>;
  selectedPlace?: Ref<PlaceSearchResult | null>;
  context?: Ref<'spot' | 'trip' | undefined>;
  onUpdateTitle?: (title: string) => void;
  onUpdateAddress?: (address: string) => void;
  onUpdateCategory?: (category: string) => void;
  onManualDetailsOpened?: () => void;
  onManualDetailsClosed?: () => void;
}

export function useLocationDetails(options: UseLocationDetailsOptions) {
  // Inline-Edit State für die Status-Details (Titel, Adresse & Kategorie)
  const isEditingTitle = ref(true);
  const editTitleInput = ref('');
  const isEditingAddress = ref(true);
  const editAddressInput = ref('');
  const isEditingCategory = ref(true);
  const editCategoryInput = ref('');

  const manualDetailsOpen = ref(false);
  const cardClosed = ref(false);

  const hasLocation = computed(() =>
    Boolean(options.modelValue.value || options.address?.value || options.mapsLink?.value)
  );

  const isDetailsVisible = computed(() => {
    if (cardClosed.value) return false;
    if (options.context?.value === 'trip') return true;
    if (options.title?.value !== undefined) return true;
    if (manualDetailsOpen.value) return true;
    if (options.selectedPlace?.value !== null && options.selectedPlace?.value !== undefined) {
      return true;
    }
    if (hasLocation.value) return true;
    return false;
  });

  function focusTitleOrAddressInput() {
    const el = document.querySelector<HTMLInputElement>(
      '.status-title-row input, .status-address-row input'
    );
    el?.focus();
  }

  function openManualDetails() {
    cardClosed.value = false;
    manualDetailsOpen.value = true;
    options.onManualDetailsOpened?.();
    nextTick(() => {
      focusTitleOrAddressInput();
    });
  }

  function closeManualDetails() {
    cardClosed.value = true;
    manualDetailsOpen.value = false;
    options.onManualDetailsClosed?.();
  }

  if (options.title) {
    watch(
      options.title,
      (newTitle) => {
        if (newTitle !== editTitleInput.value) {
          editTitleInput.value = newTitle || '';
        }
      },
      { immediate: true }
    );
  }

  if (options.address) {
    watch(
      options.address,
      (newAddress) => {
        if (newAddress !== editAddressInput.value) {
          editAddressInput.value = newAddress || '';
        }
      },
      { immediate: true }
    );
  }

  if (options.category) {
    watch(
      options.category,
      (newCategory) => {
        if (newCategory !== editCategoryInput.value) {
          editCategoryInput.value = newCategory || '';
        }
      },
      { immediate: true }
    );
  }

  function startEditTitle() {
    isEditingTitle.value = true;
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>('.status-title-row input');
      el?.focus();
      el?.select();
    });
  }

  function onTitleInput() {
    options.onUpdateTitle?.(editTitleInput.value);
  }

  function saveTitle() {
    const trimmed = editTitleInput.value.trim();
    options.onUpdateTitle?.(trimmed);
  }

  function cancelTitle() {
    if (options.title?.value !== undefined) {
      editTitleInput.value = options.title.value;
    }
  }

  function startEditAddress() {
    isEditingAddress.value = true;
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>('.status-address-row input');
      el?.focus();
      el?.select();
    });
  }

  function onAddressInput() {
    options.onUpdateAddress?.(editAddressInput.value);
  }

  function saveAddress() {
    const trimmed = editAddressInput.value.trim();
    options.onUpdateAddress?.(trimmed);
  }

  function cancelAddress() {
    if (options.address?.value !== undefined) {
      editAddressInput.value = options.address.value;
    }
  }

  function startEditCategory() {
    isEditingCategory.value = true;
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>('.status-category-row input');
      el?.focus();
      el?.select();
    });
  }

  function saveCategory(val?: string) {
    const newCat = (typeof val === 'string' ? val : editCategoryInput.value).trim();
    options.onUpdateCategory?.(newCat);
  }

  function cancelCategory() {
    if (options.category?.value !== undefined) {
      editCategoryInput.value = options.category.value;
    }
  }

  function handleCategoryBlur() {
    window.setTimeout(() => {
      if (options.category?.value) {
        saveCategory();
      }
    }, 200);
  }

  async function reverseGeocodeCoords(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/places/reverse?lat=${lat}&lng=${lng}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) {
        editAddressInput.value = '';
        options.onUpdateAddress?.('');
        return;
      }
      const data = (await res.json()) as { formatted_address?: string; address?: string } | null;
      if (data && (data.formatted_address || data.address)) {
        const addr = data.formatted_address || data.address || '';
        editAddressInput.value = addr;
        options.onUpdateAddress?.(addr);
      } else {
        editAddressInput.value = '';
        options.onUpdateAddress?.('');
      }
    } catch {
      editAddressInput.value = '';
      options.onUpdateAddress?.('');
    }
  }

  function resetDetailsState() {
    cardClosed.value = false;
    manualDetailsOpen.value = false;
    isEditingTitle.value = true;
    isEditingAddress.value = true;
    isEditingCategory.value = true;
  }

  return {
    isEditingTitle,
    editTitleInput,
    isEditingAddress,
    editAddressInput,
    isEditingCategory,
    editCategoryInput,
    manualDetailsOpen,
    cardClosed,
    hasLocation,
    isDetailsVisible,
    openManualDetails,
    closeManualDetails,
    startEditTitle,
    onTitleInput,
    saveTitle,
    cancelTitle,
    startEditAddress,
    onAddressInput,
    saveAddress,
    cancelAddress,
    startEditCategory,
    saveCategory,
    cancelCategory,
    handleCategoryBlur,
    reverseGeocodeCoords,
    resetDetailsState,
  };
}

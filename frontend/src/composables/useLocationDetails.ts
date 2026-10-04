import { computed, nextTick, ref, watch, type Ref } from 'vue';
import type { PlaceSearchResult } from './usePlaceSearch';

export interface UseLocationDetailsOptions {
  modelValue: Ref<{ lat: number; lng: number } | null | undefined>;
  title?: Ref<string | undefined>;
  address?: Ref<string | undefined>;
  category?: Ref<string | undefined>;
  mapsLink?: Ref<string | undefined>;
  selectedPlace?: Ref<PlaceSearchResult | null>;
  onUpdateTitle?: (title: string) => void;
  onUpdateAddress?: (address: string) => void;
  onUpdateCategory?: (category: string) => void;
  onManualDetailsOpened?: () => void;
  onManualDetailsClosed?: () => void;
}

export function useLocationDetails(options: UseLocationDetailsOptions) {
  // Inline-Edit State für die Status-Details (Titel, Adresse & Kategorie)
  const isEditingTitle = ref(false);
  const editTitleInput = ref('');
  const isEditingAddress = ref(false);
  const editAddressInput = ref('');
  const isEditingCategory = ref(false);
  const editCategoryInput = ref('');

  const manualDetailsOpen = ref(false);
  const cardClosed = ref(false);

  const hasLocation = computed(() =>
    Boolean(options.modelValue.value || options.address?.value || options.mapsLink?.value)
  );

  const isDetailsVisible = computed(() => {
    if (cardClosed.value) return false;
    if (manualDetailsOpen.value) return true;
    if (options.selectedPlace?.value !== null && options.selectedPlace?.value !== undefined) {
      return true;
    }
    if (hasLocation.value) return true;
    if (options.title?.value && options.title.value.trim().length > 0) return true;
    return false;
  });

  function focusTitleOrAddressInput() {
    const el = document.querySelector<HTMLInputElement>(
      '.status-title-row .inline-edit-input input, .status-title-row input, .status-address-row .inline-edit-input input, .status-address-row input'
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
        if (!isEditingTitle.value || !editTitleInput.value) {
          editTitleInput.value = newTitle || '';
          isEditingTitle.value = !newTitle;
        }
      },
      { immediate: true }
    );
  }

  if (options.address) {
    watch(
      options.address,
      (newAddress) => {
        if (!isEditingAddress.value || !editAddressInput.value) {
          editAddressInput.value = newAddress || '';
          isEditingAddress.value = !newAddress;
        }
      },
      { immediate: true }
    );
  }

  if (options.category) {
    watch(
      options.category,
      (newCategory) => {
        if (!isEditingCategory.value || !editCategoryInput.value) {
          editCategoryInput.value = newCategory || '';
          isEditingCategory.value = !newCategory;
        }
      },
      { immediate: true }
    );
  }

  function startEditTitle() {
    editTitleInput.value = options.title?.value || '';
    isEditingTitle.value = true;
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>(
        '.status-title-row .inline-edit-input input, .status-title-row input'
      );
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
    if (trimmed) {
      isEditingTitle.value = false;
    }
  }

  function cancelTitle() {
    if (options.title?.value) {
      editTitleInput.value = options.title.value;
      isEditingTitle.value = false;
    }
  }

  function startEditAddress() {
    editAddressInput.value = options.address?.value || '';
    isEditingAddress.value = true;
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>(
        '.status-address-row .inline-edit-input input, .status-address-row input'
      );
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
    if (trimmed) {
      isEditingAddress.value = false;
    }
  }

  function cancelAddress() {
    if (options.address?.value) {
      editAddressInput.value = options.address.value;
      isEditingAddress.value = false;
    }
  }

  function startEditCategory() {
    editCategoryInput.value = options.category?.value || '';
    isEditingCategory.value = true;
    nextTick(() => {
      const el = document.querySelector<HTMLInputElement>(
        '.status-category-row .inline-category-combobox input, .status-category-row input'
      );
      el?.focus();
      el?.select();
    });
  }

  function saveCategory(val?: string) {
    const newCat = (typeof val === 'string' ? val : editCategoryInput.value).trim();
    options.onUpdateCategory?.(newCat);
    if (newCat) {
      isEditingCategory.value = false;
    }
  }

  function cancelCategory() {
    if (options.category?.value) {
      editCategoryInput.value = options.category.value;
      isEditingCategory.value = false;
    }
  }

  function handleCategoryBlur() {
    window.setTimeout(() => {
      if (isEditingCategory.value && options.category?.value) {
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
    isEditingTitle.value = false;
    isEditingAddress.value = false;
    isEditingCategory.value = false;
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

<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import Input from './primitives/Input.vue';
import SparkleButton from './primitives/SparkleButton.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import SpotLocationBadge from './SpotLocationBadge.vue';
import CategoryCombobox from './CategoryCombobox.vue';
import FormField from './FormField.vue';
import { spotTitlePlaceholder } from '../utils/spotCategory';
import type { PlaceSearchResult } from '../composables/usePlaceSearch';

const props = withDefaults(
  defineProps<{
    modelValue: { lat: number; lng: number } | null;
    modified?: boolean;
    hasLocation?: boolean;
    title?: string;
    titleRequired?: boolean;
    titleInvalid?: boolean;
    category?: string;
    categoryOptions?: string[];
    address?: string;
    editTitleInput?: string;
    editCategoryInput?: string;
    editAddressInput?: string;
    showCategorySparkle?: boolean;
    categorySparkleTitle?: string;
    isFetchingCategorySuggestion?: boolean;
    showAddressSparkle?: boolean;
    addressSparkleTitle?: string;
    isFetchingAddressSuggestion?: boolean;
    showLocationSparkle?: boolean;
    locationSparkleTitle?: string;
    isSearching?: boolean;
    titleSearchResults?: PlaceSearchResult[];
    titleSearchOpen?: boolean;
    titleSearchActiveIndex?: number;
    isSearchingTitle?: boolean;
    addressSearchResults?: PlaceSearchResult[];
    addressSearchOpen?: boolean;
    addressSearchActiveIndex?: number;
    isSearchingAddress?: boolean;
    // Optional / Kompatibilität
    context?: 'spot' | 'trip';
    isEditingTitle?: boolean;
    isEditingCategory?: boolean;
    isEditingAddress?: boolean;
  }>(),
  {
    context: 'spot',
    modified: false,
    hasLocation: false,
    title: undefined,
    titleRequired: false,
    titleInvalid: false,
    category: undefined,
    categoryOptions: undefined,
    address: '',
    editTitleInput: '',
    editCategoryInput: '',
    editAddressInput: '',
    showCategorySparkle: false,
    categorySparkleTitle: '',
    isFetchingCategorySuggestion: false,
    showAddressSparkle: false,
    addressSparkleTitle: '',
    isFetchingAddressSuggestion: false,
    showLocationSparkle: false,
    locationSparkleTitle: '',
    isSearching: false,
    titleSearchResults: () => [],
    titleSearchOpen: false,
    titleSearchActiveIndex: -1,
    isSearchingTitle: false,
    addressSearchResults: () => [],
    addressSearchOpen: false,
    addressSearchActiveIndex: -1,
    isSearchingAddress: false,
    isEditingTitle: true,
    isEditingCategory: true,
    isEditingAddress: true,
  }
);

const emit = defineEmits<{
  (e: 'reset'): void;
  (e: 'clearCoords'): void;
  (e: 'update:editTitleInput', value: string): void;
  (e: 'titleInput', event: Event): void;
  (e: 'titleFocus', event: FocusEvent): void;
  (e: 'titleBlur', event: FocusEvent): void;
  (e: 'titleKeydown', event: KeyboardEvent): void;
  (e: 'selectTitlePlace', place: PlaceSearchResult): void;
  (e: 'saveTitle'): void;
  (e: 'cancelTitle'): void;
  (e: 'startEditTitle'): void;
  (e: 'update:editCategoryInput', value: string): void;
  (e: 'saveCategory', val?: string): void;
  (e: 'cancelCategory'): void;
  (e: 'startEditCategory'): void;
  (e: 'categoryBlur', event?: FocusEvent): void;
  (e: 'cycleCategorySuggestion'): void;
  (e: 'update:editAddressInput', value: string): void;
  (e: 'addressInput', event: Event): void;
  (e: 'addressFocus', event: FocusEvent): void;
  (e: 'addressBlur', event: FocusEvent): void;
  (e: 'addressKeydown', event: KeyboardEvent): void;
  (e: 'selectAddressPlace', place: PlaceSearchResult): void;
  (e: 'saveAddress'): void;
  (e: 'cancelAddress'): void;
  (e: 'startEditAddress'): void;
  (e: 'cycleAddressSuggestion'): void;
  (e: 'cycleLocationSearch'): void;
}>();

const cardEl = ref<HTMLDivElement | null>(null);
const titleInputId = useId();
const titleDropdownId = useId();
const categoryInputId = useId();
const addressInputId = useId();
const addressDropdownId = useId();

const titlePlaceholder = computed(() => {
  return spotTitlePlaceholder(props.editCategoryInput || props.category);
});

defineExpose({
  cardEl,
});
</script>

<template>
  <div
    ref="cardEl"
    class="polaroid-card"
    :class="{ 'is-modified': modified, 'has-location': hasLocation }"
    data-testid="location-status"
  >
    <!-- Header Actions (oben rechts in der Card): Zurücksetzen -->
    <div v-if="modified" class="polaroid-header-actions">
      <IconButton
        type="button"
        size="sm"
        shape="circle"
        variant="secondary"
        class="polaroid-action-btn polaroid-reset-btn"
        :icon="ACTION_ICONS.restore"
        title="Standort zurücksetzen"
        aria-label="Standort zurücksetzen"
        @click="emit('reset')"
      />
    </div>

    <!-- Polaroid-Foto / Medien-Slot (z. B. CoverImagePicker) -->
    <div v-if="$slots.media" class="polaroid-media">
      <slot name="media" />
    </div>

    <!-- Polaroid-Body / Formularfelder mit vollständigen Labels -->
    <div class="polaroid-body">
      <div class="status-details">
        <!-- 1. Name-Feld -->
        <FormField
          v-if="props.title !== undefined"
          :id="titleInputId"
          icon="title"
          label="Name"
          label-class="polaroid-field-label"
          :required="titleRequired"
          :invalid="titleInvalid"
          class="polaroid-field status-title-row"
        >
          <div class="field-input-wrap">
            <div class="inline-title-input-wrap">
              <Input
                :id="titleInputId"
                :model-value="editTitleInput"
                size="sm"
                class="polaroid-field-input inline-edit-input"
                name="title"
                data-testid="spot-title-input"
                :placeholder="titlePlaceholder"
                autocomplete="off"
                data-protonpass-ignore="true"
                data-1p-ignore="true"
                role="combobox"
                :aria-expanded="titleSearchOpen && titleSearchResults.length > 0"
                aria-autocomplete="list"
                :aria-controls="titleDropdownId"
                :aria-activedescendant="
                  titleSearchActiveIndex >= 0
                    ? `${titleDropdownId}-opt-${titleSearchActiveIndex}`
                    : undefined
                "
                :required="titleRequired"
                :invalid="titleInvalid"
                @update:model-value="emit('update:editTitleInput', $event)"
                @input="emit('titleInput', $event)"
                @focus="emit('titleFocus', $event)"
                @blur="emit('titleBlur', $event)"
                @keydown="emit('titleKeydown', $event)"
              />
              <div v-if="isSearchingTitle" class="title-input-spinner-wrap" aria-hidden="true">
                <LoadingSpinner size="sm" class="title-input-spinner" />
              </div>

              <!-- Autocomplete-Dropdown für Namensvorschläge / Ortssuche -->
              <Transition name="dropdown-unfold">
                <ul
                  v-if="titleSearchOpen && titleSearchResults.length > 0"
                  :id="titleDropdownId"
                  class="location-dropdown title-autocomplete-dropdown options"
                  role="listbox"
                  aria-label="Namensvorschläge"
                >
                  <li
                    v-for="(place, index) in titleSearchResults"
                    :id="`${titleDropdownId}-opt-${index}`"
                    :key="place.id || `${place.lat}-${place.lng}-${index}`"
                    role="option"
                    tabindex="-1"
                    class="location-result-item"
                    :class="{ 'is-active': index === titleSearchActiveIndex }"
                    :aria-selected="index === titleSearchActiveIndex"
                    @mousedown.prevent="emit('selectTitlePlace', place)"
                    @click="emit('selectTitlePlace', place)"
                    @keydown.enter.prevent="emit('selectTitlePlace', place)"
                  >
                    <AppIcon
                      :icon="FORM_FIELD_ICONS.title"
                      :size="14"
                      group="formFields"
                      class="item-icon"
                    />
                    <div class="location-item-content">
                      <span class="location-item-name">{{ place.name }}</span>
                      <span
                        v-if="
                          place.formatted_address &&
                          place.name &&
                          place.formatted_address !== place.name
                        "
                        class="location-item-address"
                      >
                        {{ place.formatted_address }}
                      </span>
                    </div>
                  </li>
                </ul>
              </Transition>
            </div>
          </div>
        </FormField>

        <!-- 2. Kategorie-Feld -->
        <FormField
          v-if="props.category !== undefined"
          :id="categoryInputId"
          icon="category"
          label="Kategorie"
          label-class="polaroid-field-label"
          class="polaroid-field status-category-row"
        >
          <div class="field-input-wrap">
            <div class="inline-category-combobox" :class="{ 'has-sparkle': showCategorySparkle }">
              <CategoryCombobox
                :id="categoryInputId"
                :model-value="editCategoryInput"
                type="spot"
                :options="categoryOptions"
                size="sm"
                placeholder="Kategorie wählen..."
                @update:model-value="emit('update:editCategoryInput', $event)"
                @select="emit('saveCategory', $event)"
                @blur="emit('categoryBlur', $event)"
                @keydown.enter.prevent="emit('saveCategory')"
                @keydown.esc.prevent="emit('cancelCategory')"
              />
              <SparkleButton
                v-if="showCategorySparkle"
                variant="category"
                class="category-sparkle-btn"
                :loading="isFetchingCategorySuggestion"
                :title="categorySparkleTitle"
                data-testid="spot-category-sparkle-btn"
                @click="emit('cycleCategorySuggestion')"
              />
            </div>
          </div>
        </FormField>

        <!-- 3. Adress-Feld & Standort-Status -->
        <FormField
          :id="addressInputId"
          icon="location"
          :label="context === 'trip' ? 'Reiseziel' : 'Adresse'"
          label-class="polaroid-field-label"
          class="polaroid-field status-address-row"
        >
          <template #extra>
            <div class="polaroid-location-status">
              <!-- Pin gesetzt Badge -->
              <span
                v-if="modelValue"
                class="coords-set-badge"
                :data-testid="context === 'trip' ? 'trip-coords-set' : 'spot-coords-set'"
                :title="`${modelValue.lat.toFixed(5)}, ${modelValue.lng.toFixed(5)}`"
              >
                <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="13" group="formFields" />
                <span>Pin gesetzt</span>
                <span class="status-coords sr-only">
                  {{ modelValue.lat.toFixed(5) }}, {{ modelValue.lng.toFixed(5) }}
                </span>
                <button
                  type="button"
                  class="clear-btn coords-clear-btn coords-clear-inline-btn"
                  title="Standort-Koordinaten entfernen"
                  aria-label="Standort-Koordinaten entfernen"
                  @click="emit('clearCoords')"
                >
                  <AppIcon :icon="ACTION_ICONS.close" :size="13" group="actions" />
                </button>
              </span>
              <!-- Standort fehlt Badge & Search Sparkle -->
              <div v-else class="coords-missing-wrap">
                <span
                  v-if="context === 'trip'"
                  class="coords-missing-badge"
                  data-testid="trip-coords-missing"
                  title="Standort fehlt – bitte Ort im Suchfeld eingeben oder auf die Karte tippen"
                >
                  <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
                  <span>Standort fehlt</span>
                </span>
                <SpotLocationBadge
                  v-else
                  context="dialog"
                  data-testid="spot-coords-missing"
                  popover-class="coords-info-popover"
                />
                <SparkleButton
                  v-if="showLocationSparkle"
                  variant="coords"
                  class="coords-sparkle-btn"
                  :loading="isSearching"
                  :title="locationSparkleTitle"
                  data-testid="spot-location-sparkle-btn"
                  @click="emit('cycleLocationSearch')"
                />
              </div>
            </div>
          </template>

          <div class="field-input-wrap">
            <div class="inline-address-input-wrap" :class="{ 'has-sparkle': showAddressSparkle }">
              <Input
                :id="addressInputId"
                :model-value="editAddressInput"
                size="sm"
                class="polaroid-field-input inline-edit-input"
                :name="context === 'trip' ? 'destination' : 'spot-address'"
                :data-testid="context === 'trip' ? 'trip-destination-input' : 'spot-address-input'"
                :placeholder="
                  context === 'trip'
                    ? 'Reiseziel oder Stadt eingeben...'
                    : 'Adresse oder Ort eingeben...'
                "
                autocomplete="off"
                data-protonpass-ignore="true"
                data-1p-ignore="true"
                role="combobox"
                :aria-expanded="addressSearchOpen && addressSearchResults.length > 0"
                aria-autocomplete="list"
                :aria-controls="addressDropdownId"
                :aria-activedescendant="
                  addressSearchActiveIndex >= 0
                    ? `${addressDropdownId}-opt-${addressSearchActiveIndex}`
                    : undefined
                "
                @update:model-value="emit('update:editAddressInput', $event)"
                @input="emit('addressInput', $event)"
                @focus="emit('addressFocus', $event)"
                @blur="emit('addressBlur', $event)"
                @keydown="emit('addressKeydown', $event)"
              />
              <div v-if="isSearchingAddress" class="address-input-spinner-wrap" aria-hidden="true">
                <LoadingSpinner size="sm" class="address-input-spinner" />
              </div>
              <SparkleButton
                v-if="showAddressSparkle"
                variant="address"
                class="address-sparkle-btn"
                :loading="isFetchingAddressSuggestion"
                :title="addressSparkleTitle"
                data-testid="spot-address-sparkle-btn"
                @click="emit('cycleAddressSuggestion')"
              />

              <!-- Autocomplete-Dropdown für Adressvorschläge -->
              <Transition name="dropdown-unfold">
                <ul
                  v-if="addressSearchOpen && addressSearchResults.length > 0"
                  :id="addressDropdownId"
                  class="location-dropdown address-autocomplete-dropdown options"
                  role="listbox"
                  aria-label="Adressvorschläge"
                >
                  <li
                    v-for="(place, index) in addressSearchResults"
                    :id="`${addressDropdownId}-opt-${index}`"
                    :key="place.id || `${place.lat}-${place.lng}-${index}`"
                    role="option"
                    tabindex="-1"
                    class="location-result-item"
                    :class="{ 'is-active': index === addressSearchActiveIndex }"
                    :aria-selected="index === addressSearchActiveIndex"
                    @mousedown.prevent="emit('selectAddressPlace', place)"
                    @click="emit('selectAddressPlace', place)"
                    @keydown.enter.prevent="emit('selectAddressPlace', place)"
                  >
                    <AppIcon
                      :icon="FORM_FIELD_ICONS.location"
                      :size="14"
                      group="formFields"
                      class="item-icon"
                    />
                    <div class="location-item-content">
                      <span class="location-item-name">{{
                        place.formatted_address || place.address || place.name
                      }}</span>
                      <span
                        v-if="
                          place.formatted_address &&
                          place.name &&
                          place.formatted_address !== place.name
                        "
                        class="location-item-address"
                      >
                        {{ place.name }}
                      </span>
                    </div>
                  </li>
                </ul>
              </Transition>
            </div>
          </div>
        </FormField>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Polaroid Card */
.polaroid-card {
  position: absolute;
  top: 68px;
  left: 12px;
  width: 320px;
  max-width: calc(100% - 24px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  gap: var(--space-2, 8px);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  z-index: var(--z-card-elevated, 5);
}

.polaroid-card:focus-within,
.polaroid-card:has(.open),
.polaroid-card:has(.options),
.polaroid-card:has(.location-dropdown) {
  z-index: var(--z-popover, 1100);
}

.polaroid-card.is-modified {
  border-color: var(--color-accent);
  box-shadow:
    var(--shadow-md),
    0 0 0 1px var(--color-accent);
}

.polaroid-header-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: var(--z-sticky, 10);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.polaroid-action-btn {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  width: var(--input-height-sm, 38px);
  height: var(--input-height-sm, 38px);
  min-width: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.15s ease;
}

.polaroid-action-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.polaroid-reset-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.polaroid-media {
  width: 100%;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  overflow: hidden;
  background: var(--color-hover);
  flex-shrink: 0;

  :deep(.form-image-banner--polaroid) {
    height: 120px;
  }
}

.polaroid-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  min-width: 0;
  padding: 0;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

/* Einzelnes Formularfeld in der Polaroid-Card */
.polaroid-field {
  width: 100%;
  min-width: 0;
}

.field-input-wrap {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
}

.polaroid-field-input {
  width: 100%;
  min-width: 0;
}

/* Standort-Status im Header der Adresszeile */
.polaroid-location-status {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.coords-set-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 6px 3px 9px;
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.25;
}

.coords-missing-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-warning-dark, var(--color-warning));
  line-height: 1.25;
}

.coords-clear-inline-btn {
  @include touch-target;
  @include min-touch-target(24px) {
    width: 24px;
    height: 24px;
  }
  background: none;
  border: none;
  padding: 0;
  width: 20px;
  height: 20px;
  min-width: 20px;
  min-height: 20px;
  margin-left: 2px;
  cursor: pointer;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  line-height: 1;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    outline 0.15s ease;
}

.coords-clear-inline-btn:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
}

.coords-clear-inline-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 1px);
}

.coords-missing-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.coords-info-popover {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

/* Input Wrappers & Sparkle / Spinner */
.inline-address-input-wrap,
.inline-title-input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.inline-address-input-wrap.has-sparkle :deep(input) {
  padding-right: 38px;
}

.inline-category-combobox {
  min-width: 0;
  flex: 1;
  width: 100%;
  position: relative;
  display: flex;
  align-items: center;
}

.inline-category-combobox.has-sparkle :deep(input) {
  padding-right: 62px;
}

.inline-category-combobox :deep(.category-sparkle-btn) {
  right: 28px;
}

.inline-category-combobox :deep(.combobox) {
  min-width: 0;
  width: 100%;
}

.address-input-spinner-wrap {
  position: absolute;
  right: 34px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  pointer-events: none;
}

.address-input-spinner,
.title-input-spinner {
  pointer-events: none;
}

.title-input-spinner-wrap {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  pointer-events: none;
}

/* Autocomplete Dropdown */
.address-autocomplete-dropdown,
.title-autocomplete-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  right: 0;
  z-index: var(--z-popover, 1100);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  list-style: none;
  padding: var(--space-1) 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

.location-result-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-1) 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.location-result-item:hover,
.location-result-item.is-active,
.location-result-item[aria-selected='true'] {
  background: var(--color-hover);
}

.item-icon {
  margin-top: 3px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.location-item-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}

.location-item-name {
  font-weight: 500;
  font-size: var(--font-size-xs);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-item-address {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Responsive / Container Queries */
@container (min-width: 581px) {
  .polaroid-card {
    position: absolute;
    top: 68px;
    left: 12px;
    right: auto;
    width: 320px;
    max-width: calc(100% - 24px);
    max-height: calc(100% - 80px);
    overflow-y: auto;
  }

  .polaroid-card:has(.options),
  .polaroid-card:has(.location-dropdown) {
    overflow-y: visible;
  }
}

@container (max-width: 580px) {
  .polaroid-card {
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    width: 100%;
    max-width: 100%;
    max-height: none;
    overflow-y: visible;
    box-shadow: none;
  }

  .polaroid-media :deep(.form-image-banner--polaroid) {
    height: 110px;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>

<script setup lang="ts">
import { ref } from 'vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import AppIcon from './AppIcon.vue';
import IconButton from './primitives/IconButton.vue';
import Input from './primitives/Input.vue';
import InfoPopover from './primitives/InfoPopover.vue';
import SparkleButton from './primitives/SparkleButton.vue';
import CategoryChip from './CategoryChip.vue';
import CategoryCombobox from './CategoryCombobox.vue';

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
    isEditingTitle?: boolean;
    editTitleInput?: string;
    isEditingCategory?: boolean;
    editCategoryInput?: string;
    showCategorySparkle?: boolean;
    categorySparkleTitle?: string;
    isFetchingCategorySuggestion?: boolean;
    isEditingAddress?: boolean;
    editAddressInput?: string;
    showAddressSparkle?: boolean;
    addressSparkleTitle?: string;
    isFetchingAddressSuggestion?: boolean;
    showLocationSparkle?: boolean;
    locationSparkleTitle?: string;
    isSearching?: boolean;
  }>(),
  {
    modified: false,
    hasLocation: false,
    title: undefined,
    titleRequired: false,
    titleInvalid: false,
    category: undefined,
    categoryOptions: undefined,
    address: '',
    isEditingTitle: false,
    editTitleInput: '',
    isEditingCategory: false,
    editCategoryInput: '',
    showCategorySparkle: false,
    categorySparkleTitle: '',
    isFetchingCategorySuggestion: false,
    isEditingAddress: false,
    editAddressInput: '',
    showAddressSparkle: false,
    addressSparkleTitle: '',
    isFetchingAddressSuggestion: false,
    showLocationSparkle: false,
    locationSparkleTitle: '',
    isSearching: false,
  }
);

const emit = defineEmits<{
  (e: 'reset'): void;
  (e: 'clearCoords'): void;
  (e: 'startEditTitle'): void;
  (e: 'update:editTitleInput', value: string): void;
  (e: 'titleInput', event: Event): void;
  (e: 'saveTitle'): void;
  (e: 'cancelTitle'): void;
  (e: 'startEditCategory'): void;
  (e: 'update:editCategoryInput', value: string): void;
  (e: 'saveCategory', val?: string): void;
  (e: 'cancelCategory'): void;
  (e: 'categoryBlur', event?: FocusEvent): void;
  (e: 'cycleCategorySuggestion'): void;
  (e: 'startEditAddress'): void;
  (e: 'update:editAddressInput', value: string): void;
  (e: 'addressInput', event: Event): void;
  (e: 'saveAddress'): void;
  (e: 'cancelAddress'): void;
  (e: 'cycleAddressSuggestion'): void;
  (e: 'cycleLocationSearch'): void;
}>();

const cardEl = ref<HTMLDivElement | null>(null);

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

    <!-- Polaroid-Body / Beschriftung & Detailzeilen -->
    <div class="polaroid-body">
      <div class="status-details">
        <!-- 1. Titel-Zeile -->
        <div v-if="props.title !== undefined" class="status-meta-row status-title-row">
          <span class="status-row-icon" title="Titel" aria-hidden="true">
            <AppIcon :icon="FORM_FIELD_ICONS.title" :size="14" group="formFields" />
          </span>
          <div v-if="!isEditingTitle && props.title" class="status-meta-display">
            <span class="status-title" :title="props.title">
              {{ props.title }}
            </span>
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              class="inline-edit-btn"
              :icon="ACTION_ICONS.edit"
              title="Titel bearbeiten"
              aria-label="Titel bearbeiten"
              @click="emit('startEditTitle')"
            />
          </div>
          <div v-else class="status-meta-edit status-title-edit">
            <Input
              :model-value="editTitleInput"
              size="sm"
              class="inline-edit-input"
              name="title"
              data-testid="spot-title-input"
              placeholder="Titel des Spots..."
              :required="titleRequired"
              :invalid="titleInvalid"
              @update:model-value="emit('update:editTitleInput', $event)"
              @input="emit('titleInput', $event)"
              @keydown.enter.prevent="emit('saveTitle')"
              @keydown.esc.prevent="emit('cancelTitle')"
              @blur="emit('saveTitle')"
            />
            <IconButton
              v-if="props.title"
              type="button"
              size="sm"
              variant="ghost"
              class="inline-save-btn"
              :icon="ACTION_ICONS.done"
              title="Titel speichern"
              aria-label="Titel speichern"
              @click="emit('saveTitle')"
            />
          </div>
        </div>

        <!-- 2. Kategorie-Zeile (direkt nach dem Titel analog SpotCard) -->
        <div v-if="props.category !== undefined" class="status-meta-row status-category-row">
          <span class="status-row-icon" title="Kategorie" aria-hidden="true">
            <AppIcon :icon="FORM_FIELD_ICONS.category" :size="14" group="formFields" />
          </span>
          <div v-if="!isEditingCategory && props.category" class="status-meta-display">
            <CategoryChip :category="props.category" type="spot" />
            <IconButton
              type="button"
              size="sm"
              variant="ghost"
              class="inline-edit-btn"
              :icon="ACTION_ICONS.edit"
              title="Kategorie bearbeiten"
              aria-label="Kategorie bearbeiten"
              @click="emit('startEditCategory')"
            />
          </div>
          <div v-else class="status-meta-edit status-category-edit">
            <div class="inline-category-combobox" :class="{ 'has-sparkle': showCategorySparkle }">
              <CategoryCombobox
                :model-value="editCategoryInput"
                type="spot"
                :options="categoryOptions"
                size="sm"
                placeholder="Kategorie wählen..."
                @update:model-value="emit('update:editCategoryInput', $event)"
                @select="emit('saveCategory', $event)"
                @keydown.enter.prevent="emit('saveCategory')"
                @keydown.esc.prevent="emit('cancelCategory')"
                @blur="emit('categoryBlur', $event)"
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
            <IconButton
              v-if="props.category"
              type="button"
              size="sm"
              variant="ghost"
              class="inline-save-btn"
              :icon="ACTION_ICONS.done"
              title="Kategorie speichern"
              aria-label="Kategorie speichern"
              @click="emit('saveCategory')"
            />
          </div>
        </div>

        <!-- 3. Standort-Gruppe: Adresse & Koordinaten näher zusammengerückt -->
        <div class="status-location-group">
          <!-- Adress-Zeile -->
          <div class="status-meta-row status-address-row">
            <span class="status-row-icon" title="Adresse" aria-hidden="true">
              <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
            </span>
            <div v-if="!isEditingAddress && props.address" class="status-meta-display">
              <span class="status-address" :title="props.address">
                {{ props.address }}
              </span>
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                class="inline-edit-btn"
                :icon="ACTION_ICONS.edit"
                title="Adresse bearbeiten"
                aria-label="Adresse bearbeiten"
                @click="emit('startEditAddress')"
              />
            </div>
            <div v-else class="status-meta-edit status-address-edit">
              <div class="inline-address-input-wrap" :class="{ 'has-sparkle': showAddressSparkle }">
                <Input
                  :model-value="editAddressInput"
                  size="sm"
                  class="inline-edit-input"
                  name="spot-address"
                  data-testid="spot-address-input"
                  placeholder="Adresse eingeben..."
                  autocomplete="off"
                  data-protonpass-ignore="true"
                  data-1p-ignore="true"
                  @update:model-value="emit('update:editAddressInput', $event)"
                  @input="emit('addressInput', $event)"
                  @keydown.enter.prevent="emit('saveAddress')"
                  @keydown.esc.prevent="emit('cancelAddress')"
                  @blur="emit('saveAddress')"
                />
                <SparkleButton
                  v-if="showAddressSparkle"
                  variant="address"
                  class="address-sparkle-btn"
                  :loading="isFetchingAddressSuggestion"
                  :title="addressSparkleTitle"
                  data-testid="spot-address-sparkle-btn"
                  @click="emit('cycleAddressSuggestion')"
                />
              </div>
              <IconButton
                v-if="props.address"
                type="button"
                size="sm"
                variant="ghost"
                class="inline-save-btn"
                :icon="ACTION_ICONS.done"
                title="Adresse speichern"
                aria-label="Adresse speichern"
                @click="emit('saveAddress')"
              />
            </div>
          </div>

          <!-- Standort / Koordinaten-Zeile: Immer sichtbar (Issue #SpotLocationMissing) -->
          <div class="status-meta-row status-coords-row" :class="{ 'is-missing': !modelValue }">
            <template v-if="modelValue">
              <span class="status-row-icon" title="Koordinaten" aria-hidden="true">
                <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" />
              </span>
              <div class="status-meta-display">
                <span class="status-coords">
                  {{ modelValue.lat.toFixed(5) }}, {{ modelValue.lng.toFixed(5) }}
                </span>
                <IconButton
                  type="button"
                  size="sm"
                  variant="ghost"
                  class="clear-btn coords-clear-btn"
                  :icon="ACTION_ICONS.close"
                  title="Standort-Koordinaten entfernen"
                  aria-label="Standort-Koordinaten entfernen"
                  @click="emit('clearCoords')"
                />
              </div>
            </template>
            <template v-else>
              <span
                class="status-row-icon status-warning-icon"
                title="Standort fehlt"
                aria-hidden="true"
              >
                <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
              </span>
              <div class="status-meta-display">
                <span class="status-coords status-coords-missing" data-testid="spot-coords-missing">
                  Standort fehlt
                </span>
                <InfoPopover
                  title="Standort festlegen"
                  aria-label="Hinweise zum Festlegen des Standorts anzeigen"
                  placement="bottom"
                  align="left"
                  :icon-size="14"
                  :menu-width="260"
                  class="coords-info-popover"
                >
                  <p>
                    <strong>Standort festlegen:</strong>
                  </p>
                  <p>
                    • <strong>Ortssuche:</strong> Nutze die Suchleiste oben für Adressen oder
                    Sehenswürdigkeiten.
                  </p>
                  <p>
                    • <strong>Karten-Link:</strong> Kopiere einen Google Maps-, Apple Maps- oder
                    OSM-Link in das Suchfeld.
                  </p>
                  <p class="popover-tip">
                    📍 Tippe alternativ direkt auf die Karte, um die Stecknadel manuell zu
                    platzieren.
                  </p>
                </InfoPopover>
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
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Polaroid Card */
.polaroid-card {
  position: absolute;
  top: 68px;
  left: 12px;
  width: 260px;
  max-width: calc(100% - 24px);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: var(--space-2);
  gap: var(--space-2);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  z-index: var(--z-card-elevated, 5);
}

.polaroid-card:focus-within,
.polaroid-card:has(.open) {
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
  width: 26px;
  height: 26px;
  min-width: 26px;
  min-height: 26px;
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
}

.polaroid-card.is-modified:not(:has(.polaroid-media)) .status-title-row {
  padding-right: var(--space-5);
}

.polaroid-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: 2px 2px var(--space-1) 2px;
}

.clear-btn {
  line-height: 1;
}

.status-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  max-width: 100%;
  width: 100%;
  box-sizing: border-box;
}

.status-location-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-width: 0;
}

.status-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
  width: 100%;
  min-height: 36px;
}

.status-coords-row {
  align-items: center;
}

.status-coords-row .status-row-icon {
  margin-top: 0;
}

.status-row-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  min-width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--color-text-muted);
  margin-top: 0;
}

.status-meta-display {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-1);
  min-width: 0;
  max-width: 100%;
  flex: 1;
  min-height: 36px;
}

.status-meta-edit {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
  flex: 1;
  min-width: 0;
  max-width: 100%;
  min-height: 36px;
}

.status-meta-row:has(.status-meta-edit) {
  align-items: center;
}

.status-meta-row:has(.status-meta-edit) .status-row-icon {
  margin-top: 0;
}

.inline-edit-input {
  flex: 1;
  min-width: 0;
  width: 100%;
}

.inline-address-input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
}

.inline-address-input-wrap.has-sparkle :deep(input) {
  padding-right: 28px;
}

.inline-category-combobox.has-sparkle :deep(input) {
  padding-right: 46px;
}

.inline-edit-btn {
  opacity: 0;
  pointer-events: none;
  padding: 2px 4px;
  flex-shrink: 0;
  align-self: center;
  margin-top: 0;
  margin-left: auto;
  transition: opacity 0.15s ease;
}

.status-meta-row:hover .inline-edit-btn,
.inline-edit-btn:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .inline-edit-btn {
    opacity: 0.85;
    pointer-events: auto;
  }
}

.inline-save-btn {
  padding: 2px 4px;
  flex-shrink: 0;
  align-self: center;
  margin-left: auto;
  color: var(--color-success);
}

.status-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  min-width: 0;
  flex: 1;
  line-height: 1.35;
  overflow-wrap: break-word;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-address {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  min-width: 0;
  flex: 1;
  line-height: 1.35;
  overflow-wrap: break-word;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-coords {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 0;
  flex: 1;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coords-clear-btn {
  color: var(--color-text-muted);
  padding: 2px 4px;
  flex-shrink: 0;
  align-self: center;
  margin-top: 0;
  margin-left: auto;
  opacity: 0.7;
  transition:
    opacity 0.15s ease,
    color 0.15s ease;
}

.status-coords-row:hover .coords-clear-btn,
.coords-clear-btn:focus-visible {
  opacity: 1;
}

.coords-clear-btn:hover {
  opacity: 1;
  color: var(--color-danger);
}

.status-warning-icon {
  color: var(--color-warning);
}

.status-coords.status-coords-missing {
  color: var(--color-warning-dark);
  font-weight: 500;
  font-style: italic;
  font-size: var(--font-size-xs);
  font-variant-numeric: normal;
}

.coords-info-popover {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.inline-category-combobox {
  min-width: 0;
  flex: 1;
  width: 100%;
  position: relative;
}

.inline-category-combobox:focus-within,
.inline-category-combobox:has(.open) {
  z-index: var(--z-popover, 1100);
}

.inline-category-combobox :deep(.combobox) {
  min-width: 0;
  width: 100%;
}

@container (min-width: 581px) {
  .polaroid-card {
    position: absolute;
    top: 68px;
    left: 12px;
    right: auto;
    width: 260px;
    max-width: calc(100% - 24px);
  }
}

@container (max-width: 580px) {
  .polaroid-card {
    position: absolute;
    top: 68px;
    left: 12px;
    right: 12px;
    width: auto;
    max-width: none;
    max-height: calc(100% - 200px);
    overflow-y: auto;
  }
}
</style>

<script setup lang="ts">
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import InfoPopover from './primitives/InfoPopover.vue';
import CategoryChip from './CategoryChip.vue';
import type { PlaceSearchResult } from '../composables/usePlaceSearch';

defineProps<{
  modelValue: string;
  isSearching: boolean;
  isOpen: boolean;
  results: PlaceSearchResult[];
  activeIndex: number;
  placeholder?: string;
  isDetailsVisible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', place: PlaceSearchResult): void;
  (e: 'keydown', event: KeyboardEvent): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'openManualDetails'): void;
}>();
</script>

<template>
  <div class="location-search-row location-search-floating">
    <div
      class="location-search-wrap"
      :class="{ 'is-loading': isSearching, loading: isSearching }"
      :aria-busy="isSearching"
    >
      <AppIcon
        :icon="ACTION_ICONS.search"
        :size="16"
        group="actions"
        class="location-search-icon"
        aria-hidden="true"
      />
      <Input
        :model-value="modelValue"
        class="location-picker-input"
        type="text"
        name="location-search"
        data-testid="location-search-input"
        :placeholder="placeholder"
        aria-label="Ort suchen oder Maps-Link einfügen"
        autocomplete="off"
        @update:model-value="emit('update:modelValue', $event)"
        @keydown="emit('keydown', $event)"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
      />
      <div class="search-right-actions">
        <div v-if="isSearching" class="input-spinner-wrap" aria-hidden="true">
          <LoadingSpinner size="sm" class="spinner input-spinner" />
        </div>
        <InfoPopover
          title="Suchtipps & Maps-Links"
          aria-label="Suchtipps und Maps-Links anzeigen"
          align="right"
          placement="bottom"
          :menu-width="260"
          class="search-info-popover"
        >
          <p>
            <strong>Ortssuche:</strong> Du kannst nach Adressen, Cafés, Sehenswürdigkeiten oder
            Orten weltweit suchen.
          </p>
          <p>
            <strong>Karten-Links:</strong> Kopiere einfach einen Link von Google Maps, Apple Maps
            oder OpenStreetMap (OSM) hier hinein.
          </p>
          <p class="popover-tip">
            📍 Du kannst auch direkt auf die Karte tippen, um die Stecknadel manuell zu platzieren.
          </p>
        </InfoPopover>
      </div>

      <!-- Autocomplete Dropdown List -->
      <Transition name="dropdown-unfold">
        <ul
          v-if="isOpen && (results.length > 0 || (!isSearching && modelValue.trim().length >= 2))"
          class="location-dropdown options"
          role="listbox"
          aria-label="Suchergebnisse"
        >
          <li
            v-if="!isSearching && results.length === 0"
            role="status"
            class="location-result-empty"
          >
            <AppIcon :icon="ACTION_ICONS.warning" :size="16" group="actions" class="item-icon" />
            <div class="location-empty-content">
              <span class="empty-title">Kein passender Ort gefunden</span>
              <span class="empty-desc">
                Du kannst die Details manuell ausfüllen oder direkt auf die Karte tippen.
              </span>
            </div>
          </li>
          <li
            v-for="(place, index) in results"
            :key="place.id || `${place.lat}-${place.lng}-${index}`"
            role="option"
            tabindex="-1"
            class="location-result-item"
            :class="{ 'is-active': index === activeIndex }"
            :aria-selected="index === activeIndex"
            @mousedown.prevent="emit('select', place)"
            @click="emit('select', place)"
            @keydown.enter.prevent="emit('select', place)"
          >
            <AppIcon
              :icon="FORM_FIELD_ICONS.location"
              :size="16"
              group="formFields"
              class="item-icon"
            />
            <div class="location-item-content">
              <div class="location-item-title-row">
                <span class="location-item-name">{{ place.name }}</span>
                <CategoryChip
                  v-if="place.category"
                  :category="place.category"
                  type="spot"
                  class="location-category-badge"
                />
              </div>
              <span class="location-item-address">{{
                place.formatted_address || place.address
              }}</span>
            </div>
          </li>
        </ul>
      </Transition>
    </div>

    <!-- "Details manuell ausfüllen" Action Bar (wenn Details initial verborgen) -->
    <div v-if="!isDetailsVisible" class="manual-details-bar">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        class="manual-details-btn"
        :icon="ACTION_ICONS.edit"
        @click="emit('openManualDetails')"
      >
        Details manuell ausfüllen
      </Button>
    </div>
  </div>
</template>

<style scoped>
.location-search-row {
  width: 100%;
  min-width: 0;
}

.location-search-floating {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 12px;
  width: auto;
  box-sizing: border-box;
  z-index: var(--z-dropdown, 500);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.location-search-floating:focus-within,
.location-search-floating:has(.location-dropdown) {
  z-index: var(--z-popover, 1100);
}

.manual-details-bar {
  display: flex;
  justify-content: flex-start;
  margin: 0;
}

.manual-details-btn {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  height: 28px;
  padding: 2px var(--space-2);
  cursor: pointer;
}

.location-search-wrap {
  position: relative;
  width: 100%;
}

.location-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
  z-index: 2;
}

.location-picker-input,
.location-search-wrap :deep(.location-picker-input) {
  width: 100%;
  box-sizing: border-box;
  padding-left: 38px;
  padding-right: 42px;
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  border-radius: var(--radius-pill);
  corner-shape: round;
}

.location-search-wrap.is-loading :deep(.location-picker-input) {
  padding-right: 70px;
}

.location-search-wrap :deep(.location-picker-input)::placeholder {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.search-right-actions {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  z-index: 3;
}

.search-right-actions .input-spinner-wrap {
  position: static;
  transform: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.input-spinner {
  pointer-events: none;
}

.location-dropdown {
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
  max-height: 240px;
  overflow-y: auto;
}

.location-result-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.location-result-item:hover,
.location-result-item.is-active,
.location-result-item[aria-selected='true'] {
  background: var(--color-hover);
}

.item-icon {
  margin-top: 2px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.location-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.location-item-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.location-item-name {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-category-badge {
  flex-shrink: 0;
}

.location-item-address {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-result-empty {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: 10px 12px;
  color: var(--color-text-muted);
  user-select: none;
}

.location-empty-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.location-empty-content .empty-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.location-empty-content .empty-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.4;
}
</style>

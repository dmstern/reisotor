<script setup lang="ts">
import { computed, ref } from 'vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import InfoPopover from './primitives/InfoPopover.vue';
import CategoryChip from './CategoryChip.vue';
import type { PlaceSearchResult } from '../composables/usePlaceSearch';
import { useAnimatedPlaceholder } from '../composables/useAnimatedPlaceholder';

const props = defineProps<{
  modelValue: string;
  isSearching: boolean;
  isOpen: boolean;
  results: PlaceSearchResult[];
  activeIndex: number;
  placeholder?: string;
  placeholderPhrases?: string[];
  isDetailsVisible: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', place: PlaceSearchResult): void;
  (e: 'keydown', event: KeyboardEvent): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'openManualDetails'): void;
  (e: 'loadMore'): void;
}>();

const isFocused = ref(false);

const phrases = computed(() => props.placeholderPhrases || []);

const { placeholder: animatedPlaceholder } = useAnimatedPlaceholder(phrases, {
  fallback: () => props.placeholder,
  disabled: () => Boolean(props.modelValue) || isFocused.value || phrases.value.length === 0,
});

const activePlaceholder = computed(() => {
  if (phrases.value.length > 0 && !isFocused.value && !props.modelValue) {
    return animatedPlaceholder.value;
  }

  return props.placeholder;
});

function handleFocus(event: FocusEvent) {
  isFocused.value = true;
  emit('focus', event);
}

function handleBlur(event: FocusEvent) {
  isFocused.value = false;
  emit('blur', event);
}

const LOAD_MORE_SCROLL_THRESHOLD_PX = 36;

function onDropdownScroll(e: Event) {
  const el = e.target as HTMLElement;

  if (!el) {
    return;
  }

  if (el.scrollHeight - el.scrollTop - el.clientHeight < LOAD_MORE_SCROLL_THRESHOLD_PX) {
    if (props.hasMore && !props.isLoadingMore && !props.isSearching) {
      emit('loadMore');
    }
  }
}
</script>

<template>
  <div
    class="location-search-row location-search-floating"
    :class="{ 'has-details': isDetailsVisible }"
  >
    <div class="location-search-field">
      <div
        class="location-search-wrap"
        :class="{ 'is-loading': isSearching, loading: isSearching, 'is-focused': isFocused }"
        :aria-busy="isSearching"
      >
        <div class="location-search-inner">
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
            type="search"
            name="location-search"
            data-testid="location-search-input"
            :placeholder="activePlaceholder"
            aria-label="Ort suchen oder Maps-Link einfügen"
            autocomplete="off"
            @update:model-value="emit('update:modelValue', $event)"
            @keydown="emit('keydown', $event)"
            @focus="handleFocus"
            @blur="handleBlur"
          />
          <div class="search-right-actions">
            <div v-if="isSearching" class="input-spinner-wrap" aria-hidden="true">
              <LoadingSpinner size="sm" decorative class="input-spinner" />
            </div>
            <InfoPopover
              title="Suchtipps, Maps- & Buchungs-Links"
              aria-label="Suchtipps und Maps-Links anzeigen"
              align="right"
              placement="bottom"
              :menu-width="290"
              class="search-info-popover"
            >
              <p>
                <strong>Ortssuche:</strong> Du kannst nach Adressen, Cafés, Sehenswürdigkeiten oder
                Orten weltweit suchen.
              </p>
              <p>
                <strong>Karten-Links:</strong> Kopiere einfach einen Link von Google Maps, Apple
                Maps oder OpenStreetMap (OSM) hier hinein.
              </p>
              <p>
                <strong>Buchungs-Links:</strong> Füge einen Link von Booking.com, Airbnb oder
                Trivago ein – Name, Fotos, Adresse, Preis und Reisedaten werden automatisch
                übernommen.
              </p>
              <p class="popover-tip">
                <AppIcon
                  :icon="FORM_FIELD_ICONS.location"
                  :size="14"
                  group="formFields"
                  class="popover-tip-icon"
                  aria-hidden="true"
                />
                <span
                  >Du kannst auch direkt auf die Karte tippen, um die Stecknadel manuell zu
                  platzieren.</span
                >
              </p>
            </InfoPopover>
          </div>
        </div>
      </div>

      <!-- Autocomplete Dropdown List (außerhalb von .location-search-wrap, damit backdrop-filter nicht durch den Eltern-Backdrop-Root blockiert wird) -->
      <Transition name="dropdown-unfold">
        <ul
          v-if="isOpen && (results.length > 0 || (!isSearching && modelValue.trim().length >= 2))"
          class="location-dropdown options"
          role="listbox"
          aria-label="Suchergebnisse"
          @scroll="onDropdownScroll"
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

          <!-- "Weiter suchen" Lazy Loading Meta-Eintrag -->
          <li
            v-if="results.length > 0 && (hasMore || isLoadingMore)"
            role="button"
            tabindex="0"
            class="location-load-more"
            :class="{ 'is-loading': isLoadingMore }"
            aria-label="Weitere Orte suchen"
            @mousedown.prevent="emit('loadMore')"
            @click="emit('loadMore')"
            @keydown.enter.prevent="emit('loadMore')"
            @keydown.space.prevent="emit('loadMore')"
          >
            <LoadingSpinner v-if="isLoadingMore" size="sm" decorative class="load-more-spinner" />
            <AppIcon
              v-else
              :icon="ACTION_ICONS.search"
              :size="14"
              group="actions"
              class="load-more-icon"
              aria-hidden="true"
            />
            <span class="load-more-text">
              {{ isLoadingMore ? 'Weitere Orte werden geladen…' : 'Weitere Orte suchen…' }}
            </span>
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

<style scoped lang="scss">
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
  @include touch-target($expand: true);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-surface-glass-border);
  border-radius: var(--radius-pill);
  height: 28px;
  padding: var(--space-2xs) var(--space-2);
  cursor: pointer;
  transition: var(--transition-glass);

  @include can-hover {
    &:hover {
      background: var(--color-surface-glass-hover);
      border-color: var(--color-surface-glass-hover-border);
      box-shadow: var(--shadow-md);
    }
  }
}

.location-search-field {
  position: relative;
  width: 100%;
}

.location-search-wrap {
  @include control-glass-field(true);
  width: 100%;
  box-sizing: border-box;
  padding: 5px;

  &:focus-within:not(.is-focused) {
    background-color: var(--color-surface-glass);
    outline: none;
    box-shadow: var(--shadow-floating-island);

    &:hover {
      background-color: var(--color-surface-glass-hover);
      box-shadow: var(--shadow-floating-island-hover);
    }
  }

  &.is-focused {
    background-color: var(--color-surface-glass-active);
    outline: none;
    box-shadow: var(--shadow-floating-island-hover);
  }
}

.location-search-inner {
  --search-groove-edge: rgba(43, 42, 40, 0.15);
  --search-groove-depth: rgba(43, 42, 40, 0.08);
  --search-groove-gloss-top: rgba(255, 255, 255, 0.72);
  --search-groove-gloss-bottom: rgba(255, 255, 255, 0.64);

  position: relative;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  background: transparent;
  border: 2px solid transparent;
  border-radius: var(--radius-pill);
  corner-shape: round;

  &::before {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: inherit;
    corner-shape: round;
    border: 1px solid var(--search-groove-edge);
    box-shadow:
      inset 0 1px 0.5px var(--search-groove-gloss-top),
      0 1px 0.5px var(--search-groove-gloss-bottom),
      inset 0 0 0 1px var(--search-groove-depth);
    pointer-events: none;
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .location-search-wrap.is-focused &::before {
    border-color: var(--focus-ring-color, var(--color-primary));
    box-shadow:
      inset 0 0 0 1px var(--focus-ring-color, var(--color-primary)),
      0 0 0 1px color-mix(in srgb, var(--focus-ring-color, var(--color-primary)) 25%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    &::before {
      transition: none;
    }
  }
}

:root[data-theme='dark'] .location-search-inner {
  --search-groove-edge: rgba(0, 0, 0, 0.44);
  --search-groove-depth: rgba(0, 0, 0, 0.16);
  --search-groove-gloss-top: rgba(255, 255, 255, 0.16);
  --search-groove-gloss-bottom: rgba(255, 255, 255, 0.12);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .location-search-inner {
    --search-groove-edge: rgba(0, 0, 0, 0.44);
    --search-groove-depth: rgba(0, 0, 0, 0.16);
    --search-groove-gloss-top: rgba(255, 255, 255, 0.16);
    --search-groove-gloss-bottom: rgba(255, 255, 255, 0.12);
  }
}

.location-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
  z-index: 2;
  transition: color 0.15s ease;

  .location-search-wrap.is-focused & {
    color: var(--color-primary);
  }
}

.location-search-wrap .location-search-inner :deep(.location-picker-input) {
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  padding-top: 7px;
  padding-bottom: 7px;
  padding-left: 38px;
  padding-right: 42px;
  border-radius: var(--radius-pill);
  corner-shape: round;
  color: var(--color-text);

  &:hover,
  &:focus,
  &:focus-visible,
  &:active {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    outline: none !important;
  }
}

.location-search-wrap.is-loading .location-search-inner :deep(.location-picker-input) {
  padding-right: 78px;
}

.location-search-wrap .location-search-inner :deep(.location-picker-input)::placeholder {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

.search-right-actions {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  z-index: 3;
}

.search-info-popover :deep(.info-popover-btn:not(.is-active)) {
  @include control-glass-interactive('embedded');
  color: var(--color-text-muted);
}

.search-right-actions .input-spinner-wrap {
  position: static;
  transform: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: var(--line-height-none);
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
  background: color-mix(in srgb, var(--color-surface) 88%, transparent);
  backdrop-filter: blur(max(12px, var(--glass-blur, 6px))) saturate(180%);
  border: 1px solid var(--color-surface-glass-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-floating-island);
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
  padding: var(--space-2) var(--space-md);
  cursor: pointer;
  transition: background 0.15s ease;

  &.is-active,
  &[aria-selected='true'] {
    background: var(--color-hover);
  }

  @include can-hover {
    &:hover {
      background: var(--color-hover);
    }
  }
}

.item-icon {
  margin-top: var(--space-2xs);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.location-item-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
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
  padding: 10px var(--space-md);
  color: var(--color-text-muted);
  user-select: none;
}

.location-empty-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.location-empty-content .empty-title {
  font-weight: 600;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.location-empty-content .empty-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: var(--line-height-snug);
}

.location-load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-md);
  margin-top: var(--space-1);
  border-top: 1px dashed var(--color-surface-glass-border);
  cursor: pointer;
  color: var(--color-primary);
  font-size: var(--font-size-xs);
  font-weight: 500;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  user-select: none;
}

@include can-hover {
  .location-load-more:hover {
    background: var(--color-hover);
  }
}

.location-load-more:focus-visible {
  background: var(--color-hover);
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: -3px;
}

.location-load-more.is-loading {
  cursor: default;
  color: var(--color-text-muted);
}

.load-more-spinner,
.load-more-icon {
  flex-shrink: 0;
}

.popover-tip {
  display: flex;
  align-items: flex-start;
  gap: var(--space-1);
  margin-top: var(--space-1);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.popover-tip-icon {
  flex-shrink: 0;
  margin-top: var(--space-2xs);
  color: var(--color-primary);
}

/* Auf schmalen Containern (<= tablet-sm) mit sichtbaren Details wird die Suchleiste über der Karte gestackt */
/* statt darüber zu schweben — dann den normalen Eingabefeld-Look ohne Glas-Rahmen verwenden. */
@include container-down('tablet-sm') {
  .location-search-row.has-details {
    .location-search-wrap {
      background-color: var(--color-input-bg);
      backdrop-filter: none;
      border: 1.5px solid var(--color-search-field-border);
      box-shadow: var(--shadow-search-field-inset);
      padding: 0;
      transition: var(--transition-control);

      &:hover:not(.is-focused) {
        background-color: var(--color-input-bg);
        border-color: color-mix(
          in srgb,
          var(--color-primary) 35%,
          var(--color-search-field-border)
        );
        box-shadow: var(--shadow-control-inset-hover);
      }

      &:focus-within:not(.is-focused) {
        background-color: var(--color-input-bg);
        outline: none;
        box-shadow: var(--shadow-search-field-inset);

        &:hover {
          background-color: var(--color-input-bg);
          border-color: color-mix(
            in srgb,
            var(--color-primary) 35%,
            var(--color-search-field-border)
          );
          box-shadow: var(--shadow-control-inset-hover);
        }
      }

      &.is-focused {
        background-color: var(--color-input-bg);
        border-color: var(--color-search-field-border);
        outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
        outline-offset: var(--focus-ring-offset, 2px);
        box-shadow:
          var(--focus-ring-halo, 0 0 0 2px var(--color-surface)), var(--shadow-control-inset);
      }
    }

    .location-search-inner {
      border: none;

      &::before {
        display: none;
      }
    }

    .location-search-wrap .location-search-inner :deep(.location-picker-input) {
      min-height: calc(var(--input-height, 46px) - 3px);
    }

    .search-right-actions {
      right: 6px;
    }
  }
}
</style>

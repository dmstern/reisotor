<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IconDef } from '../utils/icon';
import type { IconGroup } from '../stores/iconStyle';
import { ACTION_ICONS } from '../utils/actionIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import ImageUrlInput from './ImageUrlInput.vue';
import Modal from './Modal.vue';
import { api } from '../api/client';

export interface ImageSearchContext {
  name?: string;
  city?: string;
  lat?: number;
  lng?: number;
  maps_link?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    previewImage?: string | null;
    placeholderIcon?: IconDef;
    iconGroup?: IconGroup;
    modalTitle?: string;
    modified?: boolean;
    uploading?: boolean;
    initialValue?: string;
    searchContext?: ImageSearchContext;
    initialSuggestions?: string[];
  }>(),
  {
    modelValue: '',
    previewImage: null,
    placeholderIcon: () => ACTION_ICONS.vacation,
    iconGroup: 'actions',
    modalTitle: 'Bild bearbeiten',
    modified: false,
    uploading: false,
    initialValue: undefined,
    searchContext: undefined,
    initialSuggestions: () => [],
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'update:uploading', value: boolean): void;
  (e: 'reset'): void;
}>();

const showModal = ref(false);
const isUploading = ref(false);
const imageUrlInputRef = ref<InstanceType<typeof ImageUrlInput> | null>(null);

const suggestions = ref<string[]>([]);
const currentIndex = ref<number>(-1);
const isSearchingNext = ref(false);
const searchMessage = ref<string | null>(null);

watch(isUploading, (v) => {
  emit('update:uploading', v);
});

const isModified = computed(() => {
  if (props.modified) return true;
  if (props.initialValue !== undefined) {
    return (props.modelValue || '').trim() !== (props.initialValue || '').trim();
  }
  return false;
});

function syncSuggestions(newSuggs?: string[]) {
  if (newSuggs && newSuggs.length > 0) {
    for (const s of newSuggs) {
      if (s && !suggestions.value.includes(s)) {
        suggestions.value.push(s);
      }
    }
  }
  if (props.modelValue && suggestions.value.includes(props.modelValue)) {
    currentIndex.value = suggestions.value.indexOf(props.modelValue);
  }
}

watch(
  () => props.initialSuggestions,
  (val) => {
    syncSuggestions(val);
  },
  { immediate: true }
);

watch(
  () => props.modelValue,
  (val) => {
    if (val && !suggestions.value.includes(val)) {
      if (currentIndex.value === -1) {
        suggestions.value.unshift(val);
        currentIndex.value = 0;
      }
    } else if (val && suggestions.value.includes(val)) {
      currentIndex.value = suggestions.value.indexOf(val);
    }
  },
  { immediate: true }
);

const effectivePreview = computed(() => {
  if (props.modelValue) return props.modelValue;
  if (props.previewImage) return props.previewImage;
  return null;
});

const canBrowse = computed(() => {
  return Boolean(
    (props.searchContext && (props.searchContext.name || props.searchContext.maps_link)) ||
    suggestions.value.length > 0
  );
});

const suggestionStatusText = computed(() => {
  if (suggestions.value.length === 0) return '';
  if (currentIndex.value >= 0) {
    return `Vorschlag ${currentIndex.value + 1} von ${suggestions.value.length}`;
  }
  return `${suggestions.value.length} Vorschläge`;
});

async function fetchSuggestionsFromApi(): Promise<number> {
  if (!props.searchContext || (!props.searchContext.name && !props.searchContext.maps_link)) {
    return 0;
  }
  const params = new URLSearchParams();
  if (props.searchContext.name) params.set('name', props.searchContext.name);
  if (props.searchContext.city) params.set('city', props.searchContext.city);
  if (props.searchContext.lat != null) params.set('lat', String(props.searchContext.lat));
  if (props.searchContext.lng != null) params.set('lng', String(props.searchContext.lng));
  if (props.searchContext.maps_link) params.set('maps_link', props.searchContext.maps_link);

  const res = await api.get<{ name: string | null; imageUrl: string | null; images?: string[] }>(
    `/spots/preview?${params.toString()}`
  );
  const newImages = res.images || (res.imageUrl ? [res.imageUrl] : []);
  let added = 0;
  for (const img of newImages) {
    if (img && !suggestions.value.includes(img)) {
      suggestions.value.push(img);
      added++;
    }
  }
  return added;
}

async function nextSuggestion() {
  if (isSearchingNext.value || isUploading.value) return;
  searchMessage.value = null;

  if (suggestions.value.length === 0 || currentIndex.value >= suggestions.value.length - 1) {
    isSearchingNext.value = true;
    try {
      const added = await fetchSuggestionsFromApi();
      if (added > 0 && currentIndex.value < suggestions.value.length - 1) {
        currentIndex.value++;
        emit('update:modelValue', suggestions.value[currentIndex.value]);
        return;
      }
    } catch {
      searchMessage.value = 'Bilder-Suche fehlgeschlagen.';
      return;
    } finally {
      isSearchingNext.value = false;
    }

    if (suggestions.value.length === 0) {
      searchMessage.value = 'Keine Bilder gefunden.';
      return;
    }

    if (currentIndex.value >= suggestions.value.length - 1) {
      if (suggestions.value.length > 1) {
        currentIndex.value = 0;
        emit('update:modelValue', suggestions.value[0]);
        searchMessage.value = 'Wieder von vorne begonnen.';
      } else {
        searchMessage.value = 'Keine weiteren Vorschläge gefunden.';
      }
      return;
    }
  }

  currentIndex.value++;
  emit('update:modelValue', suggestions.value[currentIndex.value]);
}

function prevSuggestion() {
  if (isSearchingNext.value || isUploading.value) return;
  searchMessage.value = null;
  if (currentIndex.value > 0) {
    currentIndex.value--;
    emit('update:modelValue', suggestions.value[currentIndex.value]);
  }
}

function removeImage() {
  if (isUploading.value) return;
  emit('update:modelValue', '');
  showModal.value = false;
  searchMessage.value = null;
}

function resetImage() {
  if (isUploading.value) return;
  const resetTo = props.initialValue ?? '';
  emit('update:modelValue', resetTo);
  emit('reset');
  searchMessage.value = null;
  if (resetTo && suggestions.value.includes(resetTo)) {
    currentIndex.value = suggestions.value.indexOf(resetTo);
  }
}

function handleModalClose(visible: boolean) {
  if (!visible) {
    if (isUploading.value) {
      imageUrlInputRef.value?.abortUpload();
    }
    showModal.value = false;
    searchMessage.value = null;
  }
}
</script>

<template>
  <div class="cover-image-picker">
    <div
      class="form-image-banner"
      :class="{ 'is-modified': isModified }"
      :style="effectivePreview ? { backgroundImage: `url(${effectivePreview})` } : {}"
    >
      <span v-if="isModified" class="banner-badge-modified">
        <AppIcon :icon="ACTION_ICONS.done" :size="12" group="actions" />
        Bild geändert
      </span>
      <AppIcon
        v-if="!effectivePreview"
        class="placeholder"
        :size="35"
        :icon="placeholderIcon"
        :group="iconGroup"
      />
      <div class="banner-actions">
        <Button
          v-if="isModified"
          type="button"
          variant="ghost"
          class="banner-reset-btn"
          title="Änderungen am Bild zurücksetzen"
          @click.stop="resetImage"
        >
          <AppIcon :icon="ACTION_ICONS.restore" :size="13" group="actions" />
          Zurücksetzen
        </Button>
        <Button type="button" variant="ghost" class="banner-edit-btn" @click="showModal = true">
          <AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" />
          {{ modelValue ? 'Bild bearbeiten' : 'Bild hinzufügen' }}
        </Button>
      </div>
    </div>

    <Modal :model-value="showModal" :title="modalTitle" @update:model-value="handleModalClose">
      <div class="image-submodal">
        <!-- Live-Vorschau des aktuellen Bilds im Dialog -->
        <div v-if="effectivePreview" class="dialog-image-preview">
          <img :src="effectivePreview" alt="Vorschau" class="dialog-preview-img" />
          <span v-if="isModified" class="dialog-preview-badge">
            <AppIcon :icon="ACTION_ICONS.done" :size="12" group="actions" />
            Bild geändert
          </span>
        </div>

        <!-- Bildvorschläge durchblättern -->
        <div v-if="canBrowse" class="suggestion-browse-bar">
          <div class="browse-header">
            <span class="browse-title">Vorschläge aus der Ortssuche</span>
            <span v-if="suggestionStatusText" class="browse-counter">
              {{ suggestionStatusText }}
            </span>
          </div>
          <div class="browse-buttons">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              :icon="ACTION_ICONS.scrollLeft"
              :disabled="currentIndex <= 0 || isSearchingNext || isUploading"
              title="Zurück zum vorherigen Bild"
              @click="prevSuggestion"
            >
              Zurück zum letzten Bild
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              :icon="isSearchingNext ? undefined : ACTION_ICONS.search"
              :disabled="isSearchingNext || isUploading"
              title="Nächstes Bild suchen"
              @click="nextSuggestion"
            >
              <LoadingSpinner v-if="isSearchingNext" size="sm" />
              <span>{{ isSearchingNext ? 'Sucht…' : 'Nächstes Bild suchen' }}</span>
            </Button>
          </div>
          <div v-if="searchMessage" class="browse-msg">
            {{ searchMessage }}
          </div>
        </div>

        <ImageUrlInput
          ref="imageUrlInputRef"
          :model-value="modelValue"
          v-model:uploading="isUploading"
          @update:model-value="(val) => emit('update:modelValue', val)"
        />

        <ButtonGroup>
          <Button
            v-if="isModified"
            type="button"
            variant="secondary"
            :icon="ACTION_ICONS.restore"
            :disabled="isUploading || isSearchingNext"
            @click="resetImage"
          >
            Änderungen zurücksetzen
          </Button>
          <Button
            v-if="modelValue"
            type="button"
            variant="danger"
            secondary
            :icon="ACTION_ICONS.delete"
            :disabled="isUploading || isSearchingNext"
            @click="removeImage"
          >
            Bild entfernen
          </Button>
          <div class="spacer" />
          <Button type="button" :disabled="isUploading" @click="showModal = false">Fertig</Button>
        </ButtonGroup>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.cover-image-picker {
  width: 100%;
}

.form-image-banner {
  position: relative;
  margin: 0 0 var(--space-2);
  height: 6rem;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  overflow: hidden;
  border: 2px solid transparent;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.form-image-banner.is-modified {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 1px var(--color-accent);
}

.banner-badge-modified {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
  z-index: 1;
}

.form-image-banner .placeholder {
  font-size: 2.5rem;
  margin: auto;
}

.form-image-banner .banner-actions {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  z-index: 1;
}

.banner-reset-btn {
  background: var(--color-surface) !important;
  color: var(--color-accent) !important;
  font-size: 0.82rem;
  padding: 4px 8px;
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.banner-reset-btn:hover {
  background: var(--color-hover) !important;
}

.banner-edit-btn {
  background: var(--color-surface) !important;
  color: var(--color-text) !important;
  font-size: 0.82rem;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.banner-edit-btn:hover {
  background: var(--color-hover) !important;
}

.image-submodal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dialog-image-preview {
  position: relative;
  width: 100%;
  height: 9rem;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-hover);
}

.dialog-preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.dialog-preview-badge {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-sm);
}

.suggestion-browse-bar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.browse-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
}

.browse-title {
  font-weight: 600;
  color: var(--color-text-muted);
}

.browse-counter {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.browse-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.browse-msg {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-style: italic;
}

.image-submodal .spacer {
  flex: 1;
}
</style>

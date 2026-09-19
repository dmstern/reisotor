<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Attachment } from '../api/types';
import Modal from './Modal.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import IconButton from './primitives/IconButton.vue';
import FileFormatGraphic from './primitives/FileFormatGraphic.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { formatFileSize } from '../utils/fileUpload';
import {
  extractExifFromUrl,
  formatGeoCoordinates,
  type ImageExifMetadata,
} from '../utils/imageCompression';
import { useCalendarSettingsStore } from '../stores/calendarSettings';
import { useDrawersStore } from '../stores/drawers';
import { DEMO_MODE } from '../demo/isDemoMode';

export interface AttachmentPreviewItem {
  id?: number;
  url: string;
  original_name?: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  metadata?: ImageExifMetadata | null;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    attachments: (Attachment | AttachmentPreviewItem | string)[];
    initialIndex?: number;
    editable?: boolean;
  }>(),
  { initialIndex: 0, editable: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'remove', index: number): void;
}>();

const currentIndex = ref(props.initialIndex);

watch(
  () => props.initialIndex,
  (newIdx) => {
    if (newIdx !== undefined && newIdx >= 0 && newIdx < props.attachments.length) {
      currentIndex.value = newIdx;
    }
  }
);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      isTransitionReady.value = false;
      contentHeight.value = null;
      if (
        props.initialIndex !== undefined &&
        props.initialIndex >= 0 &&
        props.initialIndex < props.attachments.length
      ) {
        currentIndex.value = props.initialIndex;
      } else {
        currentIndex.value = 0;
      }
      window.addEventListener('keydown', onKeydown);
      nextTick(() => {
        updateContentHeight(false);
      });
    } else {
      window.removeEventListener('keydown', onKeydown);
      resetAnimationState();
      isTransitionReady.value = false;
      contentHeight.value = null;
    }
  }
);

watch(
  () => props.attachments.length,
  (newLen) => {
    resetAnimationState();
    if (newLen === 0) {
      emit('update:modelValue', false);
    } else if (currentIndex.value >= newLen) {
      currentIndex.value = Math.max(0, newLen - 1);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  resetAnimationState();
  if (contentResizeObserver) {
    contentResizeObserver.disconnect();
    contentResizeObserver = null;
  }
});

function isImage(attachment: AttachmentPreviewItem | null): boolean {
  if (!attachment) return false;
  if (attachment.mime_type && attachment.mime_type.startsWith('image/')) {
    return true;
  }
  const name = attachment.original_name || attachment.filename || '';
  return (
    /\.(jpe?g|png|webp|gif|svg|avif|heic|heif)$/i.test(name) ||
    /\.(jpe?g|png|webp|gif|svg|avif|heic|heif)$/i.test(attachment.url) ||
    attachment.url.startsWith('data:image/')
  );
}

function normalizeAttachment(
  item: Attachment | AttachmentPreviewItem | string,
  index: number
): AttachmentPreviewItem {
  if (typeof item === 'string') {
    return {
      url: item,
      original_name: `Bild ${index + 1}`,
      mime_type: 'image/jpeg',
    };
  }
  return {
    ...item,
    original_name:
      item.original_name ||
      item.filename ||
      (isImage(item as AttachmentPreviewItem) ? `Bild ${index + 1}` : `Anhang ${index + 1}`),
  };
}

const normalizedAttachments = computed<AttachmentPreviewItem[]>(() =>
  props.attachments.map((a, i) => normalizeAttachment(a, i))
);

const currentAttachment = computed<AttachmentPreviewItem | null>(
  () => normalizedAttachments.value[currentIndex.value] ?? null
);

const prevAttachment = computed<AttachmentPreviewItem | null>(() => {
  if (normalizedAttachments.value.length <= 1) return null;
  const idx =
    (currentIndex.value - 1 + normalizedAttachments.value.length) %
    normalizedAttachments.value.length;
  return normalizedAttachments.value[idx] ?? null;
});

const nextAttachment = computed<AttachmentPreviewItem | null>(() => {
  if (normalizedAttachments.value.length <= 1) return null;
  const idx = (currentIndex.value + 1) % normalizedAttachments.value.length;
  return normalizedAttachments.value[idx] ?? null;
});

const visibleSlides = computed(() => {
  if (normalizedAttachments.value.length <= 1) {
    return [
      {
        slot: 'current',
        item: currentAttachment.value,
        ariaHidden: false,
      },
    ];
  }
  return [
    {
      slot: 'prev',
      item: prevAttachment.value,
      ariaHidden: true,
    },
    {
      slot: 'current',
      item: currentAttachment.value,
      ariaHidden: false,
    },
    {
      slot: 'next',
      item: nextAttachment.value,
      ariaHidden: true,
    },
  ];
});

// --- Smoothe & Stabile Swipe- und Slide-Animation ---
const isDragging = ref(false);
const isAnimating = ref(false);
const dragOffset = ref(0);
const targetOffsetPercent = ref<-200 | -100 | 0>(-100);

let touchStartX = 0;
let touchStartY = 0;
let isHorizontalGesture: boolean | null = null;
let animationTimer: ReturnType<typeof setTimeout> | null = null;
let activeMouseUpHandler: (() => void) | null = null;
let activeMouseMoveHandler: ((e: MouseEvent) => void) | null = null;

function clearAnimTimer() {
  if (animationTimer) {
    clearTimeout(animationTimer);
    animationTimer = null;
  }
}

function removeActiveMouseDragListeners() {
  if (activeMouseMoveHandler) {
    window.removeEventListener('mousemove', activeMouseMoveHandler);
    activeMouseMoveHandler = null;
  }
  if (activeMouseUpHandler) {
    window.removeEventListener('mouseup', activeMouseUpHandler);
    activeMouseUpHandler = null;
  }
}

function resetAnimationState() {
  clearAnimTimer();
  removeActiveMouseDragListeners();
  isAnimating.value = false;
  isDragging.value = false;
  dragOffset.value = 0;
  targetOffsetPercent.value = -100;
  isHorizontalGesture = null;
}

const ANIMATION_DURATION_MS = 280;

function slideTowards(direction: 'next' | 'prev' | 'cancel') {
  if (isAnimating.value) return;
  clearAnimTimer();

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (direction === 'cancel') {
    if (dragOffset.value === 0) return;
    isAnimating.value = true;
    dragOffset.value = 0;
    targetOffsetPercent.value = -100;
    animationTimer = setTimeout(
      () => {
        isAnimating.value = false;
      },
      reducedMotion ? 0 : 220
    );
    return;
  }

  isAnimating.value = true;
  dragOffset.value = 0;
  targetOffsetPercent.value = direction === 'next' ? -200 : 0;

  const duration = reducedMotion ? 0 : ANIMATION_DURATION_MS;

  animationTimer = setTimeout(() => {
    if (direction === 'next') {
      currentIndex.value = (currentIndex.value + 1) % props.attachments.length;
    } else {
      currentIndex.value =
        (currentIndex.value - 1 + props.attachments.length) % props.attachments.length;
    }
    targetOffsetPercent.value = -100;
    isAnimating.value = false;
  }, duration);
}

function prev() {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  slideTowards('prev');
}

function next() {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  slideTowards('next');
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue || props.attachments.length <= 1 || isAnimating.value) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prev();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    next();
  }
}

function download(attachment: AttachmentPreviewItem | null) {
  if (!attachment) return;
  const downloadUrl =
    DEMO_MODE || attachment.url.startsWith('data:') || !attachment.id
      ? attachment.url
      : `/api/attachments/${attachment.id}/download`;

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = attachment.original_name || attachment.filename || 'attachment';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function onRemoveCurrent() {
  resetAnimationState();
  const currentLen = props.attachments.length;
  const removeIdx = currentIndex.value;
  emit('remove', removeIdx);
  if (currentLen <= 1) {
    emit('update:modelValue', false);
  } else if (removeIdx >= currentLen - 1) {
    currentIndex.value = Math.max(0, currentLen - 2);
  }
}

// --- EXIF Metadaten (Aufnahmedatum & Geolocation) ---
const drawers = useDrawersStore();
const currentMetadata = ref<ImageExifMetadata | null>(null);
const isLoadingMetadata = ref(false);

const hasExifMetadata = computed(() =>
  Boolean(
    currentMetadata.value &&
    (currentMetadata.value.dateTime ||
      (currentMetadata.value.latitude != null && currentMetadata.value.longitude != null))
  )
);

function formatExifDateTime(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const calendarSettings = useCalendarSettingsStore();
  let dateFormatted = `${day}.${month}.${year}`;
  if (calendarSettings.dateFormat === 'iso') {
    dateFormatted = `${year}-${month}-${day}`;
  } else if (calendarSettings.dateFormat === 'us') {
    dateFormatted = `${month}/${day}/${year}`;
  }
  return `${dateFormatted}, ${hours}:${minutes}\u00A0Uhr`;
}

async function loadMetadataForAttachment(attachment: AttachmentPreviewItem | null) {
  if (!attachment || !isImage(attachment)) {
    currentMetadata.value = null;
    return;
  }
  if (attachment.metadata !== undefined) {
    currentMetadata.value = attachment.metadata;
    return;
  }
  isLoadingMetadata.value = true;
  try {
    const meta = await extractExifFromUrl(attachment.url);
    if (currentAttachment.value?.url === attachment.url) {
      currentMetadata.value = meta;
    }
  } catch {
    if (currentAttachment.value?.url === attachment.url) {
      currentMetadata.value = null;
    }
  } finally {
    isLoadingMetadata.value = false;
  }
}

watch(
  () => currentAttachment.value?.url,
  () => {
    loadMetadataForAttachment(currentAttachment.value);
  },
  { immediate: true }
);

function onShowLocationOnMap() {
  if (currentMetadata.value?.latitude == null || currentMetadata.value?.longitude == null) {
    return;
  }
  const lat = currentMetadata.value.latitude;
  const lng = currentMetadata.value.longitude;
  const title = currentAttachment.value?.original_name || 'Foto-Standort';
  emit('update:modelValue', false);
  drawers.openMapAtLocation(lat, lng, title);
}

// --- Swipe Logic für Touch-Geräte ---
function onTouchStart(e: TouchEvent) {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  if (e.touches.length !== 1) return;
  if ((e.target as HTMLElement)?.closest('.nav-btn, button, a')) return;

  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isHorizontalGesture = null;
  dragOffset.value = 0;
  isDragging.value = true;
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value || isAnimating.value) return;
  const currentX = e.touches[0].clientX;
  const currentY = e.touches[0].clientY;
  const deltaX = currentX - touchStartX;
  const deltaY = currentY - touchStartY;

  if (isHorizontalGesture === null) {
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    if (absX > 6 || absY > 6) {
      if (absX > absY) {
        isHorizontalGesture = true;
      } else {
        isHorizontalGesture = false;
        isDragging.value = false;
        return;
      }
    } else {
      return;
    }
  }

  if (isHorizontalGesture) {
    if (e.cancelable) {
      e.preventDefault();
    }
    dragOffset.value = deltaX;
  }
}

function onTouchEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;

  if (isHorizontalGesture) {
    const SWIPE_THRESHOLD = 45;
    if (dragOffset.value < -SWIPE_THRESHOLD) {
      slideTowards('next');
    } else if (dragOffset.value > SWIPE_THRESHOLD) {
      slideTowards('prev');
    } else {
      slideTowards('cancel');
    }
  } else {
    dragOffset.value = 0;
  }
  isHorizontalGesture = null;
}

function onTouchCancel() {
  if (isDragging.value) {
    isDragging.value = false;
    slideTowards('cancel');
  }
  isHorizontalGesture = null;
}

// --- Maus-Drag-Unterstützung für Desktop ---
function onMouseDown(e: MouseEvent) {
  if (props.attachments.length <= 1 || isAnimating.value) return;
  if (e.button !== 0) return;
  if ((e.target as HTMLElement)?.closest('.nav-btn, button, a')) return;

  e.preventDefault();
  removeActiveMouseDragListeners();

  const startX = e.clientX;
  isDragging.value = true;
  dragOffset.value = 0;

  activeMouseMoveHandler = (moveEvent: MouseEvent) => {
    if (!isDragging.value) return;
    dragOffset.value = moveEvent.clientX - startX;
  };

  activeMouseUpHandler = () => {
    removeActiveMouseDragListeners();
    if (!isDragging.value) return;
    isDragging.value = false;

    const SWIPE_THRESHOLD = 50;
    if (dragOffset.value < -SWIPE_THRESHOLD) {
      slideTowards('next');
    } else if (dragOffset.value > SWIPE_THRESHOLD) {
      slideTowards('prev');
    } else {
      slideTowards('cancel');
    }
  };

  window.addEventListener('mousemove', activeMouseMoveHandler);
  window.addEventListener('mouseup', activeMouseUpHandler);
}

const trackStyle = computed(() => {
  if (props.attachments.length <= 1) {
    return {
      transform: 'none',
      transition: 'none',
    };
  }

  if (isDragging.value) {
    return {
      transform: `translateX(calc(-100% + ${dragOffset.value}px))`,
      transition: 'none',
    };
  }

  if (isAnimating.value) {
    return {
      transform: `translateX(calc(${targetOffsetPercent.value}% + 0px))`,
      transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
    };
  }

  return {
    transform: 'translateX(calc(-100% + 0px))',
    transition: 'none',
  };
});

// --- Smoothe Höhenanpassung an aktuellen sowie benachbarten Inhalt ---
const previewContentRef = ref<HTMLElement | null>(null);
const sliderTrackRef = ref<HTMLElement | null>(null);
const contentHeight = ref<number | null>(null);
const isTransitionReady = ref(false);

const contentStyle = computed(() => {
  if (!contentHeight.value) return {};
  return {
    height: `${contentHeight.value}px`,
  };
});

function measureSlideHeight(slideEl: HTMLElement): number {
  const img = slideEl.querySelector<HTMLImageElement>('.preview-img');
  if (img) {
    const rect = img.getBoundingClientRect();
    if (rect.height > 0) {
      return rect.height;
    }
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      const containerWidth = previewContentRef.value?.clientWidth || 600;
      const maxViewportH = typeof window !== 'undefined' ? window.innerHeight * 0.65 : 500;
      const aspect = img.naturalHeight / img.naturalWidth;
      return Math.min(containerWidth * aspect, maxViewportH);
    }
  }
  const unsupported = slideEl.querySelector<HTMLElement>('.unsupported-wrapper');
  if (unsupported) {
    const rect = unsupported.getBoundingClientRect();
    return rect.height > 0 ? rect.height : 220;
  }
  return 0;
}

function updateContentHeight(animate = true) {
  if (!sliderTrackRef.value || !props.modelValue) return;

  const slides = sliderTrackRef.value.querySelectorAll<HTMLElement>('.slider-slide');
  if (!slides.length) return;

  let maxHeight = 0;
  slides.forEach((slide) => {
    const h = measureSlideHeight(slide);
    if (h > maxHeight) {
      maxHeight = h;
    }
  });

  if (maxHeight <= 0) return;

  const targetH = Math.max(200, Math.round(maxHeight));

  if (!animate) {
    isTransitionReady.value = false;
    contentHeight.value = targetH;
    nextTick(() => {
      requestAnimationFrame(() => {
        isTransitionReady.value = true;
      });
    });
  } else {
    isTransitionReady.value = true;
    contentHeight.value = targetH;
  }
}

function onImageLoad() {
  updateContentHeight(isTransitionReady.value);
}

watch(
  () => visibleSlides.value,
  () => {
    nextTick(() => {
      updateContentHeight(isTransitionReady.value);
    });
  },
  { deep: true }
);

let contentResizeObserver: ResizeObserver | null = null;
let lastObservedWidth = 0;

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') {
    contentResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.round(entry.contentRect.width);
        if (w > 0 && w !== lastObservedWidth) {
          lastObservedWidth = w;
          updateContentHeight(isTransitionReady.value);
        }
      }
    });
    if (previewContentRef.value) {
      contentResizeObserver.observe(previewContentRef.value);
    }
  }
});

watch(previewContentRef, (el, oldEl) => {
  if (oldEl && contentResizeObserver) {
    contentResizeObserver.unobserve(oldEl);
  }
  if (el && contentResizeObserver) {
    contentResizeObserver.observe(el);
  }
});
</script>

<template>
  <Modal
    :model-value="modelValue"
    size="lg"
    :title="currentAttachment?.original_name || 'Anhang-Vorschau'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="currentAttachment" class="preview-container">
      <div class="preview-meta">
        <span v-if="attachments.length > 1" class="preview-counter">
          {{ currentIndex + 1 }} von {{ attachments.length }}
        </span>
        <span v-if="currentAttachment.size_bytes" class="preview-size">
          {{ formatFileSize(currentAttachment.size_bytes) }}
        </span>
      </div>

      <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
      <div
        class="preview-stage"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchCancel"
        @mousedown="onMouseDown"
      >
        <IconButton
          v-if="attachments.length > 1"
          variant="ghost"
          class="nav-btn prev-btn"
          :icon="ACTION_ICONS.scrollLeft"
          title="Vorheriger Anhang (Pfeiltaste links)"
          aria-label="Vorheriger Anhang"
          :disabled="isAnimating"
          @click="prev"
        />

        <div
          ref="previewContentRef"
          class="preview-content"
          :class="{
            'is-draggable': attachments.length > 1 && !isAnimating,
            'is-dragging': isDragging,
            'has-transition': isTransitionReady,
          }"
          :style="contentStyle"
        >
          <div ref="sliderTrackRef" class="slider-track" :style="trackStyle">
            <div
              v-for="slide in visibleSlides"
              :key="slide.slot"
              class="slider-slide"
              :aria-hidden="slide.ariaHidden || undefined"
            >
              <div v-if="slide.item && isImage(slide.item)" class="image-wrapper">
                <img
                  :src="slide.item.url"
                  :alt="slide.item.original_name"
                  class="preview-img"
                  draggable="false"
                  @load="onImageLoad"
                />
              </div>
              <div v-else-if="slide.item" class="unsupported-wrapper">
                <FileFormatGraphic
                  :filename="slide.item.original_name || slide.item.filename"
                  :mime-type="slide.item.mime_type"
                  :size="56"
                  class="unsupported-icon"
                />
                <p class="unsupported-title">Keine Vorschau verfügbar</p>
                <p class="unsupported-hint">
                  Für diesen Dateityp ist keine direkte Bild-Vorschau verfügbar.
                </p>
                <p class="unsupported-filename">
                  {{ slide.item.original_name }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <IconButton
          v-if="attachments.length > 1"
          variant="ghost"
          class="nav-btn next-btn"
          :icon="ACTION_ICONS.scrollRight"
          title="Nächster Anhang (Pfeiltaste rechts)"
          aria-label="Nächster Anhang"
          :disabled="isAnimating"
          @click="next"
        />
      </div>

      <!-- EXIF Metadaten (Aufnahmedatum & Geolocation) -->
      <Transition name="exif-card">
        <div
          v-if="hasExifMetadata && currentMetadata"
          class="preview-exif-card"
          data-testid="preview-exif-card"
        >
          <Transition name="exif-content" mode="out-in">
            <div :key="currentAttachment?.url || String(currentIndex)" class="exif-details">
              <div v-if="currentMetadata.dateTime" class="exif-item" data-testid="exif-date">
                <div class="exif-icon-badge" aria-hidden="true">
                  <AppIcon :icon="FORM_FIELD_ICONS.time" :size="16" group="formFields" />
                </div>
                <div class="exif-text">
                  <span class="exif-label">Aufnahmedatum</span>
                  <span class="exif-value">{{ formatExifDateTime(currentMetadata.dateTime) }}</span>
                </div>
              </div>

              <div
                v-if="currentMetadata.latitude != null && currentMetadata.longitude != null"
                class="exif-item"
                data-testid="exif-location"
              >
                <div class="exif-icon-badge" aria-hidden="true">
                  <AppIcon :icon="FORM_FIELD_ICONS.location" :size="16" group="formFields" />
                </div>
                <div class="exif-text">
                  <span class="exif-label">Standort</span>
                  <span class="exif-value">{{
                    formatGeoCoordinates(currentMetadata.latitude, currentMetadata.longitude)
                  }}</span>
                </div>
              </div>
            </div>
          </Transition>

          <div
            v-if="currentMetadata.latitude != null && currentMetadata.longitude != null"
            class="exif-actions"
          >
            <Button
              variant="secondary"
              size="sm"
              class="btn-show-map"
              :icon="FORM_FIELD_ICONS.maps"
              @click="onShowLocationOnMap"
            >
              Ort auf Karte anzeigen
            </Button>
            <MapsAppPicker
              :lat="currentMetadata.latitude"
              :lng="currentMetadata.longitude"
              :title="currentAttachment?.original_name || 'Foto-Standort'"
              size="sm"
              variant="secondary"
            />
          </div>
        </div>
      </Transition>

      <div class="preview-actions">
        <Button
          v-if="editable"
          variant="danger"
          :icon="ACTION_ICONS.delete"
          :title="isImage(currentAttachment) ? 'Bild entfernen' : 'Anhang löschen'"
          @click="onRemoveCurrent"
        >
          Löschen
        </Button>
        <div class="preview-actions-right">
          <Button
            variant="primary"
            :icon="ACTION_ICONS.download"
            @click="download(currentAttachment)"
          >
            Herunterladen
          </Button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.preview-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.preview-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.preview-stage {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 200px;
  touch-action: pan-y pinch-zoom;
}

.nav-btn {
  flex-shrink: 0;
}

.preview-content {
  flex: 1;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  position: relative;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: height 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.preview-content:not(.has-transition) {
  transition: none !important;
}

.preview-content.is-draggable {
  cursor: grab;
}

.preview-content.is-dragging {
  cursor: grabbing;
  user-select: none;
}

.slider-track {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  will-change: transform;
}

.slider-slide {
  flex: 0 0 100%;
  width: 100%;
  min-width: 100%;
  max-width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.image-wrapper {
  width: 100%;
  max-height: 65vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.preview-img {
  max-width: 100%;
  max-height: 65vh;
  object-fit: contain;
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  display: block;
  user-select: none;
  -webkit-user-drag: none;
}

@media (prefers-reduced-motion: reduce) {
  .slider-track {
    transition: none !important;
  }

  .preview-content {
    transition: none !important;
  }
}

.unsupported-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.03));
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  width: 100%;
  min-height: 220px;
}

.unsupported-icon {
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.unsupported-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text);
  margin: 0 0 var(--space-1);
}

.unsupported-hint {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-2);
}

.unsupported-filename {
  font-size: 0.8rem;
  color: var(--color-primary);
  word-break: break-all;
  margin: 0;
}

.preview-exif-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-3);
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  transition: border-color var(--duration-fast, 150ms) ease;
}

.preview-exif-card:hover {
  border-color: var(--color-border-strong);
}

/* Smooth Transition für den EXIF-Metadaten-Kasten */
.exif-card-enter-active {
  transition:
    opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    padding-top 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    padding-bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.25s ease;
  max-height: 180px;
  overflow: hidden;
}

.exif-card-leave-active {
  transition:
    opacity 0.22s ease-in,
    transform 0.22s ease-in,
    max-height 0.26s cubic-bezier(0.16, 1, 0.3, 1),
    margin-top 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    padding-top 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    padding-bottom 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.2s ease;
  max-height: 180px;
  overflow: hidden;
}

.exif-card-enter-from,
.exif-card-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
  max-height: 0;
  margin-top: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-top-width: 0;
  border-bottom-width: 0;
  border-color: transparent;
}

/* Subtle cross-fade for values when switching between attachments */
.exif-content-enter-active,
.exif-content-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.exif-content-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.exif-content-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (prefers-reduced-motion: reduce) {
  .exif-card-enter-active,
  .exif-card-leave-active,
  .exif-content-enter-active,
  .exif-content-leave-active {
    transition: none !important;
    max-height: none !important;
    transform: none !important;
  }
}

.exif-details {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.exif-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.exif-icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  flex-shrink: 0;
}

.exif-text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.exif-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.exif-value {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  font-feature-settings: 'tnum';
  font-variant-numeric: tabular-nums;
}

.exif-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .preview-exif-card {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .exif-details {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
  }

  .exif-actions {
    width: 100%;
    justify-content: flex-start;
  }
}

.preview-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.preview-actions-right {
  margin-left: auto;
  display: flex;
  gap: var(--space-2);
}
</style>

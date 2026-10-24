<script setup lang="ts">
import { imageDisplayUrl } from '../utils/imageDisplayUrl';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import AppIcon from './AppIcon.vue';
import EditButton from './EditButton.vue';
import RichTextDisplay from './RichTextDisplay.vue';

withDefaults(
  defineProps<{
    spot: Spot;
    expanded: boolean;
    creatorLabel: string | null;
    isAccommodation: boolean;
    headingTag?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  }>(),
  {
    headingTag: 'h4',
  }
);

const emit = defineEmits<{
  (e: 'edit', spot: Spot): void;
}>();

function formatAccommodationDate(d: string | null) {
  if (!d) return null;
  return formatDateShared(d);
}
</script>

<template>
  <div
    class="image"
    :class="{ 'is-expanded': expanded }"
    :title="expanded ? 'Klicken zum Einklappen' : 'Klicken zum Aufklappen'"
    :style="spot.image_url ? { backgroundImage: `url(${imageDisplayUrl(spot.image_url)})` } : {}"
  >
    <AppIcon
      v-if="!spot.image_url"
      class="placeholder"
      :size="35"
      :icon="spotCategoryMeta(spot.category).tabler"
      group="categories"
    />

    <!-- Expanded Cover Overlay: Halbdunkles Gradient-Overlay mit Edit-Button, Titel, Metadaten, Notiz & Einklapp-Pille -->
    <Transition name="overlay-fade">
      <div v-if="expanded" class="image-expanded-overlay">
        <div class="overlay-top-row">
          <EditButton floating class="overlay-edit-btn" @click="emit('edit', spot)" />
        </div>
        <div class="overlay-bottom-content">
          <div class="overlay-bottom-row">
            <div class="overlay-bottom-text">
              <div class="card-title-block is-expanded">
                <component :is="headingTag" class="card-title" :title="spot.title">
                  {{ spot.title }}
                </component>
                <div
                  v-if="creatorLabel || (isAccommodation && (spot.start_date || spot.end_date))"
                  class="card-title-meta"
                >
                  <span v-if="creatorLabel" class="overlay-author">Von {{ creatorLabel }}</span>
                  <span
                    v-if="isAccommodation && (spot.start_date || spot.end_date)"
                    class="overlay-submeta"
                  >
                    {{ formatAccommodationDate(spot.start_date) || '?' }} –
                    {{ formatAccommodationDate(spot.end_date) || '?' }}
                  </span>
                </div>
              </div>
              <!-- Spot-Notiz im Image Banner unterhalb vom Spot-Titel -->
              <div v-if="spot.note" class="overlay-note">
                <RichTextDisplay
                  class="note is-banner"
                  :content="spot.note"
                  :format="spot.note_format"
                />
              </div>
            </div>

            <span class="spot-collapse-pill" aria-hidden="true">
              <span class="spot-collapse-label">Einklappen</span>
              <AppIcon
                :icon="ACTION_ICONS.chevronUp"
                :size="14"
                group="actions"
                class="spot-collapse-chevron"
              />
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.image {
  height: 120px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition:
    height 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.2s ease;
  border-radius: calc(var(--radius-md-squircle) - var(--space-1));
  corner-shape: squircle;
  overflow: hidden;
  flex-shrink: 0;
}

.image.is-expanded {
  height: 165px;
  cursor: pointer;
}

.image.is-expanded:hover:not(:has(.overlay-edit-btn:hover, a:hover)) {
  box-shadow:
    inset 0 0 0 2px var(--color-primary),
    0 4px 12px rgba(0, 0, 0, 0.18);
}

.overlay-fade-enter-active {
  transition: opacity 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.overlay-fade-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

.placeholder {
  font-size: 2.2rem;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.image.is-expanded .placeholder {
  position: absolute;
  opacity: 0.15;
  transform: scale(1.8);
  pointer-events: none;
}

/* Expanded Cover Overlay: Halbdunkles Gradient-Overlay mit Titel, Autor, Notiz & Metadaten */
.image-expanded-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: var(--space-3);
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.55) 0%,
    rgba(0, 0, 0, 0.15) 25%,
    rgba(0, 0, 0, 0.6) 55%,
    rgba(0, 0, 0, 0.92) 100%
  );
  border-radius: inherit;
  pointer-events: none;
  z-index: var(--z-card);
}

.image-expanded-overlay > * {
  pointer-events: auto;
}

.overlay-top-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.overlay-bottom-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.overlay-bottom-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
  width: 100%;
}

.overlay-bottom-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.image.is-expanded:hover:not(:has(.overlay-edit-btn:hover, a:hover)) .overlay-bottom-text {
  transform: translateY(-1px);
}

.spot-collapse-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #ffffff;
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1;
  backdrop-filter: var(--backdrop-blur-md, blur(8px));
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  user-select: none;
  flex-shrink: 0;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.2s ease;
}

.spot-collapse-chevron {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.image.is-expanded:hover:not(:has(.overlay-edit-btn:hover, a:hover)) .spot-collapse-pill {
  background: var(--color-primary);
  border-color: rgba(255, 255, 255, 0.65);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  transform: translateY(-1px);
}

.image.is-expanded:hover:not(:has(.overlay-edit-btn:hover, a:hover)) .spot-collapse-chevron {
  transform: translateY(-2px);
}

.overlay-bottom-content .card-title-block.is-expanded {
  margin-bottom: 0;
  padding-right: 0;
  transform: none;
}

.overlay-bottom-content .card-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: 1.25;
  color: #ffffff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
}

.overlay-bottom-content .card-title-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.88);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  flex-wrap: wrap;
}

.overlay-note {
  margin-top: 2px;
  overflow: hidden;
  max-height: 2.7em;
}

.note.is-banner {
  overflow-wrap: anywhere;
  font-size: var(--font-size-xs);
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
}

.note.is-banner :deep(.richtext) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  color: inherit;
}

.note.is-banner :deep(p),
.note.is-banner :deep(div) {
  display: inline;
  margin: 0;
  color: inherit;
}

.note.is-banner :deep(p + p::before),
.note.is-banner :deep(div + div::before) {
  content: ' ';
}

.note.is-banner :deep(a) {
  color: var(--color-scheduled);
  text-decoration: underline;
}

.note.is-banner :deep(strong),
.note.is-banner :deep(b) {
  color: #ffffff;
}

.overlay-edit-btn {
  animation: editBtnSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
}

@keyframes editBtnSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.overlay-author {
  font-weight: 600;
}

.overlay-submeta {
  opacity: 0.85;
}

@container spot-card (max-width: 360px) {
  .spot-collapse-pill {
    width: 26px;
    padding: 0;
  }

  .spot-collapse-label {
    display: none;
  }
}

@container spots-col (max-width: 480px) {
  .image {
    height: 100px;
    transition: height 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .image.is-expanded {
    height: 145px;
  }

  .image-expanded-overlay {
    padding: var(--space-2);
  }

  .overlay-bottom-content .card-title {
    font-size: var(--font-size-md);
    line-height: 1.2;
  }

  .note.is-banner {
    font-size: var(--font-size-xs);
    line-height: 1.25;
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image,
  .overlay-bottom-text,
  .spot-collapse-pill,
  .spot-collapse-chevron {
    transition: none;
    transform: none !important;
  }
}
</style>

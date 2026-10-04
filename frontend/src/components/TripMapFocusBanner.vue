<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Excursion, Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { MAP_TOOL_ICONS } from '../utils/mapToolIcons';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';

const props = defineProps<{
  focusedExcursion?: Excursion | null;
  focusedDate?: string | null;
  focusedSpot?: Spot | null;
  focusedLocation?: { imageUrl?: string; title?: string } | null;
  focusedAllPhotos?: boolean;
  allTripPhotoPointsCount?: number;
  formatDate?: (date: string) => string;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
  (e: 'open-photo-preview'): void;
}>();

const isFocusBannerExpanded = ref(false);

const isVisible = computed(() => {
  return (
    !!props.focusedExcursion ||
    !!props.focusedDate ||
    !!props.focusedSpot ||
    !!props.focusedLocation ||
    !!props.focusedAllPhotos
  );
});

const isPhotoFocus = computed(() => {
  return !!props.focusedLocation || !!props.focusedAllPhotos;
});

const formattedDateString = computed(() => {
  if (!props.focusedDate) return '';
  return props.formatDate ? props.formatDate(props.focusedDate) : props.focusedDate;
});

function handleToggleClick() {
  if (isPhotoFocus.value) {
    emit('open-photo-preview');
  } else {
    isFocusBannerExpanded.value = !isFocusBannerExpanded.value;
  }
}

watch(
  () => [
    props.focusedExcursion,
    props.focusedDate,
    props.focusedSpot,
    props.focusedLocation,
    props.focusedAllPhotos,
  ],
  () => {
    isFocusBannerExpanded.value = false;
  }
);
</script>

<template>
  <div v-if="isVisible" class="focus-banner" :class="{ 'is-expanded': isFocusBannerExpanded }">
    <button
      class="focus-banner-toggle-btn"
      :class="{ 'is-clickable': isPhotoFocus }"
      :aria-expanded="isFocusBannerExpanded"
      :aria-label="
        isPhotoFocus
          ? 'Foto in Galerie öffnen'
          : isFocusBannerExpanded
            ? 'Fokus-Banner einklappen'
            : 'Fokus-Banner ausklappen'
      "
      @click="handleToggleClick"
    >
      <img
        v-if="!focusedExcursion && !focusedSpot && !focusedAllPhotos && focusedLocation?.imageUrl"
        :src="focusedLocation.imageUrl"
        alt=""
        class="focus-banner-thumb"
      />
      <AppIcon
        v-else
        :icon="
          focusedExcursion
            ? SECTION_ICON_DEFS.excursions
            : focusedSpot
              ? spotCategoryMeta(focusedSpot.category).tabler
              : focusedAllPhotos
                ? MAP_TOOL_ICONS.photos
                : focusedLocation
                  ? FORM_FIELD_ICONS.image
                  : FORM_FIELD_ICONS.period
        "
        :size="18"
        :group="focusedExcursion ? 'navigation' : focusedSpot ? 'categories' : 'formFields'"
      />
    </button>
    <div class="focus-banner-content">
      <button
        v-if="focusedLocation"
        type="button"
        class="focus-title-btn"
        title="Foto in Galerie öffnen"
        @click="emit('open-photo-preview')"
      >
        {{ focusedLocation.title || 'Foto-Standort' }}
      </button>
      <button
        v-else-if="focusedAllPhotos"
        type="button"
        class="focus-title-btn"
        title="Fotos in Galerie öffnen"
        @click="emit('open-photo-preview')"
      >
        {{
          allTripPhotoPointsCount === 1
            ? '1 Foto mit Standort'
            : `Alle Fotos mit Standort (${allTripPhotoPointsCount || 0})`
        }}
      </button>
      <span v-else>{{
        focusedExcursion
          ? focusedExcursion.title
          : focusedSpot
            ? focusedSpot.title
            : formattedDateString
      }}</span>
      <Button variant="card-action" @click="emit('clear')">
        <AppIcon :icon="ACTION_ICONS.close" :size="14" group="actions" /> Fokus verlassen
      </Button>
    </div>
  </div>
</template>

<style scoped>
.focus-banner {
  position: absolute;
  top: var(--fit-btn-top-inset, var(--space-3));
  left: var(--space-3);
  bottom: unset;
  right: unset;
  z-index: 1000;
  display: flex;
  align-items: center;
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  color: var(--color-primary-dark);
  font-size: var(--font-size-sm);
  font-weight: 600;
  overflow: hidden;

  /* Initial-Zustand Mobil: Runder Icon-Button */
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 2px;
  width: auto;
  max-width: 44px;
  height: 44px;
  box-shadow: var(--shadow-md);

  transition:
    max-width 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    padding 0.3s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.focus-banner.is-expanded {
  max-width: calc(100% - 60px);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 2px var(--space-3) 2px 2px;
}

.focus-banner-toggle-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  color: var(--color-primary-dark);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast);
}

.focus-banner-toggle-btn:active {
  background: var(--color-hover);
}

.focus-banner-thumb {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  object-fit: cover;
  display: block;
  box-shadow: var(--shadow-sm);
}

.focus-banner-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity var(--transition-fast),
    visibility var(--transition-fast);
  white-space: nowrap;
}

.focus-banner.is-expanded .focus-banner-content {
  opacity: 1;
  visibility: visible;
  transition-delay: 0.1s;
}

@container trip-map (min-width: 720px) {
  .focus-banner {
    top: calc(var(--app-header-height, 56px) + var(--space-4));
    left: calc(
      var(
          --spots-col-right-px,
          calc(
            var(--calendar-margin, var(--drawer-tab-width, 32px)) + var(--calendar-offset, 0px) +
              var(--spots-col-width, 400px) + var(--space-4)
          )
        ) +
        var(--space-3)
    );
    bottom: unset;
    right: unset;
    width: auto;
    max-width: calc(100% - 60px);
    border-radius: var(--radius-pill);
    corner-shape: round;
    padding: 2px var(--space-3) 2px 2px;
    height: 44px;
  }

  :global(.karte.sheet-overlay-mode) .focus-banner,
  :global(.sheet-overlay-mode) .focus-banner {
    left: calc(
      var(--calendar-margin, var(--drawer-tab-width, 32px)) + var(--calendar-offset, 0px) +
        var(--space-4)
    );
  }

  .focus-banner-content {
    opacity: 1;
    visibility: visible;
  }

  .focus-banner-toggle-btn {
    pointer-events: none;
  }

  .focus-banner-toggle-btn.is-clickable {
    pointer-events: auto;
    cursor: pointer;
  }
}

.focus-banner span,
.focus-banner .focus-title-btn {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-banner .focus-title-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 500;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.focus-banner .focus-title-btn:hover {
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>

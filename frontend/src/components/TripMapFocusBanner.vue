<script setup lang="ts">
import { imageDisplayUrl } from '../utils/imageDisplayUrl';
import { computed, ref, watch } from 'vue';
import type { Excursion, Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { getTourRoleIconDef } from '../utils/travelRole';
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
  vacationDays?: string[];
  formatDate?: (date: string) => string;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
  (e: 'open-photo-preview'): void;
  (e: 'change-date', date: string): void;
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
  if (!props.focusedDate) {
    return '';
  }

  return props.formatDate ? props.formatDate(props.focusedDate) : props.focusedDate;
});

const currentDayIndex = computed(() => {
  if (!props.focusedDate || !props.vacationDays || props.vacationDays.length === 0) {
    return -1;
  }

  return props.vacationDays.indexOf(props.focusedDate);
});

const hasMultipleDays = computed(() => {
  return !!(props.vacationDays && props.vacationDays.length > 1);
});

const prevDate = computed(() => {
  if (!props.focusedDate || !props.vacationDays || props.vacationDays.length === 0) {
    return null;
  }

  const idx = currentDayIndex.value;

  if (idx > 0) {
    return props.vacationDays[idx - 1];
  }

  if (idx === -1) {
    const earlierDays = props.vacationDays.filter(
      (vacationDay) => vacationDay < props.focusedDate!
    );

    if (earlierDays.length > 0) {
      return earlierDays[earlierDays.length - 1];
    }
  }

  return null;
});

const nextDate = computed(() => {
  if (!props.focusedDate || !props.vacationDays || props.vacationDays.length === 0) {
    return null;
  }

  const idx = currentDayIndex.value;

  if (idx >= 0 && idx < props.vacationDays.length - 1) {
    return props.vacationDays[idx + 1];
  }

  if (idx === -1) {
    const laterDays = props.vacationDays.filter((vacationDay) => vacationDay > props.focusedDate!);

    if (laterDays.length > 0) {
      return laterDays[0];
    }
  }

  return null;
});

const hasPrevDate = computed(() => prevDate.value !== null);
const hasNextDate = computed(() => nextDate.value !== null);

function goToPrevDate() {
  if (prevDate.value) {
    emit('change-date', prevDate.value);
  }
}

function goToNextDate() {
  if (nextDate.value) {
    emit('change-date', nextDate.value);
  }
}

function handleToggleClick() {
  if (isPhotoFocus.value) {
    emit('open-photo-preview');
  } else {
    isFocusBannerExpanded.value = !isFocusBannerExpanded.value;
  }
}

watch(
  () => [props.focusedExcursion, props.focusedSpot, props.focusedLocation, props.focusedAllPhotos],
  () => {
    isFocusBannerExpanded.value = false;
  }
);

watch(
  () => Boolean(props.focusedDate),
  (hasDate, hadDate) => {
    if (hasDate !== hadDate) {
      isFocusBannerExpanded.value = false;
    }
  }
);
</script>

<template>
  <Transition name="focus-banner-fade">
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
          :src="imageDisplayUrl(focusedLocation.imageUrl)"
          alt=""
          class="focus-banner-thumb"
        />
        <AppIcon
          v-else
          :icon="
            focusedExcursion
              ? getTourRoleIconDef(focusedExcursion.role)
              : focusedSpot
                ? spotCategoryMeta(focusedSpot.category).tabler
                : focusedAllPhotos
                  ? MAP_TOOL_ICONS.photos
                  : focusedLocation
                    ? FORM_FIELD_ICONS.image
                    : FORM_FIELD_ICONS.period
          "
          :size="18"
          :group="focusedExcursion || focusedSpot ? 'categories' : 'formFields'"
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
        <div v-else-if="focusedDate" class="focus-date-nav">
          <button
            v-if="hasMultipleDays"
            type="button"
            class="focus-nav-btn"
            :disabled="!hasPrevDate"
            aria-label="Vorheriger Tag"
            title="Vorheriger Tag"
            @click.stop="goToPrevDate"
          >
            <AppIcon :icon="ACTION_ICONS.scrollLeft" :size="16" group="actions" />
          </button>
          <span class="focus-date-label">{{ formattedDateString }}</span>
          <button
            v-if="hasMultipleDays"
            type="button"
            class="focus-nav-btn"
            :disabled="!hasNextDate"
            aria-label="Nächster Tag"
            title="Nächster Tag"
            @click.stop="goToNextDate"
          >
            <AppIcon :icon="ACTION_ICONS.scrollRight" :size="16" group="actions" />
          </button>
        </div>
        <span v-else>{{
          focusedExcursion ? focusedExcursion.title : focusedSpot ? focusedSpot.title : ''
        }}</span>
        <Button variant="card-action" class="focus-close-btn" @click="emit('clear')">
          <AppIcon :icon="ACTION_ICONS.close" :size="14" group="actions" /> Fokus verlassen
        </Button>
      </div>
    </div>
  </Transition>
</template>

<style lang="scss" scoped>
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

.focus-banner-fade-enter-active,
.focus-banner-fade-leave-active {
  transition:
    opacity var(--duration-normal, 0.25s) ease,
    transform var(--duration-normal, 0.25s) cubic-bezier(0.32, 0.72, 0, 1);
}

.focus-banner-fade-enter-from,
.focus-banner-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}

.focus-banner.is-expanded {
  max-width: calc(100% - 60px);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: 2px 6px 2px 2px;
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

.focus-banner-toggle-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
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
    padding: 2px 6px 2px 2px;
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

.focus-banner .focus-title-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.focus-banner :deep(.focus-close-btn),
.focus-close-btn {
  border-radius: var(--radius-pill) !important;
  corner-shape: round;
  min-height: 30px;
  height: 30px;
  padding: 0 10px;
  font-size: var(--font-size-xs, 0.75rem);
  flex-shrink: 0;
}

.focus-date-nav {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.focus-nav-btn {
  @include touch-target($expand: true);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  border-radius: var(--radius-pill);
  corner-shape: round;
  border: none;
  background: transparent;
  color: var(--color-primary-dark);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    opacity var(--transition-fast);
}

.focus-nav-btn:hover:not(:disabled) {
  background: var(--color-hover);
}

.focus-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.focus-nav-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.focus-date-label {
  padding: 0 2px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  white-space: nowrap;
  user-select: none;
}
</style>

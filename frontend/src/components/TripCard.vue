<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Trip } from '../api/types';
import { formatTripDateRange } from '../utils/dateFormat';
import { imageDisplayUrl } from '../utils/imageDisplayUrl';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import AppIcon from './AppIcon.vue';
import EditButton from './EditButton.vue';
import Badge from './primitives/Badge.vue';
import Card from './primitives/Card.vue';

const MS_PER_DAY = 86_400_000;
const MAX_VISIBLE_MEMBERS = 3;
const COVER_PLACEHOLDER_ICON_SIZE = 36;
const META_ICON_SIZE = 15;
const STAT_ICON_SIZE = 13;
const MEMBER_FALLBACK_ICON_SIZE = 12;

const props = withDefaults(
  defineProps<{
    trip: Trip;
    active?: boolean;
  }>(),
  {
    active: false,
  }
);

const emit = defineEmits<{
  (e: 'select', id: number): void;
  (e: 'edit', trip: Trip): void;
}>();

const imageFailed = ref(false);

watch(
  () => props.trip.image_url,
  () => {
    imageFailed.value = false;
  }
);

const coverImageSrc = computed(() => {
  if (imageFailed.value || !props.trip.image_url) {
    return undefined;
  }

  return imageDisplayUrl(props.trip.image_url);
});

const tripDays = computed(() => {
  const { start_date: startDate, end_date: endDate } = props.trip;

  if (!startDate || !endDate) {
    return null;
  }

  const startMs = Date.parse(startDate);
  const endMs = Date.parse(endDate);

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return null;
  }

  return Math.round((endMs - startMs) / MS_PER_DAY) + 1;
});

const dateRangeLabel = computed(() => {
  const baseRange = formatTripDateRange(props.trip.start_date, props.trip.end_date);

  if (tripDays.value == null) {
    return baseRange;
  }

  const unit = tripDays.value === 1 ? 'Tag' : 'Tage';
  return `${baseRange} · ${tripDays.value} ${unit}`;
});

const hasDates = computed(() => Boolean(props.trip.start_date || props.trip.end_date));

const destinationLabel = computed(
  () => props.trip.destination?.trim() || props.trip.country_name?.trim() || ''
);

const members = computed(() => props.trip.members ?? []);
const visibleMembers = computed(() => members.value.slice(0, MAX_VISIBLE_MEMBERS));
const hiddenMembers = computed(() => members.value.slice(MAX_VISIBLE_MEMBERS));
const hiddenMembersTitle = computed(() =>
  hiddenMembers.value.map((member) => member.username).join(', ')
);

const packingLabel = computed(() => {
  const stats = props.trip.stats;

  if (!stats) {
    return '';
  }

  if (stats.packing_total <= 0) {
    return '0 gepackt';
  }

  return `${stats.packing_packed}/${stats.packing_total} gepackt`;
});

const isPackingComplete = computed(() => {
  const stats = props.trip.stats;

  if (!stats || stats.packing_total <= 0) {
    return false;
  }

  return stats.packing_packed >= stats.packing_total;
});

function onCardClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;

  if (target?.closest('button, a')) {
    return;
  }

  emit('select', props.trip.id);
}
</script>

<template>
  <Card variant="polaroid" class="trip-card" :class="{ 'is-active': active }" @click="onCardClick">
    <div class="trip-cover">
      <img
        v-if="coverImageSrc"
        :src="coverImageSrc"
        :alt="trip.name"
        class="trip-cover-img"
        loading="lazy"
        @error="imageFailed = true"
      />
      <AppIcon
        v-else
        :icon="ACTION_ICONS.vacation"
        :size="COVER_PLACEHOLDER_ICON_SIZE"
        group="actions"
        class="trip-cover-placeholder"
      />
    </div>

    <div class="trip-body">
      <div class="card-header-row">
        <h2 class="card-title-block">
          <button
            type="button"
            class="trip-select"
            :title="trip.name"
            @click="emit('select', trip.id)"
          >
            {{ trip.name }}
          </button>
        </h2>

        <div class="card-header-actions">
          <Badge v-if="active" variant="primary" size="sm">Aktiv</Badge>
          <EditButton
            size="sm"
            shape="squircle"
            variant="ghost"
            class="trip-edit-btn"
            @click="emit('edit', trip)"
          />
        </div>
      </div>

      <div class="trip-meta">
        <div class="trip-meta-row">
          <AppIcon
            :icon="FORM_FIELD_ICONS.period"
            :size="META_ICON_SIZE"
            group="formFields"
            class="trip-meta-icon"
          />
          <span class="trip-meta-text" :class="{ 'is-muted': !hasDates }">
            {{ dateRangeLabel }}
          </span>
        </div>

        <div class="trip-meta-row">
          <AppIcon
            :icon="FORM_FIELD_ICONS.location"
            :size="META_ICON_SIZE"
            group="formFields"
            class="trip-meta-icon"
          />
          <span
            class="trip-meta-text"
            :class="{ 'is-muted': !destinationLabel }"
            :title="destinationLabel || undefined"
          >
            {{ destinationLabel || 'Reiseziel noch offen' }}
          </span>
        </div>

        <div v-if="members.length > 0" class="trip-meta-row trip-members-row">
          <AppIcon
            :icon="FORM_FIELD_ICONS.visibility"
            :size="META_ICON_SIZE"
            group="formFields"
            class="trip-meta-icon"
          />
          <div class="trip-members-list">
            <span
              v-for="member in visibleMembers"
              :key="member.id"
              class="trip-member-pill"
              :title="member.username"
            >
              <span v-if="member.avatar" class="trip-member-avatar" aria-hidden="true">
                {{ member.avatar }}
              </span>
              <AppIcon
                v-else
                :icon="FORM_FIELD_ICONS.person"
                :size="MEMBER_FALLBACK_ICON_SIZE"
                group="formFields"
              />
              <span class="trip-member-name">{{ member.username }}</span>
            </span>
            <span
              v-if="hiddenMembers.length > 0"
              class="trip-member-overflow"
              :title="hiddenMembersTitle"
            >
              +{{ hiddenMembers.length }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="trip.stats" class="trip-stats">
        <span
          class="trip-stat"
          :title="`${trip.stats.spots} ${trip.stats.spots === 1 ? 'Spot' : 'Spots'}`"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.location" :size="STAT_ICON_SIZE" group="formFields" />
          <span>{{ trip.stats.spots }} {{ trip.stats.spots === 1 ? 'Spot' : 'Spots' }}</span>
        </span>

        <span
          class="trip-stat"
          :title="`${trip.stats.tours} ${trip.stats.tours === 1 ? 'Tour' : 'Touren'}`"
        >
          <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="STAT_ICON_SIZE" group="navigation" />
          <span>{{ trip.stats.tours }} {{ trip.stats.tours === 1 ? 'Tour' : 'Touren' }}</span>
        </span>

        <span
          class="trip-stat"
          :title="`${trip.stats.diary} ${trip.stats.diary === 1 ? 'Tagebucheintrag' : 'Tagebucheinträge'}`"
        >
          <AppIcon :icon="SECTION_ICON_DEFS.diary" :size="STAT_ICON_SIZE" group="navigation" />
          <span>{{ trip.stats.diary }} {{ trip.stats.diary === 1 ? 'Eintrag' : 'Einträge' }}</span>
        </span>

        <span
          class="trip-stat"
          :class="{ 'is-complete': isPackingComplete }"
          :title="`Packliste: ${packingLabel}`"
        >
          <AppIcon :icon="SECTION_ICON_DEFS.packing" :size="STAT_ICON_SIZE" group="navigation" />
          <span>{{ packingLabel }}</span>
        </span>
      </div>
    </div>
  </Card>
</template>

<style lang="scss" scoped>
.trip-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  cursor: pointer;
  padding: var(--space-sm);
}

.trip-card.is-active {
  border-color: var(--color-primary);
}

.trip-cover {
  height: 136px;
  background: var(--color-primary-tint);
  border-radius: calc(var(--radius-md-squircle) - var(--space-1));
  corner-shape: squircle;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.trip-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.trip-cover-placeholder {
  color: var(--color-primary-dark);
  opacity: 0.72;
}

.trip-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: var(--space-2);
  padding: var(--space-sm) var(--space-xs) var(--space-2xs);
  min-width: 0;
}

.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.card-title-block {
  margin: 0;
  flex: 1;
  min-width: 0;
}

.trip-select {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  text-align: left;
  background: none;
  border: none;
  padding: var(--space-1) var(--space-1-5);
  margin: calc(-1 * var(--space-1)) calc(-1 * var(--space-1-5));
  border-radius: var(--radius-xs);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 700;
  line-height: var(--line-height-snug);
  color: var(--color-text);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

@include can-hover {
  .trip-card:hover:not(:has(.trip-edit-btn:hover)) .trip-select,
  .trip-select:hover {
    color: var(--color-primary-dark);
  }
}

.trip-select:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
}

.card-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-shrink: 0;
}

.trip-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  min-width: 0;
}

.trip-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-1-5);
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}

.trip-meta-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.trip-meta-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trip-meta-text.is-muted {
  color: var(--color-text-muted);
  font-style: italic;
}

.trip-members-row {
  align-items: flex-start;
}

.trip-members-row .trip-meta-icon {
  margin-top: 3px;
}

.trip-members-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.trip-member-pill,
.trip-member-overflow {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  color: var(--color-text);
  max-width: 100%;
  line-height: var(--line-height-tight);
}

.trip-member-avatar {
  line-height: 1;
  flex-shrink: 0;
}

.trip-member-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 110px;
}

.trip-member-overflow {
  color: var(--color-text-muted);
  font-weight: 600;
}

.trip-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1-5);
  margin-top: auto;
  padding-top: var(--space-2);
  @include divider-engraved('top');
}

.trip-stat {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2xs) var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.trip-stat.is-complete {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
}
</style>

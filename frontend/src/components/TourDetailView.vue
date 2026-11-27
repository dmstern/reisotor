<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import { useDiaryStore } from '../stores/diary';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import { useExcursionStations } from '../composables/useExcursionStations';
import { useExcursionWeather } from '../composables/useExcursionWeather';
import EditButton from './EditButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import SocialRow from './SocialRow.vue';
import Accordion from './primitives/Accordion.vue';
import FileAttachments from './FileAttachments.vue';
import TourRoleBadge from './TourRoleBadge.vue';
import ToggleSwitch from './primitives/ToggleSwitch.vue';
import ExcursionMapLinks from './ExcursionMapLinks.vue';
import LinkedDiaryPills from './LinkedDiaryPills.vue';
import Button from './primitives/Button.vue';
import WeatherIcon from './WeatherIcon.vue';
import WeatherDayDetailDialog from './WeatherDayDetailDialog.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { summarizeTourLegsByTransport } from '../utils/travelDuration';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { weatherCodeMeta } from '../utils/weather';
import { formatDate as formatDateShared } from '../utils/dateFormat';

const props = withDefaults(
  defineProps<{
    excursion: Excursion;
    creatorLabel: string | null;
    likeCount: number;
    liked: boolean;
    comments: CommentItem[];
    stations: Spot[];
    travelItems: TravelItem[];
    headingTag?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  }>(),
  {
    headingTag: 'h2',
  }
);

const emit = defineEmits<{
  (e: 'edit', excursion: Excursion): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'update-comment', id: number, content: string): void;
  (e: 'toggle-comment-like', id: number): void;
  (e: 'show-on-map'): void;
  (e: 'update-note', note: string): void;
}>();

const diaryStore = useDiaryStore();
const excursionsStore = useExcursionsStore();
const drawers = useDrawersStore();
const doneToggleId = useId();
const showComments = ref(false);

const pendingDone = ref<boolean | null>(null);
const isDone = computed(() => pendingDone.value ?? Boolean(props.excursion.done));
let doneQueueTail = Promise.resolve();

/** Serialisiert schnelle Toggle-Klicks, damit ältere API-Antworten keinen neueren Status überschreiben. */
function onToggleDone(nextDone: boolean) {
  const excursionId = props.excursion.id;
  pendingDone.value = nextDone;
  doneQueueTail = doneQueueTail
    .then(async () => {
      await excursionsStore.setDone(excursionId, nextDone);
    })
    .catch(() => {
      // Fehlerbehandlung erfolgt im Store/API-Layer; State fällt im finally auf props.excursion.done zurück.
    })
    .finally(() => {
      if (pendingDone.value === nextDone) {
        pendingDone.value = null;
      }
    });
}

const linkedDiaryEntries = computed(() =>
  diaryStore.entries.filter(
    (entry) => !entry.is_draft && (entry.excursion_ids ?? []).includes(props.excursion.id)
  )
);

const {
  resolvedStations,
  hasMappedStations,
  effectiveDepartureTime,
  effectiveArrivalTime,
  travelDuration,
  linkedTracks,
} = useExcursionStations({
  excursion: () => props.excursion,
  stations: () => props.stations,
  travelItems: () => props.travelItems,
});

const { weatherSummary, primaryWeatherDay, primaryWeatherDays, primaryWeatherLocation } =
  useExcursionWeather({
    excursion: () => props.excursion,
    resolvedStations: () => resolvedStations.value,
  });

const isWeatherDialogOpen = ref(false);
const selectedWeatherDate = ref('');

function openWeatherDialog() {
  selectedWeatherDate.value = props.excursion.date || '';
  isWeatherDialogOpen.value = true;
}

const timeLabel = computed(() => {
  if (effectiveDepartureTime.value) {
    return effectiveArrivalTime.value
      ? `${effectiveDepartureTime.value}\u2013${effectiveArrivalTime.value}\u00A0Uhr`
      : `${effectiveDepartureTime.value}\u00A0Uhr`;
  }

  if (effectiveArrivalTime.value) {
    return `Ankunft ${effectiveArrivalTime.value}\u00A0Uhr`;
  }

  return null;
});

const plannedDateLabel = computed(() =>
  props.excursion.date ? formatDateShared(props.excursion.date, { includeYear: false }) : ''
);

function openPlannedDateInCalendar() {
  if (!props.excursion.date) {
    return;
  }

  drawers.openCalendar(props.excursion.date);
}

const hasTimeOrDuration = computed(() => Boolean(timeLabel.value || travelDuration.value));

const hasMeta = computed(() =>
  Boolean(
    props.creatorLabel || hasTimeOrDuration.value || props.excursion.date || weatherSummary.value
  )
);

const weatherLabel = computed(() =>
  weatherSummary.value ? weatherCodeMeta(weatherSummary.value.weatherCode).label : ''
);

const transportSummary = computed(() => summarizeTourLegsByTransport(props.excursion.legs));
</script>

<template>
  <article
    class="tour-detail-view"
    :class="{
      'has-role': !!excursion.role,
      'is-travel': !!excursion.role,
    }"
  >
    <header class="tour-detail-header">
      <div class="tour-detail-heading-group">
        <div class="tour-detail-header-top">
          <div class="tour-detail-title-group">
            <component :is="headingTag" class="tour-detail-title" :title="excursion.title">
              {{ excursion.title }}
            </component>
            <TourRoleBadge :role="excursion.role" translucent />
            <PendingSyncBadge v-if="excursion._pending" />
          </div>

          <EditButton
            size="md"
            shape="squircle"
            variant="ghost"
            class="tour-edit-btn"
            @click="emit('edit', excursion)"
          />
        </div>

        <div v-if="hasMeta" class="tour-detail-meta-row">
          <div v-if="creatorLabel || hasTimeOrDuration" class="tour-detail-meta">
            <span v-if="creatorLabel" class="tour-detail-author">Von {{ creatorLabel }}</span>
            <span
              v-if="creatorLabel && hasTimeOrDuration"
              class="tour-detail-meta-sep"
              aria-hidden="true"
            >
              ·
            </span>
            <span v-if="timeLabel" class="tour-detail-time">
              <AppIcon
                :icon="FORM_FIELD_ICONS.time"
                :size="13"
                group="formFields"
                aria-hidden="true"
              />
              <span class="tour-detail-meta-text">{{ timeLabel }}</span>
            </span>
            <span
              v-if="timeLabel && travelDuration"
              class="tour-detail-meta-sep"
              aria-hidden="true"
            >
              ·
            </span>
            <span v-if="travelDuration" class="tour-detail-duration">
              <AppIcon
                v-if="!timeLabel"
                :icon="FORM_FIELD_ICONS.time"
                :size="13"
                group="formFields"
                aria-hidden="true"
              />
              <span class="tour-detail-meta-text">{{ travelDuration }}</span>
            </span>
          </div>

          <div v-if="plannedDateLabel || weatherSummary" class="tour-detail-date-weather">
            <Button
              v-if="plannedDateLabel"
              variant="ghost"
              size="xs"
              class="tour-detail-date-btn"
              title="Diesen Tag im Kalender öffnen"
              :aria-label="`${formatDateShared(excursion.date!)} im Kalender öffnen`"
              @click="openPlannedDateInCalendar"
            >
              <AppIcon
                :icon="FORM_FIELD_ICONS.date"
                :size="13"
                group="formFields"
                aria-hidden="true"
              />
              <span>{{ plannedDateLabel }}</span>
            </Button>

            <span
              v-if="plannedDateLabel && weatherSummary"
              class="tour-detail-meta-sep"
              aria-hidden="true"
            >
              ·
            </span>

            <Button
              v-if="weatherSummary"
              variant="ghost"
              size="xs"
              class="tour-detail-weather-btn"
              :title="`${weatherLabel} (${weatherSummary.tempLabel}) – Tagesverlauf anzeigen`"
              :aria-label="`Wetter: ${weatherLabel}, ${weatherSummary.tempLabel} – Tagesverlauf anzeigen`"
              @click="openWeatherDialog"
            >
              <WeatherIcon :code="weatherSummary.weatherCode" :size="16" aria-hidden="true" />
              <span>{{ weatherSummary.tempLabel }}</span>
            </Button>
          </div>
        </div>

        <div
          v-if="transportSummary.length > 0"
          class="tour-detail-transport-summary"
          aria-label="Übersicht Verkehrsmittel"
        >
          <span
            v-for="item in transportSummary"
            :key="item.type"
            class="tour-detail-transport-item"
            :title="item.tooltip"
            :aria-label="item.ariaLabel"
          >
            <AppIcon
              :icon="travelTypeIconDef(item.type)"
              :size="15"
              group="actions"
              force-style="icons"
              aria-hidden="true"
            />
            <span class="tour-detail-transport-text">{{ item.formattedPrimary }}</span>
          </span>
        </div>
      </div>

      <div class="tour-detail-header-controls">
        <div class="tour-detail-status">
          <ToggleSwitch
            :id="doneToggleId"
            size="sm"
            :model-value="isDone"
            :aria-label="isDone ? 'Nicht mehr als gemacht markiert' : 'Als gemacht markieren'"
            :title="isDone ? 'Als nicht gemacht markieren' : 'Als gemacht markieren'"
            @update:model-value="onToggleDone"
          />
          <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
          <label :for="doneToggleId" class="tour-detail-done-label">Gemacht</label>
        </div>

        <SocialRow
          :readonly="false"
          :like-count="likeCount"
          :liked="liked"
          :comment-count="comments.length"
          :comments-open="showComments"
          @toggle-like="emit('toggle-like')"
          @toggle-comments="showComments = !showComments"
        />
      </div>
    </header>

    <Accordion class="tour-detail-comments-accordion" :expanded="showComments">
      <Comments
        :comments="comments"
        @submit="(content) => emit('submit-comment', content)"
        @remove="(id) => emit('remove-comment', id)"
        @update="(id, content) => emit('update-comment', id, content)"
        @toggle-like="(id) => emit('toggle-comment-like', id)"
      />
    </Accordion>

    <div v-if="excursion.note" class="tour-detail-note-wrap">
      <RichTextDisplay
        class="tour-detail-note"
        :content="excursion.note"
        :format="excursion.note_format"
        interactive
        @update:content="(html) => emit('update-note', html)"
      />
    </div>

    <FileAttachments
      class="tour-detail-attachments"
      domain="ideas"
      :entity-id="excursion.id"
      :editable="false"
    />

    <div
      v-if="hasMappedStations || linkedTracks.length || linkedDiaryEntries.length"
      class="tour-detail-links-row"
    >
      <ExcursionMapLinks
        :has-mapped-stations="hasMappedStations"
        :linked-tracks="linkedTracks"
        @show-on-map="emit('show-on-map')"
      />

      <LinkedDiaryPills
        v-if="linkedTracks.length || linkedDiaryEntries.length"
        :tracks="linkedTracks"
        :entries="linkedDiaryEntries"
      />
    </div>

    <div class="tour-detail-stations">
      <slot name="stations" />
    </div>

    <WeatherDayDetailDialog
      v-model="isWeatherDialogOpen"
      :date="selectedWeatherDate || excursion.date || undefined"
      :day="primaryWeatherDay"
      :days="primaryWeatherDays"
      :lat="primaryWeatherLocation?.lat ?? null"
      :lng="primaryWeatherLocation?.lng ?? null"
      :location-label="primaryWeatherLocation?.label || excursion.title"
      @navigate-day="(d) => (selectedWeatherDate = d.date)"
    />
  </article>
</template>

<style scoped lang="scss">
.tour-detail-view {
  --tour-theme-color: var(--color-tour);
  --tour-theme-dark: var(--color-tour-dark);
  --tour-theme-tint: var(--color-tour-tint);
  --tour-theme-border: var(--color-tour-border);

  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg) 0 0;
  min-width: 0;
}

.tour-detail-view.is-travel,
.tour-detail-view.has-role {
  --tour-theme-color: var(--color-travel);
  --tour-theme-dark: var(--color-travel-dark);
  --tour-theme-tint: var(--color-travel-tint);
  --tour-theme-border: var(--color-travel-border);
}

.tour-detail-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding-bottom: var(--space-lg);
  @include divider-engraved('bottom');
}

.tour-detail-heading-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
  min-width: 0;
}

.tour-detail-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
  min-width: 0;
}

.tour-detail-title-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1) var(--space-2);
  padding-top: var(--space-1);
}

.tour-detail-title-group :deep(.category-chip) {
  max-width: 100%;
}

.tour-detail-title {
  margin: 0;
  min-width: 0;
  max-width: 100%;
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-snug);
  color: var(--color-text);
  overflow-wrap: break-word;
}

.tour-edit-btn {
  flex-shrink: 0;
}

.tour-detail-meta-row {
  display: flex;
  align-items: safe center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-md);
  min-width: 0;
}

.tour-detail-meta {
  display: flex;
  align-items: safe center;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-1-5);
  min-width: 0;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-snug);
  color: var(--color-text-muted);
}

.tour-detail-author {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.tour-detail-meta-sep {
  opacity: 0.6;
  flex-shrink: 0;
}

.tour-detail-date-weather {
  display: inline-flex;
  align-items: safe center;
  gap: var(--space-2xs);
  flex-shrink: 0;
  margin-left: auto;
}

.tour-detail-date-weather :deep(.tour-detail-date-btn),
.tour-detail-date-weather :deep(.tour-detail-weather-btn) {
  padding-inline: var(--space-1-5);
}

.tour-detail-date-weather :deep(.tour-detail-date-btn) {
  color: var(--color-text-muted);
}

.tour-detail-date-weather :deep(.tour-detail-date-btn:hover) {
  color: var(--color-text);
}

.tour-detail-time,
.tour-detail-duration {
  display: inline-flex;
  align-items: safe center;
  gap: var(--space-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.tour-detail-meta-text {
  text-box: trim-both cap alphabetic;
}

.tour-detail-transport-summary {
  display: flex;
  align-items: safe center;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-md);
  min-width: 0;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-snug);
  color: var(--color-text-muted);
}

.tour-detail-transport-item {
  display: inline-flex;
  align-items: safe center;
  gap: var(--space-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.tour-detail-transport-text {
  font-weight: 500;
  text-box: trim-both cap alphabetic;
}

.tour-detail-header-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.tour-detail-header-controls > :deep(.social-row) {
  margin-left: auto;
}

.tour-detail-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.tour-detail-done-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
}

.tour-detail-comments-accordion {
  margin-top: calc(-1 * var(--space-lg));
}

.tour-detail-comments-accordion.is-expanded {
  margin-top: 0;
}

.tour-detail-comments-accordion :deep(.comments) {
  margin-top: 0;
  padding-top: 0;
  padding-bottom: var(--space-lg);
  border-top: none;
  box-shadow: none;
  @include divider-engraved('bottom');
}

.tour-detail-note-wrap {
  min-width: 0;
}

.tour-detail-note {
  overflow-wrap: anywhere;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-normal);
  color: var(--color-text);
}

.tour-detail-links-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.tour-detail-stations {
  min-width: 0;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import { useDiaryStore } from '../stores/diary';
import { useExcursionStations } from '../composables/useExcursionStations';
import { useExcursionWeather } from '../composables/useExcursionWeather';
import EditButton from './EditButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import SocialRow from './SocialRow.vue';
import Accordion from './primitives/Accordion.vue';
import Badge from './primitives/Badge.vue';
import FileAttachments from './FileAttachments.vue';
import TourRoleBadge from './TourRoleBadge.vue';
import ExcursionDoneStatus from './ExcursionDoneStatus.vue';
import ExcursionMapLinks from './ExcursionMapLinks.vue';
import LinkedDiaryPills from './LinkedDiaryPills.vue';
import WeatherIcon from './WeatherIcon.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

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
}>();

const diaryStore = useDiaryStore();
const showComments = ref(false);

const linkedDiaryEntries = computed(() =>
  diaryStore.entries.filter(
    (entry) => !entry.is_draft && (entry.excursion_ids ?? []).includes(props.excursion.id)
  )
);

const { resolvedStations, hasMappedStations, travelDuration, linkedTracks } = useExcursionStations({
  excursion: () => props.excursion,
  stations: () => props.stations,
  travelItems: () => props.travelItems,
});

const { weatherSummary } = useExcursionWeather({
  excursion: () => props.excursion,
  resolvedStations: () => resolvedStations.value,
});

const hasInfoBadges = computed(() =>
  Boolean(
    props.creatorLabel || travelDuration.value || weatherSummary.value || linkedTracks.value.length
  )
);
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
      <div class="tour-detail-header-top">
        <component :is="headingTag" class="tour-detail-title" :title="excursion.title">
          {{ excursion.title }}
        </component>

        <div class="tour-detail-badges">
          <TourRoleBadge :role="excursion.role" translucent />
          <PendingSyncBadge v-if="excursion._pending" />
          <EditButton
            size="sm"
            shape="squircle"
            variant="ghost"
            class="tour-edit-btn"
            @click="emit('edit', excursion)"
          />
        </div>
      </div>

      <div v-if="hasInfoBadges" class="tour-detail-info-badges">
        <Badge v-if="creatorLabel" variant="default" size="sm" class="tour-detail-info-badge">
          <span class="tour-detail-info-badge-text">Von {{ creatorLabel }}</span>
        </Badge>
        <Badge v-if="travelDuration" variant="default" size="sm" class="tour-detail-info-badge">
          <AppIcon :icon="FORM_FIELD_ICONS.time" :size="13" group="formFields" />
          {{ travelDuration }}
        </Badge>
        <Badge v-if="weatherSummary" variant="default" size="sm" class="tour-detail-info-badge">
          <WeatherIcon :code="weatherSummary.weatherCode" :size="14" />
          {{ weatherSummary.tempLabel }}
        </Badge>
        <Badge
          v-if="linkedTracks.length"
          variant="default"
          size="sm"
          class="tour-detail-info-badge"
        >
          <AppIcon :icon="ACTION_ICONS.history" :size="13" group="actions" />
          {{ linkedTracks.length }}
          {{ linkedTracks.length === 1 ? 'Aufzeichnung' : 'Aufzeichnungen' }}
        </Badge>
      </div>

      <div class="tour-detail-header-controls">
        <div class="tour-detail-status">
          <ExcursionDoneStatus :excursion="excursion" :expanded="true" />
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

    <Accordion v-if="showComments" :expanded="showComments">
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
  gap: var(--space-md);
  padding: var(--space-md) 0 var(--space-xl);
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
  gap: var(--space-sm);
  padding-bottom: var(--space-md);
  @include divider-engraved('bottom');
}

.tour-detail-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
  min-width: 0;
}

.tour-detail-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-snug);
  color: var(--color-text);
  overflow-wrap: break-word;
}

.tour-detail-badges {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.tour-edit-btn {
  flex-shrink: 0;
}

.tour-detail-info-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-xs);
  min-width: 0;
}

.tour-detail-info-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.tour-detail-info-badge-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  gap: var(--space-xs);
  min-width: 0;
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

.tour-detail-attachments {
  margin-top: 0;
}

.tour-detail-links-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.tour-detail-links-row :deep(.links) {
  margin-top: 0;
}

.tour-detail-stations {
  min-width: 0;
}

@include container-down('spots-col', 'mobile-compact') {
  .tour-detail-badges :deep(.category-chip-label) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .tour-detail-badges :deep(.category-chip) {
    padding: 3px var(--space-1);
    gap: 0;
    max-width: none;
  }
}
</style>

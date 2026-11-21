<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Excursion, Spot, TravelItem } from '../api/types';
import { useDiaryStore } from '../stores/diary';
import { useExcursionStations } from '../composables/useExcursionStations';
import EditButton from './EditButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import SocialRow from './SocialRow.vue';
import Accordion from './primitives/Accordion.vue';
import FileAttachments from './FileAttachments.vue';
import TourRoleBadge from './TourRoleBadge.vue';
import ExcursionDoneStatus from './ExcursionDoneStatus.vue';
import ExcursionMapLinks from './ExcursionMapLinks.vue';
import LinkedDiaryPills from './LinkedDiaryPills.vue';

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

const { resolvedStations, hasMappedStations, routeLabel, travelDuration, linkedTracks } =
  useExcursionStations({
    excursion: () => props.excursion,
    stations: () => props.stations,
    travelItems: () => props.travelItems,
  });

const hasMeta = computed(() =>
  Boolean(
    props.creatorLabel ||
    routeLabel.value ||
    resolvedStations.value.length ||
    travelDuration.value ||
    linkedTracks.value.length
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

      <div v-if="hasMeta" class="tour-detail-meta">
        <span v-if="creatorLabel" class="tour-detail-author">Von {{ creatorLabel }}</span>
        <span v-if="routeLabel" class="tour-detail-submeta">
          <template v-if="creatorLabel">· </template>{{ routeLabel }}
        </span>
        <span v-else-if="resolvedStations.length" class="tour-detail-submeta">
          <template v-if="creatorLabel">· </template>{{ resolvedStations.length }}
          {{ resolvedStations.length === 1 ? 'Station' : 'Stationen' }}
        </span>
        <span v-if="travelDuration" class="tour-detail-submeta">· {{ travelDuration }}</span>
        <span v-if="linkedTracks.length" class="tour-detail-submeta">
          <template v-if="creatorLabel || routeLabel || resolvedStations.length || travelDuration">
            ·
          </template>
          {{ linkedTracks.length }}
          {{ linkedTracks.length === 1 ? 'Aufzeichnung' : 'Aufzeichnungen' }}
        </span>
      </div>
    </header>

    <ExcursionMapLinks
      :has-mapped-stations="hasMappedStations"
      :linked-tracks="linkedTracks"
      @show-on-map="emit('show-on-map')"
    />

    <div v-if="excursion.note" class="tour-detail-note-wrap">
      <RichTextDisplay
        class="tour-detail-note"
        :content="excursion.note"
        :format="excursion.note_format"
      />
    </div>

    <div class="tour-detail-attachments">
      <FileAttachments domain="ideas" :entity-id="excursion.id" :editable="false" />
    </div>

    <LinkedDiaryPills
      v-if="linkedTracks.length || linkedDiaryEntries.length"
      :tracks="linkedTracks"
      :entries="linkedDiaryEntries"
    />

    <div class="tour-detail-actions-row">
      <div class="tour-detail-status">
        <ExcursionDoneStatus
          :excursion="excursion"
          :expanded="true"
          :resolved-stations="resolvedStations"
        />
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

    <Accordion :expanded="showComments">
      <Comments
        :comments="comments"
        @submit="(content) => emit('submit-comment', content)"
        @remove="(id) => emit('remove-comment', id)"
        @update="(id, content) => emit('update-comment', id, content)"
        @toggle-like="(id) => emit('toggle-comment-like', id)"
      />
    </Accordion>

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
  gap: var(--space-2);
  padding: var(--space-3) var(--space-3) var(--space-4);
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
  gap: var(--space-1);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border-divider);
}

.tour-detail-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-2);
  min-width: 0;
}

.tour-detail-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-text);
  overflow-wrap: break-word;
}

.tour-detail-badges {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.tour-edit-btn {
  flex-shrink: 0;
}

.tour-detail-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.tour-detail-author {
  font-weight: 600;
}

.tour-detail-submeta {
  opacity: 0.9;
}

.tour-detail-note-wrap {
  margin-top: var(--space-1);
}

.tour-detail-note {
  overflow-wrap: anywhere;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text);
}

.tour-detail-attachments {
  margin-top: var(--space-1);
}

.tour-detail-actions-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding-top: var(--space-1);
}

.tour-detail-actions-row > :deep(.social-row) {
  margin-left: auto;
}

.tour-detail-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.tour-detail-stations {
  margin-top: var(--space-2);
  min-width: 0;
}

@container spots-col (max-width: 360px) {
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

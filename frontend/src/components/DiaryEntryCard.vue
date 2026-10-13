<script setup lang="ts">
import type { DiaryEntry, DiaryImage, Excursion, Spot } from '../api/types';
import type { DailyWeather } from '../utils/weather';
import { useDrawersStore } from '../stores/drawers';
import { formatDate } from '../utils/dateFormat';
import { weatherCodeMeta } from '../utils/weather';
import { spotCategoryMeta } from '../utils/spotCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import Button from './primitives/Button.vue';
import EditButton from './EditButton.vue';
import PendingSyncBadge from './PendingSyncBadge.vue';
import DraftBadge from './DraftBadge.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import PolaroidStack from './primitives/PolaroidStack.vue';
import WeatherIcon from './WeatherIcon.vue';
import SocialRow from './SocialRow.vue';
import Comments, { type CommentItem } from './Comments.vue';
import Accordion from './primitives/Accordion.vue';

export interface CoEditor {
  id: number;
  avatar: string;
  username: string;
}

withDefaults(
  defineProps<{
    entry: DiaryEntry;
    index?: number;
    highlighted?: boolean;
    authorName?: string;
    authorAvatar?: string;
    coEditors?: CoEditor[];
    weather?: DailyWeather | null;
    hasMap?: boolean;
    excursions?: Excursion[];
    spots?: Spot[];
    likeCount?: number;
    liked?: boolean;
    commentCount?: number;
    comments?: CommentItem[];
    commentsOpen?: boolean;
  }>(),
  {
    index: 0,
    highlighted: false,
    authorName: '?',
    authorAvatar: '❓',
    coEditors: () => [],
    weather: null,
    hasMap: false,
    excursions: () => [],
    spots: () => [],
    likeCount: 0,
    liked: false,
    commentCount: 0,
    comments: () => [],
    commentsOpen: false,
  }
);

const emit = defineEmits<{
  (e: 'edit', entry: DiaryEntry): void;
  (e: 'previewImages', images: DiaryImage[], index: number): void;
  (e: 'toggleLike'): void;
  (e: 'toggleComments'): void;
  (e: 'submitComment', content: string): void;
  (e: 'removeComment', commentId: number): void;
  (e: 'updateComment', commentId: number, content: string): void;
  (e: 'toggleCommentLike', commentId: number): void;
}>();

const drawers = useDrawersStore();
</script>

<template>
  <Card
    tag="article"
    class="entry animate-cascade"
    :style="{ '--stagger-delay': `${index * 60}ms` }"
    :highlight="highlighted"
  >
    <header class="entry-head">
      <span class="avatar">{{ entry.author_avatar ?? authorAvatar }}</span>
      <div class="entry-meta">
        <strong>{{ entry.author_username ?? authorName }}</strong>
        <span class="date">
          {{ formatDate(entry.date) }}
          <span v-if="coEditors.length" class="edited-by">
            · bearbeitet von
            <span v-for="(u, i) in coEditors" :key="u.id" class="edited-by-user">
              <span class="edited-by-avatar">{{ u.avatar }}</span
              >{{ u.username }}<template v-if="i < coEditors.length - 1">, </template>
            </span>
          </span>
          <span v-else-if="entry.updated_at"> (bearbeitet)</span>
        </span>
      </div>
      <PendingSyncBadge v-if="entry._pending" />
      <div class="entry-actions">
        <EditButton small @click="emit('edit', entry)" />
      </div>
    </header>

    <h3 v-if="entry.title">{{ entry.title }}</h3>
    <DraftBadge v-if="entry.is_draft" />
    <RichTextDisplay class="content" :content="entry.content" :format="entry.content_format" />

    <div class="diary-polaroid-wrap" v-if="entry.images.length">
      <PolaroidStack
        :items="entry.images"
        clipped
        @click="(idx) => emit('previewImages', entry.images, idx)"
      />
    </div>

    <div class="card-actions-wrapper">
      <div class="excursion-links">
        <div
          v-if="weather"
          class="diary-weather"
          :title="weatherCodeMeta(weather.weatherCode).label"
        >
          <WeatherIcon class="weather-icon" :size="16" :code="weather.weatherCode" />
          <span class="weather-temp"
            >{{ Math.round(weather.tempMax) }}° / {{ Math.round(weather.tempMin) }}°</span
          >
        </div>
        <Button
          type="button"
          variant="card-action"
          v-if="hasMap"
          @click="drawers.focusMapOnDate(entry.date)"
        >
          <AppIcon :icon="SECTION_ICON_DEFS.map" :size="14" group="navigation" /> Tag auf Karte
          anzeigen
        </Button>
        <Button
          v-for="ex in excursions"
          :key="ex.id"
          type="button"
          variant="ghost"
          class="excursion-chip"
          :title="ex.title"
          :aria-label="ex.title"
          @click="drawers.openMapForExcursion(ex.id)"
        >
          <span
            class="excursion-chip-img"
            :style="ex.image_url ? { backgroundImage: `url(${ex.image_url})` } : {}"
          >
            <AppIcon
              v-if="!ex.image_url"
              :icon="SECTION_ICON_DEFS.excursions"
              :size="16"
              group="navigation"
            />
          </span>
          <span class="excursion-chip-title">{{ ex.title }}</span>
        </Button>
        <Button
          v-for="spot in spots"
          :key="spot.id"
          type="button"
          variant="ghost"
          class="excursion-chip"
          :title="spot.title"
          :aria-label="spot.title"
          @click="drawers.openMapAt(`spot-${spot.id}`)"
        >
          <span
            class="excursion-chip-img"
            :style="spot.image_url ? { backgroundImage: `url(${spot.image_url})` } : {}"
          >
            <AppIcon
              v-if="!spot.image_url"
              :icon="spotCategoryMeta(spot.category).tabler"
              :size="16"
              group="categories"
            />
          </span>
          <span class="excursion-chip-title">{{ spot.title }}</span>
        </Button>
      </div>

      <SocialRow
        :like-count="likeCount"
        :liked="liked"
        :comment-count="commentCount"
        :comments-open="commentsOpen"
        @toggle-like="emit('toggleLike')"
        @toggle-comments="emit('toggleComments')"
      />
    </div>

    <Accordion :expanded="commentsOpen">
      <Comments
        :comments="comments"
        @submit="(content) => emit('submitComment', content)"
        @remove="(commentId) => emit('removeComment', commentId)"
        @update="(commentId, content) => emit('updateComment', commentId, content)"
        @toggle-like="(commentId) => emit('toggleCommentLike', commentId)"
      />
    </Accordion>
  </Card>
</template>

<style scoped>
.entry-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.avatar {
  font-size: var(--font-size-2xl);
  line-height: 1;
  flex-shrink: 0;
}

.entry-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.entry-meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  overflow-wrap: break-word;
}

.edited-by-avatar {
  font-size: 0.9em;
  margin-right: 2px;
}

.entry-actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.entry h3 {
  margin: 0 0 var(--space-1);
  font-family: var(--font-diary);
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-primary-dark);
  overflow-wrap: anywhere;
}

.content {
  margin: 0 0 var(--space-2);
  font-family: var(--font-diary);
  font-size-adjust: from-font;
  font-size: 1.05rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  max-width: 75ch;
}

.diary-polaroid-wrap {
  margin: var(--space-2) 0;
  padding: var(--space-1) 0 var(--space-2) var(--space-1);
}

.card-actions-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.excursion-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.excursion-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--color-hover);
  border: none;
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: var(--space-1) var(--space-3) var(--space-1) var(--space-1);
  font-size: var(--font-size-sm);
  font-family: inherit;
  color: var(--color-text);
  text-decoration: none;
  cursor: pointer;
  max-width: 100%;
  min-width: 0;
}

.excursion-chip:hover {
  background: var(--color-primary-tint);
}

.excursion-chip-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.excursion-chip-img {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.diary-weather {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: var(--color-hover);
  border-radius: var(--radius-pill);
  corner-shape: round;
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  white-space: nowrap;
  flex-shrink: 0;
}

.diary-weather .weather-icon {
  font-size: var(--font-size-md);
}

@container app-main (max-width: 480px) {
  .card-actions-wrapper {
    flex-direction: column;
    align-items: stretch;
  }

  .card-actions-wrapper :deep(.card-social-actions) {
    margin-left: 0;
    justify-content: flex-end;
    width: 100%;
  }

  .excursion-chip-title {
    max-width: 180px;
  }
}
</style>

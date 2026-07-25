<script setup lang="ts">
import { ref } from 'vue';
import type { Excursion } from '../api/types';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';

defineProps<{
  excursion: Excursion;
  suggestedByLabel?: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
}>();
const emit = defineEmits<{
  (e: 'set-status', excursion: Excursion, status: Excursion['status']): void;
  (e: 'remove', id: number): void;
  (e: 'edit', excursion: Excursion): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
}>();

const showComments = ref(false);

const STATUS_LABELS: Record<Excursion['status'], string> = {
  idea: 'Idee',
  planned: 'Geplant',
  discarded: 'Verworfen',
};
</script>

<template>
  <div class="card excursion-card">
    <div class="image" :style="excursion.image_url ? { backgroundImage: `url(${excursion.image_url})` } : {}">
      <span v-if="!excursion.image_url" class="placeholder">🏞️</span>
      <EditButton floating @click="emit('edit', excursion)" />
      <span class="status" :class="excursion.status">{{ STATUS_LABELS[excursion.status] }}</span>
    </div>
    <div class="body">
      <h3>{{ excursion.title }}</h3>
      <p v-if="suggestedByLabel" class="suggested-by">💡 Vorgeschlagen von {{ suggestedByLabel }}</p>
      <p v-if="excursion.note">{{ excursion.note }}</p>
      <a v-if="excursion.link" :href="excursion.link" target="_blank" rel="noopener">Link öffnen ↗</a>
      <a v-if="excursion.maps_link" :href="excursion.maps_link" target="_blank" rel="noopener" class="external-link-btn"
        >📍 Extern öffnen ↗</a
      >
      <router-link
        v-if="excursion.lat != null && excursion.lng != null"
        :to="{ path: '/map', query: { focus: `excursion-${excursion.id}` } }"
        class="schedule-hint"
      >
        🗺️ Auf Karte anzeigen
      </router-link>
      <router-link v-if="excursion.status === 'planned'" to="/schedule" class="schedule-hint">
        📅 Im Kalender einplanen
      </router-link>
      <div class="actions">
        <div class="status-buttons">
          <button
            type="button"
            class="secondary status-btn"
            :class="{ active: excursion.status === 'idea' }"
            title="Als Idee markieren"
            @click="emit('set-status', excursion, 'idea')"
          >
            💡
          </button>
          <button
            type="button"
            class="secondary status-btn"
            :class="{ active: excursion.status === 'planned' }"
            title="Als geplant markieren"
            @click="emit('set-status', excursion, 'planned')"
          >
            ✅
          </button>
          <button
            type="button"
            class="secondary status-btn"
            :class="{ active: excursion.status === 'discarded' }"
            title="Als verworfen markieren"
            @click="emit('set-status', excursion, 'discarded')"
          >
            ❌
          </button>
        </div>
        <DeleteButton small @click="emit('remove', excursion.id)" />
      </div>
      <div class="social-row">
        <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
        <button class="secondary" @click="showComments = !showComments">💬 {{ comments.length || '' }}</button>
      </div>
      <Comments
        v-if="showComments"
        :comments="comments"
        @submit="(content) => emit('submit-comment', content)"
        @remove="(id) => emit('remove-comment', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.excursion-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.image {
  height: 160px;
  background: var(--color-primary-tint) center/cover no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.placeholder {
  font-size: 2.5rem;
}

.status {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.9);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.status.planned {
  color: var(--color-success);
}

.status.discarded {
  color: var(--color-danger);
}

.body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.body h3 {
  font-size: 1rem;
  margin-bottom: 0;
}

.suggested-by {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.status-buttons {
  display: flex;
  gap: 4px;
}

.status-btn {
  padding: 4px 8px;
  font-size: 0.9rem;
  line-height: 1;
  opacity: 0.45;
}

.status-btn.active {
  opacity: 1;
  border-color: var(--color-primary);
  background: var(--color-primary-tint);
}

.social-row {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.schedule-hint {
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}

.external-link-btn {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: rgba(42, 127, 116, 0.08);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
  color: var(--color-primary);
}

.external-link-btn:hover {
  background: var(--color-primary-tint);
}
</style>

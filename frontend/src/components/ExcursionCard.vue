<script setup lang="ts">
import type { Excursion } from '../api/types';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';

defineProps<{ excursion: Excursion }>();
const emit = defineEmits<{
  (e: 'set-status', excursion: Excursion, status: Excursion['status']): void;
  (e: 'remove', id: number): void;
  (e: 'edit', excursion: Excursion): void;
}>();

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
      <p v-if="excursion.note">{{ excursion.note }}</p>
      <a v-if="excursion.link" :href="excursion.link" target="_blank" rel="noopener">Link öffnen ↗</a>
      <a v-if="excursion.maps_link" :href="excursion.maps_link" target="_blank" rel="noopener">📍 Extern öffnen ↗</a>
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
  background: #eaf3f1 center/cover no-repeat;
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
  background: #eaf3f1;
}

.schedule-hint {
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}
</style>

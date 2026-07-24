<script setup lang="ts">
import type { Idea } from '../api/types';

defineProps<{ idea: Idea }>();
const emit = defineEmits<{
  (e: 'toggle-status', idea: Idea): void;
  (e: 'remove', id: number): void;
}>();
</script>

<template>
  <div class="card idea-card">
    <div class="image" :style="idea.image_url ? { backgroundImage: `url(${idea.image_url})` } : {}">
      <span v-if="!idea.image_url" class="placeholder">🏞️</span>
      <span class="status" :class="idea.status">{{ idea.status === 'planned' ? 'Geplant' : 'Idee' }}</span>
    </div>
    <div class="body">
      <h3>{{ idea.title }}</h3>
      <p v-if="idea.note">{{ idea.note }}</p>
      <a v-if="idea.link" :href="idea.link" target="_blank" rel="noopener">Link öffnen ↗</a>
      <div class="actions">
        <button class="secondary" @click="emit('toggle-status', idea)">
          {{ idea.status === 'planned' ? 'Als Idee markieren' : 'Als geplant markieren' }}
        </button>
        <button class="secondary" @click="emit('remove', idea.id)">Löschen</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.idea-card {
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
  gap: var(--space-2);
  margin-top: var(--space-2);
  flex-wrap: wrap;
}

.actions button {
  font-size: 0.8rem;
  padding: 6px 10px;
}
</style>

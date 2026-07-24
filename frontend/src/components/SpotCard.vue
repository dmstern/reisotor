<script setup lang="ts">
import type { Spot } from '../api/types';

defineProps<{ spot: Spot }>();
const emit = defineEmits<{ (e: 'remove', id: number): void }>();
</script>

<template>
  <div class="card spot-card">
    <div class="head">
      <h3>{{ spot.name }}</h3>
      <span v-if="spot.category" class="category">{{ spot.category }}</span>
    </div>
    <p v-if="spot.note">{{ spot.note }}</p>
    <a v-if="spot.link" :href="spot.link" target="_blank" rel="noopener">Auf Karte öffnen ↗</a>
    <p v-if="spot.lat && spot.lng" class="coords">{{ spot.lat.toFixed(5) }}, {{ spot.lng.toFixed(5) }}</p>
    <button class="secondary" @click="emit('remove', spot.id)">Löschen</button>
  </div>
</template>

<style scoped>
.spot-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.head h3 {
  margin: 0;
  font-size: 1rem;
}

.category {
  background: #eaf3f1;
  color: var(--color-primary-dark);
  font-size: 0.75rem;
  padding: 2px 10px;
  border-radius: 999px;
  font-weight: 600;
}

.coords {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

button {
  align-self: flex-start;
  font-size: 0.8rem;
  padding: 6px 10px;
  margin-top: var(--space-1);
}
</style>

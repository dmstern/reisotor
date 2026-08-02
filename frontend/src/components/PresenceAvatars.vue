<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useLiveSyncStore } from '../stores/liveSync';

// Zeigt (ähnlich Google Docs) die Avatare der anderen Mitglieder, die gerade in der App online sind
// (siehe stores/liveSync.ts's onlineUserIds, aus den SSE-Präsenz-Events des aktuellen Urlaubs).
// Eigener kleiner /users-Fetch statt eines geteilten Stores – dieselbe Liste wird bereits in fast
// jeder View unabhängig geladen (kein zentraler Users-Store in dieser App), hier reicht das genauso.
const liveSync = useLiveSyncStore();
const users = ref<User[]>([]);

onMounted(async () => {
  users.value = await api.get<User[]>('/users');
});

const allOnlineUsers = computed(() =>
  liveSync.onlineUserIds.map((id) => users.value.find((u) => u.id === id)).filter((u): u is User => !!u),
);
// Auf schmalen Bildschirmen ist im Header wenig Platz (siehe .wordmark, die dort schon ausgeblendet
// wird) – höchstens 3 Avatare direkt zeigen, der Rest kompakt als "+N"-Kreis statt den Header
// beliebig in die Breite wachsen zu lassen.
const MAX_VISIBLE = 3;
const visibleUsers = computed(() => allOnlineUsers.value.slice(0, MAX_VISIBLE));
const overflowCount = computed(() => Math.max(0, allOnlineUsers.value.length - MAX_VISIBLE));
</script>

<template>
  <div v-if="allOnlineUsers.length" class="presence-avatars">
    <span
      v-for="user in visibleUsers"
      :key="user.id"
      class="presence-avatar"
      :title="`${user.username} ist gerade online`"
    >
      {{ user.avatar }}
    </span>
    <span v-if="overflowCount > 0" class="presence-avatar overflow" :title="`${overflowCount} weitere online`">
      +{{ overflowCount }}
    </span>
  </div>
</template>

<style scoped>
.presence-avatars {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.presence-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-primary-tint);
  font-size: 1.05rem;
  line-height: 1;
  border: 2px solid var(--color-surface);
  /* Leicht überlappend wie bei Google Docs, statt einzeln nebeneinander zu stehen. */
  margin-left: -10px;
}

.presence-avatar:first-child {
  margin-left: 0;
}

.presence-avatar.overflow {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
}
</style>

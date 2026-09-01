<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useLiveSyncStore } from '../stores/liveSync';

// Zeigt (ähnlich Google Docs) gestapelt überlappende Avatare ALLER Mitreisenden dieses Urlaubs
// (nicht nur online) - ausgegraut bei offline, mit grünem Punkt bei online (siehe
// stores/liveSync.ts's onlineUserIds, aus den SSE-Präsenz-Events des aktuellen Urlaubs, filtert
// bereits die eigene Person heraus). Trip-Mitglieder statt der globalen /users-Liste (anders als
// z. B. TodoView.vue's Bearbeiter:innen-Auswahl), da hier ausdrücklich nur Personen gezeigt werden
// sollen, die tatsächlich Zugriff auf diesen Urlaub haben.
const tripStore = useTripStore();
const auth = useAuthStore();
const liveSync = useLiveSyncStore();
const members = ref<User[]>([]);

onMounted(async () => {
  const tripId = tripStore.currentTripId;
  if (tripId == null) return;
  members.value = await api.get<User[]>(`/trips/${tripId}/members`);
});

const otherMembers = computed(() => members.value.filter((u) => u.id !== auth.user?.id));

function isOnline(user: User) {
  return liveSync.onlineUserIds.includes(user.id);
}

// Auf schmalen Bildschirmen ist im Header wenig Platz (siehe .wordmark, die dort schon ausgeblendet
// wird) – höchstens 4 Avatare direkt zeigen, der Rest kompakt als "+N"-Kreis statt den Header
// beliebig in die Breite wachsen zu lassen. Etwas großzügiger als die bisherigen 3, da jetzt auch
// offline Mitglieder mitzählen und dauerhaft (nicht nur bei zufälliger Online-Anwesenheit) sichtbar
// sein sollen.
const MAX_VISIBLE = 4;
const visibleMembers = computed(() => otherMembers.value.slice(0, MAX_VISIBLE));
const overflowCount = computed(() => Math.max(0, otherMembers.value.length - MAX_VISIBLE));
</script>

<template>
  <div v-if="otherMembers.length" class="presence-avatars">
    <span
      v-for="user in visibleMembers"
      :key="user.id"
      class="presence-avatar"
      :class="{ offline: !isOnline(user), online: isOnline(user) }"
      :title="`${user.username} ist gerade ${isOnline(user) ? 'online' : 'offline'}`"
    >
      {{ user.avatar }}
    </span>
    <span
      v-if="overflowCount > 0"
      class="presence-avatar overflow"
      :title="`${overflowCount} weitere Mitreisende`"
    >
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
  position: relative;
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
  transition:
    opacity 0.15s ease,
    filter 0.15s ease;
}

.presence-avatar:first-child {
  margin-left: 0;
}

.presence-avatar.online {
  border: 2px solid color-mix(in srgb, var(--color-success) 50%, transparent);
}

.presence-avatar.offline {
  filter: grayscale(1);
  opacity: 0.5;
}

.presence-avatar.overflow {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
}
</style>

import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '../api/client';
import type { NotificationItem } from '../api/types';
import { useTripStore } from './trip';
import { useLiveSyncStore } from './liveSync';

// Notification-Inbox (#97): dünner Client über GET/POST /notifications (routes/notifications.ts),
// das seinerseits nur das bereits bestehende trip_activity-Log liest/annotiert (siehe activity.ts).
// Lädt neu bei Urlaubswechsel und bei jeder fremden Aktivität (liveSync.ts's notificationVersion) -
// kein eigener SSE-Konsument, der Server bleibt für den read-Zustand ohnehin die einzige
// Quelle der Wahrheit.
export const useNotificationsStore = defineStore('notifications', () => {
  const tripStore = useTripStore();
  const liveSync = useLiveSyncStore();

  const items = shallowRef<NotificationItem[]>([]);
  const loaded = ref(false);
  const unreadCount = computed(() => items.value.filter((n) => !n.read).length);

  async function load() {
    const tripId = tripStore.currentTripId;
    if (tripId == null) {
      items.value = [];
      loaded.value = true;
      return;
    }
    try {
      items.value = await api.get<NotificationItem[]>(`/notifications?trip_id=${tripId}`);
    } catch {
      // Best effort - ein fehlgeschlagenes Nachladen soll die restliche App nicht blockieren, die
      // Glocke zeigt dann einfach weiter den zuletzt bekannten Stand.
    } finally {
      loaded.value = true;
    }
  }

  watch(() => tripStore.currentTripId, load, { immediate: true });
  watch(() => liveSync.notificationVersion, load);

  /** Von NotificationInbox.vue beim Klick auf einen Eintrag aufgerufen - optimistisch lokal
   *  markieren (Badge/Highlight verschwinden sofort), Server-Aufruf best effort im Hintergrund. */
  async function markRead(id: number) {
    const idx = items.value.findIndex((n) => n.id === id);
    if (idx === -1 || items.value[idx].read) return;
    const next = [...items.value];
    next[idx] = { ...next[idx], read: true };
    items.value = next;
    try {
      await api.post(`/notifications/${id}/read`);
    } catch {
      // Nächstes load() (Urlaubswechsel/neue Aktivität) korrigiert den Stand notfalls wieder.
    }
  }

  async function markAllRead() {
    const tripId = tripStore.currentTripId;
    if (tripId == null) return;
    items.value = items.value.map((item) => (item.read ? item : { ...item, read: true }));
    try {
      await api.post('/notifications/read-all', { trip_id: tripId });
    } catch {
      // siehe markRead()
    }
  }

  return { items, loaded, unreadCount, load, markRead, markAllRead };
});

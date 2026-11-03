import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from './auth';

export const useAdminMessagesStore = defineStore('adminMessages', () => {
  const auth = useAuthStore();
  const unreadCount = ref(0);
  const loaded = ref(false);

  async function loadUnreadCount() {
    if (!auth.isAdmin) {
      unreadCount.value = 0;
      loaded.value = true;
      return;
    }
    try {
      const res = await api.get<{ unreadCount: number }>('/admin/messages');
      unreadCount.value = typeof res.unreadCount === 'number' ? res.unreadCount : 0;
    } catch {
      // Best effort - im Fehlerfall bisherigen Stand behalten
    } finally {
      loaded.value = true;
    }
  }

  function setUnreadCount(count: number) {
    unreadCount.value = Math.max(0, count);
  }

  // Sobald Admin-Status vorliegt, Zähler initial laden
  watch(
    () => auth.isAdmin,
    (isAdmin) => {
      if (isAdmin) {
        loadUnreadCount();
      } else {
        unreadCount.value = 0;
      }
    },
    { immediate: true }
  );

  return {
    unreadCount,
    loaded,
    loadUnreadCount,
    setUnreadCount,
  };
});

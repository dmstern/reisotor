import { defineStore } from 'pinia';
import { onMounted, onUnmounted, ref } from 'vue';
import { fetchWithTimeout, rawRequest } from '../api/client';
import { flushOutbox, getOutboxLength } from '../api/offline';
import { useLiveSyncStore } from './liveSync';

const HEALTH_CHECK_MS = 15_000;

async function sendRaw(method: string, path: string, body: unknown) {
  return rawRequest(path, { method, body: body ? JSON.stringify(body) : undefined });
}

// Offline-Anzeige + Outbox-Sync (siehe api/offline.ts, api/client.ts): navigator.onLine allein ist
// unzuverlässig (z. B. WLAN ohne echten Internetzugang meldet trotzdem "online"), daher zusätzlich
// ein periodischer echter Health-Check gegen das Backend, solange wir (vermeintlich) offline sind
// oder noch etwas in der Outbox liegt.
export const useConnectivityStore = defineStore('connectivity', () => {
  const isOnline = ref(navigator.onLine);
  const pendingCount = ref(getOutboxLength());
  const syncing = ref(false);

  async function trySync() {
    if (syncing.value || pendingCount.value === 0) return;
    syncing.value = true;
    try {
      const drained = await flushOutbox(sendRaw);
      pendingCount.value = getOutboxLength();
      if (drained) useLiveSyncStore().refreshAll();
    } finally {
      syncing.value = false;
    }
  }

  function handleOnline() {
    isOnline.value = true;
    trySync();
  }
  function handleOffline() {
    isOnline.value = false;
  }

  let healthCheck: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    healthCheck = setInterval(() => {
      // Bewusst OHNE "if (isOnline.value && pendingCount.value === 0) return"-Kurzschluss: genau
      // der Fall "isOnline fälschlich true" (z. B. WLAN verbunden, aber kein echter Internetzugang
      // mehr dahinter) ist der, den dieser Check laut Kommentar oben eigentlich auffangen soll - ein
      // Guard, der ausgerechnet dann übersprang, hätte die eigene Existenzberechtigung untergraben.
      fetchWithTimeout('/api/auth/me', { credentials: 'include' })
        .then(() => {
          if (!isOnline.value) isOnline.value = true;
          trySync();
        })
        .catch(() => {
          isOnline.value = false;
        });
    }, HEALTH_CHECK_MS);
    // Direkt beim Start versuchen, falls schon Einträge aus einer vorherigen Sitzung offen sind.
    trySync();
  });

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (healthCheck != null) clearInterval(healthCheck);
  });

  return { isOnline, pendingCount, syncing, trySync };
});

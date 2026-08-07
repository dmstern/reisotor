import { defineStore } from 'pinia';
import { onMounted, onUnmounted, ref } from 'vue';
import { fetchWithTimeout, rawRequest } from '../api/client';
import { flushOutbox, getOutboxLength, setConfirmedOffline } from '../api/offline';
import { useLiveSyncStore } from './liveSync';

// Absichtlich niedrig gehalten (statt z. B. 15-30s): api/client.ts's isConfirmedOffline()-Flag
// bleibt so lange auf "offline" stehen, bis HIER ein Check wieder erfolgreich war - ein zu großes
// Intervall würde die App also unnötig lange in einem "eigentlich schon wieder online, merkt es aber
// noch nicht"-Zustand lassen (genau der vom Nutzer gemeldete Fall). Ein leichter GET gegen
// /api/auth/me alle 6s ist für eine so kleine App vernachlässigbar teuer - der manuelle Retry-Button
// im Header (OfflineIndicator.vue) deckt den Rest ab, wenn selbst das noch zu träge wäre.
const HEALTH_CHECK_MS = 6_000;

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
  // Verhindert überlappende manuelle/periodische Checks (z. B. Nutzerin klickt mehrfach schnell auf
  // das Offline-Symbol) - ohne das würden mehrere fetchWithTimeout()-Aufrufe parallel laufen, ohne
  // echten Zusatznutzen.
  const checking = ref(false);

  // Einzige Stelle, die isOnline setzt - hält die reaktive UI-Sicht (isOnline, für
  // OfflineIndicator.vue) und api/client.ts's synchrones Modul-Flag (isConfirmedOffline(), siehe
  // dortiger Kommentar) zwangsläufig im selben Zustand, statt beides an mehreren Stellen einzeln
  // pflegen zu müssen und irgendwann auseinanderlaufen zu lassen.
  function setOnline(value: boolean) {
    isOnline.value = value;
    setConfirmedOffline(!value);
  }

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

  /** Echter Erreichbarkeits-Check gegen den Server - von drei Stellen genutzt: dem periodischen
   *  Intervall unten, dem 'online'-Browser-Event (das allein NICHT vertrauenswürdig genug ist, siehe
   *  Kommentar oben) und einem manuellen Retry-Klick (OfflineIndicator.vue). Schaltet erst bei
   *  tatsächlichem Erfolg zurück auf online, nie nur optimistisch. */
  async function checkNow() {
    if (checking.value) return;
    checking.value = true;
    try {
      await fetchWithTimeout('/api/auth/me', { credentials: 'include' });
      setOnline(true);
      trySync();
    } catch {
      setOnline(false);
    } finally {
      checking.value = false;
    }
  }

  function handleOnline() {
    // Bewusst nicht optimistisch isOnline=true setzen - das 'online'-Event feuert schon, sobald ein
    // Netzinterface wieder da ist, garantiert aber keinen echten Internetzugang (der genaue vom
    // Nutzer gemeldete Fall). checkNow() bestätigt das erst wirklich.
    checkNow();
  }
  function handleOffline() {
    // Das 'offline'-Event ist im Unterschied zu 'online' zuverlässig (der Browser weiß hier
    // tatsächlich, dass kein Netzinterface mehr aktiv ist) - hier reicht sofortiges Umschalten ohne
    // eigenen Serverzugriff.
    setOnline(false);
  }

  let healthCheck: ReturnType<typeof setInterval> | null = null;

  onMounted(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    healthCheck = setInterval(checkNow, HEALTH_CHECK_MS);
    // Direkt beim Start prüfen statt HEALTH_CHECK_MS zu warten - z. B. falls der zuletzt gespeicherte
    // Zustand veraltet ist oder noch Einträge aus einer vorherigen Sitzung in der Outbox liegen.
    checkNow();
  });

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    if (healthCheck != null) clearInterval(healthCheck);
  });

  return { isOnline, pendingCount, syncing, checking, trySync, checkNow };
});

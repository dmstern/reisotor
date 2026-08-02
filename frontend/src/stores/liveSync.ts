import { defineStore } from 'pinia';
import { reactive, ref, watch } from 'vue';
import { api } from '../api/client';
import { useTripStore } from './trip';
import { useAuthStore } from './auth';

// Domänen-Schlüssel folgen den Nav-Items (NavBar.vue) bzw. den zugehörigen Backend-Routen –
// dieselben Schlüssel wie backend/src/activity.ts's recordActivity()-Aufrufe. 'members' (Einladen/
// Entfernen) hat bewusst kein eigenes Nav-Item/keinen Badge, wird hier daher nicht geführt.
export const LIVE_DOMAINS = [
  'schedule',
  'packing',
  'shopping',
  'todos',
  'spots',
  'ideas',
  'travel',
  'accommodation',
  'budget',
  'diary',
  'notes',
] as const;
export type LiveDomain = (typeof LIVE_DOMAINS)[number];

function isLiveDomain(domain: string): domain is LiveDomain {
  return (LIVE_DOMAINS as readonly string[]).includes(domain);
}

interface ActivityRow {
  id: number;
  trip_id: number;
  domain: string;
  entity_id: number | null;
  action: string;
  actor_user_id: number;
  created_at: string;
}

const SEEN_KEY_PREFIX = 'reisotor-live-seen';

function seenKey(tripId: number, domain: LiveDomain) {
  return `${SEEN_KEY_PREFIX}:${tripId}:${domain}`;
}

function loadSeenAt(tripId: number, domain: LiveDomain): string {
  return localStorage.getItem(seenKey(tripId, domain)) ?? new Date(0).toISOString();
}

function emptySets(): Record<LiveDomain, Set<number>> {
  return Object.fromEntries(LIVE_DOMAINS.map((d) => [d, new Set<number>()])) as Record<LiveDomain, Set<number>>;
}

// Echtzeit-Sync zwischen Mitgliedern desselben Urlaubs (siehe CLAUDE.md-Auftrag): ein EventSource
// pro aktuell ausgewähltem Urlaub, verbindet sich neu bei Urlaubswechsel. Zwei Konsumenten:
// 1. domainVersion (Zähler, Präzedenzfall drawers.ts's locationsVersion) – Views watch()en ihre
//    Domäne und laden bei jeder Erhöhung neu, unabhängig davon, wer die Änderung ausgelöst hat.
// 2. unseenEntityIds – nur von ANDEREN Mitgliedern geänderte Objekt-ids seit dem letzten Besuch der
//    jeweiligen Ansicht (treibt den roten Nav-Punkt). Jede Domänen-Ansicht ruft beim Mounten
//    markSeen(domain) auf: das leert den Satz (Punkt verschwindet) und liefert die bis dahin
//    unseen-ids zurück, die die Ansicht als "neu" hervorheben kann.
export const useLiveSyncStore = defineStore('liveSync', () => {
  const tripStore = useTripStore();
  const auth = useAuthStore();

  const domainVersion = reactive<Record<LiveDomain, number>>(
    Object.fromEntries(LIVE_DOMAINS.map((d) => [d, 0])) as Record<LiveDomain, number>,
  );
  const unseenEntityIds = reactive<Record<LiveDomain, Set<number>>>(emptySets());
  const onlineUserIds = ref<number[]>([]);

  let source: EventSource | null = null;

  function closeStream() {
    source?.close();
    source = null;
    onlineUserIds.value = [];
  }

  function applyActivityRow(row: ActivityRow) {
    if (!isLiveDomain(row.domain)) return;
    // Nur auf ANDERE Mitglieder reagieren: die eigene Session kennt den neuen Stand bereits aus
    // ihrer eigenen optimistischen Aktualisierung (items.value.push(created) o. Ä.) – ein erzwungener
    // Refetch der eigenen Aktion würde dort nur unnötig re-rendern und käme dabei transientem
    // lokalem UI-Zustand in die Quere (z. B. dem 60s-Undo-Platzhalter direkt nach dem eigenen
    // Löschen, siehe useUndoableDelete.ts – ein sofortiger Refetch überschreibt dessen lokale Liste,
    // bevor der Platzhalter je sichtbar wird).
    if (row.actor_user_id === auth.user?.id) return;
    domainVersion[row.domain]++;
    if (row.entity_id != null) unseenEntityIds[row.domain].add(row.entity_id);
  }

  // Holt nach, was passiert ist, während kein Stream offen war (frischer Seitenaufruf, Tab war
  // geschlossen, kurzer Verbindungsabbruch) – ohne das wären Nav-Punkte nach einem Reload immer leer.
  async function backfill(tripId: number) {
    const oldestSeen = LIVE_DOMAINS.map((d) => loadSeenAt(tripId, d)).sort()[0];
    let rows: ActivityRow[] = [];
    try {
      rows = await api.get<ActivityRow[]>(`/trip-activity?trip_id=${tripId}&since=${encodeURIComponent(oldestSeen)}`);
    } catch {
      return;
    }
    for (const row of rows) {
      if (!isLiveDomain(row.domain)) continue;
      if (row.actor_user_id === auth.user?.id) continue;
      if (row.entity_id == null) continue;
      if (row.created_at <= loadSeenAt(tripId, row.domain)) continue;
      unseenEntityIds[row.domain].add(row.entity_id);
    }
  }

  function openStream(tripId: number) {
    closeStream();
    source = new EventSource(`/api/realtime/stream?trip_id=${tripId}`, { withCredentials: true });
    source.addEventListener('activity', (event) => {
      try {
        applyActivityRow(JSON.parse((event as MessageEvent).data));
      } catch {
        // Ignoriere unparsebare Events statt die Verbindung abzubrechen.
      }
    });
    source.addEventListener('presence', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { online: number[] };
        onlineUserIds.value = data.online.filter((id) => id !== auth.user?.id);
      } catch {
        // ignore
      }
    });
  }

  watch(
    () => tripStore.currentTripId,
    (tripId) => {
      for (const domain of LIVE_DOMAINS) unseenEntityIds[domain].clear();
      if (tripId == null) {
        closeStream();
        return;
      }
      openStream(tripId);
      backfill(tripId);
    },
    { immediate: true },
  );

  function hasUnseen(domain: LiveDomain): boolean {
    return unseenEntityIds[domain].size > 0;
  }

  /** Von stores/connectivity.ts nach erfolgreichem Leeren der Offline-Outbox aufgerufen: erzwingt
   *  einen Refetch aller Domänen, damit lokal (optimistisch, mit Platzhalter-ids) angelegte/
   *  geänderte Objekte durch den echten, autoritativen Serverstand ersetzt werden – auch relevant,
   *  falls andere Mitglieder währenddessen ebenfalls etwas geändert haben. */
  function refreshAll() {
    for (const domain of LIVE_DOMAINS) domainVersion[domain]++;
  }

  /** Von jeder Domänen-Ansicht beim Mounten (bzw. beim Öffnen der Kalender-/Touren-Schublade auf
   *  Desktop, siehe ScheduleView.vue/ExcursionsDrawer.vue) aufzurufen: liefert die seit dem letzten
   *  Besuch von ANDEREN geänderten ids (für eine "neu"-Hervorhebung) und markiert die Domäne für
   *  diesen Urlaub als jetzt gesehen (Nav-Punkt verschwindet, Zeitstempel wird persistiert). */
  function markSeen(domain: LiveDomain): Set<number> {
    const changedIds = new Set(unseenEntityIds[domain]);
    unseenEntityIds[domain].clear();
    const tripId = tripStore.currentTripId;
    if (tripId != null) {
      localStorage.setItem(seenKey(tripId, domain), new Date().toISOString());
    }
    return changedIds;
  }

  return { domainVersion, onlineUserIds, hasUnseen, markSeen, refreshAll };
});

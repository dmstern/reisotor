import { getOutbox, updateOutboxEntry, type OutboxEntry } from '../api/offline';

export const LOCAL_DATA_VERSION_KEY = 'reisotor_local_data_version';
export const CURRENT_LOCAL_DATA_VERSION = 2;
const CACHE_PREFIX = 'reisotor-cache:';

export interface MigrationReport {
  versionChanged: boolean;
  fromVersion: number;
  toVersion: number;
  migratedEntriesCount: number;
  cachePurgedCount: number;
  details: string[];
}

/**
 * Validiert und repariert einen einzelnen Outbox-Eintrag:
 * - Parst versehentlich als String gespeicherte JSON-Bodies
 * - Stellt sicher, dass POST-Einträge eine negative tempId besitzen
 * - Normalisiert Pfade (entfernt doppelte Slashes oder fälschliche /api-Präfixe)
 * - Behebt bekannte Schema-Inkompatibilitäten (z. B. Budget-Beträge/Strings, Todos done-Status, Diary Datumsfelder)
 */
export function migrateOutboxEntry(entry: OutboxEntry): { changed: boolean; reason?: string } {
  let changed = false;
  const reasons: string[] = [];

  // 1. Body Parsing falls versehentlich als JSON-String abgelegt
  if (typeof entry.body === 'string') {
    try {
      entry.body = JSON.parse(entry.body);
      changed = true;
      reasons.push('Body von JSON-String in Objekt konvertiert');
    } catch {
      // Wenn es kein valides JSON ist, belassen
    }
  }

  // 2. Pfad-Normalisierung
  if (entry.path.startsWith('/api/')) {
    entry.path = entry.path.slice(4);
    changed = true;
    reasons.push('Überflüssiges /api-Präfix im Pfad entfernt');
  }
  if (entry.path.includes('//')) {
    entry.path = entry.path.replace(/\/+/g, '/');
    changed = true;
    reasons.push('Doppelte Slashes im Pfad normalisiert');
  }

  // 3. tempId bei POST sicherstellen
  if (entry.method === 'POST' && (entry.tempId == null || entry.tempId >= 0)) {
    entry.tempId = -Date.now() - Math.floor(Math.random() * 1000);
    changed = true;
    reasons.push('Fehlende oder ungültige tempId ergänzt');
  }

  // 4. Domänenspezifische Anpassungen
  if (entry.body && typeof entry.body === 'object') {
    const body = entry.body as Record<string, unknown>;

    // Budget: Betrag als Zahl sicherstellen, category trimmen
    if (entry.path.startsWith('/budget')) {
      if (typeof body.amount === 'string') {
        const num = Number(body.amount);
        if (!isNaN(num)) {
          body.amount = num;
          changed = true;
          reasons.push('Budget-Betrag von String zu Zahl konvertiert');
        }
      }
      if (typeof body.category === 'string' && body.category !== body.category.trim()) {
        body.category = body.category.trim();
        changed = true;
        reasons.push('Budget-Kategorie getrimmt');
      }
      if (typeof body.paid_by_user_id === 'string') {
        const uid = Number(body.paid_by_user_id);
        if (!isNaN(uid)) {
          body.paid_by_user_id = uid;
          changed = true;
          reasons.push('paid_by_user_id zu Zahl konvertiert');
        }
      }
    }

    // Todos: done als boolean sicherstellen, name zu title
    if (entry.path.startsWith('/todos')) {
      if (typeof body.done === 'number') {
        body.done = body.done === 1;
        changed = true;
        reasons.push('Todo done von Zahl zu Boolean konvertiert');
      }
      if (!body.title && typeof body.name === 'string') {
        body.title = body.name;
        changed = true;
        reasons.push('Todo name zu title migriert');
      }
    }

    // Spots: name zu title falls fehlend
    if (entry.path.startsWith('/spots')) {
      if (!body.title && typeof body.name === 'string') {
        body.title = body.name;
        changed = true;
        reasons.push('Spot name zu title migriert');
      }
    }

    // Diary: entry_date sicherstellen
    if (entry.path.startsWith('/diary')) {
      if (body.entry_date === null || body.entry_date === undefined) {
        body.entry_date = new Date().toISOString().split('T')[0];
        changed = true;
        reasons.push('Fehlendes entry_date im Tagebuch mit aktuellem Datum ergänzt');
      }
    }
  }

  return { changed, reason: reasons.join(', ') };
}

/**
 * Bereinigt alte GET-Caches aus localStorage, wenn sich das Schema geändert hat.
 * Die Outbox (reisotor-outbox) bleibt dabei unberührt!
 */
export function purgeStaleCache(): number {
  if (typeof localStorage === 'undefined') return 0;
  let count = 0;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
    count++;
  }
  return count;
}

/**
 * Führt alle lokalen Datenmigrationen aus:
 * 1. Prüft und aktualisiert die Outbox-Einträge
 * 2. Aktualisiert die lokale Schema-Version
 * 3. Bereinigt bei Versionssprung alte GET-Caches
 */
export function migrateLocalData(): MigrationReport {
  let fromVersion = 1;
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(LOCAL_DATA_VERSION_KEY);
    if (stored) {
      fromVersion = parseInt(stored, 10) || 1;
    }
  }

  const entries = getOutbox();
  let migratedCount = 0;
  const details: string[] = [];

  for (const entry of entries) {
    const res = migrateOutboxEntry(entry);
    if (res.changed) {
      migratedCount++;
      details.push(`${entry.method} ${entry.path}: ${res.reason}`);
      updateOutboxEntry(entry.id, {
        path: entry.path,
        body: entry.body,
        method: entry.method,
      });
    }
  }

  let cachePurgedCount = 0;
  const versionChanged = fromVersion < CURRENT_LOCAL_DATA_VERSION;
  if (versionChanged) {
    cachePurgedCount = purgeStaleCache();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_DATA_VERSION_KEY, String(CURRENT_LOCAL_DATA_VERSION));
    }
  }

  // Veraltete, globale Vorbelegungs-Keys entfernen (werden jetzt pro tripId gespeichert)
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('reisotor-shopping-last-shop');
    localStorage.removeItem('reisotor-shopping-last-period');
    localStorage.removeItem('reisotor-todo-last-assignee');
  }

  return {
    versionChanged,
    fromVersion,
    toVersion: CURRENT_LOCAL_DATA_VERSION,
    migratedEntriesCount: migratedCount,
    cachePurgedCount,
    details,
  };
}

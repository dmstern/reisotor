import webpush from 'web-push';
import { db } from './db/index.js';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

// Push ist optional: ohne gesetzte VAPID_*-Env-Vars (siehe scripts/generate-vapid-keys.mjs)
// bleibt die App voll funktionsfähig, nur ohne Push-Benachrichtigungen (kein harter Fehler beim
// Start, z. B. für lokale Entwicklung ohne konfiguriertes Push).
const pushEnabled = !!(vapidPublicKey && vapidPrivateKey);
if (pushEnabled) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey!, vapidPrivateKey!);
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey ?? null;
}

interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface PushSubscriptionRow {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function saveSubscription(userId: number, sub: PushSubscriptionInput) {
  db.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
  ).run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date().toISOString());
}

export function removeSubscription(endpoint: string, userId: number) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, userId);
}

// Alle Domänen, für die Push-Präferenzen einstellbar sind: die 11 recordActivity()-Domänen plus
// die Abreise-Erinnerung (departureReminders.ts, kein recordActivity-Event, aber dieselbe
// Filterlogik über push_preferences).
export const PUSH_PREFERENCE_DOMAINS = [
  'schedule',
  'packing',
  'shopping',
  'todos',
  'spots',
  'ideas',
  'travel',
  'budget',
  'diary',
  'notes',
  'members',
  'departure',
] as const;
export type PushPreferenceDomain = (typeof PUSH_PREFERENCE_DOMAINS)[number];

interface PushPreferenceRow {
  domain: string;
  enabled: number;
}

/** Liefert die vollständige Präferenz-Map für alle bekannten Domänen - fehlende Zeilen (Domäne nie
 *  angefasst) werden als `true` aufgefüllt (siehe Kommentar an der Tabellendefinition in
 *  db/index.ts). */
export function getPushPreferences(userId: number): Record<PushPreferenceDomain, boolean> {
  const rows = db.prepare('SELECT domain, enabled FROM push_preferences WHERE user_id = ?').all(userId) as PushPreferenceRow[];
  const byDomain = new Map(rows.map((r) => [r.domain, !!r.enabled]));
  return Object.fromEntries(PUSH_PREFERENCE_DOMAINS.map((d) => [d, byDomain.get(d) ?? true])) as Record<
    PushPreferenceDomain,
    boolean
  >;
}

/** Upsert je übergebenem Domain-Key (Teil- oder Vollmenge von PUSH_PREFERENCE_DOMAINS). */
export function setPushPreferences(userId: number, prefs: Partial<Record<PushPreferenceDomain, boolean>>) {
  const stmt = db.prepare(
    `INSERT INTO push_preferences (user_id, domain, enabled) VALUES (?, ?, ?)
     ON CONFLICT(user_id, domain) DO UPDATE SET enabled = excluded.enabled`,
  );
  for (const [domain, enabled] of Object.entries(prefs)) {
    if (enabled === undefined) continue;
    stmt.run(userId, domain, enabled ? 1 : 0);
  }
}

// Exportiert (statt modul-privat wie ursprünglich), da routes/notifications.ts dieselben Labels für
// die Notification-Inbox (#97) braucht - eine einzige Übersetzungsstelle statt zweier
// auseinanderlaufender Kopien.
export const DOMAIN_LABEL: Record<string, string> = {
  schedule: 'Kalender',
  packing: 'Packliste',
  shopping: 'Einkaufsliste',
  todos: 'ToDos',
  spots: 'Spots',
  ideas: 'Touren',
  travel: 'Reise',
  budget: 'Budget',
  diary: 'Tagebuch',
  notes: 'Notizen',
  members: 'Mitglieder',
};

export const ACTION_LABEL: Record<string, string> = {
  created: 'etwas hinzugefügt',
  updated: 'etwas geändert',
  deleted: 'etwas gelöscht',
  restored: 'etwas wiederhergestellt',
  member_added: 'jemanden eingeladen',
  member_removed: 'jemanden entfernt',
  liked: 'etwas geliked',
  commented: 'einen Kommentar hinterlassen',
};

interface ActivityPushInfo {
  domain: string;
  action: string;
  tripName: string;
  actorUsername: string;
}

/** Gemeinsamer Versand-Kern für alle Push-Auslöser dieser Datei (Aktivitäts-Benachrichtigungen
 *  hier UND departureReminders.ts's Abreise-Erinnerungen): lädt die Abos aller Urlaub-Mitglieder
 *  (optional abzüglich einer ausschließenden user_id, z. B. der auslösenden Aktivitäts-Akteurin),
 *  gefiltert per LEFT JOIN auf push_preferences nach der jeweiligen Empfänger:in-Präferenz für
 *  `domain` (fehlende Zeile = aktiviert, siehe getPushPreferences()), und verschickt denselben
 *  JSON-Payload an jedes verbleibende Abo. Tote Abonnements (Browser hat die Berechtigung entzogen
 *  oder das Abo ist abgelaufen) räumt sich hier selbst auf, sonst würde jeder künftige Push an
 *  dasselbe tote Abo erneut fehlschlagen. Best-effort - wirft nie, ruft nie process.exit o. Ä. */
export async function sendPushToTripMembers(
  tripId: number,
  payload: Record<string, unknown>,
  domain: PushPreferenceDomain,
  excludeUserId?: number,
) {
  if (!pushEnabled) return;
  const subs = (
    excludeUserId != null
      ? db
          .prepare(
            `SELECT push_subscriptions.* FROM push_subscriptions
             JOIN trip_members ON trip_members.user_id = push_subscriptions.user_id
             LEFT JOIN push_preferences ON push_preferences.user_id = push_subscriptions.user_id
               AND push_preferences.domain = ?
             WHERE trip_members.trip_id = ? AND push_subscriptions.user_id != ?
               AND (push_preferences.enabled IS NULL OR push_preferences.enabled = 1)`,
          )
          .all(domain, tripId, excludeUserId)
      : db
          .prepare(
            `SELECT push_subscriptions.* FROM push_subscriptions
             JOIN trip_members ON trip_members.user_id = push_subscriptions.user_id
             LEFT JOIN push_preferences ON push_preferences.user_id = push_subscriptions.user_id
               AND push_preferences.domain = ?
             WHERE trip_members.trip_id = ?
               AND (push_preferences.enabled IS NULL OR push_preferences.enabled = 1)`,
          )
          .all(domain, tripId)
  ) as PushSubscriptionRow[];
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        }
      }
    }),
  );
}

/** Best-effort – wird von activity.ts's recordActivity() nach jeder Mutation angestoßen, blockiert
 *  die auslösende Route nie (siehe dortiger .catch()). */
export async function notifyTripMembers(tripId: number, excludeUserId: number, info: ActivityPushInfo) {
  const title = `${DOMAIN_LABEL[info.domain] ?? info.domain} · ${info.tripName}`;
  const body = `${info.actorUsername} hat ${ACTION_LABEL[info.action] ?? 'etwas geändert'}`;
  await sendPushToTripMembers(tripId, { title, body, tripId }, info.domain as PushPreferenceDomain, excludeUserId);
}

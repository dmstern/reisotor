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

const DOMAIN_LABEL: Record<string, string> = {
  schedule: 'Kalender',
  packing: 'Packliste',
  shopping: 'Einkaufsliste',
  todos: 'ToDos',
  spots: 'Spots',
  ideas: 'Touren',
  travel: 'Reise',
  accommodation: 'Unterkunft',
  budget: 'Budget',
  diary: 'Tagebuch',
  notes: 'Notizen',
  members: 'Mitglieder',
};

const ACTION_LABEL: Record<string, string> = {
  created: 'etwas hinzugefügt',
  updated: 'etwas geändert',
  deleted: 'etwas gelöscht',
  restored: 'etwas wiederhergestellt',
  member_added: 'jemanden eingeladen',
  member_removed: 'jemanden entfernt',
};

interface ActivityPushInfo {
  domain: string;
  action: string;
  tripName: string;
  actorUsername: string;
}

/** Best-effort – wird von activity.ts's recordActivity() nach jeder Mutation angestoßen, blockiert
 *  die auslösende Route nie (siehe dortiger .catch()). Tote Abonnements (Browser hat die Berechtigung
 *  entzogen oder das Abo ist abgelaufen) räumt sich hier selbst auf, sonst würde jeder künftige Push
 *  an dasselbe tote Abo erneut fehlschlagen. */
export async function notifyTripMembers(tripId: number, excludeUserId: number, info: ActivityPushInfo) {
  if (!pushEnabled) return;
  const subs = db
    .prepare(
      `SELECT push_subscriptions.* FROM push_subscriptions
       JOIN trip_members ON trip_members.user_id = push_subscriptions.user_id
       WHERE trip_members.trip_id = ? AND push_subscriptions.user_id != ?`,
    )
    .all(tripId, excludeUserId) as PushSubscriptionRow[];
  if (!subs.length) return;

  const title = `${DOMAIN_LABEL[info.domain] ?? info.domain} · ${info.tripName}`;
  const body = `${info.actorUsername} hat ${ACTION_LABEL[info.action] ?? 'etwas geändert'}`;
  const payload = JSON.stringify({ title, body, tripId });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        }
      }
    }),
  );
}

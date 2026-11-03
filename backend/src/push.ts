import webpush from 'web-push';
import { db } from './db/index.js';
import { getEffectiveSetting, getInstanceSetting, setInstanceSetting } from './instanceSettings.js';
import { readBuildInfo } from './routes/buildInfo.js';
import { isEmailConfigured, sendActivityEmail } from './utils/mailer.js';

export function ensureVapidConfigured(): boolean {
  const pub = getEffectiveSetting('vapid_public_key', 'VAPID_PUBLIC_KEY').trim();
  const priv = getEffectiveSetting('vapid_private_key', 'VAPID_PRIVATE_KEY').trim();
  const subject =
    getEffectiveSetting('vapid_subject', 'VAPID_SUBJECT', 'mailto:admin@example.com').trim() ||
    'mailto:admin@example.com';
  if (pub && priv) {
    try {
      webpush.setVapidDetails(subject, pub, priv);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Push ist optional: ohne gesetzte VAPID_*-Schlüssel bleibt die App voll funktionsfähig, nur ohne Push
ensureVapidConfigured();

export function getVapidPublicKey(): string | null {
  const pub = getEffectiveSetting('vapid_public_key', 'VAPID_PUBLIC_KEY').trim();
  return pub || null;
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
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  ).run(userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth, new Date().toISOString());
}

export function removeSubscription(endpoint: string, userId: number) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(
    endpoint,
    userId
  );
}

// Alle Domänen und Optionen, für die Push-Präferenzen einstellbar sind: die 11 recordActivity()-
// Domänen, die Abreise-Erinnerung (departureReminders.ts), Versions-Updates ('version')
// sowie der Aktivitäts-Umfang ('activity_updates': true = alle Änderungen, false = nur neue Elemente).
export const PUSH_PREFERENCE_DOMAINS = [
  'schedule',
  'packing',
  'shopping',
  'todos',
  'spots',
  'ideas',
  'budget',
  'diary',
  'notes',
  'members',
  'departure',
  'version',
  'activity_updates',
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
  const rows = db
    .prepare('SELECT domain, enabled FROM push_preferences WHERE user_id = ?')
    .all(userId) as PushPreferenceRow[];
  const byDomain = new Map(rows.map((r) => [r.domain, !!r.enabled]));
  return Object.fromEntries(
    PUSH_PREFERENCE_DOMAINS.map((d) => [d, byDomain.get(d) ?? true])
  ) as Record<PushPreferenceDomain, boolean>;
}

/** Upsert je übergebenem Domain-Key (Teil- oder Vollmenge von PUSH_PREFERENCE_DOMAINS). */
export function setPushPreferences(
  userId: number,
  prefs: Partial<Record<PushPreferenceDomain, boolean>>
) {
  const stmt = db.prepare(
    `INSERT INTO push_preferences (user_id, domain, enabled) VALUES (?, ?, ?)
     ON CONFLICT(user_id, domain) DO UPDATE SET enabled = excluded.enabled`
  );
  for (const [domain, enabled] of Object.entries(prefs)) {
    if (enabled === undefined) continue;
    stmt.run(userId, domain, enabled ? 1 : 0);
  }
}

/** Liefert die vollständige E-Mail-Präferenz-Map für alle bekannten Domänen.
 *  Fehlende Zeilen bedeuten `false` (Opt-in-Prinzip für E-Mails). */
export function getEmailPreferences(userId: number): Record<PushPreferenceDomain, boolean> {
  const rows = db
    .prepare('SELECT domain, enabled FROM email_preferences WHERE user_id = ?')
    .all(userId) as PushPreferenceRow[];
  const byDomain = new Map(rows.map((r) => [r.domain, !!r.enabled]));
  return Object.fromEntries(
    PUSH_PREFERENCE_DOMAINS.map((d) => [d, byDomain.get(d) ?? false])
  ) as Record<PushPreferenceDomain, boolean>;
}

/** Upsert je übergebenem Domain-Key für E-Mail-Präferenzen. */
export function setEmailPreferences(
  userId: number,
  prefs: Partial<Record<PushPreferenceDomain, boolean>>
) {
  const stmt = db.prepare(
    `INSERT INTO email_preferences (user_id, domain, enabled) VALUES (?, ?, ?)
     ON CONFLICT(user_id, domain) DO UPDATE SET enabled = excluded.enabled`
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
  version: 'Neue Versionen',
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

export const NEW_ELEMENT_ACTIONS = new Set([
  'created',
  'member_added',
  'attachment_added',
  'create_category',
]);

/** Gemeinsamer Versand-Kern für alle Urlaub-bezogenen Push-Auslöser dieser Datei
 *  (Aktivitäts-Benachrichtigungen hier UND departureReminders.ts's Abreise-Erinnerungen):
 *  lädt die Abos aller Urlaub-Mitglieder (optional abzüglich einer ausschließenden user_id,
 *  z. B. der auslösenden Aktivitäts-Akteurin), gefiltert per LEFT JOIN auf push_preferences
 *  nach der jeweiligen Empfänger:in-Präferenz für `domain` sowie bei Updates/Änderungen
 *  ('isUpdate = true') zusätzlich nach der 'activity_updates'-Präferenz (fehlende Zeile = aktiviert).
 *  Verschickt denselben JSON-Payload an jedes verbleibende Abo. Tote Abonnements räumt sich hier
 *  selbst auf. Best-effort - wirft nie, ruft nie process.exit o. Ä. */
export async function sendPushToTripMembers(
  tripId: number,
  payload: Record<string, unknown>,
  domain: PushPreferenceDomain,
  excludeUserId?: number,
  isUpdate = false
) {
  if (!ensureVapidConfigured()) return;
  const subs = (
    isUpdate
      ? excludeUserId != null
        ? db
            .prepare(
              `SELECT push_subscriptions.* FROM push_subscriptions
               JOIN trip_members ON trip_members.user_id = push_subscriptions.user_id
               LEFT JOIN push_preferences pref_domain ON pref_domain.user_id = push_subscriptions.user_id
                 AND pref_domain.domain = ?
               LEFT JOIN push_preferences pref_updates ON pref_updates.user_id = push_subscriptions.user_id
                 AND pref_updates.domain = 'activity_updates'
               WHERE trip_members.trip_id = ? AND push_subscriptions.user_id != ?
                 AND (pref_domain.enabled IS NULL OR pref_domain.enabled = 1)
                 AND (pref_updates.enabled IS NULL OR pref_updates.enabled = 1)`
            )
            .all(domain, tripId, excludeUserId)
        : db
            .prepare(
              `SELECT push_subscriptions.* FROM push_subscriptions
               JOIN trip_members ON trip_members.user_id = push_subscriptions.user_id
               LEFT JOIN push_preferences pref_domain ON pref_domain.user_id = push_subscriptions.user_id
                 AND pref_domain.domain = ?
               LEFT JOIN push_preferences pref_updates ON pref_updates.user_id = push_subscriptions.user_id
                 AND pref_updates.domain = 'activity_updates'
               WHERE trip_members.trip_id = ?
                 AND (pref_domain.enabled IS NULL OR pref_domain.enabled = 1)
                 AND (pref_updates.enabled IS NULL OR pref_updates.enabled = 1)`
            )
            .all(domain, tripId)
      : excludeUserId != null
        ? db
            .prepare(
              `SELECT push_subscriptions.* FROM push_subscriptions
               JOIN trip_members ON trip_members.user_id = push_subscriptions.user_id
               LEFT JOIN push_preferences pref_domain ON pref_domain.user_id = push_subscriptions.user_id
                 AND pref_domain.domain = ?
               WHERE trip_members.trip_id = ? AND push_subscriptions.user_id != ?
                 AND (pref_domain.enabled IS NULL OR pref_domain.enabled = 1)`
            )
            .all(domain, tripId, excludeUserId)
        : db
            .prepare(
              `SELECT push_subscriptions.* FROM push_subscriptions
               JOIN trip_members ON trip_members.user_id = push_subscriptions.user_id
               LEFT JOIN push_preferences pref_domain ON pref_domain.user_id = push_subscriptions.user_id
                 AND pref_domain.domain = ?
               WHERE trip_members.trip_id = ?
                 AND (pref_domain.enabled IS NULL OR pref_domain.enabled = 1)`
            )
            .all(domain, tripId)
  ) as PushSubscriptionRow[];
  if (!subs.length) return;
  if (!ensureVapidConfigured()) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        }
      }
    })
  );
}

/** Versendet eine Benachrichtigung an alle Push-Abonnenten, die eine gegebene Domäne (z. B. 'version')
 *  nicht abgewählt haben. */
export async function sendPushToAllSubscribers(
  payload: Record<string, unknown>,
  domain: PushPreferenceDomain
) {
  if (!ensureVapidConfigured()) return;
  const subs = db
    .prepare(
      `SELECT push_subscriptions.* FROM push_subscriptions
       LEFT JOIN push_preferences ON push_preferences.user_id = push_subscriptions.user_id
         AND push_preferences.domain = ?
       WHERE (push_preferences.enabled IS NULL OR push_preferences.enabled = 1)`
    )
    .all(domain) as PushSubscriptionRow[];
  if (!subs.length) return;
  if (!ensureVapidConfigured()) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        }
      }
    })
  );
}

/** Versendet eine Push-Benachrichtigung über ein neues App-Release an alle interessierten Nutzer:innen. */
export async function sendVersionNotification(version: string, detail?: string) {
  const payload = {
    title: `Reisotor · Version v${version}`,
    body: detail ?? 'Eine neue Version von Reisotor steht bereit!',
    url: '/settings?tab=about',
  };
  await sendPushToAllSubscribers(payload, 'version');
}

/** Prüft beim Server-Start, ob eine neue Version ausgerollt wurde, und benachrichtigt Abonnenten einmalig. */
export async function checkVersionNotification() {
  const info = readBuildInfo();
  if (!info.version) return;
  const currentVersion = info.version;
  const lastNotified = getInstanceSetting('last_notified_version');
  if (!lastNotified) {
    // Bei erstem Start keine Spam-Benachrichtigung für die bestehende Version
    setInstanceSetting('last_notified_version', currentVersion);
    return;
  }
  if (lastNotified !== currentVersion) {
    const detail = info.changelog?.notes?.[0];
    await sendVersionNotification(currentVersion, detail);
    setInstanceSetting('last_notified_version', currentVersion);
  }
}

/** Versendet Aktivitäts-E-Mails an Mitglieder des Urlaubs, die E-Mail-Benachrichtigungen für die
 *  entsprechende Domäne aktiviert haben (Opt-in, gefiltert nach email_preferences). */
export async function sendEmailToTripMembers(
  tripId: number,
  params: { title: string; body: string; tripId: number; tripName: string },
  domain: PushPreferenceDomain,
  excludeUserId?: number,
  isUpdate = false
) {
  if (!isEmailConfigured()) return;

  const users = (
    isUpdate
      ? excludeUserId != null
        ? db
            .prepare(
              `SELECT users.id, users.email, users.username FROM users
               JOIN trip_members ON trip_members.user_id = users.id
               JOIN email_preferences pref_domain ON pref_domain.user_id = users.id
                 AND pref_domain.domain = ? AND pref_domain.enabled = 1
               LEFT JOIN email_preferences pref_updates ON pref_updates.user_id = users.id
                 AND pref_updates.domain = 'activity_updates'
               WHERE trip_members.trip_id = ? AND users.id != ?
                 AND users.email IS NOT NULL AND users.email != ''
                 AND (pref_updates.enabled IS NULL OR pref_updates.enabled = 1)`
            )
            .all(domain, tripId, excludeUserId)
        : db
            .prepare(
              `SELECT users.id, users.email, users.username FROM users
               JOIN trip_members ON trip_members.user_id = users.id
               JOIN email_preferences pref_domain ON pref_domain.user_id = users.id
                 AND pref_domain.domain = ? AND pref_domain.enabled = 1
               LEFT JOIN email_preferences pref_updates ON pref_updates.user_id = users.id
                 AND pref_updates.domain = 'activity_updates'
               WHERE trip_members.trip_id = ?
                 AND users.email IS NOT NULL AND users.email != ''
                 AND (pref_updates.enabled IS NULL OR pref_updates.enabled = 1)`
            )
            .all(domain, tripId)
      : excludeUserId != null
        ? db
            .prepare(
              `SELECT users.id, users.email, users.username FROM users
               JOIN trip_members ON trip_members.user_id = users.id
               JOIN email_preferences pref_domain ON pref_domain.user_id = users.id
                 AND pref_domain.domain = ? AND pref_domain.enabled = 1
               WHERE trip_members.trip_id = ? AND users.id != ?
                 AND users.email IS NOT NULL AND users.email != ''`
            )
            .all(domain, tripId, excludeUserId)
        : db
            .prepare(
              `SELECT users.id, users.email, users.username FROM users
               JOIN trip_members ON trip_members.user_id = users.id
               JOIN email_preferences pref_domain ON pref_domain.user_id = users.id
                 AND pref_domain.domain = ? AND pref_domain.enabled = 1
               WHERE trip_members.trip_id = ?
                 AND users.email IS NOT NULL AND users.email != ''`
            )
            .all(domain, tripId)
  ) as { id: number; email: string; username: string }[];

  if (!users.length) return;

  await Promise.all(
    users.map(async (u) => {
      try {
        await sendActivityEmail({
          to: u.email,
          username: u.username,
          tripId,
          tripName: params.tripName,
          title: params.title,
          body: params.body,
        });
      } catch (err) {
        console.warn(`[Mailer] Activity-Mail an ${u.email} fehlgeschlagen:`, err);
      }
    })
  );
}

/** Best-effort – wird von activity.ts's recordActivity() nach jeder Mutation angestoßen, blockiert
 *  die auslösende Route nie (siehe dortiger .catch()). */
export async function notifyTripMembers(
  tripId: number,
  excludeUserId: number,
  info: ActivityPushInfo
) {
  const title = `${DOMAIN_LABEL[info.domain] ?? info.domain} · ${info.tripName}`;
  const body = `${info.actorUsername} hat ${ACTION_LABEL[info.action] ?? 'etwas geändert'}`;
  const isUpdate = !NEW_ELEMENT_ACTIONS.has(info.action);
  await sendPushToTripMembers(
    tripId,
    { title, body, tripId },
    info.domain as PushPreferenceDomain,
    excludeUserId,
    isUpdate
  );
  await sendEmailToTripMembers(
    tripId,
    { title, body, tripId, tripName: info.tripName },
    info.domain as PushPreferenceDomain,
    excludeUserId,
    isUpdate
  );
}

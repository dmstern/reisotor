import { db } from './db/index.js';
import { getInstanceSetting, setInstanceSetting } from './instanceSettings.js';

// #96: offene Registrierung soll per Backend-Env-Var konfigurierbar sein, ohne dafür eine
// Self-Service-Route zu brauchen – bewusst nur per Server-Env-Var pflegbar, sonst könnte sich jede
// offen registrierte Person selbst freischalten.
export type RegistrationMode = 'off' | 'full' | 'restricted';

function parseMode(raw: string | undefined): RegistrationMode {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'off' || value === 'restricted' ? value : 'full';
}

export const REGISTRATION_MODE: RegistrationMode = parseMode(process.env.REGISTRATION_MODE);

export function getRegistrationMode(): RegistrationMode {
  try {
    const val = getInstanceSetting('registration_mode');
    if (val) {
      return parseMode(val);
    }
  } catch {
    // Falls Tabelle noch nicht existiert (z. B. vor der Initialisierung)
  }
  return parseMode(process.env.REGISTRATION_MODE);
}

export function setRegistrationMode(mode: RegistrationMode): void {
  const parsed = parseMode(mode);
  setInstanceSetting('registration_mode', parsed);
}

// Kommagetrennte Reisotor-Benutzernamen, die von den restricted-Einschränkungen ausgenommen sind –
// dynamisch geprüft (nicht beim Registrieren einmalig eingefroren), damit jemand nachträglich per
// Env-Var freigeschaltet werden kann, ohne den DB-Zustand anzufassen.
const FULL_ACCESS_USERS = new Set(
  (process.env.REGISTRATION_FULL_ACCESS_USERS ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
);

export const RESTRICTED_MAX_TRIPS = 1;
export const RESTRICTED_MAX_MEMBERS = 3;

interface RestrictedUserRow {
  username: string;
  is_restricted: number;
}

/** Ob die aktuelle Session-Person den restricted-Einschränkungen unterliegt: die Markierung wird
 *  beim Registrieren gesetzt (routes/auth.ts, gilt weiter fort, auch falls REGISTRATION_MODE später
 *  wieder auf 'full' zurückgestellt wird), FULL_ACCESS_USERS hebt sie dynamisch wieder auf. */
export function isUserRestricted(userId: number | null | undefined): boolean {
  if (userId == null) return false;
  const user = db
    .prepare('SELECT username, is_admin, is_restricted FROM users WHERE id = ?')
    .get(userId) as (RestrictedUserRow & { is_admin: number }) | undefined;
  if (!user || user.is_admin || !user.is_restricted) return false;
  return !FULL_ACCESS_USERS.has(user.username);
}

export function isUserAdmin(userId: number | null | undefined): boolean {
  if (userId == null) return false;
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(userId) as
    { is_admin: number } | undefined;
  return Boolean(user?.is_admin);
}

export function userMustChangePassword(userId: number | null | undefined): boolean {
  if (userId == null) return false;
  const user = db.prepare('SELECT must_change_password FROM users WHERE id = ?').get(userId) as
    { must_change_password: number } | undefined;
  return Boolean(user?.must_change_password);
}

export function isUserEmailVerified(userId: number | null | undefined): boolean {
  if (userId == null) return false;
  const user = db.prepare('SELECT is_email_verified FROM users WHERE id = ?').get(userId) as
    { is_email_verified: number } | undefined;
  return user?.is_email_verified !== 0;
}

export function isUserLocked(userId: number | null | undefined): boolean {
  if (userId == null) return false;
  const user = db.prepare('SELECT is_locked FROM users WHERE id = ?').get(userId) as
    { is_locked: number } | undefined;
  return Boolean(user?.is_locked);
}

export function isUsernameFullAccess(username: string): boolean {
  return FULL_ACCESS_USERS.has(username);
}

/** true, wenn ALLE Mitglieder des Urlaubs restricted sind (kein Mitglied hat Vollzugriff).
 *  Sobald mindestens eine Person mit Vollzugriff Mitglied im Urlaub ist ("Sponsor-Prinzip"),
 *  entfällt der 3-Mitglieder-Deckel für diesen Urlaub. */
export function isTripOwnerRestricted(tripId: number | string): boolean {
  const members = db.prepare('SELECT user_id FROM trip_members WHERE trip_id = ?').all(tripId) as {
    user_id: number;
  }[];
  if (members.length === 0) return false;
  return members.every((m) => isUserRestricted(m.user_id));
}

/** true, wenn userId die anlegende Person des Urlaubs (das älteste trip_members-Mitglied) ist. */
export function isTripCreatedBy(
  tripId: number | string,
  userId: number | null | undefined
): boolean {
  if (userId == null) return false;
  const creator = db
    .prepare('SELECT user_id FROM trip_members WHERE trip_id = ? ORDER BY id ASC LIMIT 1')
    .get(tripId) as { user_id: number } | undefined;
  return creator?.user_id === userId;
}

/** Anzahl Urlaube, die diese Person selbst angelegt hat (= ältestes trip_members-Mitglied) – zählt
 *  bewusst nicht Urlaube, in die sie nur eingeladen wurde (siehe Issue #96: die Beschränkung gilt
 *  fürs Anlegen, nicht fürs Beitreten). */
export function countTripsCreatedBy(userId: number): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) as count FROM trip_members tm
       WHERE tm.user_id = ?
         AND tm.id = (SELECT MIN(id) FROM trip_members WHERE trip_id = tm.trip_id)`
    )
    .get(userId) as { count: number };
  return row.count;
}

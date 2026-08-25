import { db } from './db/index.js';

// #96: offene Registrierung soll per Backend-Env-Var konfigurierbar sein, ohne dafür eine
// Self-Service-Route zu brauchen – bewusst nur per Server-Env-Var pflegbar, sonst könnte sich jede
// offen registrierte Person selbst freischalten.
export type RegistrationMode = 'off' | 'full' | 'restricted';

function parseMode(raw: string | undefined): RegistrationMode {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'off' || value === 'restricted' ? value : 'full';
}

export const REGISTRATION_MODE: RegistrationMode = parseMode(process.env.REGISTRATION_MODE);

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
  const user = db.prepare('SELECT username, is_restricted FROM users WHERE id = ?').get(userId) as
    RestrictedUserRow | undefined;
  if (!user || !user.is_restricted) return false;
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

export function isUsernameFullAccess(username: string): boolean {
  return FULL_ACCESS_USERS.has(username);
}

/** true, wenn die anlegende Person des Urlaubs (das älteste trip_members-Mitglied) restricted ist –
 *  bestimmt den Mitglieder-Deckel für den gesamten Urlaub (routes/trips.ts), unabhängig davon, wer
 *  gerade konkret einlädt, damit eine restricted Person die Beschränkung nicht über eine
 *  full-access Person umgehen kann, die sie stattdessen einladen lässt. */
export function isTripOwnerRestricted(tripId: number | string): boolean {
  const creator = db
    .prepare('SELECT user_id FROM trip_members WHERE trip_id = ? ORDER BY id ASC LIMIT 1')
    .get(tripId) as { user_id: number } | undefined;
  if (!creator) return false;
  return isUserRestricted(creator.user_id);
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

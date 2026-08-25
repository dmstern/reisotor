import type { FastifyReply } from 'fastify';
import { db } from './db/index.js';

export function isTripMember(tripId: number, userId: number): boolean {
  return !!db
    .prepare('SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?')
    .get(tripId, userId);
}

/** Zentraler Zugriffs-Check für praktisch jede Urlaub-bezogene Route (siehe routes/*.ts): sendet
 *  bei fehlender Mitgliedschaft (oder fehlendem/ungültigem trip_id) selbst eine 403-Antwort und
 *  gibt zurück, ob die Route fortfahren darf. Aufrufer müssen bei `false` sofort `return`en, ohne
 *  selbst noch eine Antwort zu senden – reply wurde bereits befüllt. */
export function requireTripMember(
  reply: FastifyReply,
  tripId: number | string | null | undefined,
  userId: number | undefined
): boolean {
  const id = typeof tripId === 'string' ? Number(tripId) : tripId;
  if (id == null || !Number.isFinite(id) || userId == null || !isTripMember(id, userId)) {
    reply.code(403).send({ error: 'Kein Zugriff auf diesen Urlaub' });
    return false;
  }
  return true;
}

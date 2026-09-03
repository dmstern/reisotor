import type { ScheduleItem } from '../api/types';

/**
 * Prüft, ob ein Kalendertermin automatisch beim Einplanen eines Spots angelegt wurde
 * und vom Nutzer bisher nicht manuell modifiziert wurde.
 *
 * Ein Termin gilt als "automatisch und unverändert", wenn:
 * 1. Sein Titel dem Titel des Spots entspricht.
 * 2. Keine Uhrzeit (time / end_time) gesetzt ist.
 * 3. Kein mehrtägiger Datumsbereich (end_date) gesetzt ist.
 * 4. Keine Notiz vorhanden ist (auch kein reines leeres HTML wie <p></p>).
 * 5. Kein abweichender Standort oder Maps-Link eingetragen wurde.
 *
 * Wurde einer dieser Werte verändert oder enthält Notizen/Uhrzeiten, bleiben die
 * Nutzerdaten geschützt: der Termin wird nicht gelöscht, sondern lediglich entkoppelt (spot_id = null).
 */
export function isAutoCreatedUnmodifiedScheduleItem(
  item: ScheduleItem,
  spotTitle: string
): boolean {
  // Wurde der Termin jemals vom Nutzer angefasst/bearbeitet, bleibt er auf jeden Fall erhalten
  if (Boolean(item.user_modified)) {
    return false;
  }

  // Wurde der Termin manuell vom Nutzer angelegt und nur verknüpft (auto_created = false/0)
  if (item.auto_created === false || item.auto_created === 0) {
    return false;
  }

  if (item.title.trim().toLowerCase() !== spotTitle.trim().toLowerCase()) {
    return false;
  }
  if (item.time && item.time.trim() !== '') {
    return false;
  }
  if (item.end_time && item.end_time.trim() !== '') {
    return false;
  }
  if (item.end_date && item.end_date !== item.date) {
    return false;
  }
  if (item.note && item.note.replace(/<[^>]*>/g, '').trim() !== '') {
    return false;
  }
  if (item.location && item.location.trim() !== '') {
    return false;
  }
  if (item.maps_link && item.maps_link.trim() !== '') {
    return false;
  }
  return true;
}

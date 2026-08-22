import { db } from './db/index.js';
import { sendPushToTripMembers } from './push.js';
const REMINDER_THRESHOLDS_DAYS = [14, 7, 2, 1];
const DAY_MS = 24 * 60 * 60 * 1000;
function daysUntil(dateStr) {
    const today = new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetUtc = Date.UTC(y, m - 1, d);
    return Math.round((targetUtc - todayUtc) / DAY_MS);
}
/** Prüft für jeden Urlaub mit künftigem Abreisedatum, ob heute einer der Erinnerungs-Schwellwerte
 *  (REMINDER_THRESHOLDS_DAYS, in Tagen vor Abreise) erreicht ist, und verschickt bei Bedarf einmalig
 *  eine Push an alle Mitglieder (trip_departure_reminders_sent verhindert Doppelversand bei
 *  wiederholten Checks/Server-Neustarts). Nutzt bewusst die SERVER-Zeitzone für den Tagesvergleich -
 *  anders als der "Bis zur Abreise"-Countdown im Dashboard (DashboardView.vue/
 *  utils/departureCountdown.ts), der die Gerätezeit der jeweiligen Nutzer:in nimmt: ein Hintergrund-
 *  Batch-Job ohne Bezug zu einer einzelnen Nutzer:in kann keine individuelle Zeitzone kennen: bei
 *  tage-granularen Schwellwerten (14/7/2/1 Tage) ist das kein spürbarer Genauigkeitsverlust. */
export async function checkDepartureReminders() {
    // Grober Vorfilter (nur zukünftige/gerade laufende Urlaube) statt jeden Check über ALLE
    // (potenziell auch längst vergangenen) Urlaube laufen zu lassen - der genaue Schwellwert-Abgleich
    // passiert danach ohnehin exakt über daysUntil().
    const trips = db.prepare(`SELECT id, name, start_date FROM trips WHERE start_date >= date('now', '-1 day')`).all();
    for (const trip of trips) {
        const days = daysUntil(trip.start_date);
        if (!REMINDER_THRESHOLDS_DAYS.includes(days))
            continue;
        const alreadySent = db
            .prepare('SELECT 1 FROM trip_departure_reminders_sent WHERE trip_id = ? AND threshold_days = ?')
            .get(trip.id, days);
        if (alreadySent)
            continue;
        const label = days === 1 ? '1 Tag' : `${days} Tage`;
        await sendPushToTripMembers(trip.id, {
            title: `✈️ ${trip.name}`,
            body: `Nur noch ${label} bis zur Abreise!`,
            tripId: trip.id,
        }, 'departure');
        db.prepare('INSERT INTO trip_departure_reminders_sent (trip_id, threshold_days, sent_at) VALUES (?, ?, ?)').run(trip.id, days, new Date().toISOString());
    }
}
// Alle 6h reicht: die Schwellwerte sind tage-granular, häufigeres Prüfen brächte keine zusätzliche
// Genauigkeit. Läuft zusätzlich einmal sofort beim Start (fängt einen Schwellwert ab, der genau
// während einer Downtime begonnen hat, statt bis zum nächsten 6h-Intervall zu warten).
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export function startDepartureReminderScheduler() {
    checkDepartureReminders().catch((err) => console.error('departureReminders: initial check failed', err));
    setInterval(() => {
        checkDepartureReminders().catch((err) => console.error('departureReminders: periodic check failed', err));
    }, CHECK_INTERVAL_MS);
}

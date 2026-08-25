// Reisedauer aus Abflug-/Ankunftszeit (beides "HH:MM") berechnen – ohne eigenes Ankunftsdatum wird
// eine Ankunftszeit VOR der Abflugzeit als "am Folgetag" interpretiert (z. B. Nachtflug 23:40–01:15),
// das ist für die allermeisten Reise-Einträge in diesem Kontext (Flug/Zug/Bus an einem Tag) die
// sinnvollere Annahme als eine negative Dauer.
export function travelDurationMinutes(
  departureTime: string | null,
  arrivalTime: string | null
): number | null {
  if (!departureTime || !arrivalTime) return null;
  const [dh, dm] = departureTime.split(':').map(Number);
  const [ah, am] = arrivalTime.split(':').map(Number);
  if ([dh, dm, ah, am].some((n) => Number.isNaN(n))) return null;
  let minutes = ah * 60 + am - (dh * 60 + dm);
  if (minutes < 0) minutes += 24 * 60;
  return minutes;
}

export function formatTravelDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} Min.`;
  if (m === 0) return `${h} Std.`;
  return `${h} Std. ${m} Min.`;
}

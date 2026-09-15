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
  if (h === 0) return `${m}\u00A0Min.`;
  if (m === 0) return `${h}\u00A0Std.`;
  return `${h}\u00A0Std. ${m}\u00A0Min.`;
}

export function formatTravelDurationParts(minutes: number): string[] {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return [`${m}\u00A0Min.`];
  if (m === 0) return [`${h}\u00A0Std.`];
  return [`${h}\u00A0Std.`, `${m}\u00A0Min.`];
}

export function tourTotalDurationMinutes(excursion: {
  departure_time?: string | null;
  arrival_time?: string | null;
  legs?: { departure_time?: string | null; arrival_time?: string | null }[];
}): number | null {
  const legs = excursion.legs;
  if (!legs || legs.length === 0) {
    return travelDurationMinutes(excursion.departure_time || null, excursion.arrival_time || null);
  }

  let totalMinutes = 0;
  let lastTime: string | null = null;
  let hasAnyDuration = false;

  for (const leg of legs) {
    const dep = leg.departure_time;
    const arr = leg.arrival_time;

    if (dep) {
      if (lastTime) {
        const wait = travelDurationMinutes(lastTime, dep);
        if (wait != null) totalMinutes += wait;
      }
      if (arr) {
        const dur = travelDurationMinutes(dep, arr);
        if (dur != null) {
          totalMinutes += dur;
          hasAnyDuration = true;
        }
        lastTime = arr;
      } else {
        lastTime = dep;
      }
    } else if (arr) {
      if (lastTime) {
        const dur = travelDurationMinutes(lastTime, arr);
        if (dur != null) {
          totalMinutes += dur;
          hasAnyDuration = true;
        }
      }
      lastTime = arr;
    }
  }

  if (!hasAnyDuration && totalMinutes === 0) {
    return travelDurationMinutes(excursion.departure_time || null, excursion.arrival_time || null);
  }

  return totalMinutes;
}

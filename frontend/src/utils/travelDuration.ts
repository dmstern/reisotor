const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_MINUTE = 60;

// Reisedauer aus Abflug-/Ankunftszeit (beides "HH:MM") berechnen – ohne eigenes Ankunftsdatum wird
// eine Ankunftszeit VOR der Abflugzeit als "am Folgetag" interpretiert (z. B. Nachtflug 23:40–01:15),
// das ist für die allermeisten Reise-Einträge in diesem Kontext (Flug/Zug/Bus an einem Tag) die
// sinnvollere Annahme als eine negative Dauer.
export function travelDurationMinutes(
  departureTime: string | null,
  arrivalTime: string | null
): number | null {
  if (!departureTime || !arrivalTime) {
    return null;
  }

  const [dh, dm] = departureTime.split(':').map(Number);
  const [ah, am] = arrivalTime.split(':').map(Number);

  if ([dh, dm, ah, am].some((val) => Number.isNaN(val))) {
    return null;
  }

  let minutes = ah * MINUTES_PER_HOUR + am - (dh * MINUTES_PER_HOUR + dm);

  if (minutes < 0) {
    minutes += HOURS_PER_DAY * MINUTES_PER_HOUR;
  }

  return minutes;
}

export function formatTravelDuration(minutes: number): string {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMinutes = minutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return `${remainingMinutes}\u00A0Min.`;
  }

  if (remainingMinutes === 0) {
    return `${hours}\u00A0Std.`;
  }

  return `${hours}\u00A0Std. ${remainingMinutes}\u00A0Min.`;
}

export function formatTravelDurationParts(minutes: number): string[] {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMinutes = minutes % MINUTES_PER_HOUR;

  if (hours === 0) {
    return [`${remainingMinutes}\u00A0Min.`];
  }

  if (remainingMinutes === 0) {
    return [`${hours}\u00A0Std.`];
  }

  return [`${hours}\u00A0Std.`, `${remainingMinutes}\u00A0Min.`];
}

interface ExcursionDurationLeg {
  departure_time?: string | null;
  arrival_time?: string | null;
  duration_seconds?: number | null;
}

interface LegAccumulator {
  totalMinutes: number;
  lastTime: string | null;
  hasAnyDuration: boolean;
}

function durationMinutesFromSeconds(durationSeconds: number | null | undefined): number | null {
  if (durationSeconds == null || durationSeconds <= 0) {
    return null;
  }

  return Math.round(durationSeconds / SECONDS_PER_MINUTE);
}

function computeWaitMinutes(lastTime: string | null, departureTime: string): number {
  if (!lastTime) {
    return 0;
  }

  return travelDurationMinutes(lastTime, departureTime) ?? 0;
}

function accumulateLeg(acc: LegAccumulator, leg: ExcursionDurationLeg): void {
  const dep = leg.departure_time;
  const arr = leg.arrival_time;
  const secondsMinutes = durationMinutesFromSeconds(leg.duration_seconds);

  if (dep && arr) {
    acc.totalMinutes += computeWaitMinutes(acc.lastTime, dep);
    const dur = travelDurationMinutes(dep, arr);

    if (dur != null) {
      acc.totalMinutes += dur;
      acc.hasAnyDuration = true;
    }

    acc.lastTime = arr;
    return;
  }

  if (dep) {
    acc.totalMinutes += computeWaitMinutes(acc.lastTime, dep);

    if (secondsMinutes != null) {
      acc.totalMinutes += secondsMinutes;
      acc.hasAnyDuration = true;
      acc.lastTime = null;
    } else {
      acc.lastTime = dep;
    }

    return;
  }

  if (arr) {
    if (acc.lastTime) {
      const dur = travelDurationMinutes(acc.lastTime, arr);

      if (dur != null) {
        acc.totalMinutes += dur;
        acc.hasAnyDuration = true;
      }
    } else if (secondsMinutes != null) {
      acc.totalMinutes += secondsMinutes;
      acc.hasAnyDuration = true;
    }

    acc.lastTime = arr;
    return;
  }

  if (secondsMinutes == null) {
    return;
  }

  acc.totalMinutes += secondsMinutes;
  acc.hasAnyDuration = true;
  acc.lastTime = null;
}

export function tourTotalDurationMinutes(excursion: {
  departure_time?: string | null;
  arrival_time?: string | null;
  legs?: ExcursionDurationLeg[];
}): number | null {
  const legs = excursion.legs;

  if (!legs || legs.length === 0) {
    return travelDurationMinutes(excursion.departure_time || null, excursion.arrival_time || null);
  }

  const acc: LegAccumulator = {
    totalMinutes: 0,
    lastTime: null,
    hasAnyDuration: false,
  };

  for (const leg of legs) {
    accumulateLeg(acc, leg);
  }

  if (!acc.hasAnyDuration && acc.totalMinutes === 0) {
    return travelDurationMinutes(excursion.departure_time || null, excursion.arrival_time || null);
  }

  return acc.totalMinutes;
}

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_MINUTE = 60;
const METERS_PER_KM = 1000;
const COMPACT_KM_THRESHOLD = 10;

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

/**
 * Formatiert eine Teilstrecken-Distanz in Metern auf deutsch:
 * - < 1000 m: z. B. "450 m"
 * - 1–10 km: z. B. "1,1 km", "1,4 km"
 * - >= 10 km: z. B. "46 km"
 */
export function formatLegDistance(distanceMeters: number | null | undefined): string | null {
  if (distanceMeters == null || distanceMeters <= 0 || !Number.isFinite(distanceMeters)) {
    return null;
  }

  if (distanceMeters < METERS_PER_KM) {
    return `${Math.round(distanceMeters)}\u00A0m`;
  }

  const km = distanceMeters / METERS_PER_KM;

  if (km < COMPACT_KM_THRESHOLD) {
    const formatted = km.toFixed(1).replace('.', ',');

    return `${formatted}\u00A0km`;
  }

  return `${Math.round(km)}\u00A0km`;
}

const TRANSPORT_ALIAS_MAP: Record<string, string> = {
  'zu fuß': 'zu Fuß',
  'zu fuss': 'zu Fuß',
  fuss: 'zu Fuß',
  fuß: 'zu Fuß',
  auto: 'Auto',
  car: 'Auto',
  fahrrad: 'Fahrrad',
  bike: 'Fahrrad',
  rad: 'Fahrrad',
  zug: 'Zug',
  bahn: 'Zug',
  train: 'Zug',
  bus: 'Bus',
  straßenbahn: 'Straßenbahn',
  strassenbahn: 'Straßenbahn',
  tram: 'Straßenbahn',
  'u-bahn': 'U-Bahn',
  ubahn: 'U-Bahn',
  metro: 'U-Bahn',
  fähre: 'Fähre',
  faehre: 'Fähre',
  schiff: 'Fähre',
  ship: 'Fähre',
  ferry: 'Fähre',
  flug: 'Flug',
  flugzeug: 'Flug',
  flight: 'Flug',
  plane: 'Flug',
  öpnv: 'ÖPNV',
  oepnv: 'ÖPNV',
  transit: 'ÖPNV',
};

/**
 * Normalisiert Verkehrsmittel-Bezeichnungen auf kanonische Schreibweisen für Gruppierungen.
 */
export function normalizeTransportType(type?: string | null): string {
  if (!type || !type.trim()) {
    return 'Sonstiges';
  }

  const trimmed = type.trim();
  const lower = trimmed.toLowerCase();

  return TRANSPORT_ALIAS_MAP[lower] ?? trimmed;
}

export interface TourLegSummaryInput {
  transport_type?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  duration_seconds?: number | null;
  distance_meters?: number | null;
}

export interface TourTransportSummaryItem {
  type: string;
  distanceMeters: number;
  durationMinutes: number;
  formattedPrimary: string;
  tooltip: string;
  ariaLabel: string;
}

interface TransportAccumulator {
  type: string;
  distanceMeters: number;
  durationMinutes: number;
}

function computeLegDurationMinutes(leg: TourLegSummaryInput): number {
  if (leg.departure_time && leg.arrival_time) {
    const computedDuration = travelDurationMinutes(leg.departure_time, leg.arrival_time);

    if (computedDuration != null && computedDuration > 0) {
      return computedDuration;
    }
  }

  if (leg.duration_seconds != null && leg.duration_seconds > 0) {
    return Math.round(leg.duration_seconds / SECONDS_PER_MINUTE);
  }

  return 0;
}

function buildTransportTooltip(
  type: string,
  formattedDistance: string | null,
  formattedDuration: string | null
): string {
  if (formattedDistance && formattedDuration) {
    return `${type}: ${formattedDistance} (${formattedDuration})`;
  }

  if (formattedDistance) {
    return `${type}: ${formattedDistance}`;
  }

  if (formattedDuration) {
    return `${type}: ${formattedDuration}`;
  }

  return type;
}

function accumulateLegIntoSummary(
  summaryMap: Map<string, TransportAccumulator>,
  leg: TourLegSummaryInput
): void {
  const rawType = leg.transport_type;
  const hasExplicitType = Boolean(rawType && rawType.trim());
  const normalizedType = normalizeTransportType(rawType);

  const legDistance =
    leg.distance_meters != null && leg.distance_meters > 0 && Number.isFinite(leg.distance_meters)
      ? leg.distance_meters
      : 0;

  const legDuration = computeLegDurationMinutes(leg);

  if (!hasExplicitType && legDistance === 0 && legDuration === 0) {
    return;
  }

  const existing = summaryMap.get(normalizedType);

  if (existing) {
    existing.distanceMeters += legDistance;
    existing.durationMinutes += legDuration;
    return;
  }

  summaryMap.set(normalizedType, {
    type: normalizedType,
    distanceMeters: legDistance,
    durationMinutes: legDuration,
  });
}

/**
 * Fasst die Teilstrecken (Legs) einer Tour nach Verkehrsmittel zusammen:
 * - Distanz bei Verkehrsmitteln mit Kilometern (> 0)
 * - Dauer bei Verkehrsmitteln ohne Kilometer (typisch Öffis)
 */
export function summarizeTourLegsByTransport(
  legs?: TourLegSummaryInput[] | null
): TourTransportSummaryItem[] {
  if (!legs || legs.length === 0) {
    return [];
  }

  const summaryMap = new Map<string, TransportAccumulator>();

  for (const leg of legs) {
    accumulateLegIntoSummary(summaryMap, leg);
  }

  const result: TourTransportSummaryItem[] = [];

  for (const entry of summaryMap.values()) {
    if (entry.distanceMeters <= 0 && entry.durationMinutes <= 0) {
      continue;
    }

    const formattedDistance = formatLegDistance(entry.distanceMeters);
    const formattedDuration =
      entry.durationMinutes > 0 ? formatTravelDuration(entry.durationMinutes) : null;

    const formattedPrimary =
      entry.distanceMeters > 0 && formattedDistance ? formattedDistance : (formattedDuration ?? '');

    const tooltip = buildTransportTooltip(entry.type, formattedDistance, formattedDuration);

    result.push({
      type: entry.type,
      distanceMeters: entry.distanceMeters,
      durationMinutes: entry.durationMinutes,
      formattedPrimary,
      tooltip,
      ariaLabel: tooltip,
    });
  }

  return result;
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

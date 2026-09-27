import type { TrackPoint } from '../api/types';

/** Luftlinien-Distanz zweier Koordinaten in Metern (Haversine) - für die Kennzahlen-Anzeige einer
 *  Aufzeichnung (TrackPlayback.vue) reicht diese Näherung, keine echte Routenführung nötig, siehe
 *  auch utils/mapRoute.ts's arcRoute() (rein visuell, keine Distanzberechnung). */
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Summierte Strecke entlang der (bereits zeitlich sortierten) Punkte einer Aufzeichnung. */
export function trackDistanceMeters(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

export function trackDurationMs(points: TrackPoint[]): number {
  if (points.length < 2) return 0;
  return (
    new Date(points[points.length - 1].recorded_at).getTime() -
    new Date(points[0].recorded_at).getTime()
  );
}

/** Position entlang der Aufzeichnung zu einem Fortschritt 0..1 (Zeit-Slider, TrackPlayback.vue) -
 *  interpoliert linear zwischen den beiden zeitlich nächsten Punkten statt nur den nächstgelegenen
 *  Index zu springen, damit sich der Marker bei ungleichmäßigem GPS-Ping-Abstand gleichmäßig
 *  bewegt. */
export function interpolateTrackPosition(
  points: TrackPoint[],
  progress: number
): { lat: number; lng: number } | null {
  if (!points.length) return null;
  if (points.length === 1 || progress <= 0) return { lat: points[0].lat, lng: points[0].lng };
  if (progress >= 1) {
    const last = points[points.length - 1];
    return { lat: last.lat, lng: last.lng };
  }
  const startMs = new Date(points[0].recorded_at).getTime();
  const endMs = new Date(points[points.length - 1].recorded_at).getTime();
  const targetMs = startMs + progress * (endMs - startMs);
  for (let i = 1; i < points.length; i++) {
    const prevMs = new Date(points[i - 1].recorded_at).getTime();
    const curMs = new Date(points[i].recorded_at).getTime();
    if (targetMs <= curMs) {
      const span = curMs - prevMs;
      const t = span > 0 ? (targetMs - prevMs) / span : 0;
      return {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * t,
      };
    }
  }
  const last = points[points.length - 1];
  return { lat: last.lat, lng: last.lng };
}

export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}\u00A0Std. ${minutes}\u00A0Min.`;
  return `${minutes}\u00A0Min.`;
}

export function formatDistanceShort(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}\u00A0km`;
  return `${Math.round(meters)}\u00A0m`;
}

/**
 * Berechnet die Durchschnittsgeschwindigkeit einer Aufzeichnung in km/h.
 *
 * Formel: (distanceMeters / 1000) / (durationMs / 3_600_000)
 *
 * Gibt null zurück, wenn Dauer oder Distanz <= 0 sind oder keine endliche Zahl vorliegt.
 */
export function trackAverageSpeedKmh(distanceMeters: number, durationMs: number): number | null {
  if (
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(durationMs) ||
    distanceMeters <= 0 ||
    durationMs <= 0
  ) {
    return null;
  }
  const speed = distanceMeters / 1000 / (durationMs / 3_600_000);
  return Number.isFinite(speed) && speed > 0 ? speed : null;
}

/**
 * Formatiert eine Geschwindigkeit in km/h kurz und lokalisiert mit geschütztem Leerzeichen,
 * z. B. "12.4 km/h". Gibt bei null oder ungültigen Werten standardmäßig einen leeren String zurück
 * (oder den optional übergebenen Platzhalter).
 */
export function formatSpeedShort(kmh: number | null, placeholder = ''): string {
  if (kmh == null || !Number.isFinite(kmh) || kmh <= 0) return placeholder;
  return `${kmh.toFixed(1)}\u00A0km/h`;
}

export interface TrackElevationResult {
  gain: number;
  loss: number;
}

/**
 * Berechnet kumulierten Aufstieg und Abstieg (in ganzzahligen Metern) entlang der Track-Punkte.
 * Verwendet einen zweistufigen Filter gegen GPS-Höhen-Rauschen:
 * 1. 3-Punkt gleitender Durchschnitt glättet hochfrequentes Sensor-Jitter (Endpunkte bleiben fix).
 * 2. Hysterese-Schwellenwertfilter (Default: 3m) verhindert das Aufsummieren von Flachland-Drift.
 * Gibt null zurück, wenn weniger als 2 Punkte mit gültiger numerischer Höhe vorliegen.
 */
export function trackElevation(
  points: TrackPoint[],
  thresholdMeters = 3
): TrackElevationResult | null {
  if (!points || points.length < 2) return null;

  const validAlts: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const alt = points[i].altitude;
    if (typeof alt === 'number' && Number.isFinite(alt)) {
      validAlts.push(alt);
    }
  }

  if (validAlts.length < 2) return null;

  const count = validAlts.length;
  const smoothed: number[] = new Array(count);
  smoothed[0] = validAlts[0];
  for (let i = 1; i < count - 1; i++) {
    smoothed[i] = (validAlts[i - 1] + validAlts[i] + validAlts[i + 1]) / 3;
  }
  smoothed[count - 1] = validAlts[count - 1];

  let gain = 0;
  let loss = 0;
  let lastAlt = smoothed[0];

  for (let i = 1; i < count; i++) {
    const currentAlt = smoothed[i];
    const diff = currentAlt - lastAlt;

    if (diff >= thresholdMeters && diff > 0) {
      gain += diff;
      lastAlt = currentAlt;
    } else if (diff <= -thresholdMeters && diff < 0) {
      loss += -diff;
      lastAlt = currentAlt;
    }
  }

  return {
    gain: Math.round(gain) || 0,
    loss: Math.round(loss) || 0,
  };
}

/**
 * Formatiert Aufstieg und Abstieg kompakt, z. B. "↗ 340 m · ↘ 120 m"
 * mit geschützten Leerzeichen vor den Einheiten.
 * Gibt einen leeren String zurück, falls keine Höhendaten vorhanden sind.
 */
export function formatElevationShort(elevation: TrackElevationResult | null | undefined): string {
  if (!elevation) return '';
  const gain = Math.round(elevation.gain) || 0;
  const loss = Math.round(elevation.loss) || 0;
  return `↗\u00A0${gain}\u00A0m · ↘\u00A0${loss}\u00A0m`;
}

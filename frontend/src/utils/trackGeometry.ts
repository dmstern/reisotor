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
  return new Date(points[points.length - 1].recorded_at).getTime() - new Date(points[0].recorded_at).getTime();
}

/** Position entlang der Aufzeichnung zu einem Fortschritt 0..1 (Zeit-Slider, TrackPlayback.vue) -
 *  interpoliert linear zwischen den beiden zeitlich nächsten Punkten statt nur den nächstgelegenen
 *  Index zu springen, damit sich der Marker bei ungleichmäßigem GPS-Ping-Abstand gleichmäßig
 *  bewegt. */
export function interpolateTrackPosition(points: TrackPoint[], progress: number): { lat: number; lng: number } | null {
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
  if (hours > 0) return `${hours} Std. ${minutes} Min.`;
  return `${minutes} Min.`;
}

export function formatDistanceShort(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

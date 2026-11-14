import type { Spot } from '../api/types';

export const WALKING_THRESHOLD_METERS = 2000;

export interface SpotAccommodationDistanceInfo {
  accommodationId: number;
  accommodationTitle: string;
  distanceMeters: number;
  durationSeconds: number | null;
  profile: 'foot-walking' | 'driving-car';
  isFallback: boolean;
}

const EARTH_RADIUS_METERS = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Schnelle, exakte Haversine-Luftlinie in Metern zwischen zwei Punkten.
 */
export function haversineMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLat = (to.lat - from.lat) * DEG_TO_RAD;
  const dLng = (to.lng - from.lng) * DEG_TO_RAD;
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Prüft, ob für einen Spot eine Distanz zur Unterkunft ermittelt werden soll.
 * Ausgeschlossen sind:
 * - Spots ohne Koordinaten
 * - Unterkünfte selbst (category === 'Unterkunft')
 * - Als Heimat-Ort markierte Spots (spot.is_home === true / 1)
 */
export function shouldShowAccommodationDistance(spot: Spot): boolean {
  if (spot.lat == null || spot.lng == null) {
    return false;
  }

  if (spot.category === 'Unterkunft') {
    return false;
  }

  if (spot.is_home) {
    return false;
  }

  return true;
}

/**
 * Filtert aus einer Liste von Spots alle echten Unterkünfte mit gültigen Koordinaten heraus.
 */
export function getValidAccommodations(spots: Spot[]): Spot[] {
  return spots.filter(
    (accommodation) =>
      accommodation.category === 'Unterkunft' &&
      accommodation.lat != null &&
      accommodation.lng != null
  );
}

/**
 * Ermittelt die passende Referenz-Unterkunft für einen Spot:
 * 1. Falls der Spot ein geplantes Datum hat (scheduledDate), wird eine Unterkunft gewählt,
 *    deren Zeitraum (start_date..end_date) dieses Datum einschließt.
 * 2. Gibt es mehrere passende Unterkünfte oder kein Datum, wird die räumlich nächstgelegene
 *    Unterkunft gewählt.
 */
export function resolveReferenceAccommodation(
  spot: Spot,
  accommodations: Spot[],
  scheduledDate?: string | null
): Spot | null {
  if (!accommodations.length || spot.lat == null || spot.lng == null) {
    return null;
  }

  const validAccommodations = accommodations.filter((acc) => acc.lat != null && acc.lng != null);

  if (!validAccommodations.length) {
    return null;
  }

  // 1. Wenn scheduledDate vorhanden ist, prüfe passende Zeiträume
  if (scheduledDate) {
    const matchingDateAccommodations = validAccommodations.filter((acc) => {
      if (!acc.start_date && !acc.end_date) {
        return false;
      }

      if (acc.start_date && acc.start_date > scheduledDate) {
        return false;
      }

      if (acc.end_date && acc.end_date < scheduledDate) {
        return false;
      }

      return true;
    });

    if (matchingDateAccommodations.length === 1) {
      return matchingDateAccommodations[0];
    }

    if (matchingDateAccommodations.length > 1) {
      // Wenn mehrere Unterkünfte zeitlich passen, wähle die räumlich nächste darunter
      return findClosestAccommodation(spot, matchingDateAccommodations);
    }
  }

  // 2. Fallback: Räumlich nächstgelegene Unterkunft
  return findClosestAccommodation(spot, validAccommodations);
}

function findClosestAccommodation(spot: Spot, list: Spot[]): Spot {
  let closest = list[0];
  let minDistance = haversineMeters(
    { lat: spot.lat!, lng: spot.lng! },
    { lat: closest.lat!, lng: closest.lng! }
  );

  for (let i = 1; i < list.length; i++) {
    const distance = haversineMeters(
      { lat: spot.lat!, lng: spot.lng! },
      { lat: list[i].lat!, lng: list[i].lng! }
    );

    if (distance < minDistance) {
      minDistance = distance;
      closest = list[i];
    }
  }

  return closest;
}

/**
 * Wählt das Routing-Profil: Bei <= 2 km Luftlinie Fußweg ('foot-walking'), darüber Auto ('driving-car').
 */
export function chooseRoutingProfile(airDistanceMeters: number): 'foot-walking' | 'driving-car' {
  return airDistanceMeters <= WALKING_THRESHOLD_METERS ? 'foot-walking' : 'driving-car';
}

/**
 * Formatiert eine Distanz in Metern auf deutsch (z. B. "850 m", "2,4 km", bei Fallback "≈ 2,4 km").
 */
export function formatSpotDistance(meters: number, isFallback = false): string {
  const prefix = isFallback ? '≈\u00A0' : '';

  if (meters >= 1000) {
    const km = (meters / 1000).toFixed(1).replace('.', ',');
    return `${prefix}${km}\u00A0km`;
  }

  return `${prefix}${Math.round(meters)}\u00A0m`;
}

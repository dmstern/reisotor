import { reverseGeocode, type ReverseGeocodeResult } from './places.js';

export interface TrackPointLike {
  lat: number;
  lng: number;
  recorded_at: string;
  altitude?: number | null;
}

export type MovementType = 'walk' | 'hike' | 'bike' | 'drive' | 'stationary' | 'generic';

export interface ExtractedPlace {
  label: string;
  kind: 'poi' | 'nature' | 'district' | 'city' | 'region';
}

export interface GenerateTrackTitleOptions {
  startedAt: string;
  endedAt?: string | null;
  points?: TrackPointLike[];
  reverseGeocodeFn?: (options: {
    lat: number;
    lng: number;
    lang?: string;
  }) => Promise<ReverseGeocodeResult | null>;
}

const GERMAN_WEEKDAYS = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
] as const;

/**
 * Luftlinien-Distanz zweier Koordinaten in Metern (Haversine-Formel).
 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Ermittelt relevante Metriken für einen Track (Gesamtdistanz, Luftlinie Start-Ziel, Dauer, Höhenmeter, Tempo).
 */
export function calculateTrackMetrics(
  points: TrackPointLike[],
  startedAt: string,
  endedAt?: string | null
): {
  totalDistanceMeters: number;
  straightLineMeters: number;
  durationMs: number;
  elevationGain: number;
  speedKmh: number | null;
} {
  if (!points || points.length === 0) {
    return {
      totalDistanceMeters: 0,
      straightLineMeters: 0,
      durationMs: 0,
      elevationGain: 0,
      speedKmh: null,
    };
  }

  let totalDistanceMeters = 0;
  let elevationGain = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistanceMeters += haversineMeters(points[i - 1], points[i]);
    const altDiff = (points[i].altitude ?? 0) - (points[i - 1].altitude ?? 0);
    if (altDiff > 0 && points[i].altitude != null && points[i - 1].altitude != null) {
      elevationGain += altDiff;
    }
  }

  const startPt = points[0];
  const endPt = points[points.length - 1];
  const straightLineMeters = haversineMeters(startPt, endPt);

  let durationMs = 0;
  if (endedAt) {
    durationMs = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  } else if (points.length >= 2) {
    durationMs = Math.max(
      0,
      new Date(endPt.recorded_at).getTime() - new Date(startPt.recorded_at).getTime()
    );
  }

  let speedKmh: number | null = null;
  if (totalDistanceMeters > 0 && durationMs > 0) {
    speedKmh = totalDistanceMeters / 1000 / (durationMs / 3_600_000);
  }

  return {
    totalDistanceMeters,
    straightLineMeters,
    durationMs,
    elevationGain,
    speedKmh,
  };
}

/**
 * Schätzt die Fortbewegungsart anhand von Durchschnittsgeschwindigkeit, Distanz und Höhenmetern.
 */
export function inferMovementType(
  speedKmh: number | null,
  distanceMeters: number,
  durationMs: number,
  elevationGain = 0
): MovementType {
  if (speedKmh == null || distanceMeters < 40 || durationMs < 30_000) {
    return 'stationary';
  }

  if (speedKmh < 7.5) {
    // Wandern: Bei spürbarer Strecke (> 4.5 km) oder signifikanten Höhenmetern (> 120m)
    if (
      distanceMeters >= 4500 ||
      elevationGain >= 120 ||
      (durationMs >= 45 * 60 * 1000 && distanceMeters >= 3000)
    ) {
      return 'hike';
    }
    return 'walk';
  }

  if (speedKmh < 28) {
    return 'bike';
  }

  return 'drive';
}

/**
 * Filtert irrelevante Details (wie spezifische Restaurant-Namen, Geschäfte oder Hausnummern) heraus
 * und extrahiert den passendsten geographischen Begriff (POI/Park/Natur, Stadtteil, Ort, Stadt).
 */
export function extractPlaceLabel(geo: ReverseGeocodeResult | null): ExtractedPlace | null {
  if (!geo) return null;

  const osmKey = geo.osmKey || '';
  const osmValue = geo.osmValue || '';
  const name = geo.name?.trim();

  // 1. Natur / Parks / Sehenswürdigkeiten / markante Ausflugsziele bevorzugen
  const isNatureOrSight =
    osmKey === 'leisure' ||
    osmKey === 'natural' ||
    (osmKey === 'tourism' &&
      ['attraction', 'viewpoint', 'theme_park', 'zoo', 'aquarium', 'museum'].includes(osmValue)) ||
    (osmKey === 'historic' &&
      ['castle', 'monument', 'memorial', 'ruins', 'archaeological_site'].includes(osmValue)) ||
    geo.category === 'Sehenswürdigkeit' ||
    geo.category === 'Ausflugsziel' ||
    geo.category === 'Park & Garten' ||
    geo.category === 'Natur';

  if (isNatureOrSight && name && name !== 'Unbekannter Ort') {
    return { label: name, kind: osmKey === 'natural' || osmKey === 'leisure' ? 'nature' : 'poi' };
  }

  // 2. Wenn es ein Gewerbe (Restaurant, Café, Shop, Tankstelle etc.) oder eine Wohnstraße ist:
  // Niemals den Namen des Restaurants für den Titel einer Aufzeichnung verwenden!
  // Stattdessen Stadtteil, Gemeinde oder Stadt nutzen.
  const isAmenityOrShopOrStreet =
    osmKey === 'amenity' || osmKey === 'shop' || osmKey === 'highway' || osmKey === 'building';

  // 3. Stadtteil / Bezirk (z. B. "Kreuzberg", "Belém", "Altona")
  if (geo.district?.trim()) {
    return { label: geo.district.trim(), kind: 'district' };
  }

  // 4. Ortsteil / Gemeinde (z. B. "Trebbin")
  if (geo.locality?.trim()) {
    return { label: geo.locality.trim(), kind: 'city' };
  }

  // 5. Stadt / Gemeinde (z. B. "Berlin", "Hamburg", "Potsdam", "Lisboa")
  if (geo.city?.trim()) {
    return { label: geo.city.trim(), kind: 'city' };
  }

  // 6. Name nutzen, sofern es keine reine Wohnstraße mit Hausnummer oder Gewerbe ist
  if (!isAmenityOrShopOrStreet && name && name !== 'Unbekannter Ort' && !/\d+/.test(name)) {
    return { label: name, kind: 'poi' };
  }

  // 7. Bundesland / Region als letzter Fallback
  if (geo.state?.trim()) {
    return { label: geo.state.trim(), kind: 'region' };
  }

  return null;
}

/**
 * Formatiert den Ort mit einer idiomatischen deutschen Präposition (z. B. "durch den Plänterwald", "in Kreuzberg").
 */
export function formatPrepositionAndPlace(place: ExtractedPlace): string {
  const name = place.label.trim();
  const lower = name.toLowerCase();

  // Falls der Name bereits eine Präposition enthält (z. B. "Am Wannsee", "Im Tiergarten")
  if (/^(in|am|im|auf|durch|um|beim?|zur?)\b/i.test(name)) {
    return name;
  }

  // Städte, Stadtteile, Regionen -> immer "in [Name]" (z. B. "in Kreuzberg", "in Heidelberg", "in Berlin")
  if (place.kind === 'district' || place.kind === 'city' || place.kind === 'region') {
    return `in ${name}`;
  }

  // Wälder, Parks, Gärten, Forste -> "durch den [Name]"
  if (
    lower.endsWith('wald') ||
    lower.endsWith('park') ||
    lower.endsWith('garten') ||
    lower.endsWith('hain') ||
    lower.endsWith('forst')
  ) {
    return `durch den ${name}`;
  }

  // Seen, Teiche -> "um den [Name]"
  if (
    lower.endsWith('see') ||
    lower.endsWith('teich') ||
    lower.endsWith('weiher') ||
    lower.endsWith('talsperre')
  ) {
    return `um den ${name}`;
  }

  // Berge, Gipfel, Hügel -> "am [Name]"
  if (
    lower.endsWith('berg') ||
    lower.endsWith('spitze') ||
    lower.endsWith('gipfel') ||
    lower.endsWith('hügel')
  ) {
    return `am ${name}`;
  }

  // Inseln -> "auf der [Name]"
  if (lower.endsWith('insel')) {
    return `auf der ${name}`;
  }

  // Bekannte Bauwerke / Sehenswürdigkeiten -> "bei [Name]"
  if (place.kind === 'poi' || place.kind === 'nature') {
    return `bei ${name}`;
  }

  // Städte, Stadtteile, Regionen -> "in [Name]"
  return `in ${name}`;
}

/**
 * Erzeugt einen charmanten, abwechslungsreichen Zeit- und Wochentagstitel, wenn kein Standort
 * auf der Karte ermittelt werden kann.
 */
export function formatTimeBasedTrackTitle(
  dateInput: Date | string | number,
  movement: MovementType = 'generic'
): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return 'Aufzeichnung';
  }

  const dayIndex = d.getDay();
  const dayName = GERMAN_WEEKDAYS[dayIndex];
  const hour = d.getHours();

  // Tageszeiten
  const isMorning = hour >= 5 && hour < 11;
  const isMidday = hour >= 11 && hour < 14;
  const isAfternoon = hour >= 14 && hour < 18;
  const isEvening = hour >= 18 && hour < 22;
  const isNight = hour >= 22 || hour < 5;

  // Sonntag
  if (dayIndex === 0) {
    if (movement === 'hike') return 'Sonntagswanderung';
    if (movement === 'bike')
      return isMorning ? 'Morgendliche Sonntags-Radtour' : 'Sonntags-Radtour';
    if (movement === 'drive') return 'Sonntagsfahrt';
    if (movement === 'stationary') return 'Sonntags-Stopp';
    if (movement === 'walk') {
      if (isMorning) return 'Sonntagsspaziergang';
      if (isMidday) return 'Sonntagsrunde';
      if (isEvening) return 'Abendlicher Sonntagsspaziergang';
      if (isNight) return 'Nächtlicher Sonntagsspaziergang';
      return 'Sonntagsspaziergang';
    }
    // Generic
    if (isMorning) return 'Morgendliche Sonntagsrunde';
    if (isMidday) return 'Sonntagsrunde';
    if (isAfternoon) return 'Sonntagstour';
    if (isEvening) return 'Sonntagabend-Runde';
    return 'Nächtliche Sonntagsrunde';
  }

  // Samstag
  if (dayIndex === 6) {
    if (movement === 'hike') return 'Samstagswanderung';
    if (movement === 'bike')
      return isMorning ? 'Morgendliche Samstags-Radtour' : 'Samstags-Radtour';
    if (movement === 'drive') return 'Samstagsfahrt';
    if (movement === 'stationary') return 'Samstags-Stopp';
    if (movement === 'walk') {
      if (isMorning) return 'Samstagsspaziergang';
      if (isEvening) return 'Abendlicher Samstagsspaziergang';
      return 'Samstagsspaziergang';
    }
    // Generic
    if (isMorning) return 'Morgendliche Samstagsrunde';
    if (isAfternoon) return 'Wochenend-Ausflug';
    if (isEvening) return 'Samstagabend-Runde';
    return 'Samstagsrunde';
  }

  // Wochentage (Montag bis Freitag)
  if (movement === 'hike') {
    return `Wanderung am ${dayName}`;
  }

  if (movement === 'bike') {
    if (isMorning) return `Morgendliche Radtour am ${dayName}`;
    if (isMidday) return `Mittags-Radtour am ${dayName}`;
    if (isAfternoon) return `Nachmittags-Radtour am ${dayName}`;
    if (isEvening) return `Feierabend-Radtour am ${dayName}`;
    if (isNight) return `Nächtliche Radtour am ${dayName}`;
    return `Radtour am ${dayName}`;
  }

  if (movement === 'drive') {
    if (isMorning) return `Morgendliche Fahrt am ${dayName}`;
    if (isEvening) return `Abendfahrt am ${dayName}`;
    return `Fahrt am ${dayName}`;
  }

  if (movement === 'stationary') {
    return `Kurzer Stopp am ${dayName}`;
  }

  if (movement === 'walk') {
    if (isMorning) return `Morgenspaziergang am ${dayName}`;
    if (isMidday) return `Mittagsspaziergang am ${dayName}`;
    if (isAfternoon) return `Nachmittagsspaziergang am ${dayName}`;
    if (isEvening) return `Abendspaziergang am ${dayName}`;
    if (isNight) return `Nächtlicher Spaziergang am ${dayName}`;
    return `Spaziergang am ${dayName}`;
  }

  // Generic
  if (isMorning) return `Morgendliche Tour am ${dayName}`;
  if (isMidday) return `Mittagsrunde am ${dayName}`;
  if (isAfternoon) return `Nachmittagstour am ${dayName}`;
  if (isEvening) return `Feierabendrunde am ${dayName}`;
  return `Nachttour am ${dayName}`;
}

/**
 * Erstellt einen vollautomatischen, kontextuellen Aufzeichnungs-Titel basierend auf
 * Geokoordinaten, Streckenverlauf, Geschwindigkeit und Wochentag.
 */
export async function generateSmartTrackTitle(options: GenerateTrackTitleOptions): Promise<string> {
  const { startedAt, endedAt, points = [] } = options;
  const reverseFn = options.reverseGeocodeFn ?? reverseGeocode;

  // 1. Fall: Keine oder nur ein einzelner GPS-Punkt
  if (points.length === 0) {
    return formatTimeBasedTrackTitle(startedAt, 'generic');
  }

  if (points.length === 1) {
    const pt = points[0];
    const geo = await reverseFn({ lat: pt.lat, lng: pt.lng }).catch(() => null);
    const place = extractPlaceLabel(geo);
    if (place) {
      if (place.kind === 'poi' || place.kind === 'nature') {
        return `Stopp bei ${place.label}`;
      }
      return `Stopp in ${place.label}`;
    }
    return formatTimeBasedTrackTitle(startedAt, 'stationary');
  }

  // 2. Metriken und Bewegungsart ermitteln
  const metrics = calculateTrackMetrics(points, startedAt, endedAt);
  const movement = inferMovementType(
    metrics.speedKmh,
    metrics.totalDistanceMeters,
    metrics.durationMs,
    metrics.elevationGain
  );

  const startPt = points[0];
  const endPt = points[points.length - 1];

  // Ist es eine Rundtour (Start und Ende nah beieinander im Verhältnis zur Gesamtstrecke)?
  const isLoop =
    metrics.straightLineMeters < 350 ||
    (metrics.totalDistanceMeters >= 500 &&
      metrics.straightLineMeters / metrics.totalDistanceMeters < 0.28);

  // 3. Geokodierung für Startpunkt durchführen
  const startGeo = await reverseFn({ lat: startPt.lat, lng: startPt.lng }).catch(() => null);
  const startPlace = extractPlaceLabel(startGeo);

  // Falls es keine Rundtour ist und nennenswerte Luftlinie vorliegt, auch Endpunkt geokodieren
  let endPlace: ExtractedPlace | null = null;
  if (!isLoop && metrics.straightLineMeters >= 350) {
    const endGeo = await reverseFn({ lat: endPt.lat, lng: endPt.lng }).catch(() => null);
    endPlace = extractPlaceLabel(endGeo);
  }

  // 4. Titel zusammensetzen

  // Fall A: Start- und Zielort sind verschieden ("von A nach B")
  if (
    startPlace &&
    endPlace &&
    startPlace.label.trim().toLowerCase() !== endPlace.label.trim().toLowerCase()
  ) {
    const s = startPlace.label.trim();
    const e = endPlace.label.trim();
    if (movement === 'drive') return `Fahrt von ${s} nach ${e}`;
    if (movement === 'bike') return `Radtour von ${s} nach ${e}`;
    if (movement === 'hike') return `Wanderung von ${s} nach ${e}`;
    return `Spaziergang von ${s} nach ${e}`;
  }

  // Fall B: Einzelner Ort, Rundtour oder Start/Ende im selben Ort
  const activePlace = startPlace || endPlace;
  if (activePlace) {
    if (movement === 'stationary') {
      if (activePlace.kind === 'poi' || activePlace.kind === 'nature') {
        return `Stopp bei ${activePlace.label}`;
      }
      return `Stopp in ${activePlace.label}`;
    }

    const prep = formatPrepositionAndPlace(activePlace);
    if (movement === 'drive') {
      return `Fahrt ${prep}`;
    }
    if (movement === 'bike') {
      return `Radtour ${prep}`;
    }
    if (movement === 'hike') {
      return `Wanderung ${prep}`;
    }
    if (movement === 'walk') {
      if (isLoop && (activePlace.kind === 'district' || activePlace.kind === 'city')) {
        return `Runde ${prep}`;
      }
      return `Spaziergang ${prep}`;
    }
    return `Tour ${prep}`;
  }

  // Fall C: Keine Geodaten auffindbar (z. B. offline, kein Treffer) -> Zeit-Fallback
  return formatTimeBasedTrackTitle(startedAt, movement);
}

import { db } from '../db/index.js';

export interface RouteCoordinates {
  lat: number;
  lng: number;
}

export interface DirectionsParams {
  from: RouteCoordinates;
  to: RouteCoordinates;
  transportType?: string;
  profile?: string;
  preference?: 'fastest' | 'shortest';
}

export interface RouteResult {
  coordinates: [number, number][]; // [lat, lng] für Leaflet
  distance_meters: number;
  duration_seconds: number;
  profile: string;
}

export interface DirectionsResponse {
  supported: boolean;
  reason?: string;
  routes: RouteResult[];
}

const selectCacheStmt = db.prepare(
  'SELECT response_json FROM routing_cache WHERE profile = ? AND from_lat = ? AND from_lng = ? AND to_lat = ? AND to_lng = ? LIMIT 1'
);

const insertCacheStmt = db.prepare(
  'INSERT INTO routing_cache (profile, from_lat, from_lng, to_lat, to_lng, response_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
);

/**
 * Mappt Reisotor-Verkehrsmittel ('Auto', 'Fahrrad', 'zu Fuß') oder Profil-Namen auf ORS-Profile.
 */
export function mapTransportToProfile(
  transportType?: string,
  explicitProfile?: string
): string | null {
  if (explicitProfile) {
    const valid = [
      'driving-car',
      'cycling-regular',
      'cycling-mountain',
      'cycling-road',
      'foot-walking',
      'foot-hiking',
    ];
    if (valid.includes(explicitProfile)) return explicitProfile;
  }

  const normalized = (transportType ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'auto':
    case 'car':
    case 'driving':
    case 'driving-car':
      return 'driving-car';
    case 'fahrrad':
    case 'rad':
    case 'bike':
    case 'cycling':
    case 'cycling-regular':
      return 'cycling-regular';
    case 'zu fuß':
    case 'zu fuss':
    case 'fuss':
    case 'fuß':
    case 'foot':
    case 'walking':
    case 'foot-walking':
      return 'foot-walking';
    default:
      return null;
  }
}

/**
 * Rundet Koordinaten auf 5 Nachkommastellen (ca. 1.1m Genauigkeit).
 */
export function roundCoord(val: number): number {
  return Number(val.toFixed(5));
}

/**
 * Berechnet die ungefähre Luftlinien-Distanz zweier Punkte in Kilometern (Haversine-Formel).
 * Wird verwendet, um ORS-Limits für alternative Routen (max. ca. 100 km) einzuhalten.
 */
export function haversineDistanceKm(from: RouteCoordinates, to: RouteCoordinates): number {
  const R = 6371; // Erdradius in km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Holt eine Route von OpenRouteService oder aus dem lokalen SQLite-Cache.
 */
export async function getDirections(params: DirectionsParams): Promise<DirectionsResponse> {
  const profile = mapTransportToProfile(params.transportType, params.profile);
  if (!profile) {
    return {
      supported: false,
      reason: `Verkehrsmittel "${params.transportType ?? 'unbekannt'}" wird nicht für exaktes Straßen-/Wege-Routing unterstützt.`,
      routes: [],
    };
  }

  const fromLat = roundCoord(params.from.lat);
  const fromLng = roundCoord(params.from.lng);
  const toLat = roundCoord(params.to.lat);
  const toLng = roundCoord(params.to.lng);

  const normalizedPref = params.preference === 'shortest' ? 'shortest' : 'fastest';
  const cacheProfile = `${profile}:${normalizedPref}`;

  // 1. Im SQLite-Cache prüfen
  let cached = selectCacheStmt.get(cacheProfile, fromLat, fromLng, toLat, toLng) as
    { response_json: string } | undefined;

  // Abwärtskompatibilität: Falls keine Präferenz oder standardmäßig 'fastest', frühere Cache-Einträge ohne Suffix prüfen
  if (!cached && normalizedPref === 'fastest') {
    cached = selectCacheStmt.get(profile, fromLat, fromLng, toLat, toLng) as
      { response_json: string } | undefined;
  }

  if (cached) {
    try {
      const parsed = JSON.parse(cached.response_json) as DirectionsResponse;
      return parsed;
    } catch {
      // Ignoriere korrupten Cache-Eintrag
    }
  }

  // 2. ORS API Key prüfen
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return {
      supported: false,
      reason: 'OpenRouteService API-Key ist auf dem Server nicht konfiguriert (ORS_API_KEY fehlt).',
      routes: [],
    };
  }

  // 3. OpenRouteService anfragen
  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;
  const distKm = haversineDistanceKm(params.from, params.to);
  const canHaveAlternatives = distKm <= 95;

  const body: Record<string, unknown> = {
    coordinates: [
      [fromLng, fromLat],
      [toLng, toLat],
    ],
    preference: normalizedPref,
  };

  if (canHaveAlternatives) {
    body.alternative_routes = {
      target_count: 3,
      weight_factor: 1.6,
      share_factor: 0.8,
    };
  }

  try {
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    // Fallback: Falls alternative_routes vom ORS-Server abgelehnt wurden (z. B. Server-Limits oder unerwartete Restriktionen),
    // versuchen wir es ohne Alternativen nochmals direkt.
    if (!res.ok && body.alternative_routes) {
      delete body.alternative_routes;
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        supported: false,
        reason: `OpenRouteService meldete Fehler (${res.status}): ${errText || res.statusText}`,
        routes: [],
      };
    }

    const data = (await res.json()) as {
      features?: Array<{
        geometry?: {
          coordinates?: [number, number][]; // GeoJSON ist [lng, lat]
        };
        properties?: {
          summary?: {
            distance?: number;
            duration?: number;
          };
        };
      }>;
    };

    if (!data.features || data.features.length === 0) {
      return {
        supported: false,
        reason: 'Keine Route zwischen den angegebenen Punkten gefunden.',
        routes: [],
      };
    }

    // Maximal 3 Routen übernehmen
    const routes: RouteResult[] = data.features.slice(0, 3).map((f) => {
      const geoCoords = f.geometry?.coordinates ?? [];
      // Konvertiere GeoJSON [lng, lat] in Leaflet-kompatibles [lat, lng]
      const leafletCoords: [number, number][] = geoCoords.map(([lng, lat]) => [lat, lng]);
      return {
        coordinates: leafletCoords,
        distance_meters: Math.round(f.properties?.summary?.distance ?? 0),
        duration_seconds: Math.round(f.properties?.summary?.duration ?? 0),
        profile,
      };
    });

    const result: DirectionsResponse = {
      supported: true,
      routes,
    };

    // Im Cache persistieren
    insertCacheStmt.run(
      cacheProfile,
      fromLat,
      fromLng,
      toLat,
      toLng,
      JSON.stringify(result),
      new Date().toISOString()
    );

    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      supported: false,
      reason: `Routing-Anfrage fehlgeschlagen: ${msg}`,
      routes: [],
    };
  }
}

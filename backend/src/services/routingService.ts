import { db } from '../db/index.js';
import { getEffectiveSetting } from '../instanceSettings.js';

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

export interface RouteSummaryResult {
  distance_meters: number;
  duration_seconds: number | null;
  profile: 'foot-walking' | 'cycling-regular' | 'driving-car';
  is_fallback: boolean;
}

export interface BatchRouteRequestItem {
  key: string;
  from: RouteCoordinates;
  to: RouteCoordinates;
  profile?: 'foot-walking' | 'cycling-regular' | 'driving-car';
}

/**
 * Ermittelt kompakte Routen-Zusammenfassungen (Distanz + Dauer) für eine Liste von Start-Ziel-Paaren.
 * Nutzt primär den SQLite routing_cache; für Cache-Misses wird getDirections aufgerufen.
 * Kann kein Straßen-Routing ermittelt werden (oder fehlt der ORS_API_KEY), wird die Haversine-Luftlinie
 * mit is_fallback: true zurückgegeben.
 */
export async function getBatchRouteSummaries(
  items: BatchRouteRequestItem[]
): Promise<Record<string, RouteSummaryResult>> {
  const results: Record<string, RouteSummaryResult> = {};
  const missingQueue: BatchRouteRequestItem[] = [];

  for (const item of items) {
    const profile = item.profile ?? 'driving-car';
    const fromLat = roundCoord(item.from.lat);
    const fromLng = roundCoord(item.from.lng);
    const toLat = roundCoord(item.to.lat);
    const toLng = roundCoord(item.to.lng);

    // Identische Koordinaten -> 0 Meter Distanz
    if (fromLat === toLat && fromLng === toLng) {
      results[item.key] = {
        distance_meters: 0,
        duration_seconds: 0,
        profile,
        is_fallback: false,
      };
      continue;
    }

    const cacheProfile = `${profile}:fastest`;
    let cached = selectCacheStmt.get(cacheProfile, fromLat, fromLng, toLat, toLng) as
      { response_json: string } | undefined;

    if (!cached) {
      cached = selectCacheStmt.get(profile, fromLat, fromLng, toLat, toLng) as
        { response_json: string } | undefined;
    }

    if (cached) {
      try {
        const parsed = JSON.parse(cached.response_json) as DirectionsResponse;

        if (parsed.supported && parsed.routes?.length > 0) {
          results[item.key] = {
            distance_meters: parsed.routes[0].distance_meters,
            duration_seconds: parsed.routes[0].duration_seconds,
            profile,
            is_fallback: false,
          };
          continue;
        }
      } catch {
        // Cache-Eintrag korrupt -> neu anfragen
      }
    }

    missingQueue.push(item);
  }

  if (missingQueue.length === 0) {
    return results;
  }

  // Max. 3 gleichzeitige Anfragen an getDirections, um Rate-Limits zu schonen
  const CONCURRENCY = 3;

  for (let i = 0; i < missingQueue.length; i += CONCURRENCY) {
    const chunk = missingQueue.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (item) => {
        const profile = item.profile ?? 'driving-car';

        try {
          const directions = await getDirections({
            from: item.from,
            to: item.to,
            profile,
            preference: 'fastest',
          });

          if (directions.supported && directions.routes?.length > 0) {
            results[item.key] = {
              distance_meters: directions.routes[0].distance_meters,
              duration_seconds: directions.routes[0].duration_seconds,
              profile,
              is_fallback: false,
            };
            return;
          }
        } catch {
          // Fehler bei getDirections -> Fallback greift unten
        }

        // Fallback: Haversine-Luftlinie
        const airKm = haversineDistanceKm(item.from, item.to);
        results[item.key] = {
          distance_meters: Math.round(airKm * 1000),
          duration_seconds: null,
          profile,
          is_fallback: true,
        };
      })
    );
  }

  return results;
}

export interface DirectionsResponse {
  supported: boolean;
  reason?: string;
  details?: string;
  routes: RouteResult[];
}

interface OrsErrorInfo {
  code?: number;
  message?: string;
}

interface OrsFailureSnapshot {
  status: number;
  statusText: string;
  rawText: string;
  parsed: OrsErrorInfo;
}

const EARTH_RADIUS_KM = 6371;
const MAX_ALTERNATIVE_DISTANCE_KM = 95;
const MAX_ALTERNATIVE_ROUTES = 3;
const ALTERNATIVE_WEIGHT_FACTOR = 1.6;
const ALTERNATIVE_SHARE_FACTOR = 0.8;
const ORS_TIMEOUT_MS = 25_000;
const ORS_UNLIMITED_SNAPPING_RADIUS = -1;
const ORS_ERROR_ROUTABLE_POINT_NOT_FOUND = 2010;
const ORS_ERROR_UNKNOWN = 2099;
const MAX_ORS_ATTEMPTS = 3;
const HTTP_NOT_FOUND = 404;
const COORD_PRECISION_DECIMALS = 5;
const HALF_CIRCLE_DEG = 180;

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

    if (valid.includes(explicitProfile)) {
      return explicitProfile;
    }
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
  return Number(val.toFixed(COORD_PRECISION_DECIMALS));
}

/**
 * Berechnet die ungefähre Luftlinien-Distanz zweier Punkte in Kilometern (Haversine-Formel).
 * Wird verwendet, um ORS-Limits für alternative Routen (max. ca. 100 km) einzuhalten.
 */
export function haversineDistanceKm(from: RouteCoordinates, to: RouteCoordinates): number {
  const dLat = ((to.lat - from.lat) * Math.PI) / HALF_CIRCLE_DEG;
  const dLng = ((to.lng - from.lng) * Math.PI) / HALF_CIRCLE_DEG;
  const haversineHalf =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / HALF_CIRCLE_DEG) *
      Math.cos((to.lat * Math.PI) / HALF_CIRCLE_DEG) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversineHalf), Math.sqrt(1 - haversineHalf));
  return EARTH_RADIUS_KM * centralAngle;
}

function parseOrsError(rawText: string): OrsErrorInfo {
  if (!rawText) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawText) as {
      error?: { code?: unknown; message?: unknown };
    };
    const code = typeof parsed?.error?.code === 'number' ? parsed.error.code : undefined;
    const message = typeof parsed?.error?.message === 'string' ? parsed.error.message : undefined;
    return { code, message };
  } catch {
    return {};
  }
}

function isRoutablePointError(status: number, parsed: OrsErrorInfo, rawText: string): boolean {
  if (parsed.code === ORS_ERROR_ROUTABLE_POINT_NOT_FOUND) {
    return true;
  }

  if (
    status === HTTP_NOT_FOUND &&
    /could not find routable point/i.test(parsed.message ?? rawText)
  ) {
    return true;
  }

  return false;
}

function formatUnroutablePointMessage(profile: string): string {
  switch (profile) {
    case 'driving-car':
      return 'Für „Auto“ wurde in der Nähe von Start oder Ziel keine befahrbare Straße gefunden.';
    case 'cycling-regular':
    case 'cycling-mountain':
    case 'cycling-road':
      return 'Für „Fahrrad“ wurde in der Nähe von Start oder Ziel kein befahrbarer Weg gefunden.';
    case 'foot-walking':
    case 'foot-hiking':
      return 'Für „zu Fuß“ wurde in der Nähe von Start oder Ziel kein begehbarer Weg gefunden.';
    default:
      return 'In der Nähe von Start oder Ziel wurde kein routbarer Weg gefunden.';
  }
}

function formatOrsFailureReason(failure: OrsFailureSnapshot, profile: string): string {
  if (
    isRoutablePointError(failure.status, failure.parsed, failure.rawText) ||
    failure.parsed.code === ORS_ERROR_UNKNOWN
  ) {
    return formatUnroutablePointMessage(profile);
  }

  if (failure.parsed.message) {
    return `OpenRouteService-Fehler (${failure.status}): ${failure.parsed.message}`;
  }

  const fallbackText = failure.rawText || failure.statusText || 'Unbekannter Fehler';
  return `OpenRouteService meldete Fehler (${failure.status}): ${fallbackText}`;
}

async function postOrsDirections(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
  });
}

async function requestOrsWithFallbacks(
  url: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ res: Response; failure: OrsFailureSnapshot | null }> {
  let triedExpandedRadius = false;
  let triedWithoutAlternatives = false;
  let initialFailure: OrsFailureSnapshot | null = null;
  let lastMeaningfulFailure: OrsFailureSnapshot | null = null;
  let res: Response | null = null;

  for (let attempt = 0; attempt < MAX_ORS_ATTEMPTS; attempt += 1) {
    res = await postOrsDirections(url, apiKey, body);

    if (res.ok) {
      return { res, failure: null };
    }

    const rawText = await res.text().catch(() => '');
    const parsed = parseOrsError(rawText);
    const snapshot: OrsFailureSnapshot = {
      status: res.status,
      statusText: res.statusText ?? '',
      rawText,
      parsed,
    };

    if (!initialFailure) {
      initialFailure = snapshot;
    }

    if (parsed.code !== ORS_ERROR_UNKNOWN && (parsed.message || rawText)) {
      lastMeaningfulFailure = snapshot;
    }

    if (isRoutablePointError(res.status, parsed, rawText) && !triedExpandedRadius) {
      // Standard-Snapping von ORS ist 350m – bei Spots im Wald/Park/Moor (z. B. Teufelsseemoor)
      // liegt die nächste Autostraße oft etwas weiter entfernt. Mit -1 nutzt ORS den maximal
      // erlaubten Server-Suchradius.
      triedExpandedRadius = true;
      body.radiuses = [ORS_UNLIMITED_SNAPPING_RADIUS, ORS_UNLIMITED_SNAPPING_RADIUS];
      continue;
    }

    if (body.alternative_routes && !triedWithoutAlternatives) {
      // Fallback: Falls alternative_routes vom ORS-Server abgelehnt wurden (z. B. Server-Limits
      // oder unerwartete Restriktionen), versuchen wir es ohne Alternativen nochmals direkt.
      triedWithoutAlternatives = true;
      delete body.alternative_routes;
      continue;
    }

    break;
  }

  return {
    res: res!,
    failure: lastMeaningfulFailure ?? initialFailure,
  };
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
  const apiKey = getEffectiveSetting('ors_api_key', 'ORS_API_KEY').trim();

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
  const canHaveAlternatives = distKm <= MAX_ALTERNATIVE_DISTANCE_KM;

  const body: Record<string, unknown> = {
    coordinates: [
      [fromLng, fromLat],
      [toLng, toLat],
    ],
    preference: normalizedPref,
  };

  if (canHaveAlternatives) {
    body.alternative_routes = {
      target_count: MAX_ALTERNATIVE_ROUTES,
      weight_factor: ALTERNATIVE_WEIGHT_FACTOR,
      share_factor: ALTERNATIVE_SHARE_FACTOR,
    };
  }

  try {
    const { res, failure } = await requestOrsWithFallbacks(url, apiKey, body);

    if (!res.ok) {
      const resolvedFailure: OrsFailureSnapshot = failure ?? {
        status: res.status,
        statusText: res.statusText ?? '',
        rawText: '',
        parsed: {},
      };
      const reason = formatOrsFailureReason(resolvedFailure, profile);
      const rawDetail = resolvedFailure.rawText || resolvedFailure.statusText;
      const details = [
        `Profil: ${profile} (${normalizedPref})`,
        `Koordinaten: [${fromLat}, ${fromLng}] -> [${toLat}, ${toLng}]`,
        `OpenRouteService HTTP ${resolvedFailure.status}: ${rawDetail}`,
      ].join('\n');
      return {
        supported: false,
        reason,
        details,
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
    const routes: RouteResult[] = data.features.slice(0, MAX_ALTERNATIVE_ROUTES).map((feature) => {
      const geoCoords = feature.geometry?.coordinates ?? [];
      // Konvertiere GeoJSON [lng, lat] in Leaflet-kompatibles [lat, lng]
      const leafletCoords: [number, number][] = geoCoords.map(([lng, lat]) => [lat, lng]);
      return {
        coordinates: leafletCoords,
        distance_meters: Math.round(feature.properties?.summary?.distance ?? 0),
        duration_seconds: Math.round(feature.properties?.summary?.duration ?? 0),
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
      details: err instanceof Error ? err.stack || msg : msg,
      routes: [],
    };
  }
}

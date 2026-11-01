export interface CountryLocation {
  code: string;
  name: string;
}

interface NominatimReverseResponse {
  address?: {
    country?: string;
    country_code?: string;
  };
}

/** Reverse-Geocoding einmalig aus lat/lng (siehe routes/trips.ts's GET /trips/:id/region-info) –
 *  serverseitig, da Nominatims Nutzungsbedingungen einen eigenen User-Agent-Header verlangen, den
 *  Browser-`fetch()` nicht setzen kann. 5s-Timeout + null bei Fehlschlag, gleiches Fehlertoleranz-
 *  Muster wie mapsLink.ts's resolveLatLng() – ein fehlgeschlagener Lookup soll den Rest des
 *  Dashboards nicht blockieren. */
export async function resolveCountry(lat: number, lng: number): Promise<CountryLocation | null> {
  const params = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lng),
    zoom: '3',
    addressdetails: '1',
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Reisotor/1.0 (Reiseplanungs-App, privater Nutzer)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimReverseResponse;
    const code = data.address?.country_code?.toUpperCase();
    const name = data.address?.country;
    if (!code || !name) return null;
    return { code, name };
  } catch {
    return null;
  }
}

export interface RegionInfo {
  languages: string[];
  currency: { code: string; name: string } | null;
  /** Wechselkurs 1 Urlaubswährung -> Heimatwährung, null falls identisch oder nicht ermittelbar. */
  exchangeRate: number | null;
  advisory: { score: number; message: string } | null;
}

interface RestCountryResponse {
  languages?: Record<string, string>;
  currencies?: Record<string, { name: string; symbol?: string }>;
}

interface ExchangeRateResponse {
  result: string;
  rates?: Record<string, number>;
}

interface AuswaertigesAmtWarningItem {
  countryCode?: string;
  countryName?: string;
  warning?: boolean;
  partialWarning?: boolean;
  situationWarning?: boolean;
  situationPartWarning?: boolean;
}

interface AuswaertigesAmtResponse {
  response?: Record<string, AuswaertigesAmtWarningItem>;
}

interface CountryBaseInfo {
  languages: string[];
  currency: { code: string; name: string } | null;
  exchangeRate: number | null;
}

// Server-seitiger In-Memory-Cache pro Ländercode & Heimatwährung – die externen Stammdaten ändern sich selten
// (Sprache/Währung praktisch nie, Wechselkurs höchstens täglich), spart wiederholte Aufrufe bei
// jedem Dashboard-Besuch.
const BASE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const baseCache = new Map<string, { expiresAt: number; data: CountryBaseInfo }>();

// 6-Stunden-Cache für die weltweite Reise- und Sicherheitshinweise-Liste des Auswärtigen Amts.
// Wird unabhängig von den Länder-Stammdaten gecacht, damit Sicherheits-Updates nach 6h direkt
// wirksam werden, ohne auf das 12h-Ablaufen der Länderdaten warten zu müssen.
const AA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let aaCache: {
  expiresAt: number;
  data: Map<string, { score: number; message: string }>;
} | null = null;
let aaFetchPromise: Promise<Map<string, { score: number; message: string }> | null> | null = null;

/** Test-Hilfe zum Zurücksetzen der internen Caches */
export function _resetRegionInfoCache(): void {
  baseCache.clear();
  aaCache = null;
  aaFetchPromise = null;
}

/** Ruft die weltweite Liste der Reise- und Sicherheitshinweise des Auswärtigen Amts ab.
 *  Liefert eine Map von ISO-2-Ländercode -> { score, message }.
 *  Wird für 6 Stunden im Speicher gehalten, um unnötige Abfragen zu vermeiden. */
async function getAuswaertigesAmtAdvisories(): Promise<Map<
  string,
  { score: number; message: string }
> | null> {
  if (aaCache && aaCache.expiresAt > Date.now()) {
    return aaCache.data;
  }
  if (aaFetchPromise) {
    return aaFetchPromise;
  }

  aaFetchPromise = (async () => {
    try {
      const res = await fetch('https://www.auswaertiges-amt.de/opendata/travelwarning', {
        signal: AbortSignal.timeout(5000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Reisotor/1.0 (Reiseplanungs-App, privater Nutzer)',
        },
      });
      if (!res.ok) {
        return aaCache ? aaCache.data : null;
      }
      const data = (await res.json()) as AuswaertigesAmtResponse;
      const map = new Map<string, { score: number; message: string }>();

      if (data.response) {
        for (const val of Object.values(data.response)) {
          if (!val || typeof val !== 'object' || !val.countryCode) continue;
          const code = val.countryCode.toUpperCase();
          let score = 1.0;
          let message = 'Keine Reisewarnung';

          if (val.warning) {
            score = 5.0;
            message = 'Reisewarnung';
          } else if (val.partialWarning) {
            score = 3.0;
            message = 'Teilreisewarnung';
          } else if (val.situationWarning || val.situationPartWarning) {
            score = 2.5;
            message = 'Lagebedingter Sicherheitshinweis';
          }

          map.set(code, { score, message });
        }
      }

      aaCache = { expiresAt: Date.now() + AA_CACHE_TTL_MS, data: map };
      return map;
    } catch {
      return aaCache ? aaCache.data : null;
    } finally {
      aaFetchPromise = null;
    }
  })();

  return aaFetchPromise;
}

async function getCountryBaseInfo(
  normalizedCountryCode: string,
  homeCurrency: string | null
): Promise<CountryBaseInfo> {
  const cacheKey = `${normalizedCountryCode}|${homeCurrency ?? ''}`;
  const cached = baseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  let languages: string[] = [];
  let currency: { code: string; name: string } | null = null;

  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${normalizedCountryCode}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as RestCountryResponse[];
      languages = Object.values(data[0]?.languages ?? {});
      const currencyEntry = Object.entries(data[0]?.currencies ?? {})[0];
      if (currencyEntry) {
        currency = { code: currencyEntry[0], name: currencyEntry[1].name };
      }
    }
  } catch {
    // Fehler bei REST Countries tolerieren
  }

  let exchangeRate: number | null = null;
  if (currency && homeCurrency && currency.code !== homeCurrency) {
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${currency.code}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = (await res.json()) as ExchangeRateResponse;
        exchangeRate = data.rates?.[homeCurrency] ?? null;
      }
    } catch {
      exchangeRate = null;
    }
  }

  const baseInfo: CountryBaseInfo = { languages, currency, exchangeRate };
  baseCache.set(cacheKey, { expiresAt: Date.now() + BASE_CACHE_TTL_MS, data: baseInfo });
  return baseInfo;
}

/** Holt Sprache(n)/Währung (REST Countries), Wechselkurs zur Heimatwährung (open.er-api.com)
 *  und amtliche Reisehinweise (Auswärtiges Amt Open Data). Alle APIs werden fehlertolerant
 *  behandelt: Ein Fehlschlag einzelner Dienste lässt nur den jeweiligen Teil leer/null. */
export async function fetchRegionInfo(
  countryCode: string,
  homeCurrency: string | null
): Promise<RegionInfo> {
  const normalizedCountryCode = countryCode.toUpperCase();

  const [baseInfoResult, advisoryMapResult] = await Promise.allSettled([
    getCountryBaseInfo(normalizedCountryCode, homeCurrency),
    getAuswaertigesAmtAdvisories(),
  ]);

  const baseInfo: CountryBaseInfo =
    baseInfoResult.status === 'fulfilled'
      ? baseInfoResult.value
      : { languages: [], currency: null, exchangeRate: null };

  const advisoryMap = advisoryMapResult.status === 'fulfilled' ? advisoryMapResult.value : null;
  const advisory = advisoryMap?.get(normalizedCountryCode) ?? null;

  return {
    ...baseInfo,
    advisory,
  };
}

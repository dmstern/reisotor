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

// Server-seitiger In-Memory-Cache pro Ländercode – die externen APIs ändern sich selten (Sprache/
// Währung praktisch nie, Wechselkurs höchstens täglich), spart wiederholte Aufrufe bei
// jedem Dashboard-Besuch. Analog zu utils/weather.ts's Modul-Cache im Frontend, hier aber mit TTL
// statt "ein Fetch pro Session", da das Backend dauerhaft läuft.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; data: RegionInfo }>();

/** Holt Sprache(n)/Währung (REST Countries) und Wechselkurs zur Heimatwährung (open.er-api.com).
 *  Sicherheitshinweise/Advisories waren zuvor via travel-advisory.info angebunden, das jedoch
 *  offline gegangen ist; die Neu-Implementierung mit funktionierendem Anbieter wird in
 *  Issue #638 nachverfolgt (advisory bleibt vorerst null für Abwärtskompatibilität). */
export async function fetchRegionInfo(
  countryCode: string,
  homeCurrency: string | null
): Promise<RegionInfo> {
  const cacheKey = `${countryCode}|${homeCurrency ?? ''}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  let languages: string[] = [];
  let currency: { code: string; name: string } | null = null;

  try {
    const res = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`, {
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

  // travel-advisory.info ist offline (siehe Issue #638 für Neu-Anbindung)
  const advisory: { score: number; message: string } | null = null;

  const info: RegionInfo = { languages, currency, exchangeRate, advisory };
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: info });
  return info;
}

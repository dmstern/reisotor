/** Reverse-Geocoding einmalig aus lat/lng (siehe routes/trips.ts's GET /trips/:id/region-info) –
 *  serverseitig, da Nominatims Nutzungsbedingungen einen eigenen User-Agent-Header verlangen, den
 *  Browser-`fetch()` nicht setzen kann. 5s-Timeout + null bei Fehlschlag, gleiches Fehlertoleranz-
 *  Muster wie mapsLink.ts's resolveLatLng() – ein fehlgeschlagener Lookup soll den Rest des
 *  Dashboards nicht blockieren. */
export async function resolveCountry(lat, lng) {
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
        if (!res.ok)
            return null;
        const data = (await res.json());
        const code = data.address?.country_code?.toUpperCase();
        const name = data.address?.country;
        if (!code || !name)
            return null;
        return { code, name };
    }
    catch {
        return null;
    }
}
// Server-seitiger In-Memory-Cache pro Ländercode – die externen APIs ändern sich selten (Sprache/
// Währung praktisch nie, Wechselkurs/Reisewarnung höchstens täglich), spart wiederholte Aufrufe bei
// jedem Dashboard-Besuch. Analog zu utils/weather.ts's Modul-Cache im Frontend, hier aber mit TTL
// statt "ein Fetch pro Session", da das Backend dauerhaft läuft.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const cache = new Map();
/** Holt Sprache(n)/Währung (REST Countries), Wechselkurs zur Heimatwährung (open.er-api.com) und
 *  eine Sicherheits-Einschätzung (travel-advisory.info) – alle drei unabhängig fehlertolerant
 *  (Promise.allSettled, gleiches Muster wie das Wetter-Widget: ein Teilausfall blendet nur diesen
 *  Teil aus, statt die ganze Anfrage scheitern zu lassen). Alle drei APIs sind kostenlos/keylos,
 *  passend zum bestehenden Open-Meteo-Präzedenzfall dieser App. */
export async function fetchRegionInfo(countryCode, homeCurrency) {
    const cacheKey = `${countryCode}|${homeCurrency ?? ''}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now())
        return cached.data;
    const [countryResult, advisoryResult] = await Promise.allSettled([
        fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`, {
            signal: AbortSignal.timeout(5000),
        }).then((res) => res.ok
            ? res.json()
            : Promise.reject(new Error(String(res.status)))),
        fetch(`https://www.travel-advisory.info/api?countrycode=${countryCode}`, {
            signal: AbortSignal.timeout(5000),
        }).then((res) => res.ok
            ? res.json()
            : Promise.reject(new Error(String(res.status)))),
    ]);
    const languages = countryResult.status === 'fulfilled'
        ? Object.values(countryResult.value[0]?.languages ?? {})
        : [];
    const currencyEntry = countryResult.status === 'fulfilled'
        ? Object.entries(countryResult.value[0]?.currencies ?? {})[0]
        : undefined;
    const currency = currencyEntry ? { code: currencyEntry[0], name: currencyEntry[1].name } : null;
    let exchangeRate = null;
    if (currency && homeCurrency && currency.code !== homeCurrency) {
        try {
            const res = await fetch(`https://open.er-api.com/v6/latest/${currency.code}`, {
                signal: AbortSignal.timeout(5000),
            });
            if (res.ok) {
                const data = (await res.json());
                exchangeRate = data.rates?.[homeCurrency] ?? null;
            }
        }
        catch {
            exchangeRate = null;
        }
    }
    const advisory = advisoryResult.status === 'fulfilled'
        ? (() => {
            const entry = Object.values(advisoryResult.value.data ?? {})[0]?.advisory;
            return entry?.score != null && entry?.message
                ? { score: entry.score, message: entry.message }
                : null;
        })()
        : null;
    const info = { languages, currency, exchangeRate, advisory };
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: info });
    return info;
}

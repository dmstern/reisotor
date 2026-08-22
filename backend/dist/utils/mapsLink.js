// Dieselben Muster wie im Frontend (frontend/src/utils/googleMaps.ts) – bewusst dupliziert statt
// über ein Shared-Package geteilt, da Frontend/Backend hier getrennte Build-Pipelines haben.
// Deckt sowohl Google-Maps- als auch Apple-Maps-Linkformate ab.
const PATTERNS = [
    // !3d/!4d zuerst: kodiert die exakte Position des Pins/Orts. Google-Maps-URLs (v. a. die nach
    // Kurzlink-Redirect aufgelösten) enthalten oft ZUSÄTZLICH ein führendes "@lat,lng,zoom" – das ist
    // aber nur der Kartenausschnitt der (oft weit herausgezoomten) Zwischenseite, nicht der Ort
    // selbst. Bei falscher Reihenfolge landen dadurch viele unterschiedliche Orte fälschlich auf
    // demselben groben Stadt-/Regionsmittelpunkt statt auf ihrer echten Position.
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /coordinate=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // Apple Maps: ?coordinate=48.2082,16.3738
    /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/,
];
export function parseLatLngFromText(url) {
    // Manche Apple-Maps-Links kodieren das Komma im coordinate=/ll=-Parameter als %2C.
    let text = url;
    try {
        text = decodeURIComponent(url);
    }
    catch {
        // Ungültige Prozent-Kodierung – mit dem Rohtext weiterarbeiten.
    }
    for (const pattern of PATTERNS) {
        const match = pattern.exec(text);
        if (match) {
            const lat = Number(match[1]);
            const lng = Number(match[2]);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
                return { lat, lng };
            }
        }
    }
    return null;
}
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const FETCH_HEADERS = {
    'User-Agent': MOBILE_UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};
const MAX_REDIRECT_HOPS = 5;
/** Folgt dem Redirect eines Kurzlinks manuell, Hop für Hop, und parst NUR den `Location`-Header
 *  jeder Zwischenantwort – ohne die volle (JS-lastige) Zielseite selbst abzurufen. Google kodiert
 *  die Zielkoordinate bereits in der Redirect-Ziel-URL selbst (z. B. .../@lat,lng,zoom oder
 *  !3d.../!4d...), ein Follow bis zur fertig gerenderten Maps-Seite ist dafür gar nicht nötig – und
 *  genau DIESER letzte vollständige Seitenabruf ist der Schritt, an dem Googles Bot-Erkennung bei
 *  bestimmten Kurzlink-Varianten (siehe g_st=ic unten) ansetzt. redirect:'manual' liefert in Node
 *  (anders als im Browser, wo CORS einen undurchsichtigen "opaqueredirect"-Response erzwingt) einen
 *  normal lesbaren Response mit Location-Header, kein Sonderfall nötig. */
async function resolveViaRedirectHeaders(url) {
    let current = url;
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
        let res;
        try {
            res = await fetch(current, {
                redirect: 'manual',
                signal: AbortSignal.timeout(5000),
                headers: FETCH_HEADERS,
            });
        }
        catch {
            return null;
        }
        const location = res.headers.get('location');
        if (!location)
            return null;
        const resolved = new URL(location, current).toString();
        const direct = parseLatLngFromText(resolved);
        if (direct)
            return direct;
        current = resolved;
    }
    return null;
}
/** Löst einen Google-Maps-Link serverseitig zu Koordinaten auf. Volle Links werden direkt per
 *  Regex geparst; Kurzlinks (maps.app.goo.gl, goo.gl/maps) lassen sich clientseitig nicht auflösen
 *  (kein sichtbarer Redirect-Ziel-URL). Zwei serverseitige Strategien nacheinander: zuerst nur die
 *  Redirect-Header Hop für Hop lesen (resolveViaRedirectHeaders, siehe dortiger Kommentar – ruft nie
 *  die volle Zielseite ab), erst wenn das nichts liefert als Fallback die komplette Weiterleitung bis
 *  zur Zielseite verfolgen und deren finale URL parsen. Netzwerkfehler/Timeout führen zu `null`
 *  statt einem Fehler – Speichern soll auch ohne Koordinaten funktionieren. */
export async function resolveLatLng(url) {
    if (!url)
        return null;
    const direct = parseLatLngFromText(url);
    if (direct)
        return direct;
    // Best-effort, unbewiesene Theorie: "g_st=ic" markiert einen über das native Teilen-Menü ("in
    // context") erzeugten Kurzlink – genau diese Variante wurde wiederholt mit einem echten 403 von
    // Google blockiert (Bot-Erkennung), auch mit realistischem Browser-User-Agent. Den Parameter vor
    // dem Redirect-Follow zu entfernen kostet nichts und könnte in manchen Fällen helfen, ist aber
    // KEIN verlässlicher Fix – der eigentliche Fallback bleibt der manuelle Karten-Picker im Frontend
    // (LocationPicker.vue).
    const strippedUrl = url.replace(/([?&])g_st=[^&]*&?/, '$1').replace(/[?&]$/, '');
    const viaHeaders = await resolveViaRedirectHeaders(strippedUrl);
    if (viaHeaders)
        return viaHeaders;
    try {
        const res = await fetch(strippedUrl, {
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),
            headers: FETCH_HEADERS,
        });
        return parseLatLngFromText(res.url);
    }
    catch {
        return null;
    }
}
// Google kodiert den Ortsnamen bereits URL-kodiert im Pfad einer aufgelösten Maps-Link-Zielseite
// (.../maps/place/Caf%C3%A9+Central/@...) - kein zusätzlicher Request nötig, sobald man ohnehin
// schon die finale URL kennt.
function extractPlaceNameFromUrl(url) {
    const match = /\/maps\/place\/([^/@]+)/.exec(url);
    if (!match)
        return null;
    let name = match[1];
    try {
        name = decodeURIComponent(name);
    }
    catch {
        // Ungültige Prozent-Kodierung - mit dem Rohwert weiterarbeiten.
    }
    name = name.replace(/\+/g, ' ').trim();
    return name || null;
}
// Kein Places-API-Key vorhanden (kostenpflichtig) - das og:image-Meta-Tag der Zielseite ist der
// einzige ohne Zusatzkosten erreichbare Weg an ein ECHTES Foto des Orts zu kommen (statt nur des
// Kartenausschnitts aus tilePreviewUrl() oben). Reine Regex statt eines HTML-Parsers, analog zum
// bestehenden Muster in diesem Modul (parseLatLngFromText) - für ein einzelnes Meta-Tag ausreichend.
function extractOgImage(html) {
    const match = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i.exec(html);
    return match ? match[1] : null;
}
/** Best-effort-Vorschau (Titel/Foto) einer Maps-Link-Zielseite für ExcursionsView.vue's
 *  Spot-Anlegen-Formular - füllt Titel/Bild automatisch, sobald ein Maps-Link eingegeben wurde.
 *  Braucht (anders als resolveLatLng oben) zwingend die vollständige Zielseite (für og:image), kann
 *  also NICHT den bot-erkennungs-ärmeren Redirect-Header-Pfad nutzen - liefert bei einer
 *  fehlgeschlagenen Auflösung einfach leere Felder statt eines Fehlers, das Formular bleibt ohne
 *  Vorschau normal nutzbar. Keine Kategorie-Erkennung: dafür gibt es ohne kostenpflichtige
 *  Places-API kein verlässliches Signal. */
export async function fetchPlacePreview(url) {
    if (!url)
        return { name: null, imageUrl: null };
    const strippedUrl = url.replace(/([?&])g_st=[^&]*&?/, '$1').replace(/[?&]$/, '');
    try {
        const res = await fetch(strippedUrl, {
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),
            headers: FETCH_HEADERS,
        });
        const html = await res.text();
        return { name: extractPlaceNameFromUrl(res.url), imageUrl: extractOgImage(html) };
    }
    catch {
        return { name: null, imageUrl: null };
    }
}
/** Baut die URL einer einzelnen OpenStreetMap-Kachel rund um die Koordinate – dient als
 *  automatisches Vorschaubild, wenn ein Objekt einen Maps-Link, aber kein eigenes Bild hat. Kein
 *  echtes Foto des Orts (dafür bräuchte es einen kostenpflichtigen Places-API-Key), aber ohne
 *  API-Key sofort verfügbar und nutzt dieselbe Kachelquelle wie die interne Karte (MapView.vue). */
export function tilePreviewUrl(lat, lng, zoom = 15) {
    const latRad = (lat * Math.PI) / 180;
    const n = 2 ** zoom;
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
    return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

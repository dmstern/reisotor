import { isIP } from 'node:net';

export interface LatLng {
  lat: number;
  lng: number;
}

// Dieselben Muster wie im Frontend (frontend/src/utils/googleMaps.ts) – bewusst dupliziert statt
// über ein Shared-Package geteilt, da Frontend/Backend hier getrennte Build-Pipelines haben.
// Deckt sowohl Google-Maps- als auch Apple-Maps-Linkformate ab.
const PATTERNS: RegExp[] = [
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

export function parseLatLngFromText(url: string): LatLng | null {
  // Manche Apple-Maps-Links kodieren das Komma im coordinate=/ll=-Parameter als %2C.
  let text = url;
  try {
    text = decodeURIComponent(url);
  } catch {
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

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const FETCH_HEADERS = {
  'User-Agent': MOBILE_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};
const MAX_REDIRECT_HOPS = 5;

function isPrivateIpv4(a: number, b: number, c: number, d: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8 (aktuelles Netzwerk)
  if (a === 10) return true; // 10.0.0.0/8 (privat)
  if (a === 127) return true; // 127.0.0.0/8 (Loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-Local, Cloud-Metadaten)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (privat)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (privat)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (Carrier-Grade NAT / Shared Space)
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (Benchmarking)
  if (a >= 224) return true; // 224.0.0.0/4 (Multicast), 240.0.0.0/4 (reserviert), 255.255.255.255 (Broadcast)
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  if (hostname === '::' || hostname === '::1') return true;
  if (hostname.startsWith('fe80:')) return true; // Link-Local
  if (hostname.startsWith('fc') || hostname.startsWith('fd')) return true; // Unique Local (fc00::/7)
  if (hostname.startsWith('fec0:')) return true; // Site-Local (veraltet)

  // IPv4-mapped IPv6 (::ffff:x.x.x.x oder Hex-Format ::ffff:xxxx:xxxx)
  if (hostname.startsWith('::ffff:')) {
    const rest = hostname.slice(7);
    if (rest.includes('.')) {
      const parts = rest.split('.').map(Number);
      if (parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255)) {
        return isPrivateIpv4(parts[0], parts[1], parts[2], parts[3]);
      }
      return true;
    }
    const hexParts = rest.split(':');
    if (hexParts.length === 2) {
      const h1 = parseInt(hexParts[0], 16);
      const h2 = parseInt(hexParts[1], 16);
      if (!Number.isNaN(h1) && !Number.isNaN(h2)) {
        return isPrivateIpv4((h1 >> 8) & 0xff, h1 & 0xff, (h2 >> 8) & 0xff, h2 & 0xff);
      }
    }
    return true;
  }

  return false;
}

const BLOCKED_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
  '.localdomain',
  '.domain',
  '.corp',
  // Wildcard-DNS-Dienste, die auf 127.0.0.1 oder lokale Netze zeigen
  '.nip.io',
  '.sslip.io',
  '.localtest.me',
  '.vcap.me',
  '.lvh.me',
];

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'nip.io',
  'sslip.io',
  'localtest.me',
  'vcap.me',
  'lvh.me',
]);

/** Prüft, ob eine URL sicher für serverseitige Fetch-Anfragen ist (SSRF-Schutz). */
export function isSafeUrl(urlString: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return false;
  }

  // Single-Label-Hostnamen im lokalen Netz (z. B. http://router, http://printer, http://nas)
  if (!hostname.includes('.') && !hostname.includes(':')) {
    return false;
  }

  const ipType = isIP(hostname);
  if (ipType === 4) {
    const parts = hostname.split('.').map(Number);
    return !isPrivateIpv4(parts[0], parts[1], parts[2], parts[3]);
  } else if (ipType === 6) {
    return !isPrivateIpv6(hostname);
  } else if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
    return false;
  }

  return true;
}

/** Folgt dem Redirect eines Kurzlinks manuell, Hop für Hop, und parst den `Location`-Header
 *  jeder Zwischenantwort – ohne die volle (JS-lastige) Zielseite selbst abzurufen. Google kodiert
 *  die Zielkoordinate bereits in der Redirect-Ziel-URL selbst (z. B. .../@lat,lng,zoom oder
 *  !3d.../!4d...), ein Follow bis zur fertig gerenderten Maps-Seite ist dafür gar nicht nötig – und
 *  genau DIESER letzte vollständige Seitenabruf ist der Schritt, an dem Googles Bot-Erkennung bei
 *  bestimmten Kurzlink-Varianten (siehe g_st=ic unten) ansetzt. redirect:'manual' liefert in Node
 *  (anders als im Browser, wo CORS einen undurchsichtigen "opaqueredirect"-Response erzwingt) einen
 *  normal lesbaren Response mit Location-Header, kein Sonderfall nötig. Erzwingt isSafeUrl auf jedem
 *  Hop (SSRF-Schutz). */
async function resolveViaRedirectHeaders(url: string): Promise<LatLng | null> {
  let current = url;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    if (!isSafeUrl(current)) return null;
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: FETCH_HEADERS,
      });
    } catch {
      return null;
    }
    const location = res.headers.get('location');
    if (!location) return null;
    const resolved = new URL(location, current).toString();
    const direct = parseLatLngFromText(resolved);
    if (direct) return direct;
    current = resolved;
  }
  return null;
}

function isGoogleMapsHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return (
    h === 'maps.app.goo.gl' ||
    h === 'goo.gl' ||
    h === 'maps.google.com' ||
    h === 'google.com' ||
    h.endsWith('.google.com') ||
    /^([a-z0-9-]+\.)?google\.[a-z.]+$/.test(h)
  );
}

/** Löst einen Google-Maps-Link serverseitig zu Koordinaten auf. Volle Links werden direkt per
 *  Regex geparst; Kurzlinks (maps.app.goo.gl, goo.gl/maps) lassen sich clientseitig nicht auflösen
 *  (kein sichtbarer Redirect-Ziel-URL). Zwei serverseitige Strategien nacheinander: zuerst nur die
 *  Redirect-Header Hop für Hop lesen (resolveViaRedirectHeaders, siehe dortiger Kommentar – ruft nie
 *  die volle Zielseite ab), erst wenn das nichts liefert als Fallback die Weiterleitung bis zur
 *  Zielseite verfolgen und deren finale URL parsen. Der Fallback ist bewusst auf vertrauenswürdige
 *  Maps-Kurzlink-Hosts (maps.app.goo.gl, goo.gl, google.*) beschränkt, um SSRF über externe
 *  Redirect-Server auszuschließen. Netzwerkfehler/Timeout führen zu `null` statt einem Fehler. */
export async function resolveLatLng(url: string | null | undefined): Promise<LatLng | null> {
  if (!url) return null;
  const direct = parseLatLngFromText(url);
  if (direct) return direct;

  const strippedUrl = url.replace(/([?&])g_st=[^&]*&?/, '$1').replace(/[?&]$/, '');
  if (!isSafeUrl(strippedUrl)) return null;

  const viaHeaders = await resolveViaRedirectHeaders(strippedUrl);
  if (viaHeaders) return viaHeaders;

  let parsed: URL;
  try {
    parsed = new URL(strippedUrl);
  } catch {
    return null;
  }

  // Fallback nur für vertrauenswürdige Google-Maps-Hosts zulassen
  if (!isGoogleMapsHost(parsed.hostname)) {
    return null;
  }

  try {
    const res = await fetch(strippedUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: FETCH_HEADERS,
    });
    if (!isSafeUrl(res.url)) return null;
    return parseLatLngFromText(res.url);
  } catch {
    return null;
  }
}

export interface PlacePreview {
  name: string | null;
  imageUrl: string | null;
}

// Google kodiert den Ortsnamen bereits URL-kodiert im Pfad einer aufgelösten Maps-Link-Zielseite
// (.../maps/place/Caf%C3%A9+Central/@...) - kein zusätzlicher Request nötig, sobald man ohnehin
// schon die finale URL kennt.
function extractPlaceNameFromUrl(url: string): string | null {
  const match = /\/maps\/place\/([^/@]+)/.exec(url);
  if (!match) return null;
  let name = match[1];
  try {
    name = decodeURIComponent(name);
  } catch {
    // Ungültige Prozent-Kodierung - mit dem Rohwert weiterarbeiten.
  }
  name = name.replace(/\+/g, ' ').trim();
  return name || null;
}

// Kein Places-API-Key vorhanden (kostenpflichtig) - das og:image-Meta-Tag der Zielseite ist der
// einzige ohne Zusatzkosten erreichbare Weg an ein ECHTES Foto des Orts zu kommen (statt nur des
// Kartenausschnitts aus tilePreviewUrl() oben). Reine Regex statt eines HTML-Parsers, analog zum
// bestehenden Muster in diesem Modul (parseLatLngFromText) - für ein einzelnes Meta-Tag ausreichend.
function extractOgImage(html: string): string | null {
  const match =
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ??
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
export async function fetchPlacePreview(url: string | null | undefined): Promise<PlacePreview> {
  if (!url) return { name: null, imageUrl: null };
  const strippedUrl = url.replace(/([?&])g_st=[^&]*&?/, '$1').replace(/[?&]$/, '');
  if (!isSafeUrl(strippedUrl)) return { name: null, imageUrl: null };

  let current = strippedUrl;
  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    if (!isSafeUrl(current)) return { name: null, imageUrl: null };
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: FETCH_HEADERS,
      });
    } catch {
      return { name: null, imageUrl: null };
    }

    const location = res.headers?.get?.('location');
    if (location && (res.status == null || (res.status >= 300 && res.status < 400))) {
      try {
        current = new URL(location, current).toString();
      } catch {
        return { name: null, imageUrl: null };
      }
      continue;
    }

    try {
      const html = await res.text();
      return {
        name: extractPlaceNameFromUrl(res.url || current),
        imageUrl: extractOgImage(html),
      };
    } catch {
      return { name: null, imageUrl: null };
    }
  }

  return { name: null, imageUrl: null };
}

/** Baut die URL einer einzelnen OpenStreetMap-Kachel rund um die Koordinate – dient als
 *  automatisches Vorschaubild, wenn ein Objekt einen Maps-Link, aber kein eigenes Bild hat. Kein
 *  echtes Foto des Orts (dafür bräuchte es einen kostenpflichtigen Places-API-Key), aber ohne
 *  API-Key sofort verfügbar und nutzt dieselbe Kachelquelle wie die interne Karte (MapView.vue). */
export function tilePreviewUrl(lat: number, lng: number, zoom = 15): string {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

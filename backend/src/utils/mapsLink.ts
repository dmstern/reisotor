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

function parseLatLngFromText(url: string): LatLng | null {
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

/** Löst einen Google-Maps-Link serverseitig zu Koordinaten auf. Volle Links werden direkt per
 *  Regex geparst; Kurzlinks (maps.app.goo.gl, goo.gl/maps) lassen sich clientseitig nicht auflösen
 *  (kein sichtbarer Redirect-Ziel-URL), deshalb folgt der Server dem Redirect und parst die finale
 *  URL. Netzwerkfehler/Timeout führen zu `null` statt einem Fehler – Speichern soll auch ohne
 *  Koordinaten funktionieren. */
export async function resolveLatLng(url: string | null | undefined): Promise<LatLng | null> {
  if (!url) return null;
  const direct = parseLatLngFromText(url);
  if (direct) return direct;

  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000) });
    return parseLatLngFromText(res.url);
  } catch {
    return null;
  }
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

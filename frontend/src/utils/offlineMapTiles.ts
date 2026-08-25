import type L from 'leaflet';

// Ergänzt das bestehende PASSIVE Kartenkacheln-Caching (public/sw.js's CacheFirst-Route für
// *.tile.openstreetmap.org, cacht automatisch jede beim Browsen tatsächlich angesehene Kachel) um
// ein AKTIVES Vorab-Herunterladen: für den "totalen" Offline-Fall (unterwegs komplett ohne Netz)
// sollen auch noch nie angesehene Kartenausschnitte der Urlaubsregion offline verfügbar sein, nicht
// nur die zufällig schon besuchten. Lädt gezielt den sichtbaren Kartenausschnitt über mehrere
// Zoomstufen herunter - fetch() für eine Kachel-URL wird vom bereits registrierten Service-Worker-
// Handler transparent abgefangen und landet automatisch im selben "osm-tiles"-Cache, es ist also
// KEIN eigener caches.open()/put() nötig.
const MIN_ZOOM = 12;
const MAX_ZOOM = 16;
// Grober Erfahrungswert für eine typische 256x256px-OSM-PNG-Kachel - reicht für eine ungefähre
// Größenangabe vor dem Download (siehe estimateTiles()), keine exakte Messung nötig/möglich (die
// echte Größe hängt vom Kartenausschnitt selbst ab).
const AVG_TILE_BYTES = 15_000;
const SUBDOMAINS = ['a', 'b', 'c'];

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

function tileRange(bounds: L.LatLngBounds, zoom: number) {
  return {
    xMin: lngToTileX(bounds.getWest(), zoom),
    xMax: lngToTileX(bounds.getEast(), zoom),
    yMin: latToTileY(bounds.getNorth(), zoom),
    yMax: latToTileY(bounds.getSouth(), zoom),
  };
}

function allTileUrls(bounds: L.LatLngBounds): string[] {
  const urls: string[] = [];
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
    const { xMin, xMax, yMin, yMax } = tileRange(bounds, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        const sub = SUBDOMAINS[(x + y) % SUBDOMAINS.length];
        urls.push(`https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
      }
    }
  }
  return urls;
}

export function estimateTileDownload(bounds: L.LatLngBounds): {
  count: number;
  approxBytes: number;
} {
  const count = allTileUrls(bounds).length;
  return { count, approxBytes: count * AVG_TILE_BYTES };
}

export function formatApproxSize(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb < 1 ? `${Math.max(1, Math.round(bytes / 1000))} KB` : `${mb.toFixed(1)} MB`;
}

// mode:'no-cors' statt des fetch()-Standards ('cors'): der öffentliche OSM-Tile-Server sendet keine
// CORS-Header, ein cors-Request würde deshalb clientseitig als Netzwerkfehler abgelehnt - exakt
// dasselbe Verhalten wie Leaflets eigene <img>-Kachel-Requests, die ebenfalls ohne CORS-Modus
// auskommen (daher auch nicht per Pixel auslesbar, hier aber irrelevant - es geht nur ums Cachen).
async function downloadOne(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: 'no-cors' });
    return true;
  } catch {
    return false;
  }
}

export async function downloadTiles(
  bounds: L.LatLngBounds,
  onProgress: (done: number, total: number) => void
): Promise<{ downloaded: number; failed: number }> {
  const urls = allTileUrls(bounds);
  let downloaded = 0;
  let failed = 0;
  let index = 0;
  const CONCURRENCY = 6;

  async function worker() {
    while (index < urls.length) {
      const url = urls[index++];
      if (await downloadOne(url)) downloaded++;
      else failed++;
      onProgress(downloaded + failed, urls.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker));
  return { downloaded, failed };
}

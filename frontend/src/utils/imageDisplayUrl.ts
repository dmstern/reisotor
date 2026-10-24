const OSM_TILE_HOST = 'tile.openstreetmap.org';

/** Externe Bild-URLs (z. B. Vorschläge der Web-Bildersuche) werden über den eigenen Server
 *  geladen, damit die IP-Adresse der Nutzer:innen nicht an Fremdhosts geht (siehe
 *  backend/src/routes/images.ts, GET /images/proxy). Lokale Uploads, Data-URLs und die
 *  OSM-Kartenvorschau bleiben unverändert. */
export function imageDisplayUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    if (new URL(url).hostname.toLowerCase() === OSM_TILE_HOST) return url;
  } catch {
    return url;
  }
  return `/api/images/proxy?url=${encodeURIComponent(url)}`;
}

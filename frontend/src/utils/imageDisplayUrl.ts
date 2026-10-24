import { DEMO_MODE } from '../demo/isDemoMode';

const OSM_TILE_HOST = 'tile.openstreetmap.org';

/** Externe Bild-URLs (z. B. Vorschläge der Web-Bildersuche) werden über den eigenen Server
 *  geladen, damit die IP-Adresse der Nutzer:innen nicht an Fremdhosts geht (siehe
 *  backend/src/routes/images.ts, GET /images/proxy). Lokale Uploads, Data-URLs und die
 *  OSM-Kartenvorschau bleiben unverändert. */
export function imageDisplayUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  // Demo-Build ohne Backend: kein Proxy verfügbar, Demo-Bilder sind statisch.
  if (DEMO_MODE) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    if (new URL(url).hostname.toLowerCase() === OSM_TILE_HOST) return url;
  } catch {
    return url;
  }
  // encodeURIComponent lässt ' ( ) ! * unkodiert - würde in unquotiertem CSS-url() brechen.
  const encoded = encodeURIComponent(url).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `/api/images/proxy?url=${encoded}`;
}

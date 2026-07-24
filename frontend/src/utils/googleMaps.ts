export interface LatLng {
  lat: number;
  lng: number;
}

const PATTERNS: RegExp[] = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/, // .../@48.2082,16.3738,15z
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // Google Maps interner Embed-Parameter
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, // ?q=48.2082,16.3738
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // ?ll=48.2082,16.3738
];

/** Extrahiert Lat/Lng aus gängigen Google-Maps-Link-Formaten. Kurzlinks (goo.gl/maps, maps.app.goo.gl)
 *  lassen sich ohne Server-seitiges Auflösen des Redirects nicht parsen und liefern null. */
export function parseLatLngFromMapsLink(url: string | null | undefined): LatLng | null {
  if (!url) return null;
  for (const pattern of PATTERNS) {
    const match = pattern.exec(url);
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

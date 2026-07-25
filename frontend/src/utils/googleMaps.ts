export interface LatLng {
  lat: number;
  lng: number;
}

// Deckt sowohl Google-Maps- als auch Apple-Maps-Linkformate ab (beide Dienste werden je nach
// Gerät/Betriebssystem beim "Standort teilen" verwendet).
const PATTERNS: RegExp[] = [
  /@(-?\d+\.\d+),(-?\d+\.\d+)/, // Google: .../@48.2082,16.3738,15z
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // Google Maps interner Embed-Parameter
  /coordinate=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // Apple Maps: ?coordinate=48.2082,16.3738
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // Google/Apple Maps: ?ll=48.2082,16.3738
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, // Google/Apple Maps: ?q=48.2082,16.3738
];

/** Extrahiert Lat/Lng aus gängigen Google-Maps- und Apple-Maps-Link-Formaten. Kurzlinks
 *  (goo.gl/maps, maps.app.goo.gl, maps.apple/p/...) lassen sich ohne Server-seitiges Auflösen
 *  des Redirects nicht parsen und liefern null. */
export function parseLatLngFromMapsLink(url: string | null | undefined): LatLng | null {
  if (!url) return null;
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

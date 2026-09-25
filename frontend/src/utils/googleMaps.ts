export interface LatLng {
  lat: number;
  lng: number;
}

// Deckt sowohl Google-Maps- als auch Apple-Maps-Linkformate ab (beide Dienste werden je nach
// Gerät/Betriebssystem beim "Standort teilen" verwendet).
const PATTERNS: RegExp[] = [
  // !3d/!4d zuerst: kodiert die exakte Position des Pins/Orts. Ein "@lat,lng,zoom" davor ist oft
  // nur der (weit herausgezoomte) Kartenausschnitt der Seite, nicht der Ort selbst – bei falscher
  // Reihenfolge landen unterschiedliche Orte sonst fälschlich auf demselben groben
  // Stadt-/Regionsmittelpunkt statt ihrer echten Position (siehe backend/src/utils/mapsLink.ts).
  /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // Google Maps interner Embed-Parameter
  /@(-?\d+\.\d+),(-?\d+\.\d+)/, // Google: .../@48.2082,16.3738,15z
  /coordinate=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, // Apple Maps: ?coordinate=48.2082,16.3738
  /[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/, // Google/Apple Maps: ?ll=48.2082,16.3738
  /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/, // Google/Apple Maps: ?q=48.2082,16.3738
  /[?&]mlat=(-?\d+\.\d+)&mlon=(-?\d+\.\d+)/, // OpenStreetMap: ?mlat=48.2082&mlon=16.3738 (siehe buildOsmLink unten)
  /#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/, // OpenStreetMap Hash: #map=16/48.2082/16.3738
  /geo:(-?\d+\.\d+),(-?\d+\.\d+)/, // RFC 5870 / Android Geo-URI: geo:48.2082,16.3738
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

/** Baut eine Such-URL für Google Maps mit Pin an der Koordinate. */
export function buildGoogleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Baut eine Apple-Maps-URL mit Pin an der Koordinate und optionalem Titel. */
export function buildAppleMapsLink(lat: number, lng: number, title?: string): string {
  const query = title ? `&q=${encodeURIComponent(title)}` : '';
  return `https://maps.apple.com/?ll=${lat},${lng}${query}`;
}

/** Baut einen generischen Maps-Link, der auf Mobilgeräten (Android/iOS) die Auswahl der
 *  Karten-App an das Betriebssystem delegiert (System-Auswahldialog oder Standard-App).
 *  - iOS: maps:// URL-Schema öffnet die native Karten-App.
 *  - Android / Standard: RFC 5870 geo:-URI öffnet den nativen "Öffnen mit"-App-Chooser. */
export function buildGenericMapsLink(
  lat: number,
  lng: number,
  title?: string,
  userAgent?: string
): string {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isIos = /iPad|iPhone|iPod/.test(ua);

  if (isIos) {
    const query = title ? `&q=${encodeURIComponent(title)}` : '';
    return `maps://?ll=${lat},${lng}${query}`;
  }

  const safeTitle = title ? `(${encodeURIComponent(title.replace(/[()]/g, '').trim())})` : '';
  const query = safeTitle ? `?q=${lat},${lng}${safeTitle}` : '';
  return `geo:${lat},${lng}${query}`;
}

/** Baut die URL einer einzelnen OpenStreetMap-Kachel rund um die Koordinate – dient als
 *  Live-Vorschau im Anlege-/Bearbeiten-Formular (Bild-Banner), solange kein eigenes Bild
 *  hinterlegt ist. Dieselbe Kachel, die auch backend/src/utils/mapsLink.ts als serverseitigen
 *  Fallback berechnet (dort bewusst dupliziert, siehe Kommentar oben – getrennte Build-Pipelines). */
/** Baut einen teilbaren OpenStreetMap-Link für eine Koordinate – gedacht für den manuellen
 *  Karten-Picker (LocationPicker.vue): trägt man dort selbst einen Pin ein, füllt TripForm.vue
 *  damit automatisch das Maps-Link-Feld, damit sich die tatsächlich für die Wetterabfrage genutzte
 *  Koordinate nachträglich per Klick nachvollziehen/gegenchecken lässt (z. B. gegen eine
 *  Google-Wettersuche für dieselbe Stelle). */
export function buildOsmLink(lat: number, lng: number, zoom = 15): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

export function tilePreviewUrl(lat: number, lng: number, zoom = 15): string {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

import L from 'leaflet';

// Aus MapView.vue extrahiert: Marker-Icon- und Bogen-Routen-Helfer, die jetzt sowohl von der
// großen Karte als auch von der kleinen Ausflug-Mini-Karte (ExcursionMiniMap.vue) gebraucht
// werden – ein gemeinsamer Icon-Cache spart auf dem ressourcenschwachen Pi 2 unnötige
// L.DivIcon-Instanzen, egal welche Karte gerade rendert.
export function emojiPin(emoji: string, color: string) {
  return L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:${color};
      transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid white;">
      <span style="transform:rotate(45deg);font-size:15px;line-height:1;">${emoji}</span></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  });
}

const iconCache = new Map<string, L.DivIcon>();
export function cachedEmojiPin(emoji: string, color: string) {
  const key = `${emoji}|${color}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = emojiPin(emoji, color);
    iconCache.set(key, icon);
  }
  return icon;
}

// Sample-Punkte für einen gestrichelten Bogen zwischen zwei Koordinaten (quadratische Bezier-
// Kurve, Kontrollpunkt senkrecht zur Verbindungslinie versetzt) – rein optisch, wie man es von
// schematischen Flugrouten-Darstellungen kennt, keine echte Streckenführung/Großkreisberechnung.
export function arcPoints(from: L.LatLngExpression, to: L.LatLngExpression, segments = 32): L.LatLngExpression[] {
  const [lat1, lng1] = from as [number, number];
  const [lat2, lng2] = to as [number, number];
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  // Versatz proportional zur Streckenlänge (dLat/dLng selbst) – kurze Routen bekommen dadurch
  // automatisch einen dezenteren, lange einen deutlicheren Bogen. 0.15 ist ein reiner Optik-Faktor.
  const controlLat = (lat1 + lat2) / 2 - dLng * 0.15;
  const controlLng = (lng1 + lng2) / 2 + dLat * 0.15;
  const points: L.LatLngExpression[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const lat = (1 - t) ** 2 * lat1 + 2 * (1 - t) * t * controlLat + t ** 2 * lat2;
    const lng = (1 - t) ** 2 * lng1 + 2 * (1 - t) * t * controlLng + t ** 2 * lng2;
    points.push([lat, lng]);
  }
  return points;
}

// Verkettet arcPoints() über beliebig viele Wegpunkte zu einer durchgehenden Route – Startpunkt
// jedes Folgesegments wird weggelassen, sonst wäre er doppelt (identisch mit dem Endpunkt des
// vorigen Segments). Braucht mindestens 2 Punkte, sonst wird ein leeres Array zurückgegeben.
export function arcRoute(coords: L.LatLngExpression[], segments = 32): L.LatLngExpression[] {
  if (coords.length < 2) return [];
  const arced: L.LatLngExpression[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const segment = arcPoints(coords[i], coords[i + 1], segments);
    arced.push(...(i === 0 ? segment : segment.slice(1)));
  }
  return arced;
}

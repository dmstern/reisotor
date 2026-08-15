import L from 'leaflet';
import { useIconStyleStore } from '../stores/iconStyle';
import { tablerMarkerSvg } from './tablerMarkerSvg';
import type { IconDef } from './icon';

// Leaflets Default-Attribution-Prefix stellt der "Leaflet"-Verlinkung eine kleine
// Ukraine-Flaggen-SVG voran (Control.Attribution.js, seit 2022 aus Solidarität fest einprogrammiert,
// nicht konfigurierbar außer durch komplettes Überschreiben des prefix). Gleicher Link-Text/-Ziel,
// nur ohne die Flagge – an alle Karten mit sichtbarer Attribution-Control übergeben (siehe
// TripMap.vue/LocationPicker.vue; ExcursionMiniMap.vue braucht das nicht, da dort
// attributionControl:false).
export const LEAFLET_ATTRIBUTION_PREFIX =
  '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>';

// Ein Marker-Glyph ist entweder ein reines Emoji (String - z. B. das frei gewählte Nutzer-Avatar,
// siehe TripMap.vue's compassPin(auth.user.avatar, ...)/cachedEmojiPin(user.avatar, ...) - bleibt
// IMMER Emoji, unabhängig von der iconStyle-Einstellung, da es Identitätsdaten sind, kein festes
// Konzept mit Tabler-Äquivalent) oder ein IconDef (Kategorie-/Ortsmarker aus den Registries, siehe
// utils/icon.ts) - dann style-abhängig entweder Emoji oder eine rohe Tabler-SVG (tablerMarkerSvg.ts,
// kein Fallback-Icon kuratiert -> bleibt ebenfalls Emoji).
export type MarkerGlyph = IconDef | string;

function markerGlyphHtml(icon: MarkerGlyph, sizePx: number): string {
  if (typeof icon === 'string') {
    return `<span style="font-size:${sizePx}px;line-height:1;">${icon}</span>`;
  }
  const iconStyle = useIconStyleStore();
  if (iconStyle.style === 'emoji') {
    return `<span style="font-size:${sizePx}px;line-height:1;">${icon.emoji}</span>`;
  }
  const svg = tablerMarkerSvg(icon.id, iconStyle.variant, sizePx);
  return svg
    ? `<span style="color:#fff;display:inline-flex;width:${sizePx}px;height:${sizePx}px;">${svg}</span>`
    : `<span style="font-size:${sizePx}px;line-height:1;">${icon.emoji}</span>`;
}

// Aus TripMap.vue extrahiert: Marker-Icon- und Bogen-Routen-Helfer, die jetzt sowohl von der
// großen Karte als auch von der kleinen Ausflug-Mini-Karte (ExcursionMiniMap.vue) gebraucht
// werden – ein gemeinsamer Icon-Cache spart auf dem ressourcenschwachen Pi 2 unnötige
// L.DivIcon-Instanzen, egal welche Karte gerade rendert.
// `large`: dezent vergrößerte Variante für den aktuell hervorgehobenen Punkt (siehe
// TripMap.vue's drawers.mapFocusKey-Kopplung mit der Spots-/Detail-Ansicht) – eigener
// Cache-Eintrag pro Größe, da L.DivIcon-Instanzen unveränderlich sind.
export function emojiPin(icon: MarkerGlyph, color: string, large = false) {
  const size = large ? 54 : 32;
  const fontSize = large ? 25 : 15;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:${color};
      transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid white;">
      <span style="transform:rotate(45deg);">${markerGlyphHtml(icon, fontSize)}</span></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 2],
  });
}

const iconCache = new Map<string, L.DivIcon>();
export function cachedEmojiPin(icon: MarkerGlyph, color: string, large = false) {
  const iconStyle = useIconStyleStore();
  const identity = typeof icon === 'string' ? `emoji:${icon}` : `def:${icon.id}`;
  const key = `${identity}|${iconStyle.style}|${iconStyle.variant}|${color}|${large}`;
  let cached = iconCache.get(key);
  if (!cached) {
    cached = emojiPin(icon, color, large);
    iconCache.set(key, cached);
  }
  return cached;
}

// Für den eigenen Standort auf der Karte (TripMap.vue, Live-Standort): derselbe Pin wie emojiPin(),
// zusätzlich von einem pulsierenden Ring umgeben (CSS-Animation "map-pulse-ring", siehe TripMap.vue's
// zweiter, bewusst NICHT scoped-er <style>-Block – Leaflets dynamisch per innerHTML eingefügtes
// Markup bekommt keine Vue-Scoping-Attribute, ein @keyframes-Regelsatz muss daher global gelten).
export function pulsingEmojiPin(icon: MarkerGlyph, color: string) {
  const size = 32;
  return L.divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div class="map-pulse-ring" style="position:absolute;inset:-10px;border-radius:50%;background:${color};"></div>
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:${color};
        transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid white;">
        <span style="transform:rotate(45deg);">${markerGlyphHtml(icon, 15)}</span>
      </div>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size + 2],
  });
}

// Eigener Standort auf der großen Karte (TripMap.vue, Live-Standort): bewusst ein Kreis statt des
// Pin-Ballons (emojiPin/pulsingEmojiPin oben) - ein Pin zeigt "hier ist ein Ort", während die
// eigene Position sich bewegt und (bei vorhandenem Kompass) eine Blickrichtung hat, wie man es von
// Google/Apple Maps kennt. Zeigt trotzdem weiterhin das eigene Avatar-Emoji im Kreis (wie vorher der
// Pin-Ballon) statt eines schlichten Punkts, damit "das bin ich" auf einen Blick erkennbar bleibt.
// `headingDeg` (0 = Norden, im Uhrzeigersinn, siehe TripMap.vue's headingFromOrientationEvent()) ist
// optional - ohne Kompasszugriff (kein Sensor, Berechtigung verweigert, Desktop ohne Gerätesensor)
// bleibt der Kegel schlicht weg, nur der Kreis bleibt sichtbar. Pulsierender Ring (.map-pulse-ring,
// siehe der globale <style>-Block in TripMap.vue) bleibt wie zuvor bei pulsingEmojiPin() erhalten.
export function compassPin(icon: MarkerGlyph, color: string, headingDeg: number | null) {
  const size = 64;
  const dotSize = 34;
  const half = size / 2;
  // Klassischer CSS-Dreieck-Trick (0 Breite/Höhe, zwei transparente Seitenborder + eine gefüllte
  // Bottom-Border) ergibt ein nach oben zeigendes Dreieck - "oben" entspricht Norden, da Leaflet die
  // Karte hier nicht mitrotiert. transform-origin am unteren Rand des Dreiecks (= Zentrum des
  // Punkts) statt der Mitte, damit die Rotation um den Standortpunkt selbst erfolgt statt um die
  // Dreiecksmitte zu "eiern".
  // Eigene Klassen (statt nur Inline-Styles wie bei den übrigen Icon-Fabriken oben) - erlauben
  // e2e-Tests, gezielt "ist das der Kreis-Marker?" bzw. "ist der Richtungskegel gerade sichtbar?" zu
  // prüfen, ohne Inline-Style-Strings parsen zu müssen (siehe own-location-marker.spec.ts).
  const cone =
    headingDeg == null
      ? ''
      : `<div class="own-location-cone" style="position:absolute;left:50%;top:50%;width:0;height:0;
          border-left:12px solid transparent;border-right:12px solid transparent;
          border-bottom:28px solid ${color};opacity:.6;
          transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(${headingDeg}deg);"></div>`;
  return L.divIcon({
    html: `<div class="own-location-marker" style="position:relative;width:${size}px;height:${size}px;">
      <div class="map-pulse-ring" style="position:absolute;left:50%;top:50%;width:${dotSize + 10}px;height:${dotSize + 10}px;
        margin:${-(dotSize + 10) / 2}px 0 0 ${-(dotSize + 10) / 2}px;border-radius:50%;background:${color};"></div>
      ${cone}
      <div style="position:absolute;left:50%;top:50%;width:${dotSize}px;height:${dotSize}px;
        margin:${-dotSize / 2}px 0 0 ${-dotSize / 2}px;border-radius:50%;background:${color};
        border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;">${markerGlyphHtml(icon, 16)}</div>
    </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
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

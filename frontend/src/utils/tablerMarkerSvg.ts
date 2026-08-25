// Rohe Tabler-SVGs (statt Vue-Komponenten) für Leaflet-Marker (utils/mapRoute.ts) - Leaflet baut
// seine divIcons aus einem HTML-String, keine gemountete Vue-Komponente ist dort möglich. `?raw`
// ist ein eingebautes Vite-Feature (siehe frontend/vite.config.ts - kein zusätzliches Loader-Plugin
// nötig), liefert den Dateiinhalt als String zur Build-Zeit, bleibt also vom PWA-Precaching
// abgedeckt wie jeder andere App-Code.
//
// Nur die auf der Karte tatsächlich vorkommenden Icons sind hier kuratiert (Spot-Kategorien,
// Transportmittel, generische Karten-Konzepte wie "ausgewählter Ort"/"Kompass") - deckungsgleich
// mit den `id`s aus utils/spotCategory.ts/travelTypeIcon.ts. Fehlt eine Filled-Variante für ein Icon
// (nicht jedes Tabler-Outline-Icon hat eine), fällt tablerMarkerSvg() automatisch auf Outline zurück
// - dieselbe Regel wie resolveIconComponent() in utils/icon.ts, hier nur für rohe SVG-Strings statt
// Vue-Komponenten nachgebildet.
import toolsKitchen2Outline from '@tabler/icons/outline/tools-kitchen-2.svg?raw';
import toolsKitchen2Filled from '@tabler/icons/filled/tools-kitchen-2.svg?raw';
import coffeeOutline from '@tabler/icons/outline/coffee.svg?raw';
import targetOutline from '@tabler/icons/outline/target.svg?raw';
import shoppingBagOutline from '@tabler/icons/outline/shopping-bag.svg?raw';
import buildingBankOutline from '@tabler/icons/outline/building-bank.svg?raw';
import confettiOutline from '@tabler/icons/outline/confetti.svg?raw';
import confettiFilled from '@tabler/icons/filled/confetti.svg?raw';
import buildingCastleOutline from '@tabler/icons/outline/building-castle.svg?raw';
import beachOutline from '@tabler/icons/outline/beach.svg?raw';
import treesOutline from '@tabler/icons/outline/trees.svg?raw';
import mountainOutline from '@tabler/icons/outline/mountain.svg?raw';
import mountainFilled from '@tabler/icons/filled/mountain.svg?raw';
import walkOutline from '@tabler/icons/outline/walk.svg?raw';
import glassCocktailOutline from '@tabler/icons/outline/glass-cocktail.svg?raw';
import shoppingCartOutline from '@tabler/icons/outline/shopping-cart.svg?raw';
import shoppingCartFilled from '@tabler/icons/filled/shopping-cart.svg?raw';
import breadOutline from '@tabler/icons/outline/bread.svg?raw';
import breadFilled from '@tabler/icons/filled/bread.svg?raw';
import pillOutline from '@tabler/icons/outline/pill.svg?raw';
import pillFilled from '@tabler/icons/filled/pill.svg?raw';
import gasStationOutline from '@tabler/icons/outline/gas-station.svg?raw';
import gasStationFilled from '@tabler/icons/filled/gas-station.svg?raw';
import planeDepartureOutline from '@tabler/icons/outline/plane-departure.svg?raw';
import planeDepartureFilled from '@tabler/icons/filled/plane-departure.svg?raw';
import trainOutline from '@tabler/icons/outline/train.svg?raw';
import trainFilled from '@tabler/icons/filled/train.svg?raw';
import busOutline from '@tabler/icons/outline/bus.svg?raw';
import busFilled from '@tabler/icons/filled/bus.svg?raw';
import anchorOutline from '@tabler/icons/outline/anchor.svg?raw';
import roadOutline from '@tabler/icons/outline/road.svg?raw';
import homeOutline from '@tabler/icons/outline/home.svg?raw';
import homeFilled from '@tabler/icons/filled/home.svg?raw';
import bedOutline from '@tabler/icons/outline/bed.svg?raw';
import bedFilled from '@tabler/icons/filled/bed.svg?raw';
import mapPinOutline from '@tabler/icons/outline/map-pin.svg?raw';
import mapPinFilled from '@tabler/icons/filled/map-pin.svg?raw';
import planeOutline from '@tabler/icons/outline/plane.svg?raw';
import planeFilled from '@tabler/icons/filled/plane.svg?raw';
import carOutline from '@tabler/icons/outline/car.svg?raw';
import carFilled from '@tabler/icons/filled/car.svg?raw';
import shipOutline from '@tabler/icons/outline/ship.svg?raw';
import ticketOutline from '@tabler/icons/outline/ticket.svg?raw';
import ticketFilled from '@tabler/icons/filled/ticket.svg?raw';
import compassOutline from '@tabler/icons/outline/compass.svg?raw';
import compassFilled from '@tabler/icons/filled/compass.svg?raw';

const RAW_SVG: Record<string, { outline: string; filled?: string }> = {
  'tools-kitchen-2': { outline: toolsKitchen2Outline, filled: toolsKitchen2Filled },
  coffee: { outline: coffeeOutline },
  target: { outline: targetOutline },
  'shopping-bag': { outline: shoppingBagOutline },
  'building-bank': { outline: buildingBankOutline },
  confetti: { outline: confettiOutline, filled: confettiFilled },
  'building-castle': { outline: buildingCastleOutline },
  beach: { outline: beachOutline },
  trees: { outline: treesOutline },
  mountain: { outline: mountainOutline, filled: mountainFilled },
  walk: { outline: walkOutline },
  'glass-cocktail': { outline: glassCocktailOutline },
  'shopping-cart': { outline: shoppingCartOutline, filled: shoppingCartFilled },
  bread: { outline: breadOutline, filled: breadFilled },
  pill: { outline: pillOutline, filled: pillFilled },
  'gas-station': { outline: gasStationOutline, filled: gasStationFilled },
  'plane-departure': { outline: planeDepartureOutline, filled: planeDepartureFilled },
  train: { outline: trainOutline, filled: trainFilled },
  bus: { outline: busOutline, filled: busFilled },
  anchor: { outline: anchorOutline },
  road: { outline: roadOutline },
  home: { outline: homeOutline, filled: homeFilled },
  bed: { outline: bedOutline, filled: bedFilled },
  'map-pin': { outline: mapPinOutline, filled: mapPinFilled },
  plane: { outline: planeOutline, filled: planeFilled },
  car: { outline: carOutline, filled: carFilled },
  ship: { outline: shipOutline },
  ticket: { outline: ticketOutline, filled: ticketFilled },
  compass: { outline: compassOutline, filled: compassFilled },
};

// Tabler-SVGs haben feste width="24"/height="24"-Attribute (kein width:100% per CSS) - müssen daher
// textuell auf die gewünschte Pixelgröße normalisiert werden, sonst würde die Karten-Pin-Größe vom
// SVG selbst statt vom umschließenden <span> bestimmt.
function normalize(svg: string, sizePx: number): string {
  return svg
    .replace('width="24"', `width="${sizePx}"`)
    .replace('height="24"', `height="${sizePx}"`);
}

export function tablerMarkerSvg(id: string, variant: 'outline' | 'filled', sizePx: number): string {
  const entry = RAW_SVG[id];
  if (!entry) return '';
  const svg = (variant === 'filled' && entry.filled) || entry.outline;
  return normalize(svg, sizePx);
}

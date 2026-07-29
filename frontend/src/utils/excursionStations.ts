import type { Accommodation, Spot, TravelItem } from '../api/types';
import { spotCategoryMeta } from './spotCategory';

// Löst die generischen station_keys eines Ausflugs (siehe api/types.ts, Excursion.station_keys) zu
// einem einheitlichen Anzeige-Objekt auf – eine Station ist nicht zwingend ein echter Spot (kann
// auch die Unterkunft oder ein Anreise-/Abreise-Ort sein, siehe Kommentar dort). Zentralisiert die
// Metadaten, die TripMap.vue und ExcursionsView.vue (derivedLocations) für dieselben drei
// Objekttypen ohnehin schon separat kennen (Icon/Farbe/Label).
export type StationKind = 'spot' | 'accommodation' | 'travel-from' | 'travel-to' | 'schedule';

export interface ExcursionStation {
  key: string;
  kind: StationKind;
  /** Id des zugrunde liegenden Spots/der Unterkunft/des Reise-Eintrags (nicht des station_key-Strings). */
  id: number;
  title: string;
  icon: string;
  color: string;
  category: string;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  mapsLink: string | null;
}

const ACCOMMODATION_META = { icon: '🛏️', color: '#1baf7a' };
const TRAVEL_FROM_META = { icon: '🛫', color: '#4a3aa7' };
const TRAVEL_TO_META = { icon: '🛬', color: '#4a3aa7' };

export function resolveStation(
  key: string,
  spots: Spot[],
  accommodations: Accommodation[],
  travelItems: TravelItem[],
): ExcursionStation | null {
  if (key.startsWith('spot-')) {
    const id = Number(key.slice('spot-'.length));
    const spot = spots.find((s) => s.id === id);
    if (!spot) return null;
    const meta = spotCategoryMeta(spot.category);
    return {
      key,
      kind: 'spot',
      id,
      title: spot.title,
      icon: meta.icon,
      color: meta.color,
      category: spot.category ?? 'Sonstiges',
      imageUrl: spot.image_url,
      lat: spot.lat,
      lng: spot.lng,
      mapsLink: spot.maps_link,
    };
  }
  if (key.startsWith('accommodation-')) {
    const id = Number(key.slice('accommodation-'.length));
    const acc = accommodations.find((a) => a.id === id);
    if (!acc) return null;
    return {
      key,
      kind: 'accommodation',
      id,
      title: acc.name,
      icon: ACCOMMODATION_META.icon,
      color: ACCOMMODATION_META.color,
      category: 'Unterkunft',
      imageUrl: null,
      lat: acc.lat,
      lng: acc.lng,
      mapsLink: acc.maps_link,
    };
  }
  if (key.startsWith('travel-from-') || key.startsWith('travel-to-')) {
    const isFrom = key.startsWith('travel-from-');
    const id = Number(key.slice((isFrom ? 'travel-from-' : 'travel-to-').length));
    const item = travelItems.find((t) => t.id === id);
    if (!item) return null;
    const meta = isFrom ? TRAVEL_FROM_META : TRAVEL_TO_META;
    return {
      key,
      kind: isFrom ? 'travel-from' : 'travel-to',
      id,
      title: `${item.title} (${isFrom ? 'Abflug/Abfahrt' : 'Ankunft'})`,
      icon: meta.icon,
      color: meta.color,
      category: 'Reise',
      imageUrl: null,
      lat: isFrom ? item.from_lat : item.to_lat,
      lng: isFrom ? item.from_lng : item.to_lng,
      mapsLink: isFrom ? item.from_maps_link : item.to_maps_link,
    };
  }
  return null;
}

export function resolveStations(
  keys: string[],
  spots: Spot[],
  accommodations: Accommodation[],
  travelItems: TravelItem[],
): ExcursionStation[] {
  return keys
    .map((key) => resolveStation(key, spots, accommodations, travelItems))
    .filter((s): s is ExcursionStation => !!s);
}

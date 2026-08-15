import { IconMapPin, IconMapPinFilled } from '@tabler/icons-vue';
import type { Spot, TravelItem } from '../api/types';
import { spotCategoryMeta } from './spotCategory';
import { travelTypeIcon, travelTypeIconDef } from './travelTypeIcon';
import type { IconDef } from './icon';

const LOCATION_FALLBACK_ICON: IconDef = { id: 'map-pin', emoji: '📍', outline: IconMapPin, filled: IconMapPinFilled };

// Löst die generischen station_keys eines Ausflugs (aus Excursion.spot_ids via
// excursionStationKeys() unten abgeleitet, siehe api/types.ts) zu einem einheitlichen
// Anzeige-Objekt auf – eine Station ist nicht zwingend ein echter Spot (kann auch ein
// Etappen-Ende ohne verknüpften Ort sein, siehe Kommentar dort). Zentralisiert die
// Metadaten, die TripMap.vue und ExcursionsView.vue (derivedLocations) für dieselben Objekttypen
// ohnehin schon separat kennen (Icon/Farbe/Label). Reise-Orte (Flughafen/Bahnhof/Zuhause/…) und
// Unterkunft sind seit ihrer Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts) ganz
// normale Spots und laufen daher über den 'spot'-Zweig, kein eigener 'travel-place'-/
// 'accommodation'-Stationstyp mehr nötig.
export type StationKind = 'spot' | 'travel-from' | 'travel-to' | 'schedule';

export interface ExcursionStation {
  key: string;
  kind: StationKind;
  /** Id des zugrunde liegenden Spots/des Reise-Eintrags (nicht des station_key-Strings). */
  id: number;
  title: string;
  icon: string;
  /** Tabler-Pendant zu icon, für ExcursionMiniMap.vue's Kartenmarker (siehe utils/icon.ts) - additiv,
   *  damit Aufrufstellen, die nur icon lesen (z. B. MiniStationCard.vue/ExcursionCard.vue), unverändert
   *  funktionieren. */
  tabler: IconDef;
  color: string;
  category: string;
  imageUrl: string | null;
  lat: number | null;
  lng: number | null;
  mapsLink: string | null;
  /** Beschriftet die Verbindungslinie ZWISCHEN dieser und der vorherigen Station in einer Kette
   *  (z. B. Tages-Fokus, siehe dayStations.ts) mit dem Namen der verbindenden Reise-Etappe – nur
   *  gesetzt, wenn diese Station das Ziel einer Etappe ist, deren Startort in derselben Kette
   *  vorkommt (bzw. wo der Startort als aufeinanderfolgendes Duplikat unterdrückt wurde). Bei allen
   *  anderen Stations-Quellen (Spot/Ausflug-Stationsliste) unbenutzt/undefined. */
  connector?: { icon: string; tabler: IconDef; label: string } | null;
}

/** Welcher station_key das Von/Nach-Ende einer Etappe repräsentiert – bevorzugt den verknüpften Ort
 *  (spot-<id>, zeigt dann dessen eigenen Namen/Icon), fällt ohne Verknüpfung auf das alte
 *  Etappen-Ende-Format zurück (travel-from-/to-<id>, siehe resolveStation() unten). Exportiert, da
 *  dayStations.ts denselben Key braucht, um aufeinanderfolgende Etappen über ihren tatsächlichen Ort
 *  (statt die Etappe selbst) zu verketten. */
export function travelEndpointKey(item: TravelItem, side: 'from' | 'to'): string {
  const placeId = side === 'from' ? item.from_place_id : item.to_place_id;
  return placeId != null ? `spot-${placeId}` : `travel-${side}-${item.id}`;
}

const TRAVEL_COLOR = '#4a3aa7';

export function resolveStation(key: string, spots: Spot[], travelItems: TravelItem[]): ExcursionStation | null {
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
      tabler: meta.tabler,
      color: meta.color,
      category: spot.category ?? 'Sonstiges',
      imageUrl: spot.image_url,
      lat: spot.lat,
      lng: spot.lng,
      mapsLink: spot.maps_link,
    };
  }
  if (key.startsWith('travel-from-') || key.startsWith('travel-to-')) {
    const isFrom = key.startsWith('travel-from-');
    const id = Number(key.slice((isFrom ? 'travel-from-' : 'travel-to-').length));
    const item = travelItems.find((t) => t.id === id);
    if (!item) return null;
    return {
      key,
      kind: isFrom ? 'travel-from' : 'travel-to',
      id,
      title: `${item.title} (${isFrom ? 'Abflug/Abfahrt' : 'Ankunft'})`,
      icon: travelTypeIcon(item.type, '📍'),
      tabler: travelTypeIconDef(item.type, LOCATION_FALLBACK_ICON),
      color: TRAVEL_COLOR,
      category: 'Reise',
      imageUrl: null,
      lat: isFrom ? item.from_lat : item.to_lat,
      lng: isFrom ? item.from_lng : item.to_lng,
      mapsLink: isFrom ? item.from_maps_link : item.to_maps_link,
    };
  }
  return null;
}

export function resolveStations(keys: string[], spots: Spot[], travelItems: TravelItem[]): ExcursionStation[] {
  return keys.map((key) => resolveStation(key, spots, travelItems)).filter((s): s is ExcursionStation => !!s);
}

/** Baut aus einer Tour-Spot-Id-Liste (Excursion.spot_ids, siehe api/types.ts) die generischen
 *  station_keys, die resolveStation()/resolveStations() erwarten – eine Tour-Station ist seit der
 *  Verschmelzung von Unterkunft/Reise-Orten in Spots IMMER ein echter Spot, daher genügt ein
 *  einfaches Präfigieren statt eines echten Resolvers. */
export function excursionStationKeys(spotIds: number[]): string[] {
  return spotIds.map((id) => `spot-${id}`);
}

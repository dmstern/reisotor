import { IconMapPin, IconMapPinFilled } from '@tabler/icons-vue';
import type { TravelItem } from '../api/types';
import type { DerivedLocation } from './derivedLocation';
import { travelTypeIcon, travelTypeIconDef } from './travelTypeIcon';
import type { IconDef } from './icon';

// Gleicher Fallback wie travelTypeIcon()s '📍' oben - kein eigener Transportmittel-Typ bekannt.
const LOCATION_FALLBACK_ICON: IconDef = {
  id: 'map-pin',
  emoji: '📍',
  outline: IconMapPin,
  filled: IconMapPinFilled,
};

export interface TravelDerivedLocation extends DerivedLocation {
  /** Zuhause-/Heimat-Seite (siehe TravelItem.role) – siehe TripMap.vue's MapPoint.homeSide, hier
   *  zentral mitgeführt statt in jedem Aufrufer erneut hergeleitet. */
  homeSide: boolean;
}

function latLngIdentity(lat: number, lng: number): string {
  return `latlng-${lat.toFixed(5)}-${lng.toFixed(5)}`;
}

// Etappen-Enden mit verknüpftem Ort (TravelItem.from_place_id/to_place_id) sind seit der
// Verschmelzung von Reise-Orten in Spots (siehe Migrationskommentar in db/index.ts) ganz normale
// Spots und werden bereits über die bestehende Spots-Liste angezeigt – kein eigener Ableitungspfad
// mehr nötig. Diese Funktion deckt nur noch den Fallback ab: Etappen-Enden OHNE verknüpften Ort
// (TravelSection.vue's "✏️ Manuell eingeben" – reiner Freitext-Von/Nach mit eigenem Maps-Link/Pin).
// Dedupliziert über gerundete lat/lng, falls zwei frei eingetragene Enden zufällig denselben Ort
// treffen.
export function buildTravelDerivedLocations(travelItems: TravelItem[]): TravelDerivedLocation[] {
  const result: TravelDerivedLocation[] = [];

  const seenLatLng = new Set<string>();

  function addFallbackSide(travelItem: TravelItem, side: 'from' | 'to') {
    const placeId = side === 'from' ? travelItem.from_place_id : travelItem.to_place_id;

    if (placeId != null) {
      return;
    } // verknüpfter Ort ist bereits ein normaler Spot

    const lat = side === 'from' ? travelItem.from_lat : travelItem.to_lat;
    const lng = side === 'from' ? travelItem.from_lng : travelItem.to_lng;

    if (lat == null || lng == null) {
      return;
    }

    const identity = latLngIdentity(lat, lng);

    if (seenLatLng.has(identity)) {
      return;
    }

    seenLatLng.add(identity);
    result.push({
      key: `travel-${side}-${travelItem.id}`,
      title: `${travelItem.title} (${side === 'from' ? 'Abflug/Abfahrt' : 'Ankunft'})`,
      icon: travelTypeIcon(travelItem.type, '📍'),
      tabler: travelTypeIconDef(travelItem.type, LOCATION_FALLBACK_ICON),
      category: 'Reise',
      maps_link: side === 'from' ? travelItem.from_maps_link : travelItem.to_maps_link,
      lat,
      lng,
      homeSide: side === 'from' ? travelItem.role === 'arrival' : travelItem.role === 'departure',
    });
  }

  for (const travelItem of travelItems) {
    addFallbackSide(travelItem, 'from');
    addFallbackSide(travelItem, 'to');
  }

  return result;
}

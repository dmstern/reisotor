import type { TravelItem, TravelPlace } from '../api/types';
import type { DerivedLocation } from './derivedLocation';
import { travelTypeIcon } from './travelTypeIcon';
import { travelPlaceTypeIcon } from './travelPlaceType';

export interface TravelDerivedLocation extends DerivedLocation {
  /** Zuhause-/Heimat-Seite (siehe travel_places.is_home) – siehe TripMap.vue's MapPoint.homeSide,
   *  hier zentral mitgeführt statt in jedem Aufrufer erneut hergeleitet. */
  homeSide: boolean;
}

function latLngIdentity(lat: number, lng: number): string {
  return `latlng-${lat.toFixed(5)}-${lng.toFixed(5)}`;
}

// Jeder angelegte Ort (TravelView.vue's "Orte"-Karte, travel_places) wird hier genau EINMAL
// abgebildet – unabhängig davon, von wie vielen Etappen aus er als Von/Nach referenziert wird
// (z. B. ist "Zuhause" sowohl Start des Hinflugs als auch Ziel des Rückflugs). Titel = der vom
// Nutzer selbst vergebene Ortsname, Icon = die gewählte Ort-Art (travelPlaceType.ts) – NICHT mehr
// ein pro Etappe generierter "Hinflug (Abflug/Abfahrt)"-Titel mit festem Flugzeug-Icon, der
// denselben physischen Ort früher zweimal (einmal pro Etappen-Ende) auf Karte/Spots-Liste zeigte.
export function buildTravelDerivedLocations(
  travelItems: TravelItem[],
  travelPlaces: TravelPlace[] = [],
): TravelDerivedLocation[] {
  const result: TravelDerivedLocation[] = [];

  for (const place of travelPlaces) {
    if (place.lat == null || place.lng == null) continue;
    result.push({
      key: `travel-place-${place.id}`,
      title: place.name,
      icon: travelPlaceTypeIcon(place.type),
      category: 'Reise',
      maps_link: place.maps_link,
      lat: place.lat,
      lng: place.lng,
      homeSide: !!place.is_home,
    });
  }

  // Fallback für Etappen-Enden OHNE verknüpften Ort (TravelView.vue's "✏️ Manuell eingeben" – reiner
  // Freitext-Von/Nach mit eigenem Maps-Link/Pin) – die tauchen in travelPlaces nicht auf und müssen
  // daher weiterhin aus dem Etappen-Eintrag selbst abgeleitet werden. Dedupliziert über gerundete
  // lat/lng, falls zwei frei eingetragene Enden zufällig denselben Ort treffen.
  const seenLatLng = new Set<string>();
  function addFallbackSide(t: TravelItem, side: 'from' | 'to') {
    const placeId = side === 'from' ? t.from_place_id : t.to_place_id;
    if (placeId != null) return; // bereits über travelPlaces oben abgedeckt
    const lat = side === 'from' ? t.from_lat : t.to_lat;
    const lng = side === 'from' ? t.from_lng : t.to_lng;
    if (lat == null || lng == null) return;
    const identity = latLngIdentity(lat, lng);
    if (seenLatLng.has(identity)) return;
    seenLatLng.add(identity);
    result.push({
      key: `travel-${side}-${t.id}`,
      title: `${t.title} (${side === 'from' ? 'Abflug/Abfahrt' : 'Ankunft'})`,
      icon: travelTypeIcon(t.type, '📍'),
      category: 'Reise',
      maps_link: side === 'from' ? t.from_maps_link : t.to_maps_link,
      lat,
      lng,
      homeSide: side === 'from' ? t.role === 'arrival' : t.role === 'departure',
    });
  }

  for (const t of travelItems) {
    addFallbackSide(t, 'from');
    addFallbackSide(t, 'to');
  }

  return result;
}

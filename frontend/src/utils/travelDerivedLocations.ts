import type { TravelItem } from '../api/types';
import type { DerivedLocation } from './derivedLocation';
import { travelTypeIcon } from './travelTypeIcon';

export interface TravelDerivedLocation extends DerivedLocation {
  /** Zuhause-Seite eines Reise-Eintrags (Startpunkt der Anreise / Zielpunkt der Abreise) – siehe
   *  TripMap.vue's MapPoint.homeSide, hier zentral mitgeführt statt in jedem Aufrufer erneut aus
   *  Rolle/Seite hergeleitet. */
  homeSide: boolean;
}

// Jeder Reise-Eintrag hat zwei Enden (Von/Nach), die aber oft genau denselben zugrunde liegenden,
// wiederverwendbaren Ort treffen wie das Ende eines ANDEREN Eintrags (siehe TravelPlace,
// backend/src/routes/travel.ts's applyPlaces()) – der Rückflug startet z. B. exakt dort, wo der
// Hinflug endete ("Zielflughafen"), und endet dort, wo der Hinflug startete ("Zuhause"). Ohne
// Dedup erschien so derselbe physische Ort zweimal (einmal pro Etappen-Ende) auf der Karte/in der
// Spots-Liste. from_place_id/to_place_id identifizieren denselben Ort zuverlässiger als ein reiner
// Koordinatenvergleich; bei frei eingetragenen (nicht über einen wiederverwendbaren Ort
// verknüpften) Koordinaten wird ersatzweise auf gerundete lat/lng zurückgegriffen.
function placeIdentity(placeId: number | null, lat: number, lng: number): string {
  return placeId != null ? `place-${placeId}` : `latlng-${lat.toFixed(5)}-${lng.toFixed(5)}`;
}

export function buildTravelDerivedLocations(travelItems: TravelItem[]): TravelDerivedLocation[] {
  const result: TravelDerivedLocation[] = [];
  const byIdentity = new Map<string, TravelDerivedLocation>();

  function addSide(t: TravelItem, side: 'from' | 'to') {
    const lat = side === 'from' ? t.from_lat : t.to_lat;
    const lng = side === 'from' ? t.from_lng : t.to_lng;
    if (lat == null || lng == null) return;
    const placeId = side === 'from' ? t.from_place_id : t.to_place_id;
    const identity = placeIdentity(placeId, lat, lng);
    const homeSide = side === 'from' ? t.role === 'arrival' : t.role === 'departure';
    const existing = byIdentity.get(identity);
    if (existing) {
      // Ein Ort zählt schon als "zuhause", sobald IRGENDeine seiner Etappen-Seiten das nahelegt
      // (z. B. Hinflug-Start UND Rückflug-Ziel sind beide "Zuhause").
      if (homeSide) existing.homeSide = true;
      return;
    }
    const loc: TravelDerivedLocation = {
      key: `travel-${side}-${t.id}`,
      title: `${t.title} (${side === 'from' ? 'Abflug/Abfahrt' : 'Ankunft'})`,
      icon: travelTypeIcon(t.type, '📍'),
      category: 'Reise',
      maps_link: side === 'from' ? t.from_maps_link : t.to_maps_link,
      lat,
      lng,
      homeSide,
    };
    byIdentity.set(identity, loc);
    result.push(loc);
  }

  for (const t of travelItems) {
    addSide(t, 'from');
    addSide(t, 'to');
  }
  return result;
}

// Icon je Transportmittel eines Reise-Eintrags (travel_items.type) – zentrale Stelle, vorher
// identisch in TravelView.vue UND TravelDetailDialog.vue dupliziert; wird jetzt zusätzlich von
// travelDerivedLocations.ts/excursionStations.ts wiederverwendet, damit Karte und Spots-Liste
// dasselbe Icon zeigen wie die Reise-Sicht selbst statt eines festen Flugzeug-Icons für jeden
// Eintrag unabhängig vom tatsächlichen Transportmittel.
const TYPE_ICONS: Record<string, string> = {
  Flug: '✈️',
  Zug: '🚆',
  Bus: '🚌',
  Auto: '🚗',
  Fähre: '⛴️',
};

export function travelTypeIcon(type: string | null, fallback = '🎫'): string {
  return (type && TYPE_ICONS[type]) || fallback;
}

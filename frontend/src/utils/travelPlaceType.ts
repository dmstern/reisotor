// Art eines wiederverwendbaren Reise-Orts (travel_places.type) – rein fürs Icon in der Reise-Sicht
// (TravelView.vue) und den davon abgeleiteten Karten-/Spots-Einträgen (siehe
// travelDerivedLocations.ts). Freitext-Combobox wie bei Spot-Kategorien (spotCategory.ts) statt
// festem Enum – eigene, nicht gelistete Werte bleiben möglich und fallen dann auf den generischen
// Pin zurück. Bewusst UNABHÄNGIG von travel_places.is_home (siehe dortiger Migrationskommentar in
// db/index.ts): is_home entscheidet Heimat-Seite/Urlaubsregion (Rollen-Herleitung, Urlaubsfokus),
// type nur, welches Icon der Ort zeigt – ein Flughafen kann z. B. sowohl der heimische Abflughafen
// als auch der Zielflughafen sein, in beiden Fällen aber denselben Flugzeug-Icon-Typ haben.
const KNOWN_TYPES: { label: string; icon: string }[] = [
  { label: 'Zuhause', icon: '🏠' },
  { label: 'Flughafen', icon: '✈️' },
  { label: 'Bahnhof', icon: '🚆' },
  { label: 'Busbahnhof', icon: '🚌' },
  { label: 'Hafen', icon: '⛴️' },
  { label: 'Raststätte', icon: '⛽' },
  { label: 'Sonstiger Zwischenstopp', icon: '📍' },
];

const OTHER_ICON = '📍';

/** Für die Combobox: die Standard-Arten werden immer vorgeschlagen, auch ohne bestehende Orte. */
export const TRAVEL_PLACE_TYPE_SUGGESTIONS = KNOWN_TYPES.map((t) => t.label);

const LOOKUP = new Map(KNOWN_TYPES.map((t) => [t.label.toLowerCase(), t.icon]));

export function travelPlaceTypeIcon(type: string | null | undefined): string {
  if (!type) return OTHER_ICON;
  return LOOKUP.get(type.trim().toLowerCase()) ?? OTHER_ICON;
}

/** Ob die gewählte Art eindeutig "Zuhause" bedeutet – TravelView.vue blendet die zusätzliche
 *  Heimat-Seite-Checkbox dafür aus und setzt is_home automatisch, statt beides redundant abzufragen. */
export function isZuhauseType(type: string | null | undefined): boolean {
  return !!type && type.trim().toLowerCase() === 'zuhause';
}

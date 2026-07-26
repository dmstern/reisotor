// Spot-Kategorie ist Freitext (Combobox, eigene Kategorien möglich – analog zu Budget-Kategorien),
// keine feste Enum. Bekannte Standardkategorien bekommen ein passendes Icon/Farbe; alles andere
// fällt auf das neutrale "Sonstiges"-Icon zurück (Muster wie assignCategoryColors beim Budget).
interface CategoryMeta {
  icon: string;
  color: string;
}

const KNOWN_CATEGORIES: { label: string; icon: string; color: string }[] = [
  { label: 'Restaurant', icon: '🍽️', color: '#e34948' },
  { label: 'Café', icon: '☕', color: '#c9891f' },
  { label: 'Ausflugsziel', icon: '🎯', color: '#008300' },
  { label: 'Shop', icon: '🛍️', color: '#e87ba4' },
  { label: 'Museum', icon: '🏛️', color: '#7a5c3e' },
  { label: 'Aktivität', icon: '🎉', color: '#0aa3a3' },
  { label: 'Sehenswürdigkeit', icon: '🏰', color: '#a15be0' },
  { label: 'Strand', icon: '🏖️', color: '#1ba8c4' },
  { label: 'Natur', icon: '🌳', color: '#2f9e44' },
  { label: 'Aussichtspunkt', icon: '🌄', color: '#e0763b' },
  { label: 'Wanderweg', icon: '🥾', color: '#6b7a3a' },
  { label: 'Nachtleben', icon: '🍸', color: '#7a3ea1' },
];

const OTHER_META: CategoryMeta = { icon: '📍', color: '#8a8a86' };

/** Für die Combobox: die Standardkategorien werden immer vorgeschlagen, auch ohne bestehende Spots. */
export const SPOT_CATEGORY_SUGGESTIONS = KNOWN_CATEGORIES.map((c) => c.label);

const LOOKUP = new Map(KNOWN_CATEGORIES.map((c) => [c.label.toLowerCase(), c]));

export function spotCategoryMeta(category: string | null | undefined): CategoryMeta {
  if (!category) return OTHER_META;
  return LOOKUP.get(category.trim().toLowerCase()) ?? OTHER_META;
}

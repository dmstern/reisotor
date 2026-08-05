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
  { label: 'Supermarkt', icon: '🛒', color: '#2a78d6' },
  { label: 'Bäckerei', icon: '🥐', color: '#c17817' },
  { label: 'Apotheke', icon: '💊', color: '#dc3545' },
  { label: 'Tankstelle', icon: '⛽', color: '#5a6b7a' },
];

const OTHER_META: CategoryMeta = { icon: '📍', color: '#8a8a86' };

/** Für die Combobox: die Standardkategorien werden immer vorgeschlagen, auch ohne bestehende Spots. */
export const SPOT_CATEGORY_SUGGESTIONS = KNOWN_CATEGORIES.map((c) => c.label);

const LOOKUP = new Map(KNOWN_CATEGORIES.map((c) => [c.label.toLowerCase(), c]));

// Eigene, frei getippte Kategorien (die Combobox erlaubt das schon immer – kein Enum) bekamen
// bisher alle dieselbe neutralgraue "Sonstiges"-Optik und waren dadurch auf Karte/Liste visuell
// nicht von "keine Kategorie" zu unterscheiden. Statt einer festen Zuordnungstabelle (die für
// beliebigen Freitext nicht pflegbar wäre) bekommt jede unbekannte Kategorie hier deterministisch
// eine Farbe aus derselben validierten Palette wie budget/dataviz zugewiesen (Hash statt Reihenfolge
// – anders als assignCategoryColors() in categoryColors.ts, das die volle Kategorienliste kennen
// muss, funktioniert das pro einzelnem Aufruf ohne Kontext über andere Spots).
const CUSTOM_CATEGORY_PALETTE = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948',
];

function hashCategoryColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  return CUSTOM_CATEGORY_PALETTE[Math.abs(hash) % CUSTOM_CATEGORY_PALETTE.length];
}

export function spotCategoryMeta(category: string | null | undefined): CategoryMeta {
  if (!category) return OTHER_META;
  const trimmed = category.trim().toLowerCase();
  const known = LOOKUP.get(trimmed);
  if (known) return known;
  return { icon: OTHER_META.icon, color: hashCategoryColor(trimmed) };
}

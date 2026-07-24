// Validierte kategoriale Palette (fixe Reihenfolge, adjacent-pair CVD-sicher).
// Quelle: dataviz-Skill Referenzpalette – Reihenfolge nicht verändern.
const PALETTE = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];
const FALLBACK = '#8a8a86'; // neutral grau ab Slot 9 ("Other")

/** Weist Kategorien deterministisch (alphabetisch sortiert) feste Farb-Slots zu,
 *  damit dieselbe Kategorie über Neuladen/Filter hinweg immer dieselbe Farbe behält. */
export function assignCategoryColors(categories: string[]): Map<string, string> {
  const sorted = [...new Set(categories)].sort((a, b) => a.localeCompare(b, 'de'));
  const map = new Map<string, string>();
  sorted.forEach((category, i) => {
    map.set(category, PALETTE[i] ?? FALLBACK);
  });
  return map;
}

import { assignCategoryColors } from './categoryColors';

// Feste, deterministische Farbzuordnung je Dashboard-Kachel (dataviz-Skill: kategoriale Identität,
// fixe Reihenfolge statt gewürfelter Farben) – dieselbe validierte Palette wie überall sonst in der
// App. Aus DashboardView.vue extrahiert, damit NavBar.vue (siehe NAV_LINK_COLORS unten) dieselben
// Farben für Budget/Reise/Tagebuch/Notizen wiederverwenden kann, statt eine zweite, potenziell
// abweichende Zuordnung für dieselben Konzepte zu erfinden.
export const WIDGET_COLORS = assignCategoryColors([
  'accommodation',
  'budget',
  'diary',
  'notes',
  'packing',
  'schedule',
  'shopping',
  'todo',
  'travel',
]);

// Eigene feste Farbe statt Teil der WIDGET_COLORS-Zuweisung oben: der Sicherheits-Check ist ein
// reines Spaß-Gimmick, kein echtes Inhalts-Widget – über die kategoriale Palette laufen zu lassen
// würde bei jeder künftigen Erweiterung dieser Liste die Farben der ECHTEN Widgets mitverschieben
// (assignCategoryColors sortiert alphabetisch neu). Teal passend zum Reisotor-Roboter-Logo.
export const SECURITY_TILE_COLOR = '#4FB3A9';

// Analoge Farbzuordnung für die NavBar (siehe stores/iconStyle.ts's navColored-Einstellung,
// components/NavBar.vue) - bewusst eine EIGENE assignCategoryColors()-Zuweisung statt WIDGET_COLORS
// direkt mit den Nav-Keys wiederzuverwenden (die Nav-Linkliste hat einen anderen, kleineren
// Schlüsselsatz - 'listen' bündelt z. B. packing/shopping/todo - eine gemeinsame Zuweisung würde die
// bestehenden, eingespielten Dashboard-Kachelfarben verschieben, sobald neue Keys dazukommen, da
// assignCategoryColors() alphabetisch neu sortiert). Für Konzepte, die es in beiden Listen gibt
// (Budget/Reise/Tagebuch/Notizen), wird trotzdem bewusst exakt dieselbe WIDGET_COLORS-Farbe
// übernommen statt eine zweite, abweichende zuzuweisen - dieselbe Kategorie soll app-weit dieselbe
// Farbe tragen.
export const NAV_LINK_COLORS = new Map<string, string>([
  ['dashboard', '#2a78d6'],
  ['calendar', WIDGET_COLORS.get('schedule')!],
  ['listen', '#e87ba4'],
  ['excursions', '#008300'],
  ['travel', WIDGET_COLORS.get('travel')!],
  ['budget', WIDGET_COLORS.get('budget')!],
  ['diary', WIDGET_COLORS.get('diary')!],
  ['notes', WIDGET_COLORS.get('notes')!],
]);

import {
  IconToolsKitchen2,
  IconToolsKitchen2Filled,
  IconCoffee,
  IconTarget,
  IconShoppingBag,
  IconBuildingBank,
  IconConfetti,
  IconConfettiFilled,
  IconBuildingCastle,
  IconBeach,
  IconTrees,
  IconMountain,
  IconMountainFilled,
  IconWalk,
  IconGlassCocktail,
  IconShoppingCart,
  IconShoppingCartFilled,
  IconBread,
  IconBreadFilled,
  IconPill,
  IconPillFilled,
  IconGasStation,
  IconGasStationFilled,
  IconPlaneDeparture,
  IconPlaneDepartureFilled,
  IconTrain,
  IconTrainFilled,
  IconBus,
  IconBusFilled,
  IconAnchor,
  IconRoad,
  IconHome,
  IconHomeFilled,
  IconBed,
  IconBedFilled,
  IconMapPin,
  IconMapPinFilled,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Spot-Kategorie ist Freitext (Combobox, eigene Kategorien möglich – analog zu Budget-Kategorien),
// keine feste Enum. Bekannte Standardkategorien bekommen ein passendes Icon/Farbe; alles andere
// fällt auf das neutrale "Sonstiges"-Icon zurück (Muster wie assignCategoryColors beim Budget).
interface CategoryMeta {
  icon: string;
  color: string;
  tabler: IconDef;
}

const KNOWN_CATEGORIES: { label: string; icon: string; color: string; tabler: IconDef }[] = [
  {
    label: 'Restaurant',
    icon: '🍽️',
    color: '#e34948',
    tabler: {
      id: 'tools-kitchen-2',
      emoji: '🍽️',
      outline: IconToolsKitchen2,
      filled: IconToolsKitchen2Filled,
    },
  },
  {
    label: 'Café',
    icon: '☕',
    color: '#c9891f',
    tabler: { id: 'coffee', emoji: '☕', outline: IconCoffee },
  },
  {
    label: 'Ausflugsziel',
    icon: '🎯',
    color: '#008300',
    tabler: { id: 'target', emoji: '🎯', outline: IconTarget },
  },
  {
    label: 'Shop',
    icon: '🛍️',
    color: '#e87ba4',
    tabler: { id: 'shopping-bag', emoji: '🛍️', outline: IconShoppingBag },
  },
  {
    label: 'Museum',
    icon: '🏛️',
    color: '#7a5c3e',
    tabler: { id: 'building-bank', emoji: '🏛️', outline: IconBuildingBank },
  },
  {
    label: 'Aktivität',
    icon: '🎉',
    color: '#0aa3a3',
    tabler: { id: 'confetti', emoji: '🎉', outline: IconConfetti, filled: IconConfettiFilled },
  },
  {
    label: 'Sehenswürdigkeit',
    icon: '🏰',
    color: '#a15be0',
    tabler: { id: 'building-castle', emoji: '🏰', outline: IconBuildingCastle },
  },
  {
    label: 'Strand',
    icon: '🏖️',
    color: '#1ba8c4',
    tabler: { id: 'beach', emoji: '🏖️', outline: IconBeach },
  },
  {
    label: 'Natur',
    icon: '🌳',
    color: '#2f9e44',
    tabler: { id: 'trees', emoji: '🌳', outline: IconTrees },
  },
  {
    label: 'Aussichtspunkt',
    icon: '🌄',
    color: '#e0763b',
    tabler: { id: 'mountain', emoji: '🌄', outline: IconMountain, filled: IconMountainFilled },
  },
  {
    label: 'Wanderweg',
    icon: '🥾',
    color: '#6b7a3a',
    tabler: { id: 'walk', emoji: '🥾', outline: IconWalk },
  },
  {
    label: 'Nachtleben',
    icon: '🍸',
    color: '#7a3ea1',
    tabler: { id: 'glass-cocktail', emoji: '🍸', outline: IconGlassCocktail },
  },
  {
    label: 'Supermarkt',
    icon: '🛒',
    color: '#2a78d6',
    tabler: {
      id: 'shopping-cart',
      emoji: '🛒',
      outline: IconShoppingCart,
      filled: IconShoppingCartFilled,
    },
  },
  {
    label: 'Bäckerei',
    icon: '🥐',
    color: '#c17817',
    tabler: { id: 'bread', emoji: '🥐', outline: IconBread, filled: IconBreadFilled },
  },
  {
    label: 'Apotheke',
    icon: '💊',
    color: '#dc3545',
    tabler: { id: 'pill', emoji: '💊', outline: IconPill, filled: IconPillFilled },
  },
  {
    label: 'Tankstelle',
    icon: '⛽',
    color: '#5a6b7a',
    tabler: {
      id: 'gas-station',
      emoji: '⛽',
      outline: IconGasStation,
      filled: IconGasStationFilled,
    },
  },
  // Reise-Orte (ehemals travel_places, siehe Migrationskommentar in db/index.ts) – jetzt ganz
  // normale Spot-Kategorien, damit Flughafen/Bahnhof/Zuhause/… direkt in der Spots-Sicht anlegbar
  // sind statt in einer eigenen, parallelen Orte-Liste für Reisen.
  {
    label: 'Flughafen',
    icon: '✈️',
    color: '#4a3aa7',
    tabler: {
      id: 'plane-departure',
      emoji: '✈️',
      outline: IconPlaneDeparture,
      filled: IconPlaneDepartureFilled,
    },
  },
  {
    label: 'Bahnhof',
    icon: '🚆',
    color: '#4a3aa7',
    tabler: { id: 'train', emoji: '🚆', outline: IconTrain, filled: IconTrainFilled },
  },
  {
    label: 'Busbahnhof',
    icon: '🚌',
    color: '#4a3aa7',
    tabler: { id: 'bus', emoji: '🚌', outline: IconBus, filled: IconBusFilled },
  },
  {
    label: 'Hafen',
    icon: '⛴️',
    color: '#4a3aa7',
    tabler: { id: 'anchor', emoji: '⛴️', outline: IconAnchor },
  },
  {
    label: 'Raststätte',
    icon: '🛣️',
    color: '#4a3aa7',
    tabler: { id: 'road', emoji: '🛣️', outline: IconRoad },
  },
  {
    label: 'Zuhause',
    icon: '🏠',
    color: '#4a3aa7',
    tabler: { id: 'home', emoji: '🏠', outline: IconHome, filled: IconHomeFilled },
  },
  // Unterkunft (ehemals eigene accommodation-Tabelle, siehe Migrationskommentar in db/index.ts) –
  // jetzt ebenfalls eine ganz normale Spot-Kategorie.
  {
    label: 'Unterkunft',
    icon: '🛏️',
    color: '#1baf7a',
    tabler: { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled },
  },
];

const OTHER_META: CategoryMeta = {
  icon: '📍',
  color: '#8a8a86',
  tabler: { id: 'map-pin', emoji: '📍', outline: IconMapPin, filled: IconMapPinFilled },
};

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
  return { icon: OTHER_META.icon, color: hashCategoryColor(trimmed), tabler: OTHER_META.tabler };
}

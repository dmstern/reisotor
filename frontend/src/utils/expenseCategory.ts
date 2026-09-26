import {
  IconBed,
  IconBedFilled,
  IconToolsKitchen2,
  IconToolsKitchen2Filled,
  IconShoppingCart,
  IconShoppingCartFilled,
  IconTrain,
  IconTrainFilled,
  IconPlaneDeparture,
  IconPlaneDepartureFilled,
  IconCar,
  IconCarFilled,
  IconGasStation,
  IconGasStationFilled,
  IconRoad,
  IconParking,
  IconConfetti,
  IconConfettiFilled,
  IconBuildingBank,
  IconTicket,
  IconTicketFilled,
  IconTrees,
  IconBeach,
  IconGlassCocktail,
  IconShoppingBag,
  IconGift,
  IconGiftFilled,
  IconMassage,
  IconPill,
  IconPillFilled,
  IconReceiptTax,
  IconCoin,
  IconCoinFilled,
  IconWifi,
  IconShieldCheck,
  IconShieldCheckFilled,
  IconCompass,
  IconWashMachine,
  IconCategory,
  IconCategoryFilled,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

export interface ExpenseCategoryMeta {
  label: string;
  icon: string;
  color: string;
  tabler: IconDef;
}

export interface KnownExpenseCategoryDef extends ExpenseCategoryMeta {
  aliases?: string[];
}

export const KNOWN_EXPENSE_CATEGORIES: KnownExpenseCategoryDef[] = [
  {
    label: 'Unterkunft',
    icon: '🛏️',
    color: '#1baf7a',
    tabler: { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled },
    aliases: ['hotel', 'hostel', 'ferienwohnung', 'airbnb', 'camping', 'zelt', 'resort', 'pension'],
  },
  {
    label: 'Essen & Trinken',
    icon: '🍽️',
    color: '#e34948',
    tabler: {
      id: 'tools-kitchen-2',
      emoji: '🍽️',
      outline: IconToolsKitchen2,
      filled: IconToolsKitchen2Filled,
    },
    aliases: [
      'essen',
      'trinken',
      'restaurant',
      'café',
      'cafe',
      'bar',
      'bars',
      'lunch',
      'dinner',
      'frühstück',
      'abendessen',
      'mittagessen',
      'imbiss',
      'streetfood',
    ],
  },
  {
    label: 'Supermarkt & Lebensmittel',
    icon: '🛒',
    color: '#2a78d6',
    tabler: {
      id: 'shopping-cart',
      emoji: '🛒',
      outline: IconShoppingCart,
      filled: IconShoppingCartFilled,
    },
    aliases: [
      'supermarkt',
      'lebensmittel',
      'einkauf',
      'einkäufe',
      'snacks',
      'proviant',
      'verpflegung',
      'groceries',
    ],
  },
  {
    label: 'Transport',
    icon: '🚆',
    color: '#4a3aa7',
    tabler: { id: 'train', emoji: '🚆', outline: IconTrain, filled: IconTrainFilled },
    aliases: [
      'zug',
      'bahn',
      'bus',
      'nahverkehr',
      'öffis',
      'öpnv',
      'metro',
      'u-bahn',
      's-bahn',
      'taxi',
      'uber',
      'fähre',
      'ferry',
      'boot',
    ],
  },
  {
    label: 'Flug & Anreise',
    icon: '✈️',
    color: '#0284c7',
    tabler: {
      id: 'plane-departure',
      emoji: '✈️',
      outline: IconPlaneDeparture,
      filled: IconPlaneDepartureFilled,
    },
    aliases: [
      'flug',
      'flüge',
      'flugzeug',
      'flight',
      'airport',
      'flughafen',
      'airline',
      'anreise',
      'abreise',
    ],
  },
  {
    label: 'Mietwagen & Roller',
    icon: '🚗',
    color: '#0891b2',
    tabler: { id: 'car', emoji: '🚗', outline: IconCar, filled: IconCarFilled },
    aliases: [
      'mietwagen',
      'leihwagen',
      'roller',
      'scooter',
      'vespa',
      'fahrradverleih',
      'rental',
      'car rental',
    ],
  },
  {
    label: 'Tanken & Laden',
    icon: '⛽',
    color: '#5a6b7a',
    tabler: {
      id: 'gas-station',
      emoji: '⛽',
      outline: IconGasStation,
      filled: IconGasStationFilled,
    },
    aliases: ['tanken', 'benzin', 'diesel', 'sprit', 'kraftstoff', 'ladesäule', 'e-auto', 'strom'],
  },
  {
    label: 'Maut & Vignetten',
    icon: '🛣️',
    color: '#78716c',
    tabler: { id: 'road', emoji: '🛣️', outline: IconRoad },
    aliases: [
      'maut',
      'vignette',
      'toll',
      'autobahngebühr',
      'tunnelmaut',
      'brückenmaut',
      'umweltplakette',
    ],
  },
  {
    label: 'Parken & Stellplatz',
    icon: '🅿️',
    color: '#2563eb',
    tabler: { id: 'parking', emoji: '🅿️', outline: IconParking },
    aliases: ['parken', 'parkplatz', 'parkhaus', 'parkschein', 'parking', 'stellplatz'],
  },
  {
    label: 'Aktivitäten & Spaß',
    icon: '🎉',
    color: '#0aa3a3',
    tabler: { id: 'confetti', emoji: '🎉', outline: IconConfetti, filled: IconConfettiFilled },
    aliases: [
      'aktivität',
      'aktivitäten',
      'spaß',
      'ausflug',
      'ausflüge',
      'tour',
      'touren',
      'freizeit',
      'abenteuer',
    ],
  },
  {
    label: 'Kultur & Sehenswürdigkeiten',
    icon: '🏛️',
    color: '#7a5c3e',
    tabler: { id: 'building-bank', emoji: '🏛️', outline: IconBuildingBank },
    aliases: [
      'kultur',
      'sehenswürdigkeit',
      'sehenswürdigkeiten',
      'museum',
      'museen',
      'schloss',
      'burg',
      'denkmal',
      'galerie',
      'ausstellung',
    ],
  },
  {
    label: 'Tickets & Events',
    icon: '🎟️',
    color: '#ec4899',
    tabler: { id: 'ticket', emoji: '🎟️', outline: IconTicket, filled: IconTicketFilled },
    aliases: [
      'ticket',
      'tickets',
      'eintritt',
      'konzert',
      'festival',
      'theater',
      'musical',
      'event',
      'events',
      'kino',
    ],
  },
  {
    label: 'Natur & Nationalparks',
    icon: '🌲',
    color: '#2f9e44',
    tabler: { id: 'trees', emoji: '🌲', outline: IconTrees },
    aliases: ['natur', 'nationalpark', 'wandern', 'berge', 'gletscher', 'seilbahn', 'bergebahn'],
  },
  {
    label: 'Strand & Wasser',
    icon: '🏖️',
    color: '#1ba8c4',
    tabler: { id: 'beach', emoji: '🏖️', outline: IconBeach },
    aliases: [
      'strand',
      'beach',
      'meer',
      'see',
      'baden',
      'tauchen',
      'schnorcheln',
      'surfen',
      'bootsverleih',
      'schwimmbad',
    ],
  },
  {
    label: 'Nachtleben & Bars',
    icon: '🍸',
    color: '#7a3ea1',
    tabler: { id: 'glass-cocktail', emoji: '🍸', outline: IconGlassCocktail },
    aliases: ['nachtleben', 'clubs', 'club', 'party', 'disco', 'cocktail', 'kneipe', 'pub'],
  },
  {
    label: 'Shopping & Mode',
    icon: '🛍️',
    color: '#e87ba4',
    tabler: { id: 'shopping-bag', emoji: '🛍️', outline: IconShoppingBag },
    aliases: ['shopping', 'kleidung', 'mode', 'schuhe', 'boutique', 'outlet', 'mall'],
  },
  {
    label: 'Souvenirs',
    icon: '🎁',
    color: '#f43f5e',
    tabler: { id: 'gift', emoji: '🎁', outline: IconGift, filled: IconGiftFilled },
    aliases: ['souvenir', 'andenken', 'geschenke', 'mitbringsel', 'postkarten'],
  },
  {
    label: 'Wellness & Entspannung',
    icon: '💆',
    color: '#14b8a6',
    tabler: { id: 'massage', emoji: '💆', outline: IconMassage },
    aliases: ['wellness', 'spa', 'massage', 'sauna', 'therme', 'entspannung', 'hamam'],
  },
  {
    label: 'Gesundheit & Apotheke',
    icon: '💊',
    color: '#dc3545',
    tabler: { id: 'pill', emoji: '💊', outline: IconPill, filled: IconPillFilled },
    aliases: [
      'gesundheit',
      'apotheke',
      'medikamente',
      'arzt',
      'pharma',
      'pflaster',
      'sonnencreme',
      'krankenhaus',
    ],
  },
  {
    label: 'Kurtaxe & Gebühren',
    icon: '🏷️',
    color: '#d97706',
    tabler: { id: 'receipt-tax', emoji: '🏷️', outline: IconReceiptTax },
    aliases: [
      'kurtaxe',
      'ortstaxe',
      'city tax',
      'gebühr',
      'gebühren',
      'visum',
      'visa',
      'tourismusabgabe',
    ],
  },
  {
    label: 'Trinkgelder',
    icon: '🪙',
    color: '#eab308',
    tabler: { id: 'coin', emoji: '🪙', outline: IconCoin, filled: IconCoinFilled },
    aliases: ['trinkgeld', 'tip', 'tipping', 'service'],
  },
  {
    label: 'SIM-Karte & Internet',
    icon: '📶',
    color: '#6366f1',
    tabler: { id: 'wifi', emoji: '📶', outline: IconWifi },
    aliases: ['sim', 'esim', 'internet', 'wlan', 'wifi', 'roaming', 'datenvolumen', 'mobilfunk'],
  },
  {
    label: 'Versicherungen & Schutz',
    icon: '🛡️',
    color: '#059669',
    tabler: {
      id: 'shield-check',
      emoji: '🛡️',
      outline: IconShieldCheck,
      filled: IconShieldCheckFilled,
    },
    aliases: [
      'versicherung',
      'versicherungen',
      'krankenversicherung',
      'reiserücktritt',
      'reiseschutz',
    ],
  },
  {
    label: 'Ausrüstung & Outdoor',
    icon: '🧭',
    color: '#b45309',
    tabler: { id: 'compass', emoji: '🧭', outline: IconCompass },
    aliases: [
      'ausrüstung',
      'outdoor',
      'equipment',
      'rucksack',
      'kamera',
      'technik',
      'adapter',
      'powerbank',
    ],
  },
  {
    label: 'Wäsche & Reinigung',
    icon: '🧺',
    color: '#0ea5e9',
    tabler: { id: 'wash-machine', emoji: '🧺', outline: IconWashMachine },
    aliases: ['wäsche', 'waschsalon', 'reinigung', 'laundry', 'waschen'],
  },
  {
    label: 'Sonstiges',
    icon: '📦',
    color: '#8a8a86',
    tabler: {
      id: 'category',
      emoji: '📦',
      outline: IconCategory,
      filled: IconCategoryFilled,
    },
    aliases: ['sonstiges', 'other', 'diverses', 'allgemein', 'rest'],
  },
];

const OTHER_EXPENSE_META: ExpenseCategoryMeta = {
  label: 'Sonstiges',
  icon: '🏷️',
  color: '#8a8a86',
  tabler: {
    id: 'category',
    emoji: '🏷️',
    outline: IconCategory,
    filled: IconCategoryFilled,
  },
};

/** Vorschläge für Combobox / Budget: alphabetisch sortierte Standardkategorien */
export const EXPENSE_CATEGORY_SUGGESTIONS = KNOWN_EXPENSE_CATEGORIES.map((c) => c.label).sort(
  (a, b) => a.localeCompare(b, 'de')
);

const LOOKUP = new Map<string, KnownExpenseCategoryDef>();
for (const cat of KNOWN_EXPENSE_CATEGORIES) {
  LOOKUP.set(cat.label.toLowerCase(), cat);
  if (cat.aliases) {
    for (const alias of cat.aliases) {
      LOOKUP.set(alias.toLowerCase(), cat);
    }
  }
}

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

/**
 * Ermittelt Metadaten (Icon, Farbe, Tabler-Definition) für eine gegebene Ausgabenkategorie.
 * Bei bekannten Kategorien oder Aliasen werden die Standard-Metadaten zurückgegeben;
 * bei unbekanntem Freitext wird deterministisch eine Farbe errechnet und ein neutrales Icon verwendet.
 */
export function expenseCategoryMeta(category: string | null | undefined): ExpenseCategoryMeta {
  if (!category) return OTHER_EXPENSE_META;
  const trimmed = category.trim().toLowerCase();
  if (!trimmed) return OTHER_EXPENSE_META;

  const known = LOOKUP.get(trimmed);
  if (known) {
    return {
      label: category,
      icon: known.icon,
      color: known.color,
      tabler: known.tabler,
    };
  }

  return {
    label: category,
    icon: OTHER_EXPENSE_META.icon,
    color: hashCategoryColor(trimmed),
    tabler: OTHER_EXPENSE_META.tabler,
  };
}

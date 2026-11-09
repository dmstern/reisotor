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
  IconFlower,
  IconPaw,
  IconPawFilled,
  IconMoodKid,
  IconBuildingChurch,
  IconMasksTheater,
  IconBallFootball,
  IconMassage,
  IconTent,
  IconParking,
  IconCash,
  IconBriefcase,
  IconStethoscope,
  IconBeer,
  IconBeerFilled,
  IconDisc,
  IconMusic,
  IconDeviceLaptop,
  IconMovie,
  IconIceCream,
  IconBook,
  IconBuildingHospital,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Spot-Kategorie ist Freitext (Combobox, eigene Kategorien möglich – analog zu Budget-Kategorien),
// keine feste Enum. Bekannte Standardkategorien bekommen ein passendes Icon/Farbe; alles andere
// fällt auf das neutrale "Sonstiges"-Icon zurück (Muster wie assignCategoryColors beim Budget).
export interface CategoryMeta {
  label?: string;
  icon: string;
  color: string;
  tabler: IconDef;
  aliases?: string[];
  titlePlaceholder?: string;
}

export const KNOWN_CATEGORIES: CategoryMeta[] = [
  {
    label: 'Restaurant',
    icon: '🍽️',
    color: '#e34948',
    titlePlaceholder: 'Name des Restaurants...',
    tabler: {
      id: 'tools-kitchen-2',
      emoji: '🍽️',
      outline: IconToolsKitchen2,
      filled: IconToolsKitchen2Filled,
    },
    aliases: [
      'restaurant',
      'essen & trinken',
      'essen',
      'trinken',
      'food',
      'speisen',
      'gastronomie',
      'lunch',
      'dinner',
      'mittagessen',
      'abendessen',
      'imbiss',
    ],
  },
  {
    label: 'Café',
    icon: '☕',
    color: '#c9891f',
    titlePlaceholder: 'Name des Cafés...',
    tabler: { id: 'coffee', emoji: '☕', outline: IconCoffee },
    aliases: ['café', 'cafe', 'kaffee', 'coffee'],
  },
  {
    label: 'Ausflugsziel',
    icon: '🎯',
    color: '#008300',
    titlePlaceholder: 'Name des Ausflugsziels...',
    tabler: { id: 'target', emoji: '🎯', outline: IconTarget },
    aliases: ['ausflugsziel', 'ausflug', 'attraktion', 'target'],
  },
  {
    label: 'Shop',
    icon: '🛍️',
    color: '#e87ba4',
    titlePlaceholder: 'Name des Shops...',
    tabler: { id: 'shopping-bag', emoji: '🛍️', outline: IconShoppingBag },
    aliases: [
      'shop',
      'shopping & mode',
      'shopping',
      'laden',
      'geschäft',
      'boutique',
      'mode',
      'kleidung',
    ],
  },
  {
    label: 'Museum',
    icon: '🏛️',
    color: '#7a5c3e',
    titlePlaceholder: 'Name des Museums...',
    tabler: { id: 'building-bank', emoji: '🏛️', outline: IconBuildingBank },
    aliases: ['museum', 'kultur & sehenswürdigkeiten', 'museen', 'galerie', 'ausstellung'],
  },
  {
    label: 'Aktivität',
    icon: '🎉',
    color: '#0aa3a3',
    titlePlaceholder: 'Name der Aktivität...',
    tabler: { id: 'confetti', emoji: '🎉', outline: IconConfetti, filled: IconConfettiFilled },
    aliases: ['aktivität', 'aktivitäten & spaß', 'aktivitäten', 'spaß', 'freizeit', 'tour'],
  },
  {
    label: 'Sehenswürdigkeit',
    icon: '🏰',
    color: '#9333ea',
    titlePlaceholder: 'Name der Sehenswürdigkeit...',
    tabler: { id: 'building-castle', emoji: '🏰', outline: IconBuildingCastle },
    aliases: ['sehenswürdigkeit', 'sehenswürdigkeiten', 'schloss', 'burg', 'denkmal', 'monument'],
  },
  {
    label: 'Strand',
    icon: '🏖️',
    color: '#1ba8c4',
    titlePlaceholder: 'Name des Strands...',
    tabler: { id: 'beach', emoji: '🏖️', outline: IconBeach },
    aliases: ['strand', 'strand & wasser', 'beach', 'meer', 'küste', 'bucht'],
  },
  {
    label: 'Natur',
    icon: '🌳',
    color: '#2f9e44',
    titlePlaceholder: 'Name des Natur-Spots...',
    tabler: { id: 'trees', emoji: '🌳', outline: IconTrees },
    aliases: ['natur', 'natur & nationalparks', 'wald', 'nationalpark', 'park'],
  },
  {
    label: 'Aussichtspunkt',
    icon: '🌄',
    color: '#e0763b',
    titlePlaceholder: 'Name des Aussichtspunkts...',
    tabler: { id: 'mountain', emoji: '🌄', outline: IconMountain, filled: IconMountainFilled },
    aliases: ['aussichtspunkt', 'aussicht', 'panorama', 'viewpoint', 'view', 'gipfel'],
  },
  {
    label: 'Wanderweg',
    icon: '🥾',
    color: '#6b7a3a',
    titlePlaceholder: 'Name des Wanderwegs...',
    tabler: { id: 'walk', emoji: '🥾', outline: IconWalk },
    aliases: ['wanderweg', 'wandern', 'hike', 'hiking', 'trekking', 'trail'],
  },
  {
    label: 'Bar',
    icon: '🍸',
    color: '#9333ea',
    titlePlaceholder: 'Name der Bar...',
    tabler: { id: 'glass-cocktail', emoji: '🍸', outline: IconGlassCocktail },
    aliases: ['bar', 'bars', 'cocktailbar', 'lounge', 'cocktail', 'rooftop-bar'],
  },
  {
    label: 'Kneipe',
    icon: '🍺',
    color: '#d97706',
    titlePlaceholder: 'Name der Kneipe...',
    tabler: { id: 'beer', emoji: '🍺', outline: IconBeer, filled: IconBeerFilled },
    aliases: [
      'kneipe',
      'kneipen',
      'pub',
      'pubs',
      'biergarten',
      'brauhaus',
      'brauerei',
      'gasthaus',
      'wirtshaus',
      'schenke',
      'tavern',
    ],
  },
  {
    label: 'Club',
    icon: '🪩',
    color: '#ec4899',
    titlePlaceholder: 'Name des Clubs...',
    tabler: { id: 'disc', emoji: '🪩', outline: IconDisc },
    aliases: ['club', 'nightclub', 'disco', 'diskothek', 'tanzlokal', 'nachtclub'],
  },
  {
    label: 'Nachtleben',
    icon: '🌙',
    color: '#7a3ea1',
    titlePlaceholder: 'Name der Location...',
    tabler: { id: 'music', emoji: '🌙', outline: IconMusic },
    aliases: ['nachtleben', 'party', 'nightlife'],
  },
  {
    label: 'Supermarkt',
    icon: '🛒',
    color: '#2a78d6',
    titlePlaceholder: 'Name des Supermarkts...',
    tabler: {
      id: 'shopping-cart',
      emoji: '🛒',
      outline: IconShoppingCart,
      filled: IconShoppingCartFilled,
    },
    aliases: ['supermarkt', 'supermarkt & lebensmittel', 'lebensmittel', 'einkauf', 'groceries'],
  },
  {
    label: 'Bäckerei',
    icon: '🥐',
    color: '#c17817',
    titlePlaceholder: 'Name der Bäckerei...',
    tabler: { id: 'bread', emoji: '🥐', outline: IconBread, filled: IconBreadFilled },
    aliases: ['bäckerei', 'bäcker', 'frühstück', 'bakery'],
  },
  {
    label: 'Apotheke',
    icon: '💊',
    color: '#dc3545',
    titlePlaceholder: 'Name der Apotheke...',
    tabler: { id: 'pill', emoji: '💊', outline: IconPill, filled: IconPillFilled },
    aliases: ['apotheke', 'gesundheit & apotheke', 'gesundheit', 'medikamente', 'pharmacy'],
  },
  {
    label: 'Tankstelle',
    icon: '⛽',
    color: '#5a6b7a',
    titlePlaceholder: 'Name der Tankstelle...',
    tabler: {
      id: 'gas-station',
      emoji: '⛽',
      outline: IconGasStation,
      filled: IconGasStationFilled,
    },
    aliases: ['tankstelle', 'tanken & laden', 'tanken', 'benzin', 'diesel', 'sprit', 'ladesäule'],
  },
  // Reise-Orte (ehemals travel_places, siehe Migrationskommentar in db/index.ts) – jetzt ganz
  // normale Spot-Kategorien, damit Flughafen/Bahnhof/Zuhause/… direkt in der Spots-Sicht anlegbar
  // sind statt in einer eigenen, parallelen Orte-Liste für Reisen.
  {
    label: 'Flughafen',
    icon: '✈️',
    color: '#4a3aa7',
    titlePlaceholder: 'Name des Flughafens...',
    tabler: {
      id: 'plane-departure',
      emoji: '✈️',
      outline: IconPlaneDeparture,
      filled: IconPlaneDepartureFilled,
    },
    aliases: ['flughafen', 'flug & anreise', 'airport', 'flug', 'flüge'],
  },
  {
    label: 'Bahnhof',
    icon: '🚆',
    color: '#4a3aa7',
    titlePlaceholder: 'Name des Bahnhofs...',
    tabler: { id: 'train', emoji: '🚆', outline: IconTrain, filled: IconTrainFilled },
    aliases: ['bahnhof', 'transport', 'zug', 'bahn', 'station', 'metro', 'u-bahn', 's-bahn'],
  },
  {
    label: 'Busbahnhof',
    icon: '🚌',
    color: '#4a3aa7',
    titlePlaceholder: 'Name des Busbahnhofs...',
    tabler: { id: 'bus', emoji: '🚌', outline: IconBus, filled: IconBusFilled },
    aliases: ['busbahnhof', 'bus', 'fernbus', 'shuttle'],
  },
  {
    label: 'Hafen',
    icon: '⛴️',
    color: '#4a3aa7',
    titlePlaceholder: 'Name des Hafens...',
    tabler: { id: 'anchor', emoji: '⛴️', outline: IconAnchor },
    aliases: ['hafen', 'fähre', 'ferry', 'pier', 'marina', 'port'],
  },
  {
    label: 'Raststätte',
    icon: '🛣️',
    color: '#4a3aa7',
    titlePlaceholder: 'Name der Raststätte...',
    tabler: { id: 'road', emoji: '🛣️', outline: IconRoad },
    aliases: ['raststätte', 'maut & vignetten', 'autobahn', 'rastplatz'],
  },
  {
    label: 'Zuhause',
    icon: '🏠',
    color: '#4a3aa7',
    titlePlaceholder: 'Name des Heimatorts...',
    tabler: { id: 'home', emoji: '🏠', outline: IconHome, filled: IconHomeFilled },
    aliases: ['zuhause', 'heimat', 'wohnung', 'home'],
  },
  // Unterkunft (ehemals eigene accommodation-Tabelle, siehe Migrationskommentar in db/index.ts) –
  // jetzt ebenfalls eine ganz normale Spot-Kategorie.
  {
    label: 'Unterkunft',
    icon: '🛏️',
    color: '#1baf7a',
    titlePlaceholder: 'Name der Unterkunft...',
    tabler: { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled },
    aliases: ['hotel', 'hostel', 'ferienwohnung', 'airbnb', 'pension', 'resort'],
  },
  {
    label: 'Park & Garten',
    icon: '🌷',
    color: '#22c55e',
    titlePlaceholder: 'Name des Parks...',
    tabler: { id: 'flower', emoji: '🌷', outline: IconFlower },
    aliases: ['park', 'garten', 'schlosspark', 'botanischer garten', 'stadtpark'],
  },
  {
    label: 'Zoo & Tierpark',
    icon: '🦁',
    color: '#ea580c',
    titlePlaceholder: 'Name des Zoos...',
    tabler: { id: 'paw', emoji: '🦁', outline: IconPaw, filled: IconPawFilled },
    aliases: ['zoo', 'tierpark', 'aquarium', 'safari', 'wildpark'],
  },
  {
    label: 'Spielplatz',
    icon: '🛝',
    color: '#f59e0b',
    titlePlaceholder: 'Name des Spielplatzes...',
    tabler: { id: 'mood-kid', emoji: '🛝', outline: IconMoodKid },
    aliases: ['spielplatz', 'playground'],
  },
  {
    label: 'Kirche & Tempel',
    icon: '⛪',
    color: '#64748b',
    titlePlaceholder: 'Name der Kirche...',
    tabler: { id: 'building-church', emoji: '⛪', outline: IconBuildingChurch },
    aliases: ['kirche', 'tempel', 'dom', 'kathedrale', 'moschee', 'synagoge', 'kloster'],
  },
  {
    label: 'Theater & Bühne',
    icon: '🎭',
    color: '#d946ef',
    titlePlaceholder: 'Name des Theaters...',
    tabler: { id: 'masks-theater', emoji: '🎭', outline: IconMasksTheater },
    aliases: ['theater', 'oper', 'bühne', 'kino', 'musical'],
  },
  {
    label: 'Sport & Fitness',
    icon: '⚽',
    color: '#10b981',
    titlePlaceholder: 'Name der Sportstätte...',
    tabler: { id: 'ball-football', emoji: '⚽', outline: IconBallFootball },
    aliases: ['sport', 'fitness', 'stadion', 'sportplatz', 'kletterhalle'],
  },
  {
    label: 'Wellness & Therme',
    icon: '💆',
    color: '#14b8a6',
    titlePlaceholder: 'Name der Therme...',
    tabler: { id: 'massage', emoji: '💆', outline: IconMassage },
    aliases: ['wellness', 'spa', 'therme', 'sauna', 'bad'],
  },
  {
    label: 'Campingplatz',
    icon: '⛺',
    color: '#15803d',
    titlePlaceholder: 'Name des Campingplatzes...',
    tabler: { id: 'tent', emoji: '⛺', outline: IconTent },
    aliases: ['camping', 'campingplatz', 'zeltplatz', 'glamping'],
  },
  {
    label: 'Parkplatz',
    icon: '🅿️',
    color: '#2563eb',
    titlePlaceholder: 'Name des Parkplatzes...',
    tabler: { id: 'parking', emoji: '🅿️', outline: IconParking },
    aliases: ['parkplatz', 'parkhaus', 'parkschein'],
  },
  {
    label: 'Geldautomat & Bank',
    icon: '🏧',
    color: '#059669',
    titlePlaceholder: 'Name der Bank...',
    tabler: { id: 'cash', emoji: '🏧', outline: IconCash },
    aliases: ['atm', 'geldautomat', 'bank', 'wechselstube'],
  },
  {
    label: 'Agentur',
    icon: '💻',
    color: '#0284c7',
    titlePlaceholder: 'Name der Agentur...',
    tabler: { id: 'device-laptop', emoji: '💻', outline: IconDeviceLaptop },
    aliases: [
      'agentur',
      'digitalagentur',
      'werbeagentur',
      'it-agentur',
      'kreativagentur',
      'agency',
      'designagentur',
    ],
  },
  {
    label: 'Unternehmen',
    icon: '💼',
    color: '#475569',
    titlePlaceholder: 'Name des Unternehmens...',
    tabler: { id: 'briefcase', emoji: '💼', outline: IconBriefcase },
    aliases: ['unternehmen', 'büro', 'firma', 'office', 'company', 'arbeitsplatz', 'betrieb'],
  },
  {
    label: 'Kino',
    icon: '🎬',
    color: '#e11d48',
    titlePlaceholder: 'Name des Kinos...',
    tabler: { id: 'movie', emoji: '🎬', outline: IconMovie },
    aliases: ['kino', 'cinema', 'filmpalast', 'movie', 'lichtspiele'],
  },
  {
    label: 'Eiscafé',
    icon: '🍨',
    color: '#06b6d4',
    titlePlaceholder: 'Name des Eiscafés...',
    tabler: { id: 'ice-cream', emoji: '🍨', outline: IconIceCream },
    aliases: ['eiscafé', 'eiscafe', 'eisdiele', 'gelateria', 'eis', 'ice cream', 'ice_cream'],
  },
  {
    label: 'Bibliothek & Buchhandlung',
    icon: '📚',
    color: '#854d0e',
    titlePlaceholder: 'Name der Bibliothek...',
    tabler: { id: 'book', emoji: '📚', outline: IconBook },
    aliases: [
      'bibliothek',
      'bücherei',
      'buchhandlung',
      'buchladen',
      'bookstore',
      'library',
      'books',
    ],
  },
  {
    label: 'Krankenhaus & Klinik',
    icon: '🏥',
    color: '#dc2626',
    titlePlaceholder: 'Name des Krankenhauses...',
    tabler: { id: 'building-hospital', emoji: '🏥', outline: IconBuildingHospital },
    aliases: ['krankenhaus', 'klinik', 'spital', 'hospital', 'clinic', 'notaufnahme'],
  },
  {
    label: 'Gesundheit',
    icon: '🩺',
    color: '#0ea5e9',
    titlePlaceholder: 'Name der Praxis...',
    tabler: { id: 'stethoscope', emoji: '🩺', outline: IconStethoscope },
    aliases: ['gesundheit', 'arzt', 'ärzte', 'zahnarzt', 'praxis', 'doctor', 'dentist'],
  },
];

const OTHER_META: CategoryMeta = {
  icon: '📍',
  color: '#8a8a86',
  tabler: { id: 'map-pin', emoji: '📍', outline: IconMapPin, filled: IconMapPinFilled },
};

/** Für die Combobox: die Standardkategorien werden immer vorgeschlagen, auch ohne bestehende Spots. */
export const SPOT_CATEGORY_SUGGESTIONS = KNOWN_CATEGORIES.map((category) => category.label!).filter(
  Boolean
);

const LOOKUP = new Map<string, CategoryMeta>();

for (const cat of KNOWN_CATEGORIES) {
  if (cat.label) {
    LOOKUP.set(cat.label.toLowerCase(), cat);
  }

  if (cat.aliases) {
    for (const alias of cat.aliases) {
      LOOKUP.set(alias.toLowerCase(), cat);
    }
  }
}

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
  if (!category) {
    return OTHER_META;
  }

  const trimmed = category.trim().toLowerCase();
  const known = LOOKUP.get(trimmed);

  if (known) {
    return known;
  }

  return { icon: OTHER_META.icon, color: hashCategoryColor(trimmed), tabler: OTHER_META.tabler };
}

/**
 * Prüft, ob eine Spot-Kategorie ein eindeutiger Heimat-Ort ist (z. B. 'Zuhause', 'Wohnung', 'Home').
 * Solche Spots werden standardmäßig als Heimatort (is_home = true) vorbelegt.
 */
export function isHomeCategory(category: string | null | undefined): boolean {
  if (!category) {
    return false;
  }

  const trimmed = category.trim().toLowerCase();
  const known = LOOKUP.get(trimmed);

  if (known?.label === 'Zuhause') {
    return true;
  }

  return ['zuhause', 'heimat', 'wohnung', 'home', 'haus', 'daheim'].includes(trimmed);
}

/**
 * Prüft, ob eine Spot-Kategorie ein Reise- bzw. Transit-Ort ist (z. B. Flughafen, Bahnhof, Hafen, Raststätte),
 * der sowohl an der Heimat-Seite (z. B. Abflughafen) als auch am Urlaubsort (z. B. Zielflughafen) liegen kann.
 * Bei diesen Kategorien kann die Zuordnung nicht vollautomatisch erraten werden, weshalb der
 * "Teil der Urlaubsregion"-Schalter im Spot-Formular prominent angeboten wird.
 */
export function isTransitCategory(category: string | null | undefined): boolean {
  if (!category) {
    return false;
  }

  const trimmed = category.trim().toLowerCase();
  const known = LOOKUP.get(trimmed);
  const transitLabels = ['Flughafen', 'Bahnhof', 'Busbahnhof', 'Hafen', 'Raststätte', 'Tankstelle'];

  if (known?.label && transitLabels.includes(known.label)) {
    return true;
  }

  const transitAliases = [
    'flughafen',
    'airport',
    'flug',
    'flüge',
    'bahnhof',
    'station',
    'zug',
    'bahn',
    'metro',
    'u-bahn',
    's-bahn',
    'busbahnhof',
    'bus',
    'fernbus',
    'shuttle',
    'hafen',
    'fähre',
    'ferry',
    'pier',
    'marina',
    'port',
    'raststätte',
    'rastplatz',
    'autobahn',
    'tankstelle',
    'tanken',
    'ladesäule',
  ];
  return transitAliases.includes(trimmed);
}

/**
 * Prüft, ob eine Kategorie ein eindeutiger Urlaubsort ist (z. B. Unterkunft, Restaurant, Strand, Museum, Ausflugsziel).
 * Bei Urlaubsplanung zählen Orte standardmäßig zur Urlaubsregion (is_home = false).
 */
export function isVacationCategory(category: string | null | undefined): boolean {
  if (!category) {
    return false;
  }

  return !isHomeCategory(category) && !isTransitCategory(category);
}

export const DEFAULT_SPOT_TITLE_PLACEHOLDER = 'Name des Spots...';

const SPECIFIC_PLACEHOLDERS: Record<string, string> = {
  // Unterkunft & Wohnen
  hotel: 'Name des Hotels...',
  hostel: 'Name des Hostels...',
  ferienwohnung: 'Name der Ferienwohnung...',
  pension: 'Name der Pension...',
  resort: 'Name des Resorts...',
  wohnung: 'Name der Wohnung...',
  haus: 'Name des Hauses...',

  // Gastronomie, Bars & Kneipen
  pub: 'Name des Pubs...',
  pubs: 'Name des Pubs...',
  biergarten: 'Name des Biergartens...',
  brauhaus: 'Name des Brauhauses...',
  brauerei: 'Name der Brauerei...',
  wirtshaus: 'Name des Wirtshauses...',
  gasthaus: 'Name des Gasthauses...',
  schenke: 'Name der Schenke...',
  tavern: 'Name der Taverne...',
  cocktailbar: 'Name der Cocktailbar...',
  lounge: 'Name der Lounge...',
  imbiss: 'Name des Imbisses...',
  bäcker: 'Name der Bäckerei...',
  eisdiele: 'Name der Eisdiele...',
  gelateria: 'Name der Gelateria...',

  // Nachtleben & Kultur
  disco: 'Name der Disco...',
  diskothek: 'Name der Diskothek...',
  nachtclub: 'Name des Nachtclubs...',
  oper: 'Name der Oper...',
  musical: 'Name des Musicals...',
  galerie: 'Name der Galerie...',
  ausstellung: 'Name der Ausstellung...',
  schloss: 'Name des Schlosses...',
  burg: 'Name der Burg...',
  denkmal: 'Name des Denkmals...',
  monument: 'Name des Denkmals...',
  tempel: 'Name des Tempels...',
  dom: 'Name des Doms...',
  kathedrale: 'Name der Kathedrale...',
  moschee: 'Name der Moschee...',
  synagoge: 'Name der Synagoge...',
  kloster: 'Name des Klosters...',

  // Natur, Ausflug & Freizeit
  bucht: 'Name der Bucht...',
  meer: 'Name des Strands...',
  nationalpark: 'Name des Nationalparks...',
  park: 'Name des Parks...',
  garten: 'Name des Gartens...',
  wald: 'Name des Waldes...',
  gipfel: 'Name des Gipfels...',
  trail: 'Name des Trails...',
  tierpark: 'Name des Tierparks...',
  aquarium: 'Name des Aquariums...',
  wildpark: 'Name des Wildparks...',
  safari: 'Name des Safariparks...',
  spa: 'Name des Spas...',
  therme: 'Name der Therme...',
  sauna: 'Name der Sauna...',
  zeltplatz: 'Name des Zeltplatzes...',
  stadion: 'Name des Stadions...',
  fitnessstudio: 'Name des Fitnessstudios...',
  kletterhalle: 'Name der Kletterhalle...',

  // Shopping & Services
  laden: 'Name des Ladens...',
  geschäft: 'Name des Geschäfts...',
  boutique: 'Name der Boutique...',
  buchhandlung: 'Name der Buchhandlung...',
  buchladen: 'Name des Buchladens...',
  bücherei: 'Name der Bücherei...',
  bank: 'Name der Bank...',
  geldautomat: 'Name des Geldautomaten...',
  atm: 'Name des Geldautomaten...',
  wechselstube: 'Name der Wechselstube...',
  parkhaus: 'Name des Parkhauses...',

  // Transport & Reise
  airport: 'Name des Flughafens...',
  zug: 'Name des Bahnhofs...',
  bahn: 'Name des Bahnhofs...',
  station: 'Name der Station...',
  'u-bahn': 'Name der U-Bahn-Station...',
  's-bahn': 'Name der S-Bahn-Station...',
  metro: 'Name der Metro-Station...',
  fernbus: 'Name des Busbahnhofs...',
  fähre: 'Name der Fähre...',
  ferry: 'Name der Fähre...',
  pier: 'Name des Piers...',
  marina: 'Name der Marina...',
  port: 'Name des Hafens...',
  rastplatz: 'Name des Rastplatzes...',

  // Gesundheit & Arbeit
  klinik: 'Name der Klinik...',
  spital: 'Name des Spitals...',
  arzt: 'Name des Arztes...',
  zahnarzt: 'Name des Zahnarztes...',
  praxis: 'Name der Praxis...',
  firma: 'Name der Firma...',
  büro: 'Name des Büros...',
};

/**
 * Liefert einen kontextuellen Platzhalter für das Titel-Eingabefeld eines Spots basierend auf der Kategorie.
 * Erkennt bekannte Standard-Kategorien sowie spezifische Synonyme (z. B. "Name der Kneipe...", "Name des Restaurants...", "Name des Strands...").
 */
export function spotTitlePlaceholder(category: string | null | undefined): string {
  if (!category) {
    return DEFAULT_SPOT_TITLE_PLACEHOLDER;
  }

  const trimmed = category.trim().toLowerCase();

  if (!trimmed) {
    return DEFAULT_SPOT_TITLE_PLACEHOLDER;
  }

  const specific = SPECIFIC_PLACEHOLDERS[trimmed];

  if (specific) {
    return specific;
  }

  const known = LOOKUP.get(trimmed);

  if (known?.titlePlaceholder) {
    return known.titlePlaceholder;
  }

  return DEFAULT_SPOT_TITLE_PLACEHOLDER;
}

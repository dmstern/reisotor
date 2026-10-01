import {
  IconBed,
  IconBedFilled,
  IconTent,
  IconCaravan,
  IconCaravanFilled,
  IconBuildingCottage,
  IconBuildingCastle,
  IconKey,
  IconToolsKitchen2,
  IconToolsKitchen2Filled,
  IconBurger,
  IconPizza,
  IconCoffee,
  IconBread,
  IconBreadFilled,
  IconCake,
  IconIceCream,
  IconGlassCocktail,
  IconBeer,
  IconBeerFilled,
  IconGlassChampagne,
  IconCup,
  IconFlame,
  IconFlameFilled,
  IconFish,
  IconApple,
  IconAppleFilled,
  IconCookie,
  IconCookieFilled,
  IconSoup,
  IconMushroom,
  IconPlaneDeparture,
  IconPlaneDepartureFilled,
  IconTrain,
  IconTrainFilled,
  IconCar,
  IconCarFilled,
  IconBus,
  IconBusFilled,
  IconBike,
  IconScooter,
  IconMotorbike,
  IconMotorbikeFilled,
  IconWalk,
  IconFerry,
  IconFerryFilled,
  IconSpeedboat,
  IconSpeedboatFilled,
  IconSailboat,
  IconAerialLift,
  IconAerialLiftFilled,
  IconGasStation,
  IconGasStationFilled,
  IconChargingPile,
  IconChargingPileFilled,
  IconParking,
  IconAnchor,
  IconCamera,
  IconCameraFilled,
  IconMapPin,
  IconMapPinFilled,
  IconCompass,
  IconBuildingMonument,
  IconBuildingChurch,
  IconBuildingLighthouse,
  IconBuildingBridge,
  IconPalette,
  IconPaletteFilled,
  IconMasksTheater,
  IconMovie,
  IconMusic,
  IconConfetti,
  IconConfettiFilled,
  IconBalloon,
  IconBalloonFilled,
  IconTorii,
  IconPyramid,
  IconMountain,
  IconMountainFilled,
  IconBeach,
  IconTrees,
  IconFlower,
  IconFlowerFilled,
  IconSunset,
  IconSunsetFilled,
  IconSun,
  IconSunFilled,
  IconUmbrella,
  IconUmbrellaFilled,
  IconRipple,
  IconCampfire,
  IconSunglasses,
  IconSunglassesFilled,
  IconSnowflake,
  IconSwimming,
  IconScubaMask,
  IconSkiJumping,
  IconSnowboarding,
  IconRun,
  IconBarbell,
  IconBarbellFilled,
  IconYoga,
  IconGolf,
  IconGolfFilled,
  IconBallTennis,
  IconBallFootball,
  IconBallBasketball,
  IconBallVolleyball,
  IconKayak,
  IconFishHook,
  IconGymnastics,
  IconLifebuoy,
  IconMassage,
  IconPill,
  IconPillFilled,
  IconFirstAidKit,
  IconHospital,
  IconBabyCarriage,
  IconShoppingCart,
  IconShoppingCartFilled,
  IconShoppingBag,
  IconBuildingStore,
  IconGift,
  IconGiftFilled,
  IconCoin,
  IconCoinFilled,
  IconCreditCard,
  IconCreditCardFilled,
  IconReceipt,
  IconReceiptFilled,
  IconBuildingBank,
  IconDiscount,
  IconDiscountFilled,
  IconTrophy,
  IconLuggage,
  IconId,
  IconIdFilled,
  IconTicket,
  IconTicketFilled,
  IconWifi,
  IconPhone,
  IconDeviceLaptop,
  IconHeadphones,
  IconHeadphonesFilled,
  IconBook,
  IconShirt,
  IconShirtFilled,
  IconDog,
  IconBinoculars,
  IconSparkles,
  IconHeart,
  IconHeartFilled,
  IconStar,
  IconStarFilled,
  IconCategory,
  IconCategoryFilled,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';
import { expenseCategoryMeta } from './expenseCategory';
import { spotCategoryMeta } from './spotCategory';

export interface CategoryIconOption {
  id: string;
  label: string;
  defaultEmoji: string;
  tabler: IconDef;
  keywords?: string[];
}

export const CATEGORY_COLOR_PALETTE: string[] = [
  '#1baf7a', // Grün / Smaragd
  '#0ea5e9', // Himmelblau
  '#3b82f6', // Blau
  '#6366f1', // Indigo
  '#8b5cf6', // Violett
  '#ec4899', // Pink
  '#f43f5e', // Himbeerrot
  '#ef4444', // Kräftig Rot
  '#f97316', // Orange
  '#f59e0b', // Bernstein / Warmes Gelb
  '#eab308', // Sonnengelb
  '#84cc16', // Limette
  '#14b8a6', // Türkis
  '#64748b', // Schiefergrau
];

export const CATEGORY_ICON_PALETTE: CategoryIconOption[] = [
  // 1. Unterkunft & Wohnen
  {
    id: 'bed',
    label: 'Unterkunft & Hotel',
    defaultEmoji: '🛏️',
    tabler: { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled },
    keywords: ['hotel', 'hostel', 'unterkunft', 'zimmer', 'schlafen', 'motel', 'resort', 'pension'],
  },
  {
    id: 'tent',
    label: 'Camping & Zelten',
    defaultEmoji: '⛺',
    tabler: { id: 'tent', emoji: '⛺', outline: IconTent },
    keywords: ['camping', 'zelt', 'zelten', 'outdoor', 'campen', 'campingplatz'],
  },
  {
    id: 'caravan',
    label: 'Wohnmobil & Camper',
    defaultEmoji: '🚐',
    tabler: { id: 'caravan', emoji: '🚐', outline: IconCaravan, filled: IconCaravanFilled },
    keywords: ['wohnmobil', 'camper', 'rv', 'caravan', 'vanlife', 'van', 'campingbus'],
  },
  {
    id: 'cottage',
    label: 'Ferienhaus & Hütte',
    defaultEmoji: '🏡',
    tabler: { id: 'building-cottage', emoji: '🏡', outline: IconBuildingCottage },
    keywords: [
      'ferienhaus',
      'hütte',
      'villa',
      'chalet',
      'haus',
      'ferienwohnung',
      'bungalow',
      'cottage',
    ],
  },
  {
    id: 'castle',
    label: 'Schloss & Burg',
    defaultEmoji: '🏰',
    tabler: { id: 'building-castle', emoji: '🏰', outline: IconBuildingCastle },
    keywords: ['schloss', 'burg', 'palast', 'castle', 'festung', 'historisch', 'palace'],
  },
  {
    id: 'key',
    label: 'Check-in & Schlüssel',
    defaultEmoji: '🔑',
    tabler: { id: 'key', emoji: '🔑', outline: IconKey },
    keywords: ['schlüssel', 'key', 'checkin', 'rezeption', 'zugang', 'checkout'],
  },

  // 2. Essen & Trinken
  {
    id: 'utensils',
    label: 'Essen & Restaurant',
    defaultEmoji: '🍽️',
    tabler: {
      id: 'tools-kitchen-2',
      emoji: '🍽️',
      outline: IconToolsKitchen2,
      filled: IconToolsKitchen2Filled,
    },
    keywords: [
      'essen',
      'restaurant',
      'lokal',
      'gasthaus',
      'speisen',
      'mittagessen',
      'abendessen',
      'dine',
      'food',
    ],
  },
  {
    id: 'burger',
    label: 'Fast Food & Burger',
    defaultEmoji: '🍔',
    tabler: { id: 'burger', emoji: '🍔', outline: IconBurger },
    keywords: ['fastfood', 'burger', 'imbiss', 'snack', 'pommes', 'quick'],
  },
  {
    id: 'pizza',
    label: 'Pizza & Pasta',
    defaultEmoji: '🍕',
    tabler: { id: 'pizza', emoji: '🍕', outline: IconPizza },
    keywords: ['pizza', 'pasta', 'italienisch', 'trattoria', 'pizzeria', 'spaghetti'],
  },
  {
    id: 'coffee',
    label: 'Café & Bäckerei',
    defaultEmoji: '☕',
    tabler: { id: 'coffee', emoji: '☕', outline: IconCoffee },
    keywords: ['kaffee', 'cafe', 'espresso', 'cappuccino', 'barista', 'pause', 'coffee'],
  },
  {
    id: 'bread',
    label: 'Bäckerei & Frühstück',
    defaultEmoji: '🥐',
    tabler: { id: 'bread', emoji: '🥐', outline: IconBread, filled: IconBreadFilled },
    keywords: ['bäcker', 'bäckerei', 'frühstück', 'croissant', 'brot', 'brötchen', 'bakery'],
  },
  {
    id: 'cake',
    label: 'Kuchen & Dessert',
    defaultEmoji: '🍰',
    tabler: { id: 'cake', emoji: '🍰', outline: IconCake },
    keywords: ['kuchen', 'torte', 'dessert', 'gebäck', 'süß', 'nachtisch', 'cake'],
  },
  {
    id: 'ice-cream',
    label: 'Eis & Eisdiele',
    defaultEmoji: '🍦',
    tabler: { id: 'ice-cream', emoji: '🍦', outline: IconIceCream },
    keywords: ['eis', 'eiscreme', 'eisdiele', 'gelato', 'icecream', 'sorbet'],
  },
  {
    id: 'cocktail',
    label: 'Bar & Nachtleben',
    defaultEmoji: '🍸',
    tabler: { id: 'glass-cocktail', emoji: '🍸', outline: IconGlassCocktail },
    keywords: ['bar', 'cocktail', 'drinks', 'kneipe', 'nightlife', 'party', 'lounge'],
  },
  {
    id: 'beer',
    label: 'Bier & Pub',
    defaultEmoji: '🍺',
    tabler: { id: 'beer', emoji: '🍺', outline: IconBeer, filled: IconBeerFilled },
    keywords: ['bier', 'pub', 'brauerei', 'biergarten', 'kneipe', 'ale', 'craftbeer'],
  },
  {
    id: 'wine',
    label: 'Wein & Verkostung',
    defaultEmoji: '🍷',
    tabler: { id: 'glass-champagne', emoji: '🍷', outline: IconGlassChampagne },
    keywords: ['wein', 'weingut', 'champagner', 'sekt', 'vino', 'wine', 'tasting', 'verkostung'],
  },
  {
    id: 'cup',
    label: 'Tee & Heißgetränke',
    defaultEmoji: '🍵',
    tabler: { id: 'cup', emoji: '🍵', outline: IconCup },
    keywords: ['tee', 'heißgetränk', 'tea', 'matcha', 'tasse'],
  },
  {
    id: 'flame',
    label: 'Grill & BBQ',
    defaultEmoji: '🍖',
    tabler: { id: 'flame', emoji: '🍖', outline: IconFlame, filled: IconFlameFilled },
    keywords: ['grill', 'bbq', 'barbecue', 'fleisch', 'grillen', 'steak'],
  },
  {
    id: 'fish',
    label: 'Fisch & Meeresfrüchte',
    defaultEmoji: '🐟',
    tabler: { id: 'fish', emoji: '🐟', outline: IconFish },
    keywords: ['fisch', 'seafood', 'meeresfrüchte', 'sushi', 'fish'],
  },
  {
    id: 'apple',
    label: 'Obst & Frischemarkt',
    defaultEmoji: '🍎',
    tabler: { id: 'apple', emoji: '🍎', outline: IconApple, filled: IconAppleFilled },
    keywords: ['obst', 'apfel', 'früchte', 'gesund', 'vegan', 'markt', 'gemüse'],
  },
  {
    id: 'cookie',
    label: 'Snacks & Süßes',
    defaultEmoji: '🍪',
    tabler: { id: 'cookie', emoji: '🍪', outline: IconCookie, filled: IconCookieFilled },
    keywords: ['snack', 'keks', 'süßigkeiten', 'chips', 'naschen', 'cookie'],
  },
  {
    id: 'soup',
    label: 'Suppe & Streetfood',
    defaultEmoji: '🍜',
    tabler: { id: 'soup', emoji: '🍜', outline: IconSoup },
    keywords: ['suppe', 'ramen', 'streetfood', 'nudeln', 'asiatisch', 'soup'],
  },
  {
    id: 'mushroom',
    label: 'Pilze & Waldfrüchte',
    defaultEmoji: '🍄',
    tabler: { id: 'mushroom', emoji: '🍄', outline: IconMushroom },
    keywords: ['pilz', 'wald', 'beeren', 'natur', 'sammeln', 'mushroom'],
  },

  // 3. Transport & Mobilität
  {
    id: 'plane',
    label: 'Flug & Flughafen',
    defaultEmoji: '✈️',
    tabler: {
      id: 'plane-departure',
      emoji: '✈️',
      outline: IconPlaneDeparture,
      filled: IconPlaneDepartureFilled,
    },
    keywords: ['flug', 'flugzeug', 'flughafen', 'airport', 'airline', 'flight'],
  },
  {
    id: 'train',
    label: 'Zug & Bahn',
    defaultEmoji: '🚆',
    tabler: { id: 'train', emoji: '🚆', outline: IconTrain, filled: IconTrainFilled },
    keywords: ['zug', 'bahn', 'bahnhof', 's-bahn', 'ice', 'rail', 'metro', 'tram'],
  },
  {
    id: 'car',
    label: 'Mietwagen & Auto',
    defaultEmoji: '🚗',
    tabler: { id: 'car', emoji: '🚗', outline: IconCar, filled: IconCarFilled },
    keywords: ['auto', 'mietwagen', 'car', 'rental', 'pkw', 'fahrt', 'taxi'],
  },
  {
    id: 'bus',
    label: 'Bus & Shuttle',
    defaultEmoji: '🚌',
    tabler: { id: 'bus', emoji: '🚌', outline: IconBus, filled: IconBusFilled },
    keywords: ['bus', 'shuttle', 'reisebus', 'fernbus', 'nahverkehr', 'transfer'],
  },
  {
    id: 'bike',
    label: 'Fahrrad & E-Bike',
    defaultEmoji: '🚲',
    tabler: { id: 'bike', emoji: '🚲', outline: IconBike },
    keywords: ['fahrrad', 'bike', 'rad', 'ebike', 'radtour', 'mountainbike'],
  },
  {
    id: 'scooter',
    label: 'Roller & E-Scooter',
    defaultEmoji: '🛴',
    tabler: { id: 'scooter', emoji: '🛴', outline: IconScooter },
    keywords: ['roller', 'escooter', 'scooter', 'tretroller'],
  },
  {
    id: 'motorbike',
    label: 'Motorrad & Vespa',
    defaultEmoji: '🏍️',
    tabler: { id: 'motorbike', emoji: '🏍️', outline: IconMotorbike, filled: IconMotorbikeFilled },
    keywords: ['motorrad', 'moped', 'vespa', 'biker', 'roller'],
  },
  {
    id: 'walk',
    label: 'Zu Fuß & Wandern',
    defaultEmoji: '🚶',
    tabler: { id: 'walk', emoji: '🚶', outline: IconWalk },
    keywords: ['wandern', 'hike', 'fuß', 'walking', 'spaziergang', 'trekking'],
  },
  {
    id: 'ferry',
    label: 'Fähre & Schiff',
    defaultEmoji: '⛴️',
    tabler: { id: 'ferry', emoji: '⛴️', outline: IconFerry, filled: IconFerryFilled },
    keywords: ['fähre', 'schiff', 'hafen', 'ferry', 'boot', 'kreuzfahrt', 'cruises'],
  },
  {
    id: 'speedboat',
    label: 'Motorboot & Bootstour',
    defaultEmoji: '🚤',
    tabler: { id: 'speedboat', emoji: '🚤', outline: IconSpeedboat, filled: IconSpeedboatFilled },
    keywords: ['boot', 'motorboot', 'speedboat', 'boottour', 'ausflugsboot'],
  },
  {
    id: 'sailboat',
    label: 'Segeln & Yacht',
    defaultEmoji: '⛵',
    tabler: { id: 'sailboat', emoji: '⛵', outline: IconSailboat },
    keywords: ['segeln', 'segelboot', 'yacht', 'sailing', 'törn', 'katamaran'],
  },
  {
    id: 'cable-car',
    label: 'Seilbahn & Gondel',
    defaultEmoji: '🚠',
    tabler: {
      id: 'aerial-lift',
      emoji: '🚠',
      outline: IconAerialLift,
      filled: IconAerialLiftFilled,
    },
    keywords: ['seilbahn', 'gondel', 'lift', 'bergbahn', 'skilift', 'cablecar'],
  },
  {
    id: 'gas-station',
    label: 'Tanken & Laden',
    defaultEmoji: '⛽',
    tabler: {
      id: 'gas-station',
      emoji: '⛽',
      outline: IconGasStation,
      filled: IconGasStationFilled,
    },
    keywords: ['tanken', 'benzin', 'diesel', 'tankstelle', 'sprit', 'fuel'],
  },
  {
    id: 'charging',
    label: 'E-Auto Ladestation',
    defaultEmoji: '⚡',
    tabler: {
      id: 'charging-pile',
      emoji: '⚡',
      outline: IconChargingPile,
      filled: IconChargingPileFilled,
    },
    keywords: ['laden', 'elektroauto', 'ev', 'strom', 'ladestation', 'charge'],
  },
  {
    id: 'parking',
    label: 'Parken & Garage',
    defaultEmoji: '🅿️',
    tabler: { id: 'parking', emoji: '🅿️', outline: IconParking },
    keywords: ['parken', 'parkplatz', 'parkhaus', 'garage', 'parking'],
  },
  {
    id: 'anchor',
    label: 'Hafen & Marina',
    defaultEmoji: '⚓',
    tabler: { id: 'anchor', emoji: '⚓', outline: IconAnchor },
    keywords: ['hafen', 'marina', 'pier', 'kai', 'anker', 'dock'],
  },

  // 4. Sehenswürdigkeiten & Kultur
  {
    id: 'camera',
    label: 'Foto & Aussichtspunkt',
    defaultEmoji: '📷',
    tabler: { id: 'camera', emoji: '📷', outline: IconCamera, filled: IconCameraFilled },
    keywords: ['foto', 'aussicht', 'view', 'panorama', 'fotospot', 'kamera', 'blick'],
  },
  {
    id: 'map-pin',
    label: 'Ort & Treffpunkt',
    defaultEmoji: '📍',
    tabler: { id: 'map-pin', emoji: '📍', outline: IconMapPin, filled: IconMapPinFilled },
    keywords: ['ort', 'treffpunkt', 'location', 'ziel', 'adresse', 'spot', 'place'],
  },
  {
    id: 'compass',
    label: 'Aktivität & Tour',
    defaultEmoji: '🧭',
    tabler: { id: 'compass', emoji: '🧭', outline: IconCompass },
    keywords: ['ausflug', 'führung', 'tour', 'rundgang', 'kompass', 'guide', 'aktivität'],
  },
  {
    id: 'monument',
    label: 'Denkmal & Monument',
    defaultEmoji: '🏛️',
    tabler: { id: 'building-monument', emoji: '🏛️', outline: IconBuildingMonument },
    keywords: ['denkmal', 'monument', 'statue', 'sehenswürdigkeit', 'historisch', 'wahrzeichen'],
  },
  {
    id: 'church',
    label: 'Kirche & Kathedrale',
    defaultEmoji: '⛪',
    tabler: { id: 'building-church', emoji: '⛪', outline: IconBuildingChurch },
    keywords: ['kirche', 'dom', 'kathedrale', 'kapelle', 'kloster', 'tempel', 'church'],
  },
  {
    id: 'lighthouse',
    label: 'Leuchtturm & Küste',
    defaultEmoji: '🗼',
    tabler: { id: 'building-lighthouse', emoji: '🗼', outline: IconBuildingLighthouse },
    keywords: ['leuchtturm', 'küste', 'turm', 'meer', 'aussichtsturm', 'lighthouse'],
  },
  {
    id: 'bridge',
    label: 'Brücke & Panorama',
    defaultEmoji: '🌉',
    tabler: { id: 'building-bridge', emoji: '🌉', outline: IconBuildingBridge },
    keywords: ['brücke', 'viadukt', 'bridge', 'wahrzeichen', 'überquerung'],
  },
  {
    id: 'museum',
    label: 'Museum & Kunst',
    defaultEmoji: '🎨',
    tabler: { id: 'palette', emoji: '🎨', outline: IconPalette, filled: IconPaletteFilled },
    keywords: ['museum', 'kunst', 'galerie', 'ausstellung', 'kultur', 'malerei', 'art'],
  },
  {
    id: 'theater',
    label: 'Theater & Bühne',
    defaultEmoji: '🎭',
    tabler: { id: 'masks-theater', emoji: '🎭', outline: IconMasksTheater },
    keywords: ['theater', 'oper', 'schauspiel', 'musical', 'bühne', 'ballett'],
  },
  {
    id: 'cinema',
    label: 'Kino & Film',
    defaultEmoji: '🎬',
    tabler: { id: 'movie', emoji: '🎬', outline: IconMovie },
    keywords: ['kino', 'film', 'cinema', 'kinoabend', 'movie'],
  },
  {
    id: 'music',
    label: 'Konzert & Musik',
    defaultEmoji: '🎵',
    tabler: { id: 'music', emoji: '🎵', outline: IconMusic },
    keywords: ['musik', 'konzert', 'festival', 'band', 'live', 'song', 'music'],
  },
  {
    id: 'party',
    label: 'Party & Feiern',
    defaultEmoji: '🎉',
    tabler: { id: 'confetti', emoji: '🎉', outline: IconConfetti, filled: IconConfettiFilled },
    keywords: ['party', 'feiern', 'club', 'disco', 'festival', 'event', 'silvester', 'geburtstag'],
  },
  {
    id: 'balloon',
    label: 'Freizeitpark & Rummel',
    defaultEmoji: '🎈',
    tabler: { id: 'balloon', emoji: '🎈', outline: IconBalloon, filled: IconBalloonFilled },
    keywords: ['freizeitpark', 'kirmes', 'rummel', 'attraktion', 'volksfest', 'karussell'],
  },
  {
    id: 'temple',
    label: 'Tempel & Schrein',
    defaultEmoji: '⛩️',
    tabler: { id: 'torii', emoji: '⛩️', outline: IconTorii },
    keywords: ['tempel', 'schrein', 'asien', 'buddhismus', 'torii', 'kultur', 'japan'],
  },
  {
    id: 'pyramid',
    label: 'Antike & Ausgrabung',
    defaultEmoji: '🏛️',
    tabler: { id: 'pyramid', emoji: '🏛️', outline: IconPyramid },
    keywords: ['pyramide', 'antike', 'ruinen', 'ausgrabung', 'archäologie', 'historie'],
  },

  // 5. Natur & Wetter
  {
    id: 'mountain',
    label: 'Berge & Natur',
    defaultEmoji: '⛰️',
    tabler: { id: 'mountain', emoji: '⛰️', outline: IconMountain, filled: IconMountainFilled },
    keywords: ['berge', 'berg', 'gipfel', 'alpen', 'wandern', 'natur', 'panorama'],
  },
  {
    id: 'beach',
    label: 'Strand & Meer',
    defaultEmoji: '🏖️',
    tabler: { id: 'beach', emoji: '🏖️', outline: IconBeach },
    keywords: ['strand', 'beach', 'meer', 'bucht', 'küste', 'sand', 'sonne'],
  },
  {
    id: 'trees',
    label: 'Park & Wald',
    defaultEmoji: '🌲',
    tabler: { id: 'trees', emoji: '🌲', outline: IconTrees },
    keywords: ['wald', 'bäume', 'nationalpark', 'park', 'forst', 'natur', 'trees'],
  },
  {
    id: 'flower',
    label: 'Garten & Blumen',
    defaultEmoji: '🌸',
    tabler: { id: 'flower', emoji: '🌸', outline: IconFlower, filled: IconFlowerFilled },
    keywords: ['blumen', 'garten', 'botanik', 'blüten', 'park', 'frühling', 'botanischer'],
  },
  {
    id: 'sunset',
    label: 'Sonnenuntergang',
    defaultEmoji: '🌅',
    tabler: { id: 'sunset', emoji: '🌅', outline: IconSunset, filled: IconSunsetFilled },
    keywords: ['sonnenuntergang', 'sunset', 'abendrot', 'dämmerung', 'aussicht', 'sundowner'],
  },
  {
    id: 'sun',
    label: 'Sonnenschein & Wetter',
    defaultEmoji: '☀️',
    tabler: { id: 'sun', emoji: '☀️', outline: IconSun, filled: IconSunFilled },
    keywords: ['sonne', 'wetter', 'sommer', 'sonnig', 'hitze', 'sun'],
  },
  {
    id: 'umbrella',
    label: 'Regen & Schirm',
    defaultEmoji: '☂️',
    tabler: { id: 'umbrella', emoji: '☂️', outline: IconUmbrella, filled: IconUmbrellaFilled },
    keywords: ['regen', 'schirm', 'schlechtwetter', 'wetter', 'gewitter', 'rain'],
  },
  {
    id: 'wave',
    label: 'Meer & Wellen',
    defaultEmoji: '🌊',
    tabler: { id: 'ripple', emoji: '🌊', outline: IconRipple },
    keywords: ['wellen', 'meer', 'wasser', 'fluss', 'ozean', 'see', 'surfen'],
  },
  {
    id: 'campfire',
    label: 'Lagerfeuer & Feuer',
    defaultEmoji: '🔥',
    tabler: { id: 'campfire', emoji: '🔥', outline: IconCampfire },
    keywords: ['lagerfeuer', 'feuer', 'grillplatz', 'gemütlich', 'outdoor', 'fire'],
  },
  {
    id: 'sunglasses',
    label: 'Sommer & Urlaub',
    defaultEmoji: '🕶️',
    tabler: {
      id: 'sunglasses',
      emoji: '🕶️',
      outline: IconSunglasses,
      filled: IconSunglassesFilled,
    },
    keywords: ['sonnenbrille', 'sommer', 'ferien', 'urlaub', 'chillen', 'style'],
  },
  {
    id: 'snowflake',
    label: 'Schnee & Winter',
    defaultEmoji: '❄️',
    tabler: { id: 'snowflake', emoji: '❄️', outline: IconSnowflake },
    keywords: ['schnee', 'winter', 'kalt', 'eis', 'frost', 'snow'],
  },

  // 6. Sport & Outdoor
  {
    id: 'swimming',
    label: 'Baden & Schwimmen',
    defaultEmoji: '🏊',
    tabler: { id: 'swimming', emoji: '🏊', outline: IconSwimming },
    keywords: ['schwimmen', 'baden', 'pool', 'freibad', 'hallenbad', 'see', 'swim'],
  },
  {
    id: 'diving',
    label: 'Tauchen & Schnorcheln',
    defaultEmoji: '🤿',
    tabler: { id: 'scuba-mask', emoji: '🤿', outline: IconScubaMask },
    keywords: ['tauchen', 'schnorcheln', 'riff', 'unterwasser', 'scuba', 'korallen'],
  },
  {
    id: 'ski',
    label: 'Ski & Wintersport',
    defaultEmoji: '⛷️',
    tabler: { id: 'ski-jumping', emoji: '⛷️', outline: IconSkiJumping },
    keywords: ['ski', 'skifahren', 'piste', 'abfahrt', 'skigebiet', 'winter', 'schnee'],
  },
  {
    id: 'snowboard',
    label: 'Snowboarden',
    defaultEmoji: '🏂',
    tabler: { id: 'snowboarding', emoji: '🏂', outline: IconSnowboarding },
    keywords: ['snowboard', 'snowboarden', 'piste', 'winter', 'snow'],
  },
  {
    id: 'running',
    label: 'Laufen & Joggen',
    defaultEmoji: '🏃',
    tabler: { id: 'run', emoji: '🏃', outline: IconRun },
    keywords: ['laufen', 'joggen', 'running', 'marathon', 'sport', 'jog'],
  },
  {
    id: 'fitness',
    label: 'Fitness & Gym',
    defaultEmoji: '🏋️',
    tabler: { id: 'barbell', emoji: '🏋️', outline: IconBarbell, filled: IconBarbellFilled },
    keywords: ['fitness', 'gym', 'training', 'workout', 'kraftsport', 'hanteln'],
  },
  {
    id: 'yoga',
    label: 'Yoga & Meditation',
    defaultEmoji: '🧘',
    tabler: { id: 'yoga', emoji: '🧘', outline: IconYoga },
    keywords: ['yoga', 'meditation', 'pilates', 'entspannung', 'achtsamkeit'],
  },
  {
    id: 'golf',
    label: 'Golf & Minigolf',
    defaultEmoji: '⛳',
    tabler: { id: 'golf', emoji: '⛳', outline: IconGolf, filled: IconGolfFilled },
    keywords: ['golf', 'minigolf', 'abschlag', 'green'],
  },
  {
    id: 'tennis',
    label: 'Tennis & Padel',
    defaultEmoji: '🎾',
    tabler: { id: 'ball-tennis', emoji: '🎾', outline: IconBallTennis },
    keywords: ['tennis', 'padel', 'badminton', 'racket', 'court'],
  },
  {
    id: 'soccer',
    label: 'Fußball & Stadion',
    defaultEmoji: '⚽',
    tabler: { id: 'ball-football', emoji: '⚽', outline: IconBallFootball },
    keywords: ['fußball', 'soccer', 'stadion', 'spiel', 'bolzen', 'match'],
  },
  {
    id: 'basketball',
    label: 'Basketball',
    defaultEmoji: '🏀',
    tabler: { id: 'ball-basketball', emoji: '🏀', outline: IconBallBasketball },
    keywords: ['basketball', 'court', 'streetball', 'hoop'],
  },
  {
    id: 'volleyball',
    label: 'Volleyball & Beachvolleyball',
    defaultEmoji: '🏐',
    tabler: { id: 'ball-volleyball', emoji: '🏐', outline: IconBallVolleyball },
    keywords: ['volleyball', 'beachvolleyball', 'strand'],
  },
  {
    id: 'kayak',
    label: 'Kanu & Kajak',
    defaultEmoji: '🛶',
    tabler: { id: 'kayak', emoji: '🛶', outline: IconKayak },
    keywords: ['kajak', 'kanu', 'paddeln', 'boot', 'fluss', 'kayak'],
  },
  {
    id: 'fishing',
    label: 'Angeln & Fischen',
    defaultEmoji: '🎣',
    tabler: { id: 'fish-hook', emoji: '🎣', outline: IconFishHook },
    keywords: ['angeln', 'fischen', 'angelrute', 'see', 'fisch', 'fishing'],
  },
  {
    id: 'gymnastics',
    label: 'Klettern & Bouldern',
    defaultEmoji: '🧗',
    tabler: { id: 'gymnastics', emoji: '🧗', outline: IconGymnastics },
    keywords: ['klettern', 'bouldern', 'klettersteig', 'outdoor', 'felsen', 'climbing'],
  },
  {
    id: 'lifebuoy',
    label: 'Wassersport & Sicherheit',
    defaultEmoji: '🛟',
    tabler: { id: 'lifebuoy', emoji: '🛟', outline: IconLifebuoy },
    keywords: ['wassersport', 'rettungsring', 'sicherheit', 'pool', 'meer', 'rescue'],
  },

  // 7. Wellness & Gesundheit
  {
    id: 'massage',
    label: 'Wellness & Spa',
    defaultEmoji: '🧖',
    tabler: { id: 'massage', emoji: '🧖', outline: IconMassage },
    keywords: ['massage', 'wellness', 'spa', 'sauna', 'therme', 'erholung', 'entspannung'],
  },
  {
    id: 'pill',
    label: 'Apotheke & Gesundheit',
    defaultEmoji: '💊',
    tabler: { id: 'pill', emoji: '💊', outline: IconPill, filled: IconPillFilled },
    keywords: ['apotheke', 'medikamente', 'tabletten', 'arznei', 'gesundheit', 'pharmacy'],
  },
  {
    id: 'first-aid',
    label: 'Erste Hilfe & Notfall',
    defaultEmoji: '🩹',
    tabler: { id: 'first-aid-kit', emoji: '🩹', outline: IconFirstAidKit },
    keywords: ['erstehilfe', 'verband', 'pflaster', 'notfall', 'arzt', 'firstaid'],
  },
  {
    id: 'hospital',
    label: 'Arzt & Krankenhaus',
    defaultEmoji: '🏥',
    tabler: { id: 'hospital', emoji: '🏥', outline: IconHospital },
    keywords: ['arzt', 'krankenhaus', 'klinik', 'doktor', 'behandlung', 'hospital'],
  },
  {
    id: 'baby',
    label: 'Familie & Kinder',
    defaultEmoji: '👶',
    tabler: { id: 'baby-carriage', emoji: '👶', outline: IconBabyCarriage },
    keywords: ['baby', 'kinderwagen', 'familie', 'kinder', 'kind', 'spielplatz'],
  },

  // 8. Shopping & Finanzen
  {
    id: 'shopping-cart',
    label: 'Supermarkt & Vorräte',
    defaultEmoji: '🛒',
    tabler: {
      id: 'shopping-cart',
      emoji: '🛒',
      outline: IconShoppingCart,
      filled: IconShoppingCartFilled,
    },
    keywords: ['supermarkt', 'einkaufen', 'lebensmittel', 'drogerie', 'groceries', 'vorräte'],
  },
  {
    id: 'shopping-bag',
    label: 'Shopping & Kleidung',
    defaultEmoji: '🛍️',
    tabler: { id: 'shopping-bag', emoji: '🛍️', outline: IconShoppingBag },
    keywords: ['shopping', 'kleidung', 'mode', 'boutique', 'einkauf', 'schuhe', 'mall'],
  },
  {
    id: 'store',
    label: 'Geschäft & Markt',
    defaultEmoji: '🏪',
    tabler: { id: 'building-store', emoji: '🏪', outline: IconBuildingStore },
    keywords: ['geschäft', 'laden', 'kiosk', 'marktstand', 'shop', 'markt'],
  },
  {
    id: 'gift',
    label: 'Souvenirs & Geschenke',
    defaultEmoji: '🎁',
    tabler: { id: 'gift', emoji: '🎁', outline: IconGift, filled: IconGiftFilled },
    keywords: ['souvenir', 'geschenk', 'mitbringsel', 'andenken', 'gift'],
  },
  {
    id: 'coin',
    label: 'Gebühren & Trinkgeld',
    defaultEmoji: '🪙',
    tabler: { id: 'coin', emoji: '🪙', outline: IconCoin, filled: IconCoinFilled },
    keywords: ['bargeld', 'münzen', 'trinkgeld', 'tip', 'cash', 'gebühren', 'kurtaxe'],
  },
  {
    id: 'credit-card',
    label: 'Kreditkarte & Zahlung',
    defaultEmoji: '💳',
    tabler: {
      id: 'credit-card',
      emoji: '💳',
      outline: IconCreditCard,
      filled: IconCreditCardFilled,
    },
    keywords: ['kreditkarte', 'karte', 'zahlung', 'ec-karte', 'visa', 'mastercard', 'bezahlen'],
  },
  {
    id: 'receipt',
    label: 'Rechnung & Beleg',
    defaultEmoji: '🧾',
    tabler: { id: 'receipt', emoji: '🧾', outline: IconReceipt, filled: IconReceiptFilled },
    keywords: ['rechnung', 'beleg', 'quittung', 'kassenbon', 'ausgabe', 'kosten'],
  },
  {
    id: 'bank',
    label: 'Bank & Geldautomat',
    defaultEmoji: '🏦',
    tabler: { id: 'building-bank', emoji: '🏦', outline: IconBuildingBank },
    keywords: ['bank', 'geldautomat', 'atm', 'überweisung', 'wechselstube', 'währung'],
  },
  {
    id: 'discount',
    label: 'Rabatt & Gutschein',
    defaultEmoji: '🏷️',
    tabler: { id: 'discount', emoji: '🏷️', outline: IconDiscount, filled: IconDiscountFilled },
    keywords: ['rabatt', 'gutschein', 'coupon', 'sale', 'sparen', 'angebot'],
  },
  {
    id: 'trophy',
    label: 'Wettkampf & Event',
    defaultEmoji: '🏆',
    tabler: { id: 'trophy', emoji: '🏆', outline: IconTrophy },
    keywords: ['pokal', 'turnier', 'sieger', 'wettbewerb', 'gewinn', 'trophy'],
  },

  // 9. Organisation & Allgemeines
  {
    id: 'luggage',
    label: 'Gepäck & Koffer',
    defaultEmoji: '🧳',
    tabler: { id: 'luggage', emoji: '🧳', outline: IconLuggage },
    keywords: ['gepäck', 'koffer', 'rucksack', 'tasche', 'packen', 'luggage'],
  },
  {
    id: 'passport',
    label: 'Reisepass & Ausweis',
    defaultEmoji: '🛂',
    tabler: { id: 'id', emoji: '🛂', outline: IconId, filled: IconIdFilled },
    keywords: ['pass', 'reisepass', 'ausweis', 'visum', 'dokumente', 'zoll', 'passport'],
  },
  {
    id: 'ticket',
    label: 'Tickets & Eintritt',
    defaultEmoji: '🎟️',
    tabler: { id: 'ticket', emoji: '🎟️', outline: IconTicket, filled: IconTicketFilled },
    keywords: ['ticket', 'eintrittskarte', 'fahrkarte', 'gutschein', 'buchung', 'reservierung'],
  },
  {
    id: 'wifi',
    label: 'Internet & SIM-Karte',
    defaultEmoji: '📶',
    tabler: { id: 'wifi', emoji: '📶', outline: IconWifi },
    keywords: ['wlan', 'wifi', 'internet', 'roaming', 'sim', 'netz', 'online'],
  },
  {
    id: 'phone',
    label: 'Telefon & Anrufe',
    defaultEmoji: '📞',
    tabler: { id: 'phone', emoji: '📞', outline: IconPhone },
    keywords: ['telefon', 'anruf', 'hotline', 'nummer', 'kontakt', 'phone'],
  },
  {
    id: 'device',
    label: 'Laptop & Technik',
    defaultEmoji: '💻',
    tabler: { id: 'device-laptop', emoji: '💻', outline: IconDeviceLaptop },
    keywords: ['laptop', 'computer', 'technik', 'arbeit', 'kabel', 'elektronik'],
  },
  {
    id: 'headphones',
    label: 'Kopfhörer & Audio',
    defaultEmoji: '🎧',
    tabler: {
      id: 'headphones',
      emoji: '🎧',
      outline: IconHeadphones,
      filled: IconHeadphonesFilled,
    },
    keywords: ['kopfhörer', 'audioguide', 'podcast', 'musik', 'sound', 'audio'],
  },
  {
    id: 'book',
    label: 'Buch & Reiseführer',
    defaultEmoji: '📖',
    tabler: { id: 'book', emoji: '📖', outline: IconBook },
    keywords: ['buch', 'reiseführer', 'lesen', 'lektüre', 'literatur', 'guide'],
  },
  {
    id: 'shirt',
    label: 'Wäsche & Kleidung',
    defaultEmoji: '👕',
    tabler: { id: 'shirt', emoji: '👕', outline: IconShirt, filled: IconShirtFilled },
    keywords: ['wäsche', 'reinigung', 'laundry', 'kleidung', 'waschsalon', 'tshirt'],
  },
  {
    id: 'dog',
    label: 'Haustier & Hund',
    defaultEmoji: '🐾',
    tabler: { id: 'dog', emoji: '🐾', outline: IconDog },
    keywords: ['hund', 'haustier', 'tier', 'katze', 'gassi', 'tierpark', 'pet'],
  },
  {
    id: 'binoculars',
    label: 'Fernglas & Safari',
    defaultEmoji: '🔭',
    tabler: { id: 'binoculars', emoji: '🔭', outline: IconBinoculars },
    keywords: ['fernglas', 'safari', 'tiere', 'aussicht', 'beobachtung', 'zoo'],
  },
  {
    id: 'sparkles',
    label: 'Highlight & Geheimtipp',
    defaultEmoji: '✨',
    tabler: { id: 'sparkles', emoji: '✨', outline: IconSparkles },
    keywords: ['highlight', 'magie', 'besonders', 'geheimtipp', 'zauber', 'special'],
  },
  {
    id: 'heart',
    label: 'Favorit & Romantik',
    defaultEmoji: '❤️',
    tabler: { id: 'heart', emoji: '❤️', outline: IconHeart, filled: IconHeartFilled },
    keywords: ['liebling', 'favorit', 'romantisch', 'herz', 'empfehlung', 'love'],
  },
  {
    id: 'star',
    label: 'Must-See & Bewertung',
    defaultEmoji: '⭐',
    tabler: { id: 'star', emoji: '⭐', outline: IconStar, filled: IconStarFilled },
    keywords: ['star', 'stern', 'mustsee', 'top', 'bewertung', 'highlight', 'favorit'],
  },
  {
    id: 'category',
    label: 'Sonstiges / Allgemein',
    defaultEmoji: '🏷️',
    tabler: { id: 'category', emoji: '🏷️', outline: IconCategory, filled: IconCategoryFilled },
    keywords: ['sonstiges', 'allgemein', 'verschiedenes', 'kategorie', 'diverses', 'tag'],
  },
];

const DEFAULT_CATEGORY_ICON: IconDef = {
  id: 'category',
  emoji: '🏷️',
  outline: IconCategory,
  filled: IconCategoryFilled,
};

/** Findet eine IconOption anhand ihrer ID oder Fallback-Emoji */
export function findCategoryIcon(
  iconId?: string | null,
  fallbackEmoji?: string | null
): CategoryIconOption | undefined {
  if (iconId) {
    const byId = CATEGORY_ICON_PALETTE.find((opt) => opt.id === iconId);
    if (byId) return byId;
  }
  if (fallbackEmoji) {
    return CATEGORY_ICON_PALETTE.find((opt) => opt.defaultEmoji === fallbackEmoji);
  }
  return undefined;
}

/** Findet eine IconOption anhand ihres Emojis */
export function findCategoryIconByEmoji(emoji?: string | null): CategoryIconOption | undefined {
  if (!emoji) return undefined;
  return CATEGORY_ICON_PALETTE.find((opt) => opt.defaultEmoji === emoji);
}

/** Löst ein IconDef anhand einer Icon-ID auf */
export function getCategoryIconDef(iconId?: string | null, customEmoji?: string | null): IconDef {
  const opt = findCategoryIcon(iconId, customEmoji);
  if (opt) {
    if (customEmoji) {
      return { ...opt.tabler, emoji: customEmoji };
    }
    return opt.tabler;
  }
  return customEmoji ? { ...DEFAULT_CATEGORY_ICON, emoji: customEmoji } : DEFAULT_CATEGORY_ICON;
}

export interface ResolvedCategoryMeta {
  label: string;
  icon: string;
  color: string;
  tabler: IconDef;
}

/**
 * Löst Metadaten für eine Kategorie auf, wobei benutzerdefinierte Metadaten des Urlaubs
 * (z. B. aus dem tripCategories-Store) Vorrang vor den System-Vorgaben haben.
 */
export function resolveCategoryMeta(
  name: string,
  type: 'expense' | 'spot',
  customDef?: { icon?: string | null; emoji?: string | null; color?: string | null }
): ResolvedCategoryMeta {
  // 1. Wenn customDef mit Icon/Emoji/Farbe angegeben ist
  if (customDef && (customDef.icon || customDef.emoji || customDef.color)) {
    const tabler = getCategoryIconDef(customDef.icon, customDef.emoji);
    return {
      label: name,
      icon: customDef.emoji || tabler.emoji,
      color: customDef.color || '#3b82f6',
      tabler,
    };
  }

  // 2. Standard-Kategorie-Metadaten
  const fallback = type === 'expense' ? expenseCategoryMeta(name) : spotCategoryMeta(name);
  return {
    label: fallback.label || name,
    icon: fallback.icon,
    color: fallback.color,
    tabler: fallback.tabler,
  };
}

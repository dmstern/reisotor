import {
  IconBed,
  IconBedFilled,
  IconToolsKitchen2,
  IconToolsKitchen2Filled,
  IconCoffee,
  IconGlassCocktail,
  IconShoppingCart,
  IconShoppingCartFilled,
  IconTrain,
  IconTrainFilled,
  IconPlaneDeparture,
  IconPlaneDepartureFilled,
  IconCar,
  IconCarFilled,
  IconBus,
  IconBike,
  IconWalk,
  IconGasStation,
  IconGasStationFilled,
  IconParking,
  IconTicket,
  IconTicketFilled,
  IconCamera,
  IconCameraFilled,
  IconTrees,
  IconMountain,
  IconBeach,
  IconSwimming,
  IconTent,
  IconBuildingStore,
  IconShoppingBag,
  IconGift,
  IconGiftFilled,
  IconMassage,
  IconPill,
  IconPillFilled,
  IconCoin,
  IconCoinFilled,
  IconWifi,
  IconCompass,
  IconMapPin,
  IconMapPinFilled,
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
  {
    id: 'bed',
    label: 'Unterkunft & Hotel',
    defaultEmoji: '🛏️',
    tabler: { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled },
  },
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
  },
  {
    id: 'coffee',
    label: 'Café & Bäckerei',
    defaultEmoji: '☕',
    tabler: { id: 'coffee', emoji: '☕', outline: IconCoffee },
  },
  {
    id: 'cocktail',
    label: 'Bar & Nachtleben',
    defaultEmoji: '🍸',
    tabler: { id: 'glass-cocktail', emoji: '🍸', outline: IconGlassCocktail },
  },
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
  },
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
  },
  {
    id: 'train',
    label: 'Zug & Bahn',
    defaultEmoji: '🚆',
    tabler: { id: 'train', emoji: '🚆', outline: IconTrain, filled: IconTrainFilled },
  },
  {
    id: 'car',
    label: 'Mietwagen & Auto',
    defaultEmoji: '🚗',
    tabler: { id: 'car', emoji: '🚗', outline: IconCar, filled: IconCarFilled },
  },
  {
    id: 'bus',
    label: 'Bus & Shuttle',
    defaultEmoji: '🚌',
    tabler: { id: 'bus', emoji: '🚌', outline: IconBus },
  },
  {
    id: 'bike',
    label: 'Fahrrad & E-Bike',
    defaultEmoji: '🚲',
    tabler: { id: 'bike', emoji: '🚲', outline: IconBike },
  },
  {
    id: 'walk',
    label: 'Zu Fuß & Wandern',
    defaultEmoji: '🚶',
    tabler: { id: 'walk', emoji: '🚶', outline: IconWalk },
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
  },
  {
    id: 'parking',
    label: 'Parken & Garage',
    defaultEmoji: '🅿️',
    tabler: { id: 'parking', emoji: '🅿️', outline: IconParking },
  },
  {
    id: 'ticket',
    label: 'Tickets & Eintritt',
    defaultEmoji: '🎟️',
    tabler: { id: 'ticket', emoji: '🎟️', outline: IconTicket, filled: IconTicketFilled },
  },
  {
    id: 'camera',
    label: 'Foto & Aussichtspunkt',
    defaultEmoji: '📷',
    tabler: { id: 'camera', emoji: '📷', outline: IconCamera, filled: IconCameraFilled },
  },
  {
    id: 'beach',
    label: 'Strand & Meer',
    defaultEmoji: '🏖️',
    tabler: { id: 'beach', emoji: '🏖️', outline: IconBeach },
  },
  {
    id: 'swimming',
    label: 'Baden & Schwimmen',
    defaultEmoji: '🏊',
    tabler: { id: 'swimming', emoji: '🏊', outline: IconSwimming },
  },
  {
    id: 'mountain',
    label: 'Berge & Natur',
    defaultEmoji: '⛰️',
    tabler: { id: 'mountain', emoji: '⛰️', outline: IconMountain },
  },
  {
    id: 'trees',
    label: 'Park & Wald',
    defaultEmoji: '🌲',
    tabler: { id: 'trees', emoji: '🌲', outline: IconTrees },
  },
  {
    id: 'tent',
    label: 'Camping & Zelten',
    defaultEmoji: '⛺',
    tabler: { id: 'tent', emoji: '⛺', outline: IconTent },
  },
  {
    id: 'shopping-bag',
    label: 'Shopping & Kleidung',
    defaultEmoji: '🛍️',
    tabler: { id: 'shopping-bag', emoji: '🛍️', outline: IconShoppingBag },
  },
  {
    id: 'gift',
    label: 'Souvenirs & Geschenke',
    defaultEmoji: '🎁',
    tabler: { id: 'gift', emoji: '🎁', outline: IconGift, filled: IconGiftFilled },
  },
  {
    id: 'store',
    label: 'Geschäft & Markt',
    defaultEmoji: '🏪',
    tabler: {
      id: 'building-store',
      emoji: '🏪',
      outline: IconBuildingStore,
    },
  },
  {
    id: 'massage',
    label: 'Wellness & Spa',
    defaultEmoji: '🧖',
    tabler: { id: 'massage', emoji: '🧖', outline: IconMassage },
  },
  {
    id: 'pill',
    label: 'Apotheke & Gesundheit',
    defaultEmoji: '💊',
    tabler: { id: 'pill', emoji: '💊', outline: IconPill, filled: IconPillFilled },
  },
  {
    id: 'coin',
    label: 'Gebühren & Trinkgeld',
    defaultEmoji: '🪙',
    tabler: { id: 'coin', emoji: '🪙', outline: IconCoin, filled: IconCoinFilled },
  },
  {
    id: 'wifi',
    label: 'Internet & SIM-Karte',
    defaultEmoji: '📶',
    tabler: { id: 'wifi', emoji: '📶', outline: IconWifi },
  },
  {
    id: 'map-pin',
    label: 'Ort & Treffpunkt',
    defaultEmoji: '📍',
    tabler: { id: 'map-pin', emoji: '📍', outline: IconMapPin, filled: IconMapPinFilled },
  },
  {
    id: 'compass',
    label: 'Aktivität & Tour',
    defaultEmoji: '🧭',
    tabler: { id: 'compass', emoji: '🧭', outline: IconCompass },
  },
  {
    id: 'heart',
    label: 'Favorit & Romantik',
    defaultEmoji: '❤️',
    tabler: { id: 'heart', emoji: '❤️', outline: IconHeart, filled: IconHeartFilled },
  },
  {
    id: 'star',
    label: 'Highlight & Geheimtipp',
    defaultEmoji: '⭐',
    tabler: { id: 'star', emoji: '⭐', outline: IconStar, filled: IconStarFilled },
  },
  {
    id: 'category',
    label: 'Sonstiges / Allgemein',
    defaultEmoji: '🏷️',
    tabler: { id: 'category', emoji: '🏷️', outline: IconCategory, filled: IconCategoryFilled },
  },
];

const DEFAULT_CATEGORY_ICON: IconDef = {
  id: 'category',
  emoji: '🏷️',
  outline: IconCategory,
  filled: IconCategoryFilled,
};

/** Findet eine IconOption anhand ihrer ID */
export function findCategoryIcon(iconId?: string | null): CategoryIconOption | undefined {
  if (!iconId) return undefined;
  return CATEGORY_ICON_PALETTE.find((opt) => opt.id === iconId);
}

/** Löst ein IconDef anhand einer Icon-ID auf */
export function getCategoryIconDef(iconId?: string | null, customEmoji?: string | null): IconDef {
  const opt = findCategoryIcon(iconId);
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

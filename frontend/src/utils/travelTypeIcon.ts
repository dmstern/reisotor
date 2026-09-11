import {
  IconPlane,
  IconPlaneFilled,
  IconTrain,
  IconTrainFilled,
  IconBus,
  IconBusFilled,
  IconCar,
  IconCarFilled,
  IconShip,
  IconBike,
  IconBikeFilled,
  IconWalk,
  IconTicket,
  IconTicketFilled,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Icon je Transportmittel einer Tour mit gesetzter role (ideas.transport_type, #176 - vormals
// travel_items.type) – zentrale Stelle, wird von der Touren-Karte/-Card, TravelDetailDialog.vue,
// travelDerivedLocations.ts und excursionStations.ts geteilt, damit Karte und Spots-Liste dasselbe
// Icon zeigen wie die Tour selbst statt eines festen Flugzeug-Icons für jeden Eintrag unabhängig
// vom tatsächlichen Transportmittel.
const TYPE_ICONS: Record<string, string> = {
  Flug: '✈️',
  Flugzeug: '✈️',
  Zug: '🚆',
  Bus: '🚌',
  Auto: '🚗',
  Fähre: '⛴️',
  Fahrrad: '🚲',
  'zu Fuß': '🚶',
};

export function travelTypeIcon(type: string | null, fallback = '🎫'): string {
  if (!type) return fallback;
  if (TYPE_ICONS[type]) return TYPE_ICONS[type];
  const lower = type.toLowerCase();
  if (lower === 'zu fuß' || lower === 'zu fuss') return TYPE_ICONS['zu Fuß'];
  if (lower === 'fahrrad') return TYPE_ICONS.Fahrrad;
  return fallback;
}

const TYPE_ICON_DEFS: Record<string, IconDef> = {
  Flug: { id: 'plane', emoji: TYPE_ICONS.Flug, outline: IconPlane, filled: IconPlaneFilled },
  Flugzeug: {
    id: 'plane',
    emoji: TYPE_ICONS.Flugzeug,
    outline: IconPlane,
    filled: IconPlaneFilled,
  },
  Zug: { id: 'train', emoji: TYPE_ICONS.Zug, outline: IconTrain, filled: IconTrainFilled },
  Bus: { id: 'bus', emoji: TYPE_ICONS.Bus, outline: IconBus, filled: IconBusFilled },
  Auto: { id: 'car', emoji: TYPE_ICONS.Auto, outline: IconCar, filled: IconCarFilled },
  Fähre: { id: 'ship', emoji: TYPE_ICONS.Fähre, outline: IconShip },
  Fahrrad: { id: 'bike', emoji: TYPE_ICONS.Fahrrad, outline: IconBike, filled: IconBikeFilled },
  'zu Fuß': { id: 'walk', emoji: TYPE_ICONS['zu Fuß'], outline: IconWalk },
};

const FALLBACK_ICON_DEF: IconDef = {
  id: 'ticket',
  emoji: '🎫',
  outline: IconTicket,
  filled: IconTicketFilled,
};

export function travelTypeIconDef(
  type: string | null,
  fallback: IconDef = FALLBACK_ICON_DEF
): IconDef {
  if (!type) return fallback;
  if (TYPE_ICON_DEFS[type]) return TYPE_ICON_DEFS[type];
  const lower = type.toLowerCase();
  if (lower === 'zu fuß' || lower === 'zu fuss') return TYPE_ICON_DEFS['zu Fuß'];
  if (lower === 'fahrrad') return TYPE_ICON_DEFS.Fahrrad;
  return fallback;
}

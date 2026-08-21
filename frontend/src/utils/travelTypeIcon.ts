import { IconPlane, IconPlaneFilled, IconTrain, IconTrainFilled, IconBus, IconBusFilled, IconCar, IconCarFilled, IconShip, IconTicket, IconTicketFilled } from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Icon je Transportmittel einer Tour mit gesetzter role (ideas.transport_type, #176 - vormals
// travel_items.type) – zentrale Stelle, wird von der Touren-Karte/-Card, TravelDetailDialog.vue,
// travelDerivedLocations.ts und excursionStations.ts geteilt, damit Karte und Spots-Liste dasselbe
// Icon zeigen wie die Tour selbst statt eines festen Flugzeug-Icons für jeden Eintrag unabhängig
// vom tatsächlichen Transportmittel.
const TYPE_ICONS: Record<string, string> = {
  Flug: '✈️',
  Zug: '🚆',
  Bus: '🚌',
  Auto: '🚗',
  Fähre: '⛴️',
};

export function travelTypeIcon(type: string | null, fallback = '🎫'): string {
  return (type && TYPE_ICONS[type]) || fallback;
}

const TYPE_ICON_DEFS: Record<string, IconDef> = {
  Flug: { id: 'plane', emoji: TYPE_ICONS.Flug, outline: IconPlane, filled: IconPlaneFilled },
  Zug: { id: 'train', emoji: TYPE_ICONS.Zug, outline: IconTrain, filled: IconTrainFilled },
  Bus: { id: 'bus', emoji: TYPE_ICONS.Bus, outline: IconBus, filled: IconBusFilled },
  Auto: { id: 'car', emoji: TYPE_ICONS.Auto, outline: IconCar, filled: IconCarFilled },
  Fähre: { id: 'ship', emoji: TYPE_ICONS.Fähre, outline: IconShip },
};

const FALLBACK_ICON_DEF: IconDef = { id: 'ticket', emoji: '🎫', outline: IconTicket, filled: IconTicketFilled };

export function travelTypeIconDef(type: string | null, fallback: IconDef = FALLBACK_ICON_DEF): IconDef {
  return (type && TYPE_ICON_DEFS[type]) || fallback;
}

import {
  IconPlaneDeparture,
  IconPlaneDepartureFilled,
  IconPlaneArrival,
  IconPlaneArrivalFilled,
  IconTrain,
  IconTrainFilled,
} from '@tabler/icons-vue';
import type { IdeaRole } from '../api/types';
import type { IconDef } from './icon';
import { SECTION_ICON_DEFS } from './sectionIcons';

// Zentrale Stelle für Label/Icon der Reise-Rolle (Anreise/Abreise/Weiterreise) – wird sowohl im
// Touren-Formular (ExcursionsView.vue, #176) als auch als Badge auf der Karte/Card verwendet.
export const TRAVEL_ROLE_META: Record<
  IdeaRole,
  { icon: string; tabler: IconDef; label: string; hint: string }
> = {
  arrival: {
    icon: '🛫',
    tabler: {
      id: 'plane-departure',
      emoji: '🛫',
      outline: IconPlaneDeparture,
      filled: IconPlaneDepartureFilled,
    },
    label: 'Anreise',
    hint: 'Von zuhause zum Urlaubsziel',
  },
  departure: {
    icon: '🛬',
    tabler: {
      id: 'plane-arrival',
      emoji: '🛬',
      outline: IconPlaneArrival,
      filled: IconPlaneArrivalFilled,
    },
    label: 'Abreise',
    hint: 'Vom Urlaubsziel nach zuhause',
  },
  onward: {
    icon: '🚆',
    tabler: {
      id: 'train',
      emoji: '🚆',
      outline: IconTrain,
      filled: IconTrainFilled,
    },
    label: 'Weiterreise',
    hint: 'Zwischen zwei Orten innerhalb des Urlaubs',
  },
};

export const TRAVEL_ROLE_OPTIONS: IdeaRole[] = ['arrival', 'departure', 'onward'];

export type TourRoleFilterOption = 'arrival' | 'departure' | 'onward' | 'excursion';

export const TOUR_ROLE_OPTIONS: TourRoleFilterOption[] = [
  'arrival',
  'departure',
  'onward',
  'excursion',
];

export const TOUR_ROLE_META: Record<
  TourRoleFilterOption,
  { icon: string; tabler: IconDef; label: string; hint: string }
> = {
  arrival: TRAVEL_ROLE_META.arrival,
  departure: TRAVEL_ROLE_META.departure,
  onward: TRAVEL_ROLE_META.onward,
  excursion: {
    icon: '🎒',
    tabler: SECTION_ICON_DEFS.excursions,
    label: 'Ausflug',
    hint: 'Tagesausflug oder Rundgang',
  },
};

export function getTourRoleIconDef(role?: IdeaRole | null): IconDef {
  if (role && TRAVEL_ROLE_META[role]) {
    return TRAVEL_ROLE_META[role].tabler;
  }
  return SECTION_ICON_DEFS.excursions;
}

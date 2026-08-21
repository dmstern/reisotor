import { IconPlaneDeparture, IconPlaneDepartureFilled, IconPlaneArrival, IconPlaneArrivalFilled, IconRepeat } from '@tabler/icons-vue';
import type { IdeaRole } from '../api/types';
import type { IconDef } from './icon';

// Zentrale Stelle für Label/Icon der Reise-Rolle (Anreise/Abreise/Weiterreise) – wird sowohl im
// Touren-Formular (ExcursionsView.vue, #176) als auch als Badge auf der Karte/Card verwendet.
export const TRAVEL_ROLE_META: Record<IdeaRole, { icon: string; tabler: IconDef; label: string; hint: string }> = {
  arrival: {
    icon: '🛫',
    tabler: { id: 'plane-departure', emoji: '🛫', outline: IconPlaneDeparture, filled: IconPlaneDepartureFilled },
    label: 'Anreise',
    hint: 'Von zuhause zum Urlaubsziel',
  },
  departure: {
    icon: '🛬',
    tabler: { id: 'plane-arrival', emoji: '🛬', outline: IconPlaneArrival, filled: IconPlaneArrivalFilled },
    label: 'Abreise',
    hint: 'Vom Urlaubsziel nach zuhause',
  },
  onward: {
    icon: '🔄',
    tabler: { id: 'repeat', emoji: '🔄', outline: IconRepeat },
    label: 'Weiterreise',
    hint: 'Zwischen zwei Orten innerhalb des Urlaubs',
  },
};

export const TRAVEL_ROLE_OPTIONS: IdeaRole[] = ['arrival', 'departure', 'onward'];

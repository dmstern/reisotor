import type { TravelRole } from '../api/types';

// Zentrale Stelle für Label/Icon der Reise-Rolle (Anreise/Abreise/Weiterreise) – wird sowohl im
// Formular (TravelView.vue) als auch als Badge auf der Karte/Card verwendet.
export const TRAVEL_ROLE_META: Record<TravelRole, { icon: string; label: string; hint: string }> = {
  arrival: { icon: '🛫', label: 'Anreise', hint: 'Von zuhause zum Urlaubsziel' },
  departure: { icon: '🛬', label: 'Abreise', hint: 'Vom Urlaubsziel nach zuhause' },
  onward: { icon: '🔄', label: 'Weiterreise', hint: 'Zwischen zwei Orten innerhalb des Urlaubs' },
};

export const TRAVEL_ROLE_OPTIONS: TravelRole[] = ['arrival', 'departure', 'onward'];

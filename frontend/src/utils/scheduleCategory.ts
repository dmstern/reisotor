import type { ScheduleCategory } from '../api/types';

// Wiederverwendet die ersten beiden Slots der validierten dataviz-Palette
// (siehe categoryColors.ts) für Konsistenz mit den übrigen Kategorie-Darstellungen der App.
export const SCHEDULE_CATEGORY_META: Record<ScheduleCategory, { icon: string; color: string; label: string }> = {
  trip: { icon: '🧳', color: '#2a78d6', label: 'Urlaub' },
  excursion: { icon: '🎒', color: '#eb6834', label: 'Ausflug' },
  todo: { icon: '☑️', color: '#4a3aa7', label: 'ToDo' },
  other: { icon: '📌', color: '#8a8a86', label: 'Termin' },
};

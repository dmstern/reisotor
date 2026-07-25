// Zentrale Stelle für die Icons der App-Bereiche (Navigation, Dashboard-Widgets, Schubladen-Tabs, …).
// Bewusst getrennt von scheduleCategory.ts/spotCategory.ts (das sind Kategorie-Icons *innerhalb*
// von Kalender bzw. Spots, ein eigenes, in sich konsistentes System) – hier geht es um "welches
// Icon steht app-weit für den Bereich X", damit z. B. NavBar und Dashboard-Kachel nie auseinanderlaufen.
export type SectionKey =
  | 'dashboard'
  | 'calendar'
  | 'map'
  | 'packing'
  | 'shopping'
  | 'todo'
  | 'excursions'
  | 'travel'
  | 'accommodation'
  | 'budget'
  | 'diary'
  | 'notes';

export const SECTION_ICONS: Record<SectionKey, string> = {
  dashboard: '🏠',
  calendar: '📅',
  map: '🗺️',
  packing: '🧳',
  shopping: '🛒',
  todo: '✅',
  excursions: '🎒',
  travel: '✈️',
  accommodation: '🛏️',
  budget: '💶',
  diary: '📔',
  notes: '📝',
};

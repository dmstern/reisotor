import {
  IconHome,
  IconHomeFilled,
  IconCalendar,
  IconCalendarFilled,
  IconMap2,
  IconLuggage,
  IconShoppingCart,
  IconShoppingCartFilled,
  IconClipboardList,
  IconClipboardListFilled,
  IconBackpack,
  IconPlane,
  IconPlaneFilled,
  IconCoin,
  IconCoinFilled,
  IconNotebook,
  IconNotes,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

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
  | 'budget'
  | 'diary'
  | 'notes';

export const SECTION_ICONS: Record<SectionKey, string> = {
  dashboard: '🏠',
  calendar: '📅',
  map: '🗺️',
  packing: '🧳',
  shopping: '🛒',
  // Gleiches Icon wie SCHEDULE_CATEGORY_META.todo in scheduleCategory.ts (Kalender-Ansicht) für
  // Wiedererkennungswert app-weit.
  todo: '📋',
  excursions: '🎒',
  travel: '✈️',
  budget: '💶',
  diary: '📔',
  notes: '📝',
};

// Tabler-Pendant zu SECTION_ICONS, für AppIcon.vue (siehe utils/icon.ts) - ergänzt statt ersetzt
// die Emoji-Map oben, damit bestehende Aufrufstellen, die nur den Emoji-String lesen, unverändert
// funktionieren. Nicht jedes Icon hat eine Tabler-Filled-Variante (z. B. Rucksack/Koffer/Notizbuch/
// Karte) - AppIcon.vue fällt dafür automatisch auf Outline zurück.
export const SECTION_ICON_DEFS: Record<SectionKey, IconDef> = {
  dashboard: { id: 'home', emoji: SECTION_ICONS.dashboard, outline: IconHome, filled: IconHomeFilled },
  calendar: { id: 'calendar', emoji: SECTION_ICONS.calendar, outline: IconCalendar, filled: IconCalendarFilled },
  map: { id: 'map-2', emoji: SECTION_ICONS.map, outline: IconMap2 },
  packing: { id: 'luggage', emoji: SECTION_ICONS.packing, outline: IconLuggage },
  shopping: {
    id: 'shopping-cart',
    emoji: SECTION_ICONS.shopping,
    outline: IconShoppingCart,
    filled: IconShoppingCartFilled,
  },
  todo: {
    id: 'clipboard-list',
    emoji: SECTION_ICONS.todo,
    outline: IconClipboardList,
    filled: IconClipboardListFilled,
  },
  excursions: { id: 'backpack', emoji: SECTION_ICONS.excursions, outline: IconBackpack },
  travel: { id: 'plane', emoji: SECTION_ICONS.travel, outline: IconPlane, filled: IconPlaneFilled },
  budget: { id: 'coin', emoji: SECTION_ICONS.budget, outline: IconCoin, filled: IconCoinFilled },
  diary: { id: 'notebook', emoji: SECTION_ICONS.diary, outline: IconNotebook },
  notes: { id: 'notes', emoji: SECTION_ICONS.notes, outline: IconNotes },
};

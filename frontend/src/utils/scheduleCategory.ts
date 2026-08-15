import { IconLuggage, IconBackpack, IconClipboardList, IconClipboardListFilled, IconPlane, IconPlaneFilled, IconPin, IconPinFilled } from '@tabler/icons-vue';
import type { ScheduleCategory } from '../api/types';
import type { IconDef } from './icon';

// Wiederverwendet die ersten beiden Slots der validierten dataviz-Palette
// (siehe categoryColors.ts) für Konsistenz mit den übrigen Kategorie-Darstellungen der App.
// Tabler-Icons hier bewusst dieselben Komponenten wie SECTION_ICON_DEFS.packing/excursions/todo/
// travel (sectionIcons.ts), damit App-weite Bereichs- und Kalender-Kategorie-Icons für dasselbe
// Konzept nicht auseinanderlaufen.
export const SCHEDULE_CATEGORY_META: Record<
  ScheduleCategory,
  { icon: string; color: string; label: string; tabler: IconDef }
> = {
  trip: { icon: '🧳', color: '#2a78d6', label: 'Urlaub', tabler: { id: 'luggage', emoji: '🧳', outline: IconLuggage } },
  excursion: {
    icon: '🎒',
    color: '#eb6834',
    label: 'Ausflug',
    tabler: { id: 'backpack', emoji: '🎒', outline: IconBackpack },
  },
  // 📋 statt eines Häkchen-Symbols: ☑️ sah in der Kalender-Liste wie ein bereits abgehakter statt
  // eines offenen ToDo-Eintrags aus.
  todo: {
    icon: '📋',
    color: '#4a3aa7',
    label: 'ToDo',
    tabler: { id: 'clipboard-list', emoji: '📋', outline: IconClipboardList, filled: IconClipboardListFilled },
  },
  travel: {
    icon: '✈️',
    color: '#1baf7a',
    label: 'Reise',
    tabler: { id: 'plane', emoji: '✈️', outline: IconPlane, filled: IconPlaneFilled },
  },
  other: {
    icon: '📌',
    color: '#8a8a86',
    label: 'Termin',
    tabler: { id: 'pin', emoji: '📌', outline: IconPin, filled: IconPinFilled },
  },
};

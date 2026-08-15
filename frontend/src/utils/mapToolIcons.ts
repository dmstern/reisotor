import {
  IconSearch,
  IconBeach,
  IconBed,
  IconBedFilled,
  IconBackpack,
  IconCompass,
  IconCompassFilled,
  IconTelescope,
  IconDownload,
  IconAntenna,
  IconPlayerRecord,
  IconPlayerRecordFilled,
  IconPlayerStop,
  IconPlayerStopFilled,
  IconFocus2,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Konzept-Icons für TripMap.vue's Kartenwerkzeug-Buttons/-Popover-Menüs (Fokus-Gruppe, Standort &
// Ausrichtung, Standort teilen, Aufzeichnen) - gleiches Registry-Muster wie formFieldIcons.ts
// (Einzelfälle ohne eigene Kategorie-Registry, aber trotzdem als IconDef statt rohem Emoji-Literal
// im Template, damit die Emoji/Symbole-Einstellung (stores/iconStyle.ts) hier genauso greift wie
// überall sonst). 'accommodation' bewusst mit denselben Tabler-Komponenten wie spotCategory.ts's
// "Unterkunft"-Kategorie (IconBed/IconBedFilled) - dasselbe Konzept, siehe DESIGN.md "Konsistenz".
export type MapToolIconKey =
  | 'fitAll'
  | 'vacation'
  | 'accommodation'
  | 'excursions'
  | 'orientationNorth'
  | 'orientationHeading'
  | 'offlineDownload'
  | 'shareLocation'
  | 'record'
  | 'recordStop'
  | 'focusGroup'
  | 'locationGroup';

export const MAP_TOOL_ICONS: Record<MapToolIconKey, IconDef> = {
  fitAll: { id: 'search', emoji: '🔍', outline: IconSearch },
  vacation: { id: 'beach', emoji: '🏖️', outline: IconBeach },
  accommodation: { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled },
  excursions: { id: 'backpack', emoji: '🎒', outline: IconBackpack },
  orientationNorth: { id: 'compass', emoji: '🧭', outline: IconCompass, filled: IconCompassFilled },
  orientationHeading: { id: 'telescope', emoji: '🔭', outline: IconTelescope },
  offlineDownload: { id: 'download', emoji: '⬇️', outline: IconDownload },
  shareLocation: { id: 'antenna', emoji: '📡', outline: IconAntenna },
  record: { id: 'player-record', emoji: '⏺️', outline: IconPlayerRecord, filled: IconPlayerRecordFilled },
  recordStop: { id: 'player-stop', emoji: '⏹️', outline: IconPlayerStop, filled: IconPlayerStopFilled },
  // Gruppen-Trigger (siehe TripMap.vue): fassen mehrere der obigen Werkzeuge hinter einem Popover
  // zusammen, brauchen deshalb ein eigenes, vom Inhalt unabhängiges Icon statt eines der obigen
  // wiederzuverwenden (sonst wirkt es wie genau dieses eine Werkzeug statt einer Auswahl).
  focusGroup: { id: 'focus-2', emoji: '🔍', outline: IconFocus2 },
  locationGroup: { id: 'compass', emoji: '🧭', outline: IconCompass, filled: IconCompassFilled },
};

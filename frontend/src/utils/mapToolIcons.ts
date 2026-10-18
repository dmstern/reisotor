import {
  IconSearch,
  IconBeach,
  IconHome,
  IconHomeFilled,
  IconBed,
  IconBedFilled,
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
  IconCamera,
  IconCameraFilled,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Konzept-Icons für TripMap.vue's Kartenwerkzeug-Buttons/-Popover-Menüs (Kartenausschnitt &
// Ausrichtung, Standort teilen, Aufzeichnen) - gleiches Registry-Muster wie formFieldIcons.ts
// (Einzelfälle ohne eigene Kategorie-Registry, aber trotzdem als IconDef statt rohem Emoji-Literal
// im Template, damit die Emoji/Symbole-Einstellung (stores/iconStyle.ts) hier genauso greift wie
// überall sonst). 'accommodation' bewusst mit denselben Tabler-Komponenten wie spotCategory.ts's
// "Unterkunft"-Kategorie (IconBed/IconBedFilled) - dasselbe Konzept, siehe DESIGN.md "Konsistenz".
export type MapToolIconKey =
  | 'fitAll'
  | 'vacation'
  | 'home'
  | 'accommodation'
  | 'photos'
  | 'orientationNorth'
  | 'orientationHeading'
  | 'offlineDownload'
  | 'shareLocation'
  | 'record'
  | 'recordStop'
  | 'focusGroup';

export const MAP_TOOL_ICONS: Record<MapToolIconKey, IconDef> = {
  fitAll: { id: 'search', emoji: '🔍', outline: IconSearch },
  vacation: { id: 'beach', emoji: '🏖️', outline: IconBeach },
  home: { id: 'home', emoji: '🏠', outline: IconHome, filled: IconHomeFilled },
  accommodation: { id: 'bed', emoji: '🛏️', outline: IconBed, filled: IconBedFilled },
  photos: { id: 'photo', emoji: '📸', outline: IconCamera, filled: IconCameraFilled },
  orientationNorth: { id: 'compass', emoji: '🧭', outline: IconCompass, filled: IconCompassFilled },
  orientationHeading: { id: 'telescope', emoji: '🔭', outline: IconTelescope },
  offlineDownload: { id: 'download', emoji: '⬇️', outline: IconDownload },
  shareLocation: { id: 'antenna', emoji: '📡', outline: IconAntenna },
  record: {
    id: 'player-record',
    emoji: '⏺️',
    outline: IconPlayerRecord,
    filled: IconPlayerRecordFilled,
  },
  recordStop: {
    id: 'player-stop',
    emoji: '⏹️',
    outline: IconPlayerStop,
    filled: IconPlayerStopFilled,
  },
  // Gruppen-Trigger (siehe TripMap.vue): fasst Kartenausschnitt, Standort-Sprünge und Ausrichtung
  // hinter einem Popover zusammen, braucht deshalb ein eigenes, vom Inhalt unabhängiges Icon statt
  // eines der obigen wiederzuverwenden (sonst wirkt es wie genau dieses eine Werkzeug statt einer Auswahl).
  focusGroup: { id: 'focus-2', emoji: '🔍', outline: IconFocus2 },
};

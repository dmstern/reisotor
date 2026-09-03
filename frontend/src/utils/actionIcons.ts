import {
  IconPencil,
  IconPencilFilled,
  IconTrash,
  IconTrashFilled,
  IconX,
  IconCalendarEvent,
  IconCalendarEventFilled,
  IconBeach,
  IconRefresh,
  IconRepeat,
  IconSearch,
  IconAdjustments,
  IconAdjustmentsFilled,
  IconPlayerRecord,
  IconPlayerRecordFilled,
  IconPlayerStop,
  IconPlayerStopFilled,
  IconHistory,
  IconClock,
  IconClockFilled,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconLock,
  IconLockFilled,
  IconUsersGroup,
  IconFolders,
  IconFoldersFilled,
  IconArrowsSort,
  IconSortAscendingLetters,
  IconHeart,
  IconHeartFilled,
  IconCompass,
  IconCompassFilled,
  IconBinoculars,
  IconBinocularsFilled,
  IconDownload,
  IconDownloadFilled,
  IconBroadcast,
  IconFilter,
  IconFilterFilled,
  IconArrowsMaximize,
  IconMaximize,
  IconMinimize,
  IconCurrentLocation,
  IconCurrentLocationFilled,
  IconBan,
  IconInfinity,
  IconPaperclip,
  IconPlus,
  IconPlusFilled,
  IconDeviceFloppy,
  IconDeviceFloppyFilled,
  IconWifiOff,
  IconPlayerPause,
  IconPlayerPauseFilled,
  IconHourglass,
  IconHourglassFilled,
  IconRuler2,
  IconPlayerPlay,
  IconPlayerPlayFilled,
  IconSparkles,
  IconAlertTriangle,
  IconAlertTriangleFilled,
  IconArrowsExchange,
  IconDroplet,
  IconDropletFilled,
  IconWorld,
  IconSun,
  IconSunFilled,
  IconHome,
  IconHomeFilled,
  IconSquare,
  IconLuggage,
  IconArmchair,
  IconEye,
  IconEyeFilled,
  IconEyeOff,
  IconListNumbers,
  IconBrandApple,
  IconBrandGoogleMaps,
  IconBrandGoogle,
  IconBrandAndroid,
  IconCircleFilled,
  IconStar,
  IconStarFilled,
  IconLogout,
  IconUpload,
  IconMessageCircle,
  IconMessageCircleFilled,
  IconArrowBackUp,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,
  IconInfoCircle,
  IconInfoCircleFilled,
  IconDeviceMobile,
  IconShare,
  IconDotsVertical,
  IconSend,
  IconSendFilled,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Konzept-Icons für wiederkehrende Aktions-/Status-Glyphen (Buttons, Toggle-Beschriftungen,
// Status-Badges) - analog zu utils/formFieldIcons.ts, nur für "group: 'actions'" statt
// Formularfeld-Labels. Ein Konzept-Icon pro Zeile, auch wenn mehrere App-Bereiche dasselbe
// Tabler-Icon nutzen (z. B. 'vacation' hier und spotCategory.ts's "Strand" - bewusst getrennt
// gehalten, weil ein Button-Aktion-Konzept und eine Spot-Kategorie unterschiedliche Dinge sind,
// auch wenn sie zufällig gleich aussehen).
export type ActionIconKey =
  | 'edit'
  | 'delete'
  | 'close'
  | 'today'
  | 'vacation'
  | 'refresh'
  | 'onward'
  | 'search'
  | 'filterSettings'
  | 'recordStart'
  | 'recordStop'
  | 'history'
  | 'duration'
  | 'done'
  | 'private'
  | 'shared'
  | 'group'
  | 'sort'
  | 'sortAlpha'
  | 'sortLikes'
  | 'orientationNorth'
  | 'orientationHeading'
  | 'download'
  | 'shareLocation'
  | 'filter'
  | 'fitAll'
  | 'myLocation'
  | 'maximize'
  | 'minimize'
  | 'off'
  | 'forever'
  | 'attachment'
  | 'add'
  | 'save'
  | 'offline'
  | 'pause'
  | 'liked'
  | 'unliked'
  | 'pending'
  | 'distance'
  | 'play'
  | 'warning'
  | 'currency'
  | 'rain'
  | 'region'
  | 'sun'
  | 'home'
  | 'notDone'
  | 'luggage'
  | 'seat'
  | 'showPassword'
  | 'hidePassword'
  | 'order'
  | 'apple'
  | 'googleMaps'
  | 'comment'
  | 'restore'
  | 'googleCalendar'
  | 'android'
  | 'priorityDot'
  | 'recommended'
  | 'logout'
  | 'upload'
  | 'scrollLeft'
  | 'scrollRight'
  | 'chevronDown'
  | 'chevronUp'
  | 'info'
  | 'installApp'
  | 'sparkles'
  | 'share'
  | 'browserMenu'
  | 'send';

export const ACTION_ICONS: Record<ActionIconKey, IconDef> = {
  edit: { id: 'pencil', emoji: '✏️', outline: IconPencil, filled: IconPencilFilled },
  delete: { id: 'trash', emoji: '🗑️', outline: IconTrash, filled: IconTrashFilled },
  close: { id: 'x', emoji: '✕', outline: IconX },
  today: {
    id: 'calendar-event',
    emoji: '📍',
    outline: IconCalendarEvent,
    filled: IconCalendarEventFilled,
  },
  vacation: { id: 'beach', emoji: '🏖️', outline: IconBeach },
  refresh: { id: 'refresh', emoji: '🔄', outline: IconRefresh },
  onward: { id: 'repeat', emoji: '🔄', outline: IconRepeat },
  search: { id: 'search', emoji: '🔍', outline: IconSearch },
  filterSettings: {
    id: 'adjustments',
    emoji: '⚙️',
    outline: IconAdjustments,
    filled: IconAdjustmentsFilled,
  },
  recordStart: {
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
  history: { id: 'history', emoji: '🧭', outline: IconHistory },
  duration: { id: 'clock', emoji: '⏱️', outline: IconClock, filled: IconClockFilled },
  done: {
    id: 'circle-check',
    emoji: '✅',
    outline: IconCircleCheck,
    filled: IconCircleCheckFilled,
  },
  private: { id: 'lock', emoji: '🔒', outline: IconLock, filled: IconLockFilled },
  shared: { id: 'users-group', emoji: '🤝', outline: IconUsersGroup },
  group: { id: 'folders', emoji: '🗂️', outline: IconFolders, filled: IconFoldersFilled },
  sort: { id: 'arrows-sort', emoji: '🔀', outline: IconArrowsSort },
  sortAlpha: { id: 'sort-ascending-letters', emoji: '🔤', outline: IconSortAscendingLetters },
  sortLikes: { id: 'heart', emoji: '❤️', outline: IconHeart, filled: IconHeartFilled },
  orientationNorth: { id: 'compass', emoji: '🧭', outline: IconCompass, filled: IconCompassFilled },
  orientationHeading: {
    id: 'binoculars',
    emoji: '🔭',
    outline: IconBinoculars,
    filled: IconBinocularsFilled,
  },
  download: { id: 'download', emoji: '⬇️', outline: IconDownload, filled: IconDownloadFilled },
  shareLocation: { id: 'broadcast', emoji: '📡', outline: IconBroadcast },
  filter: { id: 'filter', emoji: '🔎', outline: IconFilter, filled: IconFilterFilled },
  fitAll: { id: 'arrows-maximize', emoji: '🔍', outline: IconArrowsMaximize },
  myLocation: {
    id: 'current-location',
    emoji: '📍',
    outline: IconCurrentLocation,
    filled: IconCurrentLocationFilled,
  },
  maximize: { id: 'maximize', emoji: '⛶', outline: IconMaximize },
  minimize: { id: 'minimize', emoji: '🗗', outline: IconMinimize },
  off: { id: 'ban', emoji: '🚫', outline: IconBan },
  forever: { id: 'infinity', emoji: '♾️', outline: IconInfinity },
  attachment: { id: 'paperclip', emoji: '📎', outline: IconPaperclip },
  add: { id: 'plus', emoji: '➕', outline: IconPlus, filled: IconPlusFilled },
  save: {
    id: 'device-floppy',
    emoji: '💾',
    outline: IconDeviceFloppy,
    filled: IconDeviceFloppyFilled,
  },
  offline: { id: 'wifi-off', emoji: '📴', outline: IconWifiOff },
  pause: {
    id: 'player-pause',
    emoji: '⏸️',
    outline: IconPlayerPause,
    filled: IconPlayerPauseFilled,
  },
  // liked/unliked zeigen bewusst IMMER dieselbe Variante (gefüllt bzw. Outline) unabhängig von der
  // globalen Outline/Gefüllt-Einstellung - das gefüllte Herz IST hier der "geliked"-Status selbst,
  // kein rein optischer Stil (siehe LikeButton.vue).
  liked: { id: 'heart-filled', emoji: '❤️', outline: IconHeartFilled, filled: IconHeartFilled },
  unliked: { id: 'heart', emoji: '🤍', outline: IconHeart, filled: IconHeart },
  pending: { id: 'hourglass', emoji: '⏳', outline: IconHourglass, filled: IconHourglassFilled },
  distance: { id: 'ruler-2', emoji: '📏', outline: IconRuler2 },
  play: { id: 'player-play', emoji: '▶️', outline: IconPlayerPlay, filled: IconPlayerPlayFilled },
  warning: {
    id: 'alert-triangle',
    emoji: '⚠️',
    outline: IconAlertTriangle,
    filled: IconAlertTriangleFilled,
  },
  currency: { id: 'arrows-exchange', emoji: '💱', outline: IconArrowsExchange },
  rain: { id: 'droplet', emoji: '💧', outline: IconDroplet, filled: IconDropletFilled },
  region: { id: 'world', emoji: '🌍', outline: IconWorld },
  sun: { id: 'sun', emoji: '☀️', outline: IconSun, filled: IconSunFilled },
  home: { id: 'home', emoji: '🏠', outline: IconHome, filled: IconHomeFilled },
  notDone: { id: 'square', emoji: '⬜️', outline: IconSquare },
  luggage: { id: 'luggage', emoji: '🧳', outline: IconLuggage },
  seat: { id: 'armchair', emoji: '💺', outline: IconArmchair },
  showPassword: { id: 'eye', emoji: '👁️', outline: IconEye, filled: IconEyeFilled },
  hidePassword: { id: 'eye-off', emoji: '🙈', outline: IconEyeOff },
  order: { id: 'list-numbers', emoji: '📋', outline: IconListNumbers },
  apple: { id: 'brand-apple', emoji: '🍎', outline: IconBrandApple },
  googleMaps: { id: 'brand-google-maps', emoji: '🗺️', outline: IconBrandGoogleMaps },
  googleCalendar: { id: 'brand-google', emoji: '📆', outline: IconBrandGoogle },
  android: { id: 'brand-android', emoji: '🤖', outline: IconBrandAndroid },
  comment: {
    id: 'message-circle',
    emoji: '💬',
    outline: IconMessageCircle,
    filled: IconMessageCircleFilled,
  },
  restore: { id: 'arrow-back-up', emoji: '↩️', outline: IconArrowBackUp },
  // Emoji-Variante bleibt ungenutzt (immer per :color eingefärbt, siehe TodoView.vue) - trotzdem
  // gesetzt, damit IconDef vollständig bleibt.
  priorityDot: {
    id: 'circle-filled',
    emoji: '🔴',
    outline: IconCircleFilled,
    filled: IconCircleFilled,
  },
  recommended: { id: 'star', emoji: '⭐', outline: IconStar, filled: IconStarFilled },
  logout: { id: 'logout', emoji: '🚪', outline: IconLogout },
  upload: { id: 'upload', emoji: '⬆️', outline: IconUpload },
  scrollLeft: { id: 'chevron-left', emoji: '◀️', outline: IconChevronLeft },
  scrollRight: { id: 'chevron-right', emoji: '▶️', outline: IconChevronRight },
  // Ein Chevron statt getrennter Auf-/Zu-/Rechts-Glyphen für alle Auf-/Zuklapp-Umschalter im Code
  // (Picker-Umschalter, Dropdown-Pfeile, Sortierrichtung, Verschieben-Buttons) - Ausrichtung per
  // CSS-Rotation an der jeweiligen Aufrufstelle statt separater Icon-Varianten pro Winkel.
  chevronDown: { id: 'chevron-down', emoji: '🔽', outline: IconChevronDown },
  chevronUp: { id: 'chevron-up', emoji: '🔼', outline: IconChevronUp },
  info: { id: 'info-circle', emoji: 'ℹ️', outline: IconInfoCircle, filled: IconInfoCircleFilled },
  installApp: { id: 'device-mobile', emoji: '📲', outline: IconDeviceMobile },
  sparkles: { id: 'sparkles', emoji: '✨', outline: IconSparkles },
  share: { id: 'share', emoji: '⬆️', outline: IconShare },
  browserMenu: { id: 'dots-vertical', emoji: '⋮', outline: IconDotsVertical },
  send: { id: 'send', emoji: '✈️', outline: IconSend, filled: IconSendFilled },
};

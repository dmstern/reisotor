import {
  IconPencil,
  IconPencilFilled,
  IconNotes,
  IconClock,
  IconClockFilled,
  IconUser,
  IconUserFilled,
  IconCoin,
  IconCoinFilled,
  IconTag,
  IconTagFilled,
  IconUsersGroup,
  IconMap2,
  IconPhoto,
  IconPhotoFilled,
  IconLink,
  IconLinkFilled,
  IconMapPin,
  IconMapPinFilled,
  IconCompass,
  IconCompassFilled,
  IconAlertTriangle,
  IconAlertTriangleFilled,
  IconCalendar,
  IconCalendarFilled,
  IconCalendarWeek,
  IconCalendarWeekFilled,
  IconPhone,
  IconPhoneFilled,
  IconPigMoney,
  IconBuildingStore,
  IconUsers,
} from '@tabler/icons-vue';
import type { IconDef } from './icon';

// Konzept-Icons für FormField.vue's icon-Prop (siehe dort) - ersetzt die zuvor per Konvention roh
// eingetippten Emoji-Literale (siehe DESIGN.md "Formularfelder") an allen ~109 Aufrufstellen.
// IconDefs statt einzelner Icon-Komponenten, damit dieselbe Auflösung wie überall sonst (AppIcon.vue,
// utils/icon.ts) gilt. Manche Konzepte teilen sich absichtlich dieselbe Tabler-Komponente wie eine
// der 5 Kategorie-Registries (z. B. 'date' = SECTION_ICON_DEFS-ähnliches Calendar, 'amount' = Coin
// wie budget), damit dasselbe Konzept app-weit nicht mit unterschiedlichen Icons auseinanderläuft.
export type FormFieldIconKey =
  | 'title'
  | 'date'
  | 'period'
  | 'time'
  | 'note'
  | 'person'
  | 'amount'
  | 'category'
  | 'shared'
  | 'maps'
  | 'image'
  | 'link'
  | 'location'
  | 'tour'
  | 'priority'
  | 'contact'
  | 'pot'
  | 'shop'
  | 'visibility';

export const FORM_FIELD_ICONS: Record<FormFieldIconKey, IconDef> = {
  title: { id: 'pencil', emoji: '✏️', outline: IconPencil, filled: IconPencilFilled },
  date: { id: 'calendar', emoji: '📅', outline: IconCalendar, filled: IconCalendarFilled },
  period: { id: 'calendar-week', emoji: '🗓️', outline: IconCalendarWeek, filled: IconCalendarWeekFilled },
  time: { id: 'clock', emoji: '🕒', outline: IconClock, filled: IconClockFilled },
  note: { id: 'notes', emoji: '📝', outline: IconNotes },
  person: { id: 'user', emoji: '🧑', outline: IconUser, filled: IconUserFilled },
  amount: { id: 'coin', emoji: '💶', outline: IconCoin, filled: IconCoinFilled },
  category: { id: 'tag', emoji: '🏷️', outline: IconTag, filled: IconTagFilled },
  shared: { id: 'users-group', emoji: '🤝', outline: IconUsersGroup },
  maps: { id: 'map-2', emoji: '🗺️', outline: IconMap2 },
  image: { id: 'photo', emoji: '🖼️', outline: IconPhoto, filled: IconPhotoFilled },
  link: { id: 'link', emoji: '🔗', outline: IconLink, filled: IconLinkFilled },
  location: { id: 'map-pin', emoji: '📍', outline: IconMapPin, filled: IconMapPinFilled },
  tour: { id: 'compass', emoji: '🧭', outline: IconCompass, filled: IconCompassFilled },
  priority: { id: 'alert-triangle', emoji: '🚦', outline: IconAlertTriangle, filled: IconAlertTriangleFilled },
  contact: { id: 'phone', emoji: '📞', outline: IconPhone, filled: IconPhoneFilled },
  pot: { id: 'pig-money', emoji: '🏺', outline: IconPigMoney },
  shop: { id: 'building-store', emoji: '🏬', outline: IconBuildingStore },
  visibility: { id: 'users', emoji: '👥', outline: IconUsers },
};

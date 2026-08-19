import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { usePersistedRef } from '../composables/usePersistedRef';

// Geräte-/Browser-UI-Einstellung (wie stores/calendarSettings.ts/weatherProvider.ts) statt
// Account-Daten: bewusst nur lokal in localStorage gehalten (siehe utils/icon.ts für die
// Auflösungslogik, components/AppIcon.vue für die Render-Stelle).
export const ICON_STYLE_OPTIONS = [
  { value: 'emoji', label: 'Emoji' },
  { value: 'icons', label: 'Symbole (Tabler)' },
] as const;
export type IconStyle = (typeof ICON_STYLE_OPTIONS)[number]['value'];

export const ICON_VARIANT_OPTIONS = [
  { value: 'outline', label: 'Outline' },
  { value: 'filled', label: 'Gefüllt' },
] as const;
export type IconVariant = (typeof ICON_VARIANT_OPTIONS)[number]['value'];

// Grobe Bereiche, für die sich der Icon-Stil einzeln einstellen lässt (Nutzer-Feedback:
// "Kategorie-Icons per Emoji, Navigation per Tabler" o. ä. soll möglich sein) - jede
// AppIcon.vue-Aufrufstelle ordnet sich über ihren `group`-Prop genau einer davon zu. Es gibt
// bewusst KEINEN globalen Fallback-Wert mehr, jeder Bereich hat immer einen konkreten Wert (siehe
// DEFAULT_GROUPS/groups unten) - ein "für alle Bereiche umstellen"-Aufruf (setAllGroups) ist nur
// ein Bulk-Setter, kein eigener persistenter Zustand.
export const ICON_GROUP_OPTIONS = [
  { value: 'navigation', label: 'Navigation & Dashboard' },
  { value: 'categories', label: 'Kategorien (Kalender, Spots, Reise, Kartenmarker)' },
  { value: 'weather', label: 'Wetter' },
  { value: 'formFields', label: 'Formularfelder' },
  { value: 'actions', label: 'Aktionen & Buttons' },
] as const;
export type IconGroup = (typeof ICON_GROUP_OPTIONS)[number]['value'];

const GROUPS_KEY = 'reisotor-icon-style-groups';
const VARIANTS_KEY = 'reisotor-icon-style-variants';
const NAV_COLORED_KEY = 'reisotor-icon-nav-colored';
const COLORIZE_WEATHER_KEY = 'reisotor-icon-colorize-weather';
const COLORIZE_CATEGORIES_KEY = 'reisotor-icon-colorize-categories';
const DEFAULT_VARIANT: IconVariant = 'outline';
// Neue Standard-Einstellungen (Issue #74): überall Symbole außer bei Kategorien, die per Default
// bei Emoji bleiben.
const DEFAULT_GROUPS: Record<IconGroup, IconStyle> = {
  navigation: 'icons',
  categories: 'emoji',
  weather: 'icons',
  formFields: 'icons',
  actions: 'icons',
};
const DEFAULT_VARIANTS: Record<IconGroup, IconVariant> = {
  navigation: DEFAULT_VARIANT,
  categories: DEFAULT_VARIANT,
  weather: DEFAULT_VARIANT,
  formFields: DEFAULT_VARIANT,
  actions: DEFAULT_VARIANT,
};

// Validiert jeden Bereich einzeln statt das ganze gespeicherte Objekt zu verwerfen - deckt sowohl
// ganz neue Nutzer:innen (kein Eintrag) als auch Reste in einem älteren/kaputten Format robust ab.
function loadPerGroup<T extends string>(key: string, validOptions: readonly { value: T }[], defaults: Record<IconGroup, T>): Record<IconGroup, T> {
  const stored = localStorage.getItem(key);
  let parsed: Partial<Record<IconGroup, unknown>> = {};
  if (stored != null) {
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = {};
    }
  }
  const result = {} as Record<IconGroup, T>;
  for (const { value: group } of ICON_GROUP_OPTIONS) {
    const candidate = parsed[group];
    result[group] = validOptions.some((o) => o.value === candidate) ? (candidate as T) : defaults[group];
  }
  return result;
}

export const useIconStyleStore = defineStore('iconStyle', () => {
  const groups = ref<Record<IconGroup, IconStyle>>(loadPerGroup(GROUPS_KEY, ICON_STYLE_OPTIONS, DEFAULT_GROUPS));
  const variants = ref<Record<IconGroup, IconVariant>>(loadPerGroup(VARIANTS_KEY, ICON_VARIANT_OPTIONS, DEFAULT_VARIANTS));
  // Nur für die Navigation (NavBar/Dashboard-Konfig-Liste) relevant, siehe utils/widgetColors.ts's
  // NAV_LINK_COLORS.
  const navColored = usePersistedRef<boolean>(NAV_COLORED_KEY, true);
  // Einfärbung passend zur jeweiligen Wetter-Bedingung (Sonne gelb, Regen blau, …), siehe
  // utils/weather.ts/components/WeatherIcon.vue.
  const colorizeWeather = usePersistedRef<boolean>(COLORIZE_WEATHER_KEY, true);
  // Kategorie-Icons (Spots/CategoryChip.vue) passend zur jeweiligen spotCategoryMeta().color
  // einfärben (#94) – gleiches Muster wie colorizeWeather oben, Standard AUS statt AN: die
  // Kategorien-Chips waren bisher immer einfarbig-neutral in der Chip-Hintergrundfarbe, ein
  // plötzlich bunt eingefärbtes Icon on-top wäre ein sichtbarer Default-Verhaltenswechsel.
  const colorizeCategories = usePersistedRef<boolean>(COLORIZE_CATEGORIES_KEY, false);

  watch(groups, (v) => localStorage.setItem(GROUPS_KEY, JSON.stringify(v)), { deep: true });
  watch(variants, (v) => localStorage.setItem(VARIANTS_KEY, JSON.stringify(v)), { deep: true });

  function styleForGroup(group: IconGroup): IconStyle {
    return groups.value[group];
  }

  function setGroupOverride(group: IconGroup, value: IconStyle) {
    groups.value = { ...groups.value, [group]: value };
  }

  function setAllGroups(value: IconStyle) {
    const next = {} as Record<IconGroup, IconStyle>;
    for (const { value: group } of ICON_GROUP_OPTIONS) next[group] = value;
    groups.value = next;
  }

  function styleVariantForGroup(group: IconGroup): IconVariant {
    return variants.value[group];
  }

  function setGroupVariant(group: IconGroup, value: IconVariant) {
    variants.value = { ...variants.value, [group]: value };
  }

  function resetToDefaults() {
    groups.value = { ...DEFAULT_GROUPS };
    variants.value = { ...DEFAULT_VARIANTS };
    navColored.value = true;
    colorizeWeather.value = true;
    colorizeCategories.value = false;
  }

  return {
    groups,
    variants,
    navColored,
    colorizeWeather,
    colorizeCategories,
    styleForGroup,
    setGroupOverride,
    setAllGroups,
    styleVariantForGroup,
    setGroupVariant,
    resetToDefaults,
  };
});

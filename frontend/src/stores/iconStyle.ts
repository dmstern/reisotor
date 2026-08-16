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

const VARIANT_KEY = 'reisotor-icon-variant';
const GROUPS_KEY = 'reisotor-icon-style-groups';
const NAV_COLORED_KEY = 'reisotor-icon-nav-colored';
const COLORIZE_WEATHER_KEY = 'reisotor-icon-colorize-weather';
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

function loadVariant(): IconVariant {
  const stored = localStorage.getItem(VARIANT_KEY);
  return ICON_VARIANT_OPTIONS.some((o) => o.value === stored) ? (stored as IconVariant) : DEFAULT_VARIANT;
}

// Validiert jeden Bereich einzeln statt das ganze gespeicherte Objekt zu verwerfen - deckt sowohl
// ganz neue Nutzer:innen (kein Eintrag) als auch Reste im alten, partiellen Format
// (reisotor-icon-style-group-overrides) oder einzelne kaputte Werte robust ab.
function loadGroups(): Record<IconGroup, IconStyle> {
  const stored = localStorage.getItem(GROUPS_KEY);
  let parsed: Partial<Record<IconGroup, unknown>> = {};
  if (stored != null) {
    try {
      parsed = JSON.parse(stored);
    } catch {
      parsed = {};
    }
  }
  const result = {} as Record<IconGroup, IconStyle>;
  for (const { value: group } of ICON_GROUP_OPTIONS) {
    const candidate = parsed[group];
    result[group] = ICON_STYLE_OPTIONS.some((o) => o.value === candidate) ? (candidate as IconStyle) : DEFAULT_GROUPS[group];
  }
  return result;
}

export const useIconStyleStore = defineStore('iconStyle', () => {
  const variant = ref<IconVariant>(loadVariant());
  const groups = ref<Record<IconGroup, IconStyle>>(loadGroups());
  // Nur für die Navigation (NavBar/Dashboard-Konfig-Liste) relevant, siehe utils/widgetColors.ts's
  // NAV_LINK_COLORS.
  const navColored = usePersistedRef<boolean>(NAV_COLORED_KEY, true);
  // Einfärbung passend zur jeweiligen Wetter-Bedingung (Sonne gelb, Regen blau, …), siehe
  // utils/weather.ts/components/WeatherIcon.vue.
  const colorizeWeather = usePersistedRef<boolean>(COLORIZE_WEATHER_KEY, true);

  watch(variant, (v) => localStorage.setItem(VARIANT_KEY, v));
  watch(groups, (v) => localStorage.setItem(GROUPS_KEY, JSON.stringify(v)), { deep: true });

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

  function resetToDefaults() {
    variant.value = DEFAULT_VARIANT;
    groups.value = { ...DEFAULT_GROUPS };
    navColored.value = true;
    colorizeWeather.value = true;
  }

  return {
    variant,
    groups,
    navColored,
    colorizeWeather,
    styleForGroup,
    setGroupOverride,
    setAllGroups,
    resetToDefaults,
  };
});

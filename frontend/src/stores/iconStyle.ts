import { defineStore } from 'pinia';
import { ref, watch, computed } from 'vue';
import { usePersistedRef } from '../composables/usePersistedRef';

// Geräte-/Browser-UI-Einstellung (wie stores/calendarSettings.ts/weatherProvider.ts) statt
// Account-Daten: bewusst nur lokal in localStorage gehalten. Default ('emoji'/'outline') entspricht
// dem bisherigen, hart codierten Verhalten der App - Bestandsnutzer:innen sehen ohne aktives
// Opt-in keine Änderung (siehe utils/icon.ts für die Auflösungslogik, components/AppIcon.vue für
// die Render-Stelle).
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

// Grobe Bereiche, für die sich der Icon-Stil einzeln vom globalen Default abweichend einstellen
// lässt (Nutzer-Feedback: "Kategorie-Icons per Tabler, Navigation weiter Emoji" o. ä. soll möglich
// sein) - jede AppIcon.vue-Aufrufstelle ordnet sich über ihren `group`-Prop genau einer davon zu.
export const ICON_GROUP_OPTIONS = [
  { value: 'navigation', label: 'Navigation & Dashboard' },
  { value: 'categories', label: 'Kategorien (Kalender, Spots, Wetter, Reise, Kartenmarker)' },
  { value: 'formFields', label: 'Formularfelder' },
  { value: 'actions', label: 'Aktionen & Buttons' },
] as const;
export type IconGroup = (typeof ICON_GROUP_OPTIONS)[number]['value'];

const STYLE_KEY = 'reisotor-icon-style';
const VARIANT_KEY = 'reisotor-icon-variant';
const GROUP_OVERRIDES_KEY = 'reisotor-icon-style-group-overrides';
const NAV_COLORED_KEY = 'reisotor-icon-nav-colored';
const DEFAULT_STYLE: IconStyle = 'emoji';
const DEFAULT_VARIANT: IconVariant = 'outline';

function loadStyle(): IconStyle {
  const stored = localStorage.getItem(STYLE_KEY);
  return ICON_STYLE_OPTIONS.some((o) => o.value === stored) ? (stored as IconStyle) : DEFAULT_STYLE;
}

function loadVariant(): IconVariant {
  const stored = localStorage.getItem(VARIANT_KEY);
  return ICON_VARIANT_OPTIONS.some((o) => o.value === stored) ? (stored as IconVariant) : DEFAULT_VARIANT;
}

export const useIconStyleStore = defineStore('iconStyle', () => {
  const style = ref<IconStyle>(loadStyle());
  const variant = ref<IconVariant>(loadVariant());
  // undefined/fehlender Eintrag = "folgt der globalen style-Einstellung oben" - siehe styleForGroup().
  const groupOverrides = usePersistedRef<Partial<Record<IconGroup, IconStyle>>>(GROUP_OVERRIDES_KEY, {});
  // Nur für die Navigation (NavBar/Dashboard-Konfig-Liste) relevant, siehe utils/widgetColors.ts's
  // NAV_LINK_COLORS - bewusst per Default AUS (anders als die Dashboard-Kacheln, die immer eingefärbt
  // sind), da die NavBar bisher immer einfarbig war und das ein bewussterer Stilbruch ist als bei den
  // ohnehin schon farbig hinterlegten Dashboard-Kacheln.
  const navColored = usePersistedRef<boolean>(NAV_COLORED_KEY, false);

  watch(style, (v) => localStorage.setItem(STYLE_KEY, v));
  watch(variant, (v) => localStorage.setItem(VARIANT_KEY, v));

  function styleForGroup(group: IconGroup): IconStyle {
    return groupOverrides.value[group] ?? style.value;
  }

  function setGroupOverride(group: IconGroup, value: IconStyle | null) {
    const next = { ...groupOverrides.value };
    if (value == null) delete next[group];
    else next[group] = value;
    groupOverrides.value = next;
  }

  // Für die Vorschau in IconStyleSettings.vue: zeigt, ob irgendein Bereich vom globalen Default
  // abweicht, damit die "Für einzelne Bereiche anpassen"-Sektion erkennbar bleibt, auch wenn sie
  // eingeklappt ist.
  const hasGroupOverrides = computed(() => Object.keys(groupOverrides.value).length > 0);

  return { style, variant, groupOverrides, navColored, styleForGroup, setGroupOverride, hasGroupOverrides };
});

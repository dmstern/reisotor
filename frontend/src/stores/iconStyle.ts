import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

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

const STYLE_KEY = 'reisotor-icon-style';
const VARIANT_KEY = 'reisotor-icon-variant';
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

  watch(style, (v) => localStorage.setItem(STYLE_KEY, v));
  watch(variant, (v) => localStorage.setItem(VARIANT_KEY, v));

  return { style, variant };
});

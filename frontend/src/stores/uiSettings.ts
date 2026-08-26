import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const SHOW_ACTIVITY_TOASTS_KEY = 'reisotor-show-activity-toasts';
const SHOW_VACATION_COUNTDOWN_KEY = 'reisotor-show-vacation-countdown';
const SHOW_HOME_WEATHER_FULL_TRIP_KEY = 'reisotor-show-home-weather-full-trip';
const GLASS_STYLE_KEY = 'reisotor-glass-style';
const GLASS_OPACITY_KEY = 'reisotor-glass-opacity';
const GLASS_BLUR_KEY = 'reisotor-glass-blur';
const PRIMARY_COLOR_KEY = 'reisotor-primary-color';
const BORDER_WIDTH_KEY = 'reisotor-border-width';

export type GlassStyle = 'glass' | 'frosted' | 'opaque' | 'custom';

export const VIBRANT_PRIMARY_COLOR_PRESETS = [
  { name: 'Türkis', hex: '#2a7f74' },
  { name: 'Ozeanblau', hex: '#2563eb' },
  { name: 'Violett', hex: '#7c3aed' },
  { name: 'Smaragd', hex: '#059669' },
  { name: 'Rubin', hex: '#e11d48' },
  { name: 'Bernstein', hex: '#d97706' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Pink', hex: '#db2777' },
  { name: 'Aubergine', hex: '#77216f' },
  { name: 'Koralle', hex: '#ea580c' },
  { name: 'Sonnengelb', hex: '#ca8a04' },
  { name: 'Lime', hex: '#65a30d' },
] as const;

export const PASTEL_PRIMARY_COLOR_PRESETS = [
  { name: 'Mint-Soft', hex: '#14b8a6' },
  { name: 'Eisblau', hex: '#3b82f6' },
  { name: 'Flieder', hex: '#a855f7' },
  { name: 'Salbei', hex: '#10b981' },
  { name: 'Altrosa', hex: '#f43f5e' },
  { name: 'Pfirsich', hex: '#f97316' },
  { name: 'Lavendel', hex: '#6366f1' },
  { name: 'Soft-Pink', hex: '#ec4899' },
  { name: 'Malve', hex: '#c084fc' },
  { name: 'Sand', hex: '#eab308' },
  { name: 'Aquamarin', hex: '#06b6d4' },
  { name: 'Pistazie', hex: '#84cc16' },
] as const;

export const PRIMARY_COLOR_PRESETS = [
  ...VIBRANT_PRIMARY_COLOR_PRESETS,
  ...PASTEL_PRIMARY_COLOR_PRESETS,
];

export const DEFAULT_PRIMARY_COLOR = '#2a7f74';
export const DEFAULT_BORDER_WIDTH = 1;

function loadShowActivityToasts(): boolean {
  // Kein gespeicherter Wert -> Standard AN (bisheriges Verhalten unverändert für alle, die die
  // Einstellung noch nie angefasst haben).
  const stored = localStorage.getItem(SHOW_ACTIVITY_TOASTS_KEY);
  return stored === null ? true : stored === 'true';
}

// Kein gespeicherter Wert -> Standard AUS (statischer Hinweis statt Resttage-Countdown während des
// Urlaubs, siehe DashboardView.vue/utils/departureCountdown.ts's computeVacationPhase()).
function loadShowVacationCountdown(): boolean {
  return localStorage.getItem(SHOW_VACATION_COUNTDOWN_KEY) === 'true';
}

// Kein gespeicherter Wert -> Standard AUS (Wetter zuhause im Dashboard zeigt standardmäßig nur die
// letzten paar Tage vor der Rückreise statt des kompletten Urlaubszeitraums, siehe
// DashboardView.vue's homeForecastDays).
function loadShowHomeWeatherFullTrip(): boolean {
  return localStorage.getItem(SHOW_HOME_WEATHER_FULL_TRIP_KEY) === 'true';
}

function loadGlassStyle(): GlassStyle {
  const stored = localStorage.getItem(GLASS_STYLE_KEY);
  if (stored === 'glass' || stored === 'frosted' || stored === 'opaque' || stored === 'custom') {
    return stored as GlassStyle;
  }
  return 'glass';
}

function loadGlassOpacity(): number {
  const stored = localStorage.getItem(GLASS_OPACITY_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 100) return parsed;
  }
  return 85;
}

function loadGlassBlur(): number {
  const stored = localStorage.getItem(GLASS_BLUR_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 30) return parsed;
  }
  return 12;
}

function loadPrimaryColor(): string {
  const stored = localStorage.getItem(PRIMARY_COLOR_KEY);
  if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) {
    return stored;
  }
  return DEFAULT_PRIMARY_COLOR;
}

function loadBorderWidth(): number {
  const stored = localStorage.getItem(BORDER_WIDTH_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) return parsed;
  }
  return DEFAULT_BORDER_WIDTH;
}

export function getPresetGlassValues(style: GlassStyle) {
  if (style === 'glass') {
    return { opacity: 55, blur: 6 };
  } else if (style === 'frosted') {
    return { opacity: 80, blur: 24 };
  } else if (style === 'opaque') {
    return { opacity: 100, blur: 0 };
  }
  return null;
}

export function computeGlassCssValues(style: GlassStyle, opacity: number, blur: number) {
  const preset = getPresetGlassValues(style);
  if (preset) {
    return { opacity: preset.opacity / 100, blur: preset.blur };
  }
  return { opacity: opacity / 100, blur };
}

export function applyGlassStyle(style: GlassStyle, opacity: number, blur: number) {
  const { opacity: op, blur: bl } = computeGlassCssValues(style, opacity, blur);
  document.documentElement.style.setProperty('--glass-opacity', op.toFixed(2));
  document.documentElement.style.setProperty('--glass-blur', `${bl}px`);
}

export function applyPrimaryColor(colorHex: string) {
  if (/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
    document.documentElement.style.setProperty('--color-primary', colorHex);
  } else {
    document.documentElement.style.removeProperty('--color-primary');
  }
}

export function applyBorderWidth(widthPx: number) {
  document.documentElement.style.setProperty('--ui-border-width', `${widthPx}px`);
}

// Geräte-/Browser-UI-Einstellung (wie stores/mapOrientation.ts) statt Account-Daten: bewusst nur
// lokal in localStorage gehalten.
export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showActivityToasts = ref(loadShowActivityToasts());
  const showVacationCountdown = ref(loadShowVacationCountdown());
  const showHomeWeatherFullTrip = ref(loadShowHomeWeatherFullTrip());

  const glassStyle = ref<GlassStyle>(loadGlassStyle());
  const glassOpacity = ref<number>(loadGlassOpacity());
  const glassBlur = ref<number>(loadGlassBlur());

  const primaryColor = ref<string>(loadPrimaryColor());
  const borderWidth = ref<number>(loadBorderWidth());

  function apply() {
    applyGlassStyle(glassStyle.value, glassOpacity.value, glassBlur.value);
    applyPrimaryColor(primaryColor.value);
    applyBorderWidth(borderWidth.value);
  }

  function init() {
    apply();
  }

  watch(showActivityToasts, (v) => localStorage.setItem(SHOW_ACTIVITY_TOASTS_KEY, String(v)));
  watch(showVacationCountdown, (v) => localStorage.setItem(SHOW_VACATION_COUNTDOWN_KEY, String(v)));
  watch(showHomeWeatherFullTrip, (v) =>
    localStorage.setItem(SHOW_HOME_WEATHER_FULL_TRIP_KEY, String(v))
  );

  watch(glassStyle, (v) => {
    localStorage.setItem(GLASS_STYLE_KEY, v);
    apply();
  });
  watch(glassOpacity, (v) => {
    localStorage.setItem(GLASS_OPACITY_KEY, String(v));
    apply();
  });
  watch(glassBlur, (v) => {
    localStorage.setItem(GLASS_BLUR_KEY, String(v));
    apply();
  });

  watch(primaryColor, (v) => {
    localStorage.setItem(PRIMARY_COLOR_KEY, v);
    apply();
  });
  watch(borderWidth, (v) => {
    localStorage.setItem(BORDER_WIDTH_KEY, String(v));
    apply();
  });

  return {
    showActivityToasts,
    showVacationCountdown,
    showHomeWeatherFullTrip,
    glassStyle,
    glassOpacity,
    glassBlur,
    primaryColor,
    borderWidth,
    init,
    apply,
  };
});

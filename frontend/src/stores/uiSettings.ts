import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const SHOW_ACTIVITY_TOASTS_KEY = 'reisotor-show-activity-toasts';
const SHOW_VACATION_COUNTDOWN_KEY = 'reisotor-show-vacation-countdown';
const SHOW_HOME_WEATHER_FULL_TRIP_KEY = 'reisotor-show-home-weather-full-trip';
const GLASS_STYLE_KEY = 'reisotor-glass-style';
const GLASS_OPACITY_KEY = 'reisotor-glass-opacity';
const GLASS_BLUR_KEY = 'reisotor-glass-blur';

export type GlassStyle = 'glass' | 'frosted' | 'opaque' | 'custom';

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

export function computeGlassCssValues(style: GlassStyle, opacity: number, blur: number) {
  if (style === 'glass') {
    return { opacity: 0.85, blur: 12 };
  } else if (style === 'frosted') {
    return { opacity: 0.95, blur: 20 };
  } else if (style === 'opaque') {
    return { opacity: 1.0, blur: 0 };
  } else {
    return { opacity: opacity / 100, blur };
  }
}

export function applyGlassStyle(style: GlassStyle, opacity: number, blur: number) {
  const { opacity: op, blur: bl } = computeGlassCssValues(style, opacity, blur);
  document.documentElement.style.setProperty('--glass-opacity', op.toFixed(2));
  document.documentElement.style.setProperty('--glass-blur', `${bl}px`);
}

// Geräte-/Browser-UI-Einstellung (wie stores/mapOrientation.ts) statt Account-Daten: bewusst nur
// lokal in localStorage gehalten. showActivityToasts schaltet components/LoadingIndicator.vue's
// kurzlebige "Lädt…/Speichert…"-Toast-Meldungen an/aus.
export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showActivityToasts = ref(loadShowActivityToasts());
  const showVacationCountdown = ref(loadShowVacationCountdown());
  const showHomeWeatherFullTrip = ref(loadShowHomeWeatherFullTrip());

  const glassStyle = ref<GlassStyle>(loadGlassStyle());
  const glassOpacity = ref<number>(loadGlassOpacity());
  const glassBlur = ref<number>(loadGlassBlur());

  function apply() {
    applyGlassStyle(glassStyle.value, glassOpacity.value, glassBlur.value);
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

  return {
    showActivityToasts,
    showVacationCountdown,
    showHomeWeatherFullTrip,
    glassStyle,
    glassOpacity,
    glassBlur,
    init,
    apply,
  };
});


import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { api } from '../api/client';
import { useThemeStore, type ThemeMode, THEME_MODE_OPTIONS } from './theme';
import { useNavPositionStore, type NavPosition } from './navPosition';
import { useNavConfigStore, sanitizeNavEntries, type NavConfigEntry } from './navConfig';
import {
  useDashboardConfigStore,
  sanitizeDashboardEntries,
  type DashboardConfigEntry,
} from './dashboardConfig';
import {
  useCalendarSettingsStore,
  type WeekStart,
  type DateFormatOption,
  WEEK_START_OPTIONS,
  DATE_FORMAT_OPTIONS,
} from './calendarSettings';
import {
  useWeatherProviderStore,
  type WeatherModel,
  WEATHER_MODEL_OPTIONS,
} from './weatherProvider';
import { useHomeCurrencyStore, type HomeCurrency, HOME_CURRENCY_OPTIONS } from './homeCurrency';

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

function safeLocalStorageGet(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function loadShowActivityToasts(): boolean {
  const stored = safeLocalStorageGet(SHOW_ACTIVITY_TOASTS_KEY);
  return stored === null ? true : stored === 'true';
}

function loadShowVacationCountdown(): boolean {
  return safeLocalStorageGet(SHOW_VACATION_COUNTDOWN_KEY) === 'true';
}

function loadShowHomeWeatherFullTrip(): boolean {
  return safeLocalStorageGet(SHOW_HOME_WEATHER_FULL_TRIP_KEY) === 'true';
}

function loadGlassStyle(): GlassStyle {
  const stored = safeLocalStorageGet(GLASS_STYLE_KEY);
  if (stored === 'glass' || stored === 'frosted' || stored === 'opaque' || stored === 'custom') {
    return stored as GlassStyle;
  }
  return 'glass';
}

function loadGlassOpacity(): number {
  const stored = safeLocalStorageGet(GLASS_OPACITY_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 20 && parsed <= 100) return parsed;
  }
  return 85;
}

function loadGlassBlur(): number {
  const stored = safeLocalStorageGet(GLASS_BLUR_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 30) return parsed;
  }
  return 12;
}

function loadPrimaryColor(): string {
  const stored = safeLocalStorageGet(PRIMARY_COLOR_KEY);
  if (stored && /^#[0-9a-fA-F]{6}$/.test(stored)) {
    return stored;
  }
  return DEFAULT_PRIMARY_COLOR;
}

function loadBorderWidth(): number {
  const stored = safeLocalStorageGet(BORDER_WIDTH_KEY);
  if (stored !== null) {
    const parsed = parseInt(stored, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) return parsed;
  }
  return DEFAULT_BORDER_WIDTH;
}

export function applyGlassStyle(style: GlassStyle, opacity: number, blur: number) {
  if (typeof document === 'undefined') return;
  const { opacity: op, blur: bl } = computeGlassCssValues(style, opacity, blur);
  document.documentElement.style.setProperty('--glass-opacity', op.toFixed(2));
  document.documentElement.style.setProperty('--glass-blur', `${bl}px`);
}

export function applyPrimaryColor(colorHex: string) {
  if (typeof document === 'undefined') return;
  if (/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
    document.documentElement.style.setProperty('--color-primary', colorHex);
  } else {
    document.documentElement.style.removeProperty('--color-primary');
  }
}

export function applyBorderWidth(widthPx: number) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--ui-border-width', `${widthPx}px`);
}

export interface StoredAppSettings {
  theme?: ThemeMode;
  showActivityToasts?: boolean;
  showVacationCountdown?: boolean;
  showHomeWeatherFullTrip?: boolean;
  glassStyle?: GlassStyle;
  glassOpacity?: number;
  glassBlur?: number;
  primaryColor?: string;
  borderWidth?: number;
  navPosition?: {
    desktop?: NavPosition;
    mobile?: NavPosition;
  };
  navConfig?: NavConfigEntry[];
  dashboardConfig?: DashboardConfigEntry[];
  calendarSettings?: {
    weekStart?: WeekStart;
    dateFormat?: DateFormatOption;
  };
  weatherModel?: WeatherModel;
  homeCurrency?: HomeCurrency;
}

// Persistierte App-Einstellungen am User-Datensatz (Issue #324).
// Lädt und speichert alle Individualisierungen (Theme, Farben, Rahmendicke, Glass, Nav, Dashboard, etc.)
// pro Account auf dem Server (/users/me/app-settings) & hält sie synchron.
export const useUiSettingsStore = defineStore('uiSettings', () => {
  const showActivityToasts = ref(loadShowActivityToasts());
  const showVacationCountdown = ref(loadShowVacationCountdown());
  const showHomeWeatherFullTrip = ref(loadShowHomeWeatherFullTrip());

  const glassStyle = ref<GlassStyle>(loadGlassStyle());
  const glassOpacity = ref<number>(loadGlassOpacity());
  const glassBlur = ref<number>(loadGlassBlur());

  const primaryColor = ref<string>(loadPrimaryColor());
  const borderWidth = ref<number>(loadBorderWidth());
  const loaded = ref(false);
  let isInternalSync = false;

  function apply() {
    applyGlassStyle(glassStyle.value, glassOpacity.value, glassBlur.value);
    applyPrimaryColor(primaryColor.value);
    applyBorderWidth(borderWidth.value);
  }

  function init() {
    apply();
  }

  function persist() {
    if (isInternalSync) return;
    const themeStore = useThemeStore();
    const navPosStore = useNavPositionStore();
    const navCfgStore = useNavConfigStore();
    const dashCfgStore = useDashboardConfigStore();
    const calSettingsStore = useCalendarSettingsStore();
    const weatherStore = useWeatherProviderStore();
    const homeCurrStore = useHomeCurrencyStore();

    api
      .put('/users/me/app-settings', {
        settings: {
          theme: themeStore.mode,
          showActivityToasts: showActivityToasts.value,
          showVacationCountdown: showVacationCountdown.value,
          showHomeWeatherFullTrip: showHomeWeatherFullTrip.value,
          glassStyle: glassStyle.value,
          glassOpacity: glassOpacity.value,
          glassBlur: glassBlur.value,
          primaryColor: primaryColor.value,
          borderWidth: borderWidth.value,
          navPosition: {
            desktop: navPosStore.desktop,
            mobile: navPosStore.mobile,
          },
          navConfig: navCfgStore.entries,
          dashboardConfig: dashCfgStore.entries,
          calendarSettings: {
            weekStart: calSettingsStore.weekStart,
            dateFormat: calSettingsStore.dateFormat,
          },
          weatherModel: weatherStore.model,
          homeCurrency: homeCurrStore.currency,
        } satisfies StoredAppSettings,
      })
      .catch(() => {});
  }

  async function load() {
    if (loaded.value) return;
    try {
      const stored = await api.get<Partial<StoredAppSettings>>('/users/me/app-settings');
      isInternalSync = true;

      const themeStore = useThemeStore();
      const navPosStore = useNavPositionStore();
      const navCfgStore = useNavConfigStore();
      const dashCfgStore = useDashboardConfigStore();
      const calSettingsStore = useCalendarSettingsStore();
      const weatherStore = useWeatherProviderStore();
      const homeCurrStore = useHomeCurrencyStore();

      if (stored.theme && THEME_MODE_OPTIONS.some((o) => o.value === stored.theme)) {
        themeStore.mode = stored.theme;
      }
      if (typeof stored.showActivityToasts === 'boolean') {
        showActivityToasts.value = stored.showActivityToasts;
      }
      if (typeof stored.showVacationCountdown === 'boolean') {
        showVacationCountdown.value = stored.showVacationCountdown;
      }
      if (typeof stored.showHomeWeatherFullTrip === 'boolean') {
        showHomeWeatherFullTrip.value = stored.showHomeWeatherFullTrip;
      }
      if (
        stored.glassStyle === 'glass' ||
        stored.glassStyle === 'frosted' ||
        stored.glassStyle === 'opaque' ||
        stored.glassStyle === 'custom'
      ) {
        glassStyle.value = stored.glassStyle;
      }
      if (
        typeof stored.glassOpacity === 'number' &&
        stored.glassOpacity >= 20 &&
        stored.glassOpacity <= 100
      ) {
        glassOpacity.value = stored.glassOpacity;
      }
      if (typeof stored.glassBlur === 'number' && stored.glassBlur >= 0 && stored.glassBlur <= 30) {
        glassBlur.value = stored.glassBlur;
      }
      if (stored.primaryColor && /^#[0-9a-fA-F]{6}$/.test(stored.primaryColor)) {
        primaryColor.value = stored.primaryColor;
      }
      if (
        typeof stored.borderWidth === 'number' &&
        stored.borderWidth >= 0 &&
        stored.borderWidth <= 10
      ) {
        borderWidth.value = stored.borderWidth;
      }
      if (stored.navPosition) {
        if (stored.navPosition.desktop === 'top' || stored.navPosition.desktop === 'bottom') {
          navPosStore.desktop = stored.navPosition.desktop;
        }
        if (stored.navPosition.mobile === 'top' || stored.navPosition.mobile === 'bottom') {
          navPosStore.mobile = stored.navPosition.mobile;
        }
      }
      if (Array.isArray(stored.navConfig)) {
        navCfgStore.entries = sanitizeNavEntries(stored.navConfig);
      }
      if (Array.isArray(stored.dashboardConfig)) {
        dashCfgStore.entries = sanitizeDashboardEntries(stored.dashboardConfig);
      }
      if (stored.calendarSettings) {
        if (
          stored.calendarSettings.weekStart &&
          WEEK_START_OPTIONS.some((o) => o.value === stored.calendarSettings?.weekStart)
        ) {
          calSettingsStore.weekStart = stored.calendarSettings.weekStart;
        }
        if (
          stored.calendarSettings.dateFormat &&
          DATE_FORMAT_OPTIONS.some((o) => o.value === stored.calendarSettings?.dateFormat)
        ) {
          calSettingsStore.dateFormat = stored.calendarSettings.dateFormat;
        }
      }
      if (
        stored.weatherModel &&
        WEATHER_MODEL_OPTIONS.some((o) => o.value === stored.weatherModel)
      ) {
        weatherStore.model = stored.weatherModel;
      }
      if (
        stored.homeCurrency &&
        HOME_CURRENCY_OPTIONS.some((o) => o.value === stored.homeCurrency)
      ) {
        homeCurrStore.currency = stored.homeCurrency;
      }

      apply();
    } catch {
      // Offline/Netzwerkfehler: Lokale Werte behalten
    } finally {
      isInternalSync = false;
      loaded.value = true;
    }
  }

  function clearOnLogout() {
    loaded.value = false;
    // reset/reload when next user logs in
  }

  watch(showActivityToasts, (v) => {
    safeLocalStorageSet(SHOW_ACTIVITY_TOASTS_KEY, String(v));
    persist();
  });
  watch(showVacationCountdown, (v) => {
    safeLocalStorageSet(SHOW_VACATION_COUNTDOWN_KEY, String(v));
    persist();
  });
  watch(showHomeWeatherFullTrip, (v) => {
    safeLocalStorageSet(SHOW_HOME_WEATHER_FULL_TRIP_KEY, String(v));
    persist();
  });

  watch(glassStyle, (v) => {
    safeLocalStorageSet(GLASS_STYLE_KEY, v);
    apply();
    persist();
  });
  watch(glassOpacity, (v) => {
    safeLocalStorageSet(GLASS_OPACITY_KEY, String(v));
    apply();
    persist();
  });
  watch(glassBlur, (v) => {
    safeLocalStorageSet(GLASS_BLUR_KEY, String(v));
    apply();
    persist();
  });

  watch(primaryColor, (v) => {
    safeLocalStorageSet(PRIMARY_COLOR_KEY, v);
    apply();
    persist();
  });
  watch(borderWidth, (v) => {
    safeLocalStorageSet(BORDER_WIDTH_KEY, String(v));
    apply();
    persist();
  });

  // Attach watchers to external stores so changes persist automatically
  const themeStore = useThemeStore();
  const navPosStore = useNavPositionStore();
  const navCfgStore = useNavConfigStore();
  const dashCfgStore = useDashboardConfigStore();
  const calSettingsStore = useCalendarSettingsStore();
  const weatherStore = useWeatherProviderStore();
  const homeCurrStore = useHomeCurrencyStore();

  watch(
    () => themeStore.mode,
    () => persist()
  );
  watch(
    () => navPosStore.desktop,
    () => persist()
  );
  watch(
    () => navPosStore.mobile,
    () => persist()
  );
  watch(
    () => navCfgStore.entries,
    () => persist(),
    { deep: true }
  );
  watch(
    () => dashCfgStore.entries,
    () => persist(),
    { deep: true }
  );
  watch(
    () => calSettingsStore.weekStart,
    () => persist()
  );
  watch(
    () => calSettingsStore.dateFormat,
    () => persist()
  );
  watch(
    () => weatherStore.model,
    () => persist()
  );
  watch(
    () => homeCurrStore.currency,
    () => persist()
  );

  return {
    showActivityToasts,
    showVacationCountdown,
    showHomeWeatherFullTrip,
    glassStyle,
    glassOpacity,
    glassBlur,
    primaryColor,
    borderWidth,
    loaded,
    load,
    clearOnLogout,
    init,
    apply,
  };
});

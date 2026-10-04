import { computed } from 'vue';
import { useThemeStore } from '../stores/theme';
import { useNavConfigStore } from '../stores/navConfig';
import { NAV_LINKS } from '../utils/navLinks';
import { useDashboardConfigStore } from '../stores/dashboardConfig';
import { DASHBOARD_TILES } from '../utils/dashboardTiles';
import { useCalendarSettingsStore } from '../stores/calendarSettings';
import {
  useUiSettingsStore,
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_DIARY_FONT,
  getPresetGlassValues,
} from '../stores/uiSettings';
import { useIconStyleStore } from '../stores/iconStyle';
import { useHomeCurrencyStore } from '../stores/homeCurrency';
import { useToast } from './useToast';

export function useAppSettingsReset() {
  const theme = useThemeStore();
  const navConfig = useNavConfigStore();
  const dashboardConfig = useDashboardConfigStore();
  const uiSettings = useUiSettingsStore();
  const iconStyle = useIconStyleStore();
  const calendarSettings = useCalendarSettingsStore();
  const homeCurrency = useHomeCurrencyStore();
  const { showToast } = useToast();

  function navLinkLabel(key: string) {
    return NAV_LINKS.find((l) => l.key === key)?.label ?? key;
  }

  function navLinkIcon(key: string) {
    return NAV_LINKS.find((l) => l.key === key)?.icon ?? null;
  }

  function dashboardTileLabel(key: string) {
    return DASHBOARD_TILES.find((t) => t.key === key)?.label ?? key;
  }

  function dashboardTileIcon(key: string) {
    return DASHBOARD_TILES.find((t) => t.key === key)?.icon ?? null;
  }

  const isThemeDefault = computed(() => theme.mode === 'system');
  function resetTheme() {
    theme.reset();
  }

  const isNavDefault = computed(() => {
    if (navConfig.customMobile) return false;
    const defaults = NAV_LINKS.map((l) => ({ key: l.key, visible: l.defaultVisible ?? true }));
    if (navConfig.entries.length !== defaults.length) return false;
    return navConfig.entries.every(
      (e, i) => e.key === defaults[i].key && e.visible === defaults[i].visible
    );
  });
  function resetNav() {
    navConfig.reset();
  }

  const isDashboardDefault = computed(() => {
    const defaults = DASHBOARD_TILES.map((t) => ({ key: t.key, visible: true }));
    if (dashboardConfig.entries.length !== defaults.length) return false;
    return dashboardConfig.entries.every(
      (e, i) => e.key === defaults[i].key && e.visible === defaults[i].visible
    );
  });
  function resetDashboard() {
    dashboardConfig.reset();
  }

  const isVacationCountdownDefault = computed(() => !uiSettings.showVacationCountdown);
  function resetVacationCountdown() {
    uiSettings.showVacationCountdown = false;
  }

  const isAllAppDefault = computed(() => {
    const g = iconStyle.groups;
    const isIconDefault =
      g.navigation === 'icons' &&
      g.categories === 'emoji' &&
      g.weather === 'icons' &&
      iconStyle.navColored &&
      iconStyle.colorizeWeather &&
      iconStyle.colorizeCategories;

    return (
      isThemeDefault.value &&
      uiSettings.primaryColor.toLowerCase() === DEFAULT_PRIMARY_COLOR.toLowerCase() &&
      uiSettings.borderWidth === DEFAULT_BORDER_WIDTH &&
      uiSettings.glassStyle === 'glass' &&
      uiSettings.glassOpacity === 42 &&
      uiSettings.glassBlur === 6 &&
      isIconDefault &&
      uiSettings.diaryFont === DEFAULT_DIARY_FONT &&
      isNavDefault.value &&
      isDashboardDefault.value &&
      isVacationCountdownDefault.value
    );
  });

  async function resetAllAppSettings() {
    if (
      !window.confirm(
        'Möchtest du wirklich alle App-Einstellungen auf die Werkseinstellungen zurücksetzen?'
      )
    ) {
      return;
    }

    theme.reset();
    uiSettings.primaryColor = DEFAULT_PRIMARY_COLOR;
    uiSettings.borderWidth = DEFAULT_BORDER_WIDTH;
    const glassPreset = getPresetGlassValues('glass');
    if (glassPreset) {
      uiSettings.glassOpacity = glassPreset.opacity;
      uiSettings.glassBlur = glassPreset.blur;
      uiSettings.glassStyle = 'glass';
    }
    iconStyle.resetToDefaults();
    uiSettings.diaryFont = DEFAULT_DIARY_FONT;
    resetNav();
    resetDashboard();
    resetVacationCountdown();

    showToast({
      message: 'Alle App-Einstellungen wurden auf Werkseinstellungen zurückgesetzt.',
      type: 'info',
    });
  }

  const isCalendarDefault = computed(
    () => calendarSettings.weekStart === 'monday' && calendarSettings.dateFormat === 'de'
  );
  function resetCalendar() {
    calendarSettings.reset();
  }

  const isWeatherDefault = computed(() => !uiSettings.showHomeWeatherFullTrip);
  function resetWeather() {
    uiSettings.showHomeWeatherFullTrip = false;
  }

  const isHomeCurrencyDefault = computed(() => homeCurrency.currency === 'EUR');
  function resetHomeCurrency() {
    homeCurrency.reset();
  }

  const isToastsDefault = computed(
    () =>
      uiSettings.showActivityToasts === true &&
      uiSettings.toastTimeout === 5 &&
      uiSettings.showUpdateDialogs === true
  );
  function resetToasts() {
    uiSettings.showActivityToasts = true;
    uiSettings.toastTimeout = 5;
    uiSettings.showUpdateDialogs = true;
  }

  return {
    navLinkLabel,
    navLinkIcon,
    dashboardTileLabel,
    dashboardTileIcon,
    isThemeDefault,
    resetTheme,
    isNavDefault,
    resetNav,
    isDashboardDefault,
    resetDashboard,
    isVacationCountdownDefault,
    resetVacationCountdown,
    isAllAppDefault,
    resetAllAppSettings,
    isCalendarDefault,
    resetCalendar,
    isWeatherDefault,
    resetWeather,
    isHomeCurrencyDefault,
    resetHomeCurrency,
    isToastsDefault,
    resetToasts,
  };
}

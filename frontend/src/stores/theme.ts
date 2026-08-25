import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import {
  IconSun,
  IconSunFilled,
  IconMoon,
  IconMoonFilled,
  IconDeviceDesktop,
} from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';

// 'system' übernimmt die Geräteeinstellung (@media(prefers-color-scheme) in style.css) statt eines
// fest gesetzten data-theme-Attributs - siehe apply() unten. Default, solange keine explizite
// Präferenz gespeichert ist. `tabler` ergänzt (nicht ersetzt) `icon` - ThemeModeSelect.vue's
// <option>-Text braucht weiterhin den rohen Emoji-String (native <select>-Elemente können keine
// Vue-Komponenten rendern), der sichtbare Icon-Button daneben nutzt `tabler` via AppIcon.
export const THEME_MODE_OPTIONS = [
  {
    value: 'light',
    icon: '☀️',
    tabler: { id: 'sun', emoji: '☀️', outline: IconSun, filled: IconSunFilled } as IconDef,
    label: 'Hell',
  },
  {
    value: 'dark',
    icon: '🌙',
    tabler: { id: 'moon', emoji: '🌙', outline: IconMoon, filled: IconMoonFilled } as IconDef,
    label: 'Dunkel',
  },
  {
    value: 'system',
    icon: '🖥️',
    tabler: { id: 'device-desktop', emoji: '🖥️', outline: IconDeviceDesktop } as IconDef,
    label: 'Systemeinstellung',
  },
] as const;
export type ThemeMode = (typeof THEME_MODE_OPTIONS)[number]['value'];

const STORAGE_KEY = 'reisotor-theme';
const DEFAULT_MODE: ThemeMode = 'system';

function loadMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return THEME_MODE_OPTIONS.some((o) => o.value === stored) ? (stored as ThemeMode) : DEFAULT_MODE;
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(loadMode());
  const isDark = ref(false);

  function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function apply() {
    if (mode.value === 'system') {
      document.documentElement.removeAttribute('data-theme');
      isDark.value = systemPrefersDark();
    } else {
      document.documentElement.setAttribute('data-theme', mode.value);
      isDark.value = mode.value === 'dark';
    }
  }

  function init() {
    apply();
    watch(mode, (m) => {
      localStorage.setItem(STORAGE_KEY, m);
      apply();
    });

    // Solange "Systemeinstellung" aktiv ist, isDark (und damit z. B. das Icon im ThemeModeSelect)
    // bei Systemwechsel (z. B. Gerät wechselt abends automatisch in den Dark Mode) synchron halten.
    // Die Farben selbst übernimmt bereits die @media-Regel in style.css unabhängig davon.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (mode.value === 'system') apply();
    });
  }

  return { mode, isDark, init };
});

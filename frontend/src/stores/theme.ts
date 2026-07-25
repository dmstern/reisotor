import { defineStore } from 'pinia';
import { ref } from 'vue';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'reisotor-theme';

export const useThemeStore = defineStore('theme', () => {
  // null = keine explizite Nutzer-Präferenz gespeichert -> die Systemeinstellung greift
  // automatisch über die @media(prefers-color-scheme)-Regel in style.css.
  const explicitMode = ref<ThemeMode | null>(null);
  const isDark = ref(false);

  function systemPrefersDark() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function apply() {
    if (explicitMode.value) {
      document.documentElement.setAttribute('data-theme', explicitMode.value);
      isDark.value = explicitMode.value === 'dark';
    } else {
      document.documentElement.removeAttribute('data-theme');
      isDark.value = systemPrefersDark();
    }
  }

  function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    explicitMode.value = stored === 'light' || stored === 'dark' ? stored : null;
    apply();

    // Solange keine explizite Präferenz gesetzt ist, das Icon bei Systemwechsel (z. B. Gerät
    // wechselt abends automatisch in den Dark Mode) synchron halten. Die Farben selbst
    // übernimmt bereits die @media-Regel in style.css unabhängig davon.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!explicitMode.value) apply();
    });
  }

  function toggle() {
    explicitMode.value = isDark.value ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, explicitMode.value);
    apply();
  }

  return { isDark, init, toggle };
});

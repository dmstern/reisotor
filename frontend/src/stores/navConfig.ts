import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { NAV_LINKS } from '../utils/navLinks';

const STORAGE_KEY = 'reisotor-nav-config';
const CUSTOM_MOBILE_STORAGE_KEY = 'reisotor-nav-config-custom-mobile';
const MOBILE_STORAGE_KEY = 'reisotor-nav-config-mobile';

export interface NavConfigEntry {
  key: string;
  visible: boolean;
}

export function defaultEntries(target: 'desktop' | 'mobile' = 'desktop'): NavConfigEntry[] {
  return NAV_LINKS.map((l) => ({
    key: l.key,
    visible:
      target === 'mobile'
        ? (l.defaultVisibleMobile ?? l.defaultVisible ?? true)
        : (l.defaultVisible ?? true),
  }));
}

function loadEntries(): NavConfigEntry[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return defaultEntries('desktop');
  }
  let parsed: NavConfigEntry[] = [];
  try {
    parsed = JSON.parse(stored);
  } catch {
    return defaultEntries('desktop');
  }
  return sanitizeNavEntries(parsed, 'desktop');
}

function loadCustomMobile(): boolean {
  const stored = localStorage.getItem(CUSTOM_MOBILE_STORAGE_KEY);
  if (stored === null) {
    return true;
  }
  return stored === 'true';
}

function loadMobileEntries(): NavConfigEntry[] {
  const stored = localStorage.getItem(MOBILE_STORAGE_KEY);
  if (!stored) {
    return defaultEntries('mobile');
  }
  let parsed: NavConfigEntry[] = [];
  try {
    parsed = JSON.parse(stored);
  } catch {
    return defaultEntries('mobile');
  }
  return sanitizeNavEntries(parsed, 'mobile');
}

export function sanitizeNavEntries(
  parsed: NavConfigEntry[],
  target: 'desktop' | 'mobile' = 'desktop'
): NavConfigEntry[] {
  const known = new Set(NAV_LINKS.map((l) => l.key));
  const validExisting = parsed.filter((e) => known.has(e.key) && typeof e.visible === 'boolean');
  const existingKeys = new Set(validExisting.map((e) => e.key));
  const missing = NAV_LINKS.filter((l) => !existingKeys.has(l.key)).map((l) => ({
    key: l.key,
    visible:
      target === 'mobile'
        ? (l.defaultVisibleMobile ?? l.defaultVisible ?? true)
        : (l.defaultVisible ?? true),
  }));
  return [...validExisting, ...missing];
}

// Account-Einstellung (Issue #324): Persistiert über /users/me/app-settings.
export const useNavConfigStore = defineStore('navConfig', () => {
  const entries = ref<NavConfigEntry[]>(loadEntries());
  const customMobile = ref<boolean>(loadCustomMobile());
  const mobileEntries = ref<NavConfigEntry[]>(loadMobileEntries());

  watch(entries, (v) => localStorage.setItem(STORAGE_KEY, JSON.stringify(v)), { deep: true });
  watch(customMobile, (v) => {
    localStorage.setItem(CUSTOM_MOBILE_STORAGE_KEY, String(v));
  });
  watch(mobileEntries, (v) => localStorage.setItem(MOBILE_STORAGE_KEY, JSON.stringify(v)), {
    deep: true,
  });

  function setCustomMobile(enabled: boolean | unknown) {
    const val = Boolean(enabled);
    if (
      val &&
      !customMobile.value &&
      !localStorage.getItem(MOBILE_STORAGE_KEY) &&
      !mobileEntries.value?.length
    ) {
      mobileEntries.value = defaultEntries('mobile');
    }
    customMobile.value = val;
  }

  function moveUp(key: string, target: 'desktop' | 'mobile' = 'desktop') {
    const list = target === 'mobile' ? mobileEntries : entries;
    const idx = list.value.findIndex((e) => e.key === key);
    if (idx <= 0) return;
    const copy = [...list.value];
    [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
    list.value = copy;
  }

  function moveDown(key: string, target: 'desktop' | 'mobile' = 'desktop') {
    const list = target === 'mobile' ? mobileEntries : entries;
    const idx = list.value.findIndex((e) => e.key === key);
    if (idx === -1 || idx >= list.value.length - 1) return;
    const copy = [...list.value];
    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
    list.value = copy;
  }

  function setVisible(key: string, visible: boolean, target: 'desktop' | 'mobile' = 'desktop') {
    const list = target === 'mobile' ? mobileEntries : entries;
    const entry = list.value.find((e) => e.key === key);
    if (entry) entry.visible = visible;
  }

  function reset() {
    entries.value = defaultEntries('desktop');
    customMobile.value = true;
    mobileEntries.value = defaultEntries('mobile');
    localStorage.removeItem(CUSTOM_MOBILE_STORAGE_KEY);
    localStorage.removeItem(MOBILE_STORAGE_KEY);
  }

  function getEffectiveEntries(isDesktop: boolean): NavConfigEntry[] {
    if (!isDesktop && customMobile.value) {
      return mobileEntries.value;
    }
    return entries.value;
  }

  return {
    entries,
    customMobile,
    mobileEntries,
    moveUp,
    moveDown,
    setVisible,
    reset,
    getEffectiveEntries,
    setCustomMobile,
  };
});

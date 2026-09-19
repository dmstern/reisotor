import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '../api/client';

// Account-Einstellung statt Geräte-/Browser-UI-Einstellung (#105: war bis dahin analog zu
// stores/calendarSettings.ts/weatherProvider.ts nur in localStorage, was auf einem zweiten Gerät
// immer wieder von vorn eingestellt werden musste). Persistiert über /users/me/icon-settings als
// ein einziger JSON-Blob (siehe backend/src/routes/users.ts) statt Einzelfeldern - das Frontend
// lädt/speichert den gesamten Einstellungs-Zustand immer auf einmal.
export const ICON_STYLE_OPTIONS = [
  { value: 'emoji', label: 'Emoji' },
  { value: 'icons', label: 'Symbole (Tabler)' },
] as const;
export type IconStyle = (typeof ICON_STYLE_OPTIONS)[number]['value'];

export type IconVariant = 'outline' | 'filled';

// Grobe Bereiche, für die sich der Icon-Stil einzeln einstellen lässt (Nutzer-Feedback:
// "Kategorie-Icons per Emoji, Navigation per Tabler" o. ä. soll möglich sein) - jede
// AppIcon.vue-Aufrufstelle ordnet sich über ihren `group`-Prop genau einer davon zu. Es gibt
// bewusst KEINEN globalen Fallback-Wert mehr, jeder Bereich hat immer einen konkreten Wert (siehe
// DEFAULT_GROUPS/groups unten) - ein "für alle Bereiche umstellen"-Aufruf (setAllGroups) ist nur
// ein Bulk-Setter, kein eigener persistenter Zustand.
//
// #168: "Formularfelder" und "Aktionen & Buttons" sind bewusst NICHT (mehr) konfigurierbar -
// Emoji statt SVG sah dort bei Interaktionselementen (Buttons, Dropdowns, Status-Labels) zu
// behämmert aus. Diese beiden Bereiche werden unten in styleForGroup fest auf 'icons' erzwungen.
export const ICON_GROUP_OPTIONS = [
  { value: 'navigation', label: 'Navigation & Dashboard' },
  { value: 'categories', label: 'Kategorien (Kalender, Spots, Reise, Kartenmarker)' },
  { value: 'weather', label: 'Wetter' },
] as const;
export type ConfigurableIconGroup = (typeof ICON_GROUP_OPTIONS)[number]['value'];
// Zusätzlich zu den konfigurierbaren Bereichen oben gibt es 'formFields'/'actions', die
// AppIcon.vue-Aufrufstellen weiterhin als `group`-Prop übergeben, deren Stil aber fest auf SVG
// steht (siehe styleForGroup unten) statt aus dem Store zu kommen.
export type IconGroup = ConfigurableIconGroup | 'formFields' | 'actions';

// Icon-Stil für die nicht (mehr) konfigurierbaren Bereiche - immer SVG, nie Emoji (#168).
const FORCED_STYLE: IconStyle = 'icons';

// Neue Standard-Einstellungen (Issue #74): überall Symbole außer bei Kategorien, die per Default
// bei Emoji bleiben.
const DEFAULT_GROUPS: Record<ConfigurableIconGroup, IconStyle> = {
  navigation: 'icons',
  categories: 'emoji',
  weather: 'icons',
};

interface StoredIconSettings {
  groups: Record<ConfigurableIconGroup, IconStyle>;
  navColored: boolean;
  colorizeWeather: boolean;
  colorizeCategories: boolean;
}

// Validiert jeden Bereich einzeln statt das ganze gespeicherte Objekt zu verwerfen - deckt sowohl
// ganz neue Nutzer:innen (noch nichts gespeichert) als auch Reste in einem älteren/kaputten Format
// robust ab. Alte, vor #168 gespeicherte Blobs können noch 'formFields'/'actions'-Einträge
// enthalten - die werden hier stillschweigend ignoriert, da ICON_GROUP_OPTIONS sie nicht mehr
// auflistet.
function sanitizePerGroup<T extends string>(
  value: unknown,
  validOptions: readonly { value: T }[],
  defaults: Record<ConfigurableIconGroup, T>
): Record<ConfigurableIconGroup, T> {
  const parsed = (value ?? {}) as Partial<Record<ConfigurableIconGroup, unknown>>;
  const result = {} as Record<ConfigurableIconGroup, T>;
  for (const { value: group } of ICON_GROUP_OPTIONS) {
    const candidate = parsed[group];
    result[group] = validOptions.some((o) => o.value === candidate)
      ? (candidate as T)
      : defaults[group];
  }
  return result;
}

export const useIconStyleStore = defineStore('iconStyle', () => {
  const groups = ref<Record<ConfigurableIconGroup, IconStyle>>({ ...DEFAULT_GROUPS });
  const navColoredRaw = ref(true);
  const colorizeWeatherRaw = ref(true);
  const colorizeCategoriesRaw = ref(true);
  const loaded = ref(false);

  // Best effort wie notificationPreferences.ts's update(): der lokale Zustand ist schon
  // (optimistisch) gesetzt, ein Fehler hier verhindert nur die Cross-Device-Synchronisation der
  // aktuellen Änderung, nicht die Bedienung selbst.
  function persist() {
    api
      .put('/users/me/icon-settings', {
        settings: {
          groups: groups.value,
          navColored: navColoredRaw.value,
          colorizeWeather: colorizeWeatherRaw.value,
          colorizeCategories: colorizeCategoriesRaw.value,
        } satisfies StoredIconSettings,
      })
      .catch(() => {});
  }

  // Computed statt einfacher Refs für die drei Einfärbe-Schalter: v-model="iconStyle.navColored"
  // in IconStyleSettings.vue bleibt dadurch unverändert nutzbar, jede Änderung löst zusätzlich
  // persist() aus.
  const navColored = computed({
    get: () => navColoredRaw.value,
    set: (v: boolean) => {
      navColoredRaw.value = v;
      persist();
    },
  });
  const colorizeWeather = computed({
    get: () => colorizeWeatherRaw.value,
    set: (v: boolean) => {
      colorizeWeatherRaw.value = v;
      persist();
    },
  });
  const colorizeCategories = computed({
    get: () => colorizeCategoriesRaw.value,
    set: (v: boolean) => {
      colorizeCategoriesRaw.value = v;
      persist();
    },
  });

  // Lädt die serverseitig gespeicherten Einstellungen einmalig (z. B. beim App-Start nach
  // erfolgreicher Session-Prüfung, siehe router/index.ts) - bis dahin gelten die obigen Defaults,
  // damit AppIcon.vue nie auf einen unfertigen Zustand trifft. Kein erneutes Laden bei
  // wiederholten Aufrufen, ein zwischenzeitlich lokal geänderter Zustand soll dadurch nicht
  // überschrieben werden.
  async function load() {
    if (loaded.value) return;
    try {
      const stored = await api.get<Partial<StoredIconSettings>>('/users/me/icon-settings');
      groups.value = sanitizePerGroup(stored.groups, ICON_STYLE_OPTIONS, DEFAULT_GROUPS);
      if (typeof stored.navColored === 'boolean') navColoredRaw.value = stored.navColored;
      if (typeof stored.colorizeWeather === 'boolean')
        colorizeWeatherRaw.value = stored.colorizeWeather;
      if (typeof stored.colorizeCategories === 'boolean')
        colorizeCategoriesRaw.value = stored.colorizeCategories;
    } catch {
      // Netzwerkfehler/offline: bei den lokalen Defaults bleiben, nächster load()-Aufruf (z. B.
      // nächster App-Start) versucht es erneut.
    } finally {
      loaded.value = true;
    }
  }

  // 'formFields'/'actions' sind seit #168 nicht mehr konfigurierbar - dort immer SVG erzwingen,
  // unabhängig davon, was ggf. noch aus einem alten gespeicherten Blob im Store steht.
  function styleForGroup(group: IconGroup): IconStyle {
    if (group === 'formFields' || group === 'actions') return FORCED_STYLE;
    return groups.value[group];
  }

  function setGroupOverride(group: ConfigurableIconGroup, value: IconStyle) {
    groups.value = { ...groups.value, [group]: value };
    persist();
  }

  function setAllGroups(value: IconStyle) {
    const next = {} as Record<ConfigurableIconGroup, IconStyle>;
    for (const { value: group } of ICON_GROUP_OPTIONS) next[group] = value;
    groups.value = next;
    persist();
  }

  function resetToDefaults() {
    groups.value = { ...DEFAULT_GROUPS };
    navColoredRaw.value = true;
    colorizeWeatherRaw.value = true;
    colorizeCategoriesRaw.value = true;
    persist();
  }

  // Auf einem gemeinsam genutzten Gerät (App ist ursprünglich für zwei Personen pro Haushalt
  // gebaut) darf nach dem Logout NICHT der Zustand der abgemeldeten Person stehen bleiben - anders
  // als bei resetToDefaults() ohne persist() (kein Server-Schreibzugriff mehr ohne Session) und mit
  // `loaded = false`, damit der nächste Login wieder per load() die Einstellungen der neu
  // angemeldeten Person holt statt der zwischenzeitlich lokal gehaltenen der vorigen.
  function clearOnLogout() {
    groups.value = { ...DEFAULT_GROUPS };
    navColoredRaw.value = true;
    colorizeWeatherRaw.value = true;
    colorizeCategoriesRaw.value = true;
    loaded.value = false;
  }

  return {
    groups,
    navColored,
    colorizeWeather,
    colorizeCategories,
    loaded,
    load,
    styleForGroup,
    setGroupOverride,
    setAllGroups,
    resetToDefaults,
    clearOnLogout,
  };
});

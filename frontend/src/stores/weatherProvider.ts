import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

// Open-Meteo bündelt mehrere echte nationale Wetterdienste hinter einer API (models-Parameter,
// siehe utils/weather.ts) – "Wetteranbieter wechseln" bedeutet hier also, welches dieser Modelle
// abgefragt wird, nicht eine zweite komplett eigenständige API-Integration (die meisten
// Alternativen wie Apple WeatherKit/OpenWeatherMap brauchen einen eigenen, kostenpflichtigen
// API-Key). ECMWF ist voreingestellt, weil es sich in der Praxis am ehesten mit dem deckt, was
// Apple Weather (das Google/DuckDuckGo anzeigen) zeigt.
export const WEATHER_MODEL_OPTIONS = [
  { value: 'ecmwf_ifs025', label: 'ECMWF (Europa, empfohlen)' },
  { value: 'best_match', label: 'Automatisch (Open-Meteo Standard)' },
  { value: 'icon_seamless', label: 'ICON (Deutscher Wetterdienst)' },
  { value: 'gfs_seamless', label: 'GFS (USA)' },
  { value: 'meteofrance_seamless', label: 'Météo-France' },
  { value: 'jma_seamless', label: 'JMA (Japan)' },
  { value: 'gem_seamless', label: 'GEM (Kanada)' },
] as const;

export type WeatherModel = (typeof WEATHER_MODEL_OPTIONS)[number]['value'];

const STORAGE_KEY = 'reisotor-weather-model';
const DEFAULT_MODEL: WeatherModel = 'ecmwf_ifs025';

function loadModel(): WeatherModel {
  const stored = localStorage.getItem(STORAGE_KEY);
  return WEATHER_MODEL_OPTIONS.some((o) => o.value === stored) ? (stored as WeatherModel) : DEFAULT_MODEL;
}

// Geräte-/Browser-UI-Einstellung (wie der Dark-Mode-Toggle in stores/theme.ts bzw. die
// Navigationsposition in stores/navPosition.ts) statt Account-Daten: bewusst nur lokal in
// localStorage gehalten, nicht am User-Datensatz im Backend.
export const useWeatherProviderStore = defineStore('weatherProvider', () => {
  const model = ref<WeatherModel>(loadModel());

  watch(model, (v) => localStorage.setItem(STORAGE_KEY, v));

  return { model };
});

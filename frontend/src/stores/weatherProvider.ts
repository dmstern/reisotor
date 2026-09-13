import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useTripStore } from './trip';

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

export const DEFAULT_WEATHER_MODEL: WeatherModel = 'ecmwf_ifs025';

// Das Wettermodell wird pro Urlaub in trips.weather_model gespeichert, damit alle
// Mitreisenden dieselbe Wettervorhersage sehen. Dieser Store stellt das Modell des aktuell
// ausgewählten Urlaubs reaktiv für alle Vorhersage-Komponenten bereit.
export const useWeatherProviderStore = defineStore('weatherProvider', () => {
  const tripStore = useTripStore();

  const model = computed<WeatherModel>(() => {
    const tripModel = tripStore.currentTrip?.weather_model;
    return WEATHER_MODEL_OPTIONS.some((o) => o.value === tripModel)
      ? (tripModel as WeatherModel)
      : DEFAULT_WEATHER_MODEL;
  });

  return { model };
});

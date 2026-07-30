import type { Accommodation, Trip } from '../api/types';
import type { DailyWeather } from './weather';

export interface WeatherLocation {
  key: string;
  lat: number;
  lng: number;
}

export interface DayWeatherEntry {
  key: string;
  label: string;
  icon: string;
  weather: DailyWeather;
}

/** Sammelt alle Orte, für die Wetterdaten geladen werden müssen: Zuhause (sofern als Ort mit
 *  is_home hinterlegt und mit Koordinaten), das allgemeine Reiseziel (Urlaub-Stammdaten) und jede
 *  Unterkunft mit eigenen Koordinaten (z. B. mehrere Unterkünfte bei einem Roadtrip). */
export function collectWeatherLocations(
  trip: Trip | null,
  home: { lat: number; lng: number } | null,
  accommodations: Accommodation[],
): WeatherLocation[] {
  const locations: WeatherLocation[] = [];
  if (home) locations.push({ key: 'home', lat: home.lat, lng: home.lng });
  if (trip?.lat != null && trip?.lng != null) locations.push({ key: 'destination', lat: trip.lat, lng: trip.lng });
  for (const a of accommodations) {
    if (a.lat != null && a.lng != null) locations.push({ key: `accommodation-${a.id}`, lat: a.lat, lng: a.lng });
  }
  return locations;
}

/** Bestimmt, welche(s) Wetter für einen Kalendertag angezeigt werden soll – nicht pro einzelnem
 *  Ort, sondern pro "Rolle": An Urlaubstagen (Tag liegt im Urlaubszeitraum ODER eine Unterkunft ist
 *  an dem Tag aktiv) nur der jeweilige Urlaubsort, möglichst konkret die an dem Tag aktive
 *  Unterkunft, sonst ersatzweise das allgemeine Reiseziel. An allen anderen Tagen (z. B.
 *  Vorbereitungstage vor der Abreise, Tage nach der Rückkehr) beides zusammen: Zuhause UND
 *  Reiseziel, sofern jeweils bekannt. */
export function dayWeatherEntries(
  date: string,
  trip: Trip | null,
  accommodations: Accommodation[],
  weatherByLocation: Map<string, DailyWeather[]>,
): DayWeatherEntry[] {
  const lookup = (key: string) => weatherByLocation.get(key)?.find((d) => d.date === date);

  const accommodation = accommodations.find(
    (a) => a.start_date && a.end_date && a.start_date <= date && date <= a.end_date && a.lat != null && a.lng != null,
  );
  const isVacationRange = !!trip && date >= trip.start_date && date <= trip.end_date;

  if (accommodation || isVacationRange) {
    if (accommodation) {
      const weather = lookup(`accommodation-${accommodation.id}`);
      return weather ? [{ key: `accommodation-${accommodation.id}`, label: 'Urlaubsort', icon: '🏖️', weather }] : [];
    }
    const weather = trip ? lookup('destination') : undefined;
    return weather ? [{ key: 'destination', label: 'Urlaubsort', icon: '🏖️', weather }] : [];
  }

  const entries: DayWeatherEntry[] = [];
  const home = lookup('home');
  if (home) entries.push({ key: 'home', label: 'Zuhause', icon: '🏠', weather: home });
  const destination = lookup('destination');
  if (destination) entries.push({ key: 'destination', label: 'Urlaubsort', icon: '🏖️', weather: destination });
  return entries;
}

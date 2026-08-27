import { IconBeach, IconHome, IconHomeFilled } from '@tabler/icons-vue';
import type { Spot, Trip } from '../api/types';
import type { DailyWeather } from './weather';
import type { IconDef } from './icon';

export interface WeatherLocation {
  key: string;
  lat: number;
  lng: number;
}

export interface DayWeatherEntry {
  key: string;
  label: string;
  icon: string;
  tabler: IconDef;
  weather: DailyWeather;
}

const VACATION_PLACE_ICON: IconDef = { id: 'beach', emoji: '🏖️', outline: IconBeach };
const HOME_ICON: IconDef = { id: 'home', emoji: '🏠', outline: IconHome, filled: IconHomeFilled };

/** Sammelt alle Orte, für die Wetterdaten geladen werden müssen: Zuhause (sofern als Ort mit
 *  is_home hinterlegt und mit Koordinaten), das allgemeine Reiseziel (Urlaub-Stammdaten) und jede
 *  Unterkunft mit eigenen Koordinaten (z. B. mehrere Unterkünfte bei einem Roadtrip). `accommodations`
 *  sind Spots der Kategorie "Unterkunft" (siehe Migrationskommentar in db/index.ts). */
export function collectWeatherLocations(
  trip: Trip | null,
  home: { lat: number; lng: number } | null,
  accommodations: Spot[]
): WeatherLocation[] {
  const locations: WeatherLocation[] = [];
  if (home) locations.push({ key: 'home', lat: home.lat, lng: home.lng });
  if (trip?.lat != null && trip?.lng != null)
    locations.push({ key: 'destination', lat: trip.lat, lng: trip.lng });
  for (const a of accommodations) {
    if (a.lat != null && a.lng != null)
      locations.push({ key: `accommodation-${a.id}`, lat: a.lat, lng: a.lng });
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
  accommodations: Spot[],
  weatherByLocation: Map<string, DailyWeather[]>
): DayWeatherEntry[] {
  const lookup = (key: string) => weatherByLocation.get(key)?.find((d) => d.date === date);

  const accommodation = accommodations.find(
    (a) =>
      a.start_date &&
      a.end_date &&
      a.start_date <= date &&
      date <= a.end_date &&
      a.lat != null &&
      a.lng != null
  );
  const isVacationRange =
    !!trip &&
    !!trip.start_date &&
    !!trip.end_date &&
    date >= trip.start_date &&
    date <= trip.end_date;

  if (accommodation || isVacationRange) {
    if (accommodation) {
      const weather = lookup(`accommodation-${accommodation.id}`);
      return weather
        ? [
            {
              key: `accommodation-${accommodation.id}`,
              label: 'Urlaubsort',
              icon: '🏖️',
              tabler: VACATION_PLACE_ICON,
              weather,
            },
          ]
        : [];
    }
    const weather = trip ? lookup('destination') : undefined;
    return weather
      ? [
          {
            key: 'destination',
            label: 'Urlaubsort',
            icon: '🏖️',
            tabler: VACATION_PLACE_ICON,
            weather,
          },
        ]
      : [];
  }

  const entries: DayWeatherEntry[] = [];
  const home = lookup('home');
  if (home)
    entries.push({ key: 'home', label: 'Zuhause', icon: '🏠', tabler: HOME_ICON, weather: home });
  const destination = lookup('destination');
  if (destination)
    entries.push({
      key: 'destination',
      label: 'Urlaubsort',
      icon: '🏖️',
      tabler: VACATION_PLACE_ICON,
      weather: destination,
    });
  return entries;
}

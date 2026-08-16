import {
  IconSun,
  IconSunFilled,
  IconCloud,
  IconCloudFilled,
  IconCloudRain,
  IconCloudSnow,
  IconCloudFog,
  IconCloudStorm,
  IconSnowflake,
  IconTemperature,
  IconDroplet,
  IconBolt,
} from '@tabler/icons-vue';
import { api } from '../api/client';
import { toLocalDateString } from './dateFormat';
import type { IconDef } from './icon';

// Wettervorhersage über Open-Meteo (kostenlos, kein API-Key nötig, CORS-freundlich für direkte
// Browser-Aufrufe) – deckt nur die kommenden ~16 Tage plus wenige Tage rückwirkend ab, für weiter
// entfernte Urlaube liefert die Abfrage entsprechend keine (oder nur teilweise) Tage im
// Urlubszeitraum zurück; das filtert der Aufrufer (DashboardView.vue) selbst gegen die Trip-Daten.
export interface DailyWeather {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number | null;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    weathercode: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max?: number[];
  };
}

// Tabler deckt Wetter-Nuancen (z. B. gefrierend vs. normal) nicht 1:1 ab - mehrere Codes teilen sich
// deshalb bewusst dasselbe IconDef, das Emoji bleibt weiterhin pro Code eindeutig.
const ICON_SUN: IconDef = { id: 'sun', emoji: '☀️', outline: IconSun, filled: IconSunFilled };
const ICON_CLOUD: IconDef = { id: 'cloud', emoji: '⛅', outline: IconCloud, filled: IconCloudFilled };
const ICON_RAIN: IconDef = { id: 'cloud-rain', emoji: '🌧️', outline: IconCloudRain };
const ICON_SNOW: IconDef = { id: 'cloud-snow', emoji: '🌨️', outline: IconCloudSnow };
const ICON_SNOWFLAKE: IconDef = { id: 'snowflake', emoji: '❄️', outline: IconSnowflake };
const ICON_FOG: IconDef = { id: 'cloud-fog', emoji: '🌫️', outline: IconCloudFog };
const ICON_STORM: IconDef = { id: 'cloud-storm', emoji: '⛈️', outline: IconCloudStorm };
const ICON_UNKNOWN: IconDef = { id: 'temperature', emoji: '🌡️', outline: IconTemperature };
const ICON_DROPLET: IconDef = { id: 'droplet', emoji: '💧', outline: IconDroplet };
const ICON_BOLT: IconDef = { id: 'bolt', emoji: '⚡', outline: IconBolt };

// Passend zur jeweiligen Wetter-Bedingung (Issue #74: "sonne gelb, wolken grau, regentropfen blau,
// blitze gelb"), genutzt von components/WeatherIcon.vue, wenn stores/iconStyle.ts's
// colorizeWeather aktiv ist.
const COLOR_SUN = '#f5b100';
const COLOR_CLOUD = '#8a94a6';
const COLOR_RAIN = '#3b82f6';
const COLOR_SNOW = '#7dd3fc';
const COLOR_BOLT = '#f5b100';

export interface WeatherIconPart {
  icon: IconDef;
  color: string;
}

export interface WeatherCodeMeta {
  icon: string;
  label: string;
  tabler: IconDef;
  /** Einfarbige Codes (nur Sonne/Wolke/Nebel/Schneeflocke): Akzentfarbe fürs ganze Icon. */
  color: string;
  /** Mehrteilige Codes (Regen/Schneefall/Gewitter): Basis- + Akzent-Icon je mit eigener Farbe,
   *  siehe components/WeatherIcon.vue. Fehlt bei einteiligen Codes. */
  parts?: [WeatherIconPart, WeatherIconPart];
}

const WEATHER_CODE_META: Record<number, WeatherCodeMeta> = {
  0: { icon: '☀️', label: 'Klar', tabler: ICON_SUN, color: COLOR_SUN },
  1: { icon: '🌤️', label: 'Überwiegend klar', tabler: ICON_SUN, color: COLOR_SUN },
  2: { icon: '⛅', label: 'Teilweise bewölkt', tabler: ICON_CLOUD, color: COLOR_CLOUD },
  3: { icon: '☁️', label: 'Bedeckt', tabler: ICON_CLOUD, color: COLOR_CLOUD },
  45: { icon: '🌫️', label: 'Nebel', tabler: ICON_FOG, color: COLOR_CLOUD },
  48: { icon: '🌫️', label: 'Reifnebel', tabler: ICON_FOG, color: COLOR_CLOUD },
  51: { icon: '🌦️', label: 'Leichter Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  53: { icon: '🌦️', label: 'Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  55: { icon: '🌧️', label: 'Starker Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  56: { icon: '🌧️', label: 'Gefrierender Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  57: { icon: '🌧️', label: 'Starker gefrierender Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  61: { icon: '🌦️', label: 'Leichter Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  63: { icon: '🌧️', label: 'Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  65: { icon: '🌧️', label: 'Starker Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  66: { icon: '🌧️', label: 'Gefrierender Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  67: { icon: '🌧️', label: 'Starker gefrierender Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  71: { icon: '🌨️', label: 'Leichter Schneefall', tabler: ICON_SNOW, color: COLOR_SNOW, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_SNOWFLAKE, color: COLOR_SNOW }] },
  73: { icon: '🌨️', label: 'Schneefall', tabler: ICON_SNOW, color: COLOR_SNOW, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_SNOWFLAKE, color: COLOR_SNOW }] },
  75: { icon: '❄️', label: 'Starker Schneefall', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  77: { icon: '❄️', label: 'Schneegriesel', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  80: { icon: '🌦️', label: 'Leichte Regenschauer', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  81: { icon: '🌧️', label: 'Regenschauer', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN }] },
  82: { icon: '⛈️', label: 'Heftige Regenschauer', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT }] },
  85: { icon: '🌨️', label: 'Leichte Schneeschauer', tabler: ICON_SNOW, color: COLOR_SNOW, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_SNOWFLAKE, color: COLOR_SNOW }] },
  86: { icon: '❄️', label: 'Starke Schneeschauer', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  95: { icon: '⛈️', label: 'Gewitter', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT }] },
  96: { icon: '⛈️', label: 'Gewitter mit Hagel', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT }] },
  99: { icon: '⛈️', label: 'Starkes Gewitter mit Hagel', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT }] },
};

const UNKNOWN_META: WeatherCodeMeta = { icon: '🌡️', label: 'Unbekannt', tabler: ICON_UNKNOWN, color: COLOR_CLOUD };

export function weatherCodeMeta(code: number): WeatherCodeMeta {
  return WEATHER_CODE_META[code] ?? UNKNOWN_META;
}

// Einfacher Modul-Cache statt Store: pro (gerundeter) Koordinate+Modell reicht ein Fetch pro
// Session, die Vorhersage ändert sich nicht innerhalb eines Dashboard-Aufrufs.
let cache: { key: string; promise: Promise<DailyWeather[]> } | null = null;

// model: welches der von Open-Meteo gebündelten Wettermodelle (siehe stores/weatherProvider.ts)
// abgefragt wird – ECMWF IFS als Default, da es sich in der Praxis am ehesten mit dem deckt, was
// kommerzielle Wetter-Apps (Apple Weather/Google) zeigen (ein Nutzer hatte abweichende Werte/
// Symbole gegenüber Apple Weather bemerkt, v. a. bei der Bewölkung, dem modellsensibelsten Wert
// überhaupt). In den Einstellungen (ProfileView.vue) auf ein anderes Modell umstellbar.
export function fetchWeatherForecast(lat: number, lng: number, model = 'ecmwf_ifs025'): Promise<DailyWeather[]> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${model}`;
  if (cache?.key === key) return cache.promise;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    past_days: '1',
    forecast_days: '16',
    models: model,
  });
  const promise = fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    .then((res) => {
      if (!res.ok) throw new Error(`Wetterdaten konnten nicht geladen werden (${res.status})`);
      return res.json() as Promise<OpenMeteoResponse>;
    })
    .then((data) =>
      data.daily.time.map((date, i) => ({
        date,
        weatherCode: data.daily.weathercode[i],
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipitationProbability: data.daily.precipitation_probability_max?.[i] ?? null,
      })),
    );
  cache = { key, promise };
  // Bei einem Fehlschlag darf der Cache nicht "vergiftet" bleiben – sonst würde ein erneuter
  // Versuch (z. B. nächster Dashboard-Besuch) nie wieder einen neuen Fetch auslösen.
  promise.catch(() => {
    if (cache?.key === key) cache = null;
  });
  return promise;
}

interface WeatherHistoryRow {
  date: string;
  weathercode: number;
  temp_max: number;
  temp_min: number;
  precipitation_probability: number | null;
}

// Ergänzt die live von Open-Meteo geholte Vorhersage (deckt nur ~16 Tage im Voraus + 1 Tag
// rückwirkend ab) um dauerhaft gespeicherte Ist-Werte vergangener Tage (backend/src/
// weatherSnapshots.ts, GET /trips/:id/weather-history) – dadurch bleibt das Wetter eines Urlaubs
// auch lange nach dessen Ende noch anzeigbar. Für "heute"/Zukunft bleibt weiterhin die Live-Vorhersage
// maßgeblich (die gespeicherten Snapshots decken ohnehin nur strikt vergangene, abgeschlossene Tage
// ab, siehe dortiger Kommentar). Ein Fehlschlag der History-Abfrage darf die Live-Vorhersage nicht
// verhindern – deshalb kein Promise.all, sondern beide unabhängig behandelt.
export async function fetchMergedWeather(tripId: number, lat: number, lng: number, model?: string): Promise<DailyWeather[]> {
  const [live, history] = await Promise.all([
    fetchWeatherForecast(lat, lng, model),
    api.get<WeatherHistoryRow[]>(`/trips/${tripId}/weather-history`).catch(() => [] as WeatherHistoryRow[]),
  ]);

  const today = toLocalDateString(new Date());
  const byDate = new Map<string, DailyWeather>();
  for (const day of live) byDate.set(day.date, day);
  for (const row of history) {
    if (row.date >= today) continue; // Live-Vorhersage bleibt für heute/Zukunft maßgeblich
    byDate.set(row.date, {
      date: row.date,
      weatherCode: row.weathercode,
      tempMax: row.temp_max,
      tempMin: row.temp_min,
      precipitationProbability: row.precipitation_probability,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

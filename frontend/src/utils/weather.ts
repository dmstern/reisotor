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
  IconDropletFilled,
  IconBolt,
  IconBoltFilled,
} from '@tabler/icons-vue';
import { api } from '../api/client';
import { DEMO_MODE } from '../demo/isDemoMode';
import { formatDate as formatDateShared, toLocalDateString } from './dateFormat';
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
// filled statt outline für beide (siehe WeatherIconPart.forceFilled unten): als kleines Akzent-Icon
// über einer Wolke überlagern sich sonst zwei Outline-Umrisse (Wolke + Tropfen/Blitz) unschön.
const ICON_DROPLET: IconDef = { id: 'droplet', emoji: '💧', outline: IconDroplet, filled: IconDropletFilled };
const ICON_BOLT: IconDef = { id: 'bolt', emoji: '⚡', outline: IconBolt, filled: IconBoltFilled };

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
  /** Erzwingt "Gefüllt" für dieses Teil-Icon (Regentropfen/Blitz), unabhängig von der pro Bereich
   *  eingestellten Variante - siehe components/WeatherIcon.vue. */
  forceFilled?: boolean;
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
  51: { icon: '🌦️', label: 'Leichter Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  53: { icon: '🌦️', label: 'Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  55: { icon: '🌧️', label: 'Starker Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  56: { icon: '🌧️', label: 'Gefrierender Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  57: { icon: '🌧️', label: 'Starker gefrierender Nieselregen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  61: { icon: '🌦️', label: 'Leichter Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  63: { icon: '🌧️', label: 'Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  65: { icon: '🌧️', label: 'Starker Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  66: { icon: '🌧️', label: 'Gefrierender Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  67: { icon: '🌧️', label: 'Starker gefrierender Regen', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  71: { icon: '🌨️', label: 'Leichter Schneefall', tabler: ICON_SNOW, color: COLOR_SNOW, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_SNOWFLAKE, color: COLOR_SNOW }] },
  73: { icon: '🌨️', label: 'Schneefall', tabler: ICON_SNOW, color: COLOR_SNOW, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_SNOWFLAKE, color: COLOR_SNOW }] },
  75: { icon: '❄️', label: 'Starker Schneefall', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  77: { icon: '❄️', label: 'Schneegriesel', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  80: { icon: '🌦️', label: 'Leichte Regenschauer', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  81: { icon: '🌧️', label: 'Regenschauer', tabler: ICON_RAIN, color: COLOR_RAIN, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true }] },
  82: { icon: '⛈️', label: 'Heftige Regenschauer', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true }] },
  85: { icon: '🌨️', label: 'Leichte Schneeschauer', tabler: ICON_SNOW, color: COLOR_SNOW, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_SNOWFLAKE, color: COLOR_SNOW }] },
  86: { icon: '❄️', label: 'Starke Schneeschauer', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  95: { icon: '⛈️', label: 'Gewitter', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true }] },
  96: { icon: '⛈️', label: 'Gewitter mit Hagel', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true }] },
  99: { icon: '⛈️', label: 'Starkes Gewitter mit Hagel', tabler: ICON_STORM, color: COLOR_BOLT, parts: [{ icon: ICON_CLOUD, color: COLOR_CLOUD }, { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true }] },
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
// überhaupt). In den Einstellungen (SettingsView.vue) auf ein anderes Modell umstellbar.
// Deterministisches, überwiegend sonniges Muster (kein echter Netzwerk-Zugriff im backend-losen
// Demo-Build, siehe demoClient.ts) - sorgt dafür, dass sowohl die echte Live-Demo als auch daraus
// erzeugte Marketing-Screenshots (siehe DESIGN.md) eine plausible Wetterkarte statt der sonst
// sichtbaren "Wetterdaten konnten nicht geladen werden"-Fehlermeldung zeigen.
const DEMO_WEATHER_PATTERN: Pick<DailyWeather, 'weatherCode' | 'tempMax' | 'tempMin' | 'precipitationProbability'>[] = [
  { weatherCode: 0, tempMax: 27, tempMin: 18, precipitationProbability: 5 },
  { weatherCode: 0, tempMax: 28, tempMin: 19, precipitationProbability: 5 },
  { weatherCode: 1, tempMax: 26, tempMin: 18, precipitationProbability: 10 },
  { weatherCode: 2, tempMax: 24, tempMin: 17, precipitationProbability: 20 },
  { weatherCode: 0, tempMax: 29, tempMin: 19, precipitationProbability: 5 },
];

function demoWeatherForecast(): DailyWeather[] {
  const start = new Date();
  start.setDate(start.getDate() - 1); // past_days: 1, siehe echte Abfrage unten
  return Array.from({ length: 17 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return { date: toLocalDateString(date), ...DEMO_WEATHER_PATTERN[i % DEMO_WEATHER_PATTERN.length] };
  });
}

export function fetchWeatherForecast(lat: number, lng: number, model = 'ecmwf_ifs025'): Promise<DailyWeather[]> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)},${model}`;
  if (cache?.key === key) return cache.promise;

  if (DEMO_MODE) {
    const promise = Promise.resolve(demoWeatherForecast());
    cache = { key, promise };
    return promise;
  }

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
  lat?: number;
  lng?: number;
  weathercode: number;
  temp_max: number;
  temp_min: number;
  precipitation_probability: number | null;
}

// Ergänzt die live von Open-Meteo geholte Vorhersage (deckt nur ~16 Tage im Voraus + 1 Tag
// rückwirkend ab) um dauerhaft gespeicherte Ist-Werte vergangener Tage (backend/src/
// weatherSnapshots.ts, GET /trips/:id/weather-history) – dadurch bleibt das Wetter eines Urlaubs
// auch lange nach dessen Ende noch anzeigbar. Für "heute"/Zukunft bleibt weiterhin die Live-Vorhersage
// maßgeblich.
export async function fetchMergedWeather(tripId: number, lat: number, lng: number, model?: string): Promise<DailyWeather[]> {
  const [live, history] = await Promise.all([
    fetchWeatherForecast(lat, lng, model),
    api.get<WeatherHistoryRow[]>(`/trips/${tripId}/weather-history`).catch(() => [] as WeatherHistoryRow[]),
  ]);

  const today = toLocalDateString(new Date());
  const byDate = new Map<string, DailyWeather>();
  for (const day of live) byDate.set(day.date, day);

  // Filtere nach passende Standort-Snapshots, falls Ortskoordinaten in der Historie vorliegen
  const matchingHistory = history.filter((row) => {
    if (row.lat == null || row.lng == null) return true;
    return Math.abs(row.lat - lat) < 0.05 && Math.abs(row.lng - lng) < 0.05;
  });

  for (const row of matchingHistory) {
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

export interface WeatherRangeSummary {
  weatherCode: number;
  tempMaxMin: number;
  tempMaxMax: number;
  tempLabel: string;
}

const WEATHER_CODE_SEVERITY_ORDER = [99, 96, 95, 82, 81, 80, 67, 66, 65, 63, 61, 57, 56, 55, 53, 51, 86, 85, 75, 73, 71, 77, 48, 45, 3, 2, 1, 0];

/** Bildet aus mehreren Tageswetter-Messungen (z. B. für eine Tour mit mehreren Stationen) eine
 *  zusammenfassende Temperatur-Range und bestimmt das prägnanteste Wetter-Icon (Issue #152). */
export function summarizeWeatherRange(weathers: DailyWeather[]): WeatherRangeSummary | null {
  if (!weathers.length) return null;
  const temps = weathers.map((w) => Math.round(w.tempMax));
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const tempLabel = minTemp === maxTemp ? `${minTemp}°` : `${minTemp}°–${maxTemp}°`;

  let bestCode = weathers[0].weatherCode;
  let bestIdx = WEATHER_CODE_SEVERITY_ORDER.indexOf(bestCode);
  if (bestIdx === -1) bestIdx = 999;

  for (let i = 1; i < weathers.length; i++) {
    const code = weathers[i].weatherCode;
    let idx = WEATHER_CODE_SEVERITY_ORDER.indexOf(code);
    if (idx === -1) idx = 999;
    if (idx < bestIdx) {
      bestCode = code;
      bestIdx = idx;
    }
  }

  return {
    weatherCode: bestCode,
    tempMaxMin: minTemp,
    tempMaxMax: maxTemp,
    tempLabel,
  };
}

export interface WeatherAlert {
  id: string;
  type: 'heat' | 'storm' | 'rain' | 'snow' | 'cold';
  severity: 'warning' | 'danger';
  title: string;
  description: string;
  date: string;
}

/** Erkenne Unwetter- / Wetter-Warnungen (Sturm, extreme Hitze, Starkregen, Schneefall, Kälte)
 *  aus den Vorhersage-Daten für das Dashboard (Issue #134). */
export function detectWeatherAlerts(forecast: DailyWeather[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const today = toLocalDateString(new Date());

  for (const day of forecast) {
    if (day.date < today) continue;
    const formattedDate = formatDateShared(day.date, { includeYear: false });

    // Hitze
    if (day.tempMax >= 35) {
      alerts.push({
        id: `heat-danger-${day.date}`,
        type: 'heat',
        severity: 'danger',
        title: 'Extreme Hitze-Warnung',
        description: `Extreme Hitze bis zu ${Math.round(day.tempMax)}°C am ${formattedDate} erwartet.`,
        date: day.date,
      });
    } else if (day.tempMax >= 31) {
      alerts.push({
        id: `heat-warning-${day.date}`,
        type: 'heat',
        severity: 'warning',
        title: 'Hitze-Warnung',
        description: `Hohe Temperaturen bis zu ${Math.round(day.tempMax)}°C am ${formattedDate}.`,
        date: day.date,
      });
    }

    // Gewitter / Unwetter / Starkregen
    if ([95, 96, 99].includes(day.weatherCode)) {
      alerts.push({
        id: `storm-${day.date}`,
        type: 'storm',
        severity: 'danger',
        title: 'Gewitter- / Unwetter-Warnung',
        description: `Schwere Gewitter oder Sturmböen am ${formattedDate} erwartet.`,
        date: day.date,
      });
    } else if ([82, 65, 67].includes(day.weatherCode)) {
      alerts.push({
        id: `rain-${day.date}`,
        type: 'rain',
        severity: 'warning',
        title: 'Starkregen-Warnung',
        description: `Heftiger Niederschlag am ${formattedDate} vorhergesagt.`,
        date: day.date,
      });
    } else if ([75, 86].includes(day.weatherCode)) {
      alerts.push({
        id: `snow-${day.date}`,
        type: 'snow',
        severity: 'warning',
        title: 'Starker Schneefall',
        description: `Intensiver Schneefall am ${formattedDate} erwartet.`,
        date: day.date,
      });
    }

    // Kälte
    if (day.tempMin <= -10) {
      alerts.push({
        id: `cold-${day.date}`,
        type: 'cold',
        severity: 'warning',
        title: 'Extreme Kälte-Warnung',
        description: `Temperaturen fallen bis zu ${Math.round(day.tempMin)}°C am ${formattedDate}.`,
        date: day.date,
      });
    }
  }

  return alerts;
}

export interface HourlyWeather {
  time: string;
  temp: number;
  weatherCode: number;
  precipitationProbability: number | null;
}

interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[];
    weathercode: number[];
    temperature_2m: number[];
    precipitation_probability_max?: number[];
    precipitation_probability?: number[];
  };
}

/** Holt stündliche Wetterdaten für die Tages-Detail-Ansicht (Issue #133). */
export async function fetchHourlyForecast(lat: number, lng: number, date: string, model = 'ecmwf_ifs025'): Promise<HourlyWeather[]> {
  if (DEMO_MODE) {
    const hours = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
    const demoPattern = [
      { temp: 18, weatherCode: 0, precipitationProbability: 5 },
      { temp: 22, weatherCode: 0, precipitationProbability: 5 },
      { temp: 26, weatherCode: 1, precipitationProbability: 10 },
      { temp: 27, weatherCode: 2, precipitationProbability: 15 },
      { temp: 24, weatherCode: 0, precipitationProbability: 5 },
      { temp: 20, weatherCode: 0, precipitationProbability: 5 },
    ];
    return hours.map((h, i) => ({ time: h, ...demoPattern[i % demoPattern.length] }));
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: 'weathercode,temperature_2m,precipitation_probability',
    timezone: 'auto',
    start_date: date,
    end_date: date,
    models: model,
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Stündliche Wetterdaten konnten nicht geladen werden (${res.status})`);
  const data = (await res.json()) as OpenMeteoHourlyResponse;

  const result: HourlyWeather[] = [];
  if (data.hourly?.time) {
    data.hourly.time.forEach((t, i) => {
      const hourStr = t.split('T')[1] ?? '';
      const hourNum = parseInt(hourStr.split(':')[0], 10);
      if ([6, 9, 12, 15, 18, 21].includes(hourNum)) {
        result.push({
          time: hourStr,
          temp: Math.round(data.hourly.temperature_2m[i]),
          weatherCode: data.hourly.weathercode[i],
          precipitationProbability: data.hourly.precipitation_probability?.[i] ?? null,
        });
      }
    });
  }
  return result;
}


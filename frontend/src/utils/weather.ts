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

// Wettervorhersage über den Backend-Proxy (/api/weather -> Open-Meteo, kostenlos, kein API-Key
// nötig, keine Weitergabe der Client-IP an Dritte) – deckt nur die kommenden ~16 Tage plus wenige
// Tage rückwirkend ab, für weiter entfernte Urlaube liefert die Abfrage entsprechend keine (oder
// nur teilweise) Tage im Urlaubszeitraum zurück; das filtert der Aufrufer (DashboardView.vue)
// selbst gegen die Trip-Daten.
export interface DailyWeather {
  date: string;
  weatherCode: number | null;
  tempMax: number | null;
  tempMin: number | null;
  precipitationProbability: number | null;
}

interface OpenMeteoResponse {
  daily: {
    time: string[];
    weathercode: (number | null)[];
    temperature_2m_max: (number | null)[];
    temperature_2m_min: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

// Tabler deckt Wetter-Nuancen (z. B. gefrierend vs. normal) nicht 1:1 ab - mehrere Codes teilen sich
// deshalb bewusst dasselbe IconDef, das Emoji bleibt weiterhin pro Code eindeutig.
const ICON_SUN: IconDef = { id: 'sun', emoji: '☀️', outline: IconSun, filled: IconSunFilled };
const ICON_CLOUD: IconDef = {
  id: 'cloud',
  emoji: '⛅',
  outline: IconCloud,
  filled: IconCloudFilled,
};
const ICON_RAIN: IconDef = { id: 'cloud-rain', emoji: '🌧️', outline: IconCloudRain };
const ICON_SNOW: IconDef = { id: 'cloud-snow', emoji: '🌨️', outline: IconCloudSnow };
const ICON_SNOWFLAKE: IconDef = { id: 'snowflake', emoji: '❄️', outline: IconSnowflake };
const ICON_FOG: IconDef = { id: 'cloud-fog', emoji: '🌫️', outline: IconCloudFog };
const ICON_STORM: IconDef = { id: 'cloud-storm', emoji: '⛈️', outline: IconCloudStorm };
const ICON_UNKNOWN: IconDef = { id: 'temperature', emoji: '🌡️', outline: IconTemperature };
// filled statt outline für beide (siehe WeatherIconPart.forceFilled unten): als kleines Akzent-Icon
// über einer Wolke überlagern sich sonst zwei Outline-Umrisse (Wolke + Tropfen/Blitz) unschön.
const ICON_DROPLET: IconDef = {
  id: 'droplet',
  emoji: '💧',
  outline: IconDroplet,
  filled: IconDropletFilled,
};
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
  51: {
    icon: '🌦️',
    label: 'Leichter Nieselregen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  53: {
    icon: '🌦️',
    label: 'Nieselregen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  55: {
    icon: '🌧️',
    label: 'Starker Nieselregen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  56: {
    icon: '🌧️',
    label: 'Gefrierender Nieselregen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  57: {
    icon: '🌧️',
    label: 'Starker gefrierender Nieselregen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  61: {
    icon: '🌦️',
    label: 'Leichter Regen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  63: {
    icon: '🌧️',
    label: 'Regen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  65: {
    icon: '🌧️',
    label: 'Starker Regen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  66: {
    icon: '🌧️',
    label: 'Gefrierender Regen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  67: {
    icon: '🌧️',
    label: 'Starker gefrierender Regen',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  71: {
    icon: '🌨️',
    label: 'Leichter Schneefall',
    tabler: ICON_SNOW,
    color: COLOR_SNOW,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_SNOWFLAKE, color: COLOR_SNOW },
    ],
  },
  73: {
    icon: '🌨️',
    label: 'Schneefall',
    tabler: ICON_SNOW,
    color: COLOR_SNOW,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_SNOWFLAKE, color: COLOR_SNOW },
    ],
  },
  75: { icon: '❄️', label: 'Starker Schneefall', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  77: { icon: '❄️', label: 'Schneegriesel', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  80: {
    icon: '🌦️',
    label: 'Leichte Regenschauer',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  81: {
    icon: '🌧️',
    label: 'Regenschauer',
    tabler: ICON_RAIN,
    color: COLOR_RAIN,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_DROPLET, color: COLOR_RAIN, forceFilled: true },
    ],
  },
  82: {
    icon: '⛈️',
    label: 'Heftige Regenschauer',
    tabler: ICON_STORM,
    color: COLOR_BOLT,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true },
    ],
  },
  85: {
    icon: '🌨️',
    label: 'Leichte Schneeschauer',
    tabler: ICON_SNOW,
    color: COLOR_SNOW,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_SNOWFLAKE, color: COLOR_SNOW },
    ],
  },
  86: { icon: '❄️', label: 'Starke Schneeschauer', tabler: ICON_SNOWFLAKE, color: COLOR_SNOW },
  95: {
    icon: '⛈️',
    label: 'Gewitter',
    tabler: ICON_STORM,
    color: COLOR_BOLT,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true },
    ],
  },
  96: {
    icon: '⛈️',
    label: 'Gewitter mit Hagel',
    tabler: ICON_STORM,
    color: COLOR_BOLT,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true },
    ],
  },
  99: {
    icon: '⛈️',
    label: 'Starkes Gewitter mit Hagel',
    tabler: ICON_STORM,
    color: COLOR_BOLT,
    parts: [
      { icon: ICON_CLOUD, color: COLOR_CLOUD },
      { icon: ICON_BOLT, color: COLOR_BOLT, forceFilled: true },
    ],
  },
};

const UNKNOWN_META: WeatherCodeMeta = {
  icon: '🌡️',
  label: 'Unbekannt',
  tabler: ICON_UNKNOWN,
  color: COLOR_CLOUD,
};

export function weatherCodeMeta(code?: number | null): WeatherCodeMeta {
  if (code == null) {
    return UNKNOWN_META;
  }

  return WEATHER_CODE_META[code] ?? UNKNOWN_META;
}

export function formatWeatherTemp(temp?: number | null): string {
  if (temp == null || Number.isNaN(temp)) {
    return '–';
  }

  return `${Math.round(temp)}°`;
}

export function formatWeatherTempRange(tempMax?: number | null, tempMin?: number | null): string {
  if (tempMax == null && tempMin == null) {
    return '–';
  }

  if (tempMax != null && tempMin != null) {
    return `${Math.round(tempMax)}° / ${Math.round(tempMin)}°`;
  }

  if (tempMax != null) {
    return `${Math.round(tempMax)}°`;
  }

  return `${Math.round(tempMin!)}°`;
}

export function isWeatherUnknown(weather?: DailyWeather | null): boolean {
  if (!weather) {
    return true;
  }

  const isUnknownCode =
    weather.weatherCode == null || weatherCodeMeta(weather.weatherCode).label === 'Unbekannt';
  const noTemps = weather.tempMax == null && weather.tempMin == null;
  return isUnknownCode && noTemps;
}

export function getWeatherUnknownReason(date?: string | null): string {
  if (!date) {
    return 'Keine Wetterdaten verfügbar.';
  }

  const today = toLocalDateString(new Date());

  if (date > today) {
    return 'Vorhersage noch nicht verfügbar (liegt zu weit in der Zukunft)';
  }

  if (date < today) {
    return 'Keine historischen Wetteraufzeichnungen verfügbar';
  }

  return 'Wetterdaten konnten nicht abgerufen werden';
}

export function getWeatherUnknownExplanation(date?: string | null): string {
  if (!date) {
    return 'Wetterdaten für diesen Tag konnten nicht geladen werden.';
  }

  const today = toLocalDateString(new Date());

  if (date > today) {
    return 'Dieser Tag liegt noch zu weit in der Zukunft. Wetterdienste liefern verlässliche Vorhersagen meist nur für die kommenden 7 bis 14 Tage.';
  }

  if (date < today) {
    return 'Für diesen vergangenen Tag liegen keine gespeicherten Wetteraufzeichnungen vor.';
  }

  return 'Wetterdaten konnten vom Wetterdienst zurzeit nicht abgerufen werden.';
}

// Session-Cache pro (gerundeter) Koordinate+Modell sowie Concurrency-Limit für /api/weather:
// Browser erlauben unter HTTP/1.1 nur 6 gleichzeitige Verbindungen pro Origin (davon belegt der
// SSE-Stream bereits 1 dauerhaft). Ohne Limitierung und Multi-Key-Cache würden beim Öffnen einer
// Ansicht mit 5+ Orten bei langsamem/hängendem Open-Meteo alle übrigen Verbindungen blockiert,
// sodass interaktive Anfragen (z. B. Speichern von Touren/Spots) in der Queue verhungern.
const MAX_CONCURRENT_WEATHER_REQUESTS = 2;
const WEATHER_REQUEST_TIMEOUT_MS = 6_000;

const forecastCache = new Map<string, Promise<DailyWeather[]>>();
let activeWeatherRequests = 0;
const weatherRequestQueue: Array<() => void> = [];

function runWithWeatherConcurrency<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      activeWeatherRequests++;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeWeatherRequests--;
          const next = weatherRequestQueue.shift();

          if (next) {
            next();
          }
        });
    };

    if (activeWeatherRequests < MAX_CONCURRENT_WEATHER_REQUESTS) {
      start();
    } else {
      weatherRequestQueue.push(start);
    }
  });
}

// model: welches der von Open-Meteo gebündelten Wettermodelle (siehe stores/weatherProvider.ts)
// abgefragt wird – ECMWF IFS als Default, da es sich in der Praxis am ehesten mit dem deckt, was
// kommerzielle Wetter-Apps (Apple Weather/Google) zeigen (ein Nutzer hatte abweichende Werte/
// Symbole gegenüber Apple Weather bemerkt, v. a. bei der Bewölkung, dem modellsensibelsten Wert
// überhaupt). In den Einstellungen (SettingsView.vue) auf ein anderes Modell umstellbar.
// Deterministisches, überwiegend sonniges Muster (kein echter Netzwerk-Zugriff im backend-losen
// Demo-Build, siehe demoClient.ts) - sorgt dafür, dass sowohl die echte Live-Demo als auch daraus
// erzeugte Marketing-Screenshots (siehe DESIGN.md) eine plausible Wetterkarte statt der sonst
// sichtbaren "Wetterdaten konnten nicht geladen werden"-Fehlermeldung zeigen.
const DEMO_WEATHER_PATTERN: Pick<
  DailyWeather,
  'weatherCode' | 'tempMax' | 'tempMin' | 'precipitationProbability'
>[] = [
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
    return {
      date: toLocalDateString(date),
      ...DEMO_WEATHER_PATTERN[i % DEMO_WEATHER_PATTERN.length],
    };
  });
}

export function roundWeatherCoord(val: number): number {
  return Math.round(val * 100) / 100;
}

export function resetWeatherCache() {
  forecastCache.clear();
}

export function fetchWeatherForecast(
  lat: number,
  lng: number,
  model = 'ecmwf_ifs025'
): Promise<DailyWeather[]> {
  const roundedLat = roundWeatherCoord(lat);
  const roundedLng = roundWeatherCoord(lng);
  const key = `${roundedLat.toFixed(2)},${roundedLng.toFixed(2)},${model}`;
  const cached = forecastCache.get(key);

  if (cached) {
    return cached;
  }

  if (DEMO_MODE) {
    const promise = Promise.resolve(demoWeatherForecast());
    forecastCache.set(key, promise);
    return promise;
  }

  const params = new URLSearchParams({
    lat: String(roundedLat),
    lng: String(roundedLng),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    past_days: '1',
    forecast_days: '16',
    models: model,
  });
  const promise = runWithWeatherConcurrency(() =>
    api.get<OpenMeteoResponse>(`/weather?${params}`, {
      timeoutMs: WEATHER_REQUEST_TIMEOUT_MS,
      skipOfflineDetection: true,
    })
  ).then((data) =>
    data.daily.time.map((date, i) => ({
      date,
      weatherCode: data.daily.weathercode[i],
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipitationProbability: data.daily.precipitation_probability_max?.[i] ?? null,
    }))
  );
  forecastCache.set(key, promise);
  // Bei einem Fehlschlag darf der Cache nicht "vergiftet" bleiben – sonst würde ein erneuter
  // Versuch (z. B. nächster Dashboard-Besuch) nie wieder einen neuen Fetch auslösen.
  promise.catch(() => {
    if (forecastCache.get(key) === promise) {
      forecastCache.delete(key);
    }
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

// Ergänzt die über den Backend-Proxy geholte Vorhersage (deckt nur ~16 Tage im Voraus + 1 Tag
// rückwirkend ab) um dauerhaft gespeicherte Ist-Werte vergangener Tage (backend/src/
// weatherSnapshots.ts, GET /trips/:id/weather-history) – dadurch bleibt das Wetter eines Urlaubs
// auch lange nach dessen Ende noch anzeigbar. Für "heute"/Zukunft bleibt weiterhin die Live-Vorhersage
// maßgeblich.
export async function fetchMergedWeather(
  tripId: number,
  lat: number,
  lng: number,
  model?: string
): Promise<DailyWeather[]> {
  const [live, history] = await Promise.all([
    fetchWeatherForecast(lat, lng, model),
    api
      .get<WeatherHistoryRow[]>(`/trips/${tripId}/weather-history`)
      .catch(() => [] as WeatherHistoryRow[]),
  ]);

  const today = toLocalDateString(new Date());
  const byDate = new Map<string, DailyWeather>();

  for (const day of live) {
    byDate.set(day.date, day);
  }

  const SNAPSHOT_COORD_TOLERANCE_DEG = 0.05;

  // Filtere nach passende Standort-Snapshots, falls Ortskoordinaten in der Historie vorliegen
  const matchingHistory = history.filter((row) => {
    if (row.lat == null || row.lng == null) {
      return true;
    }

    return (
      Math.abs(row.lat - lat) < SNAPSHOT_COORD_TOLERANCE_DEG &&
      Math.abs(row.lng - lng) < SNAPSHOT_COORD_TOLERANCE_DEG
    );
  });

  for (const row of matchingHistory) {
    if (row.date >= today) {
      continue;
    } // Live-Vorhersage bleibt für heute/Zukunft maßgeblich

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

enum WmoCode {
  Clear = 0,
  MostlyClear = 1,
  PartlyCloudy = 2,
  Overcast = 3,
  Fog = 45,
  DepositingRimeFog = 48,
  DrizzleLight = 51,
  DrizzleModerate = 53,
  DrizzleDense = 55,
  FreezingDrizzleLight = 56,
  FreezingDrizzleDense = 57,
  RainSlight = 61,
  RainModerate = 63,
  RainHeavy = 65,
  FreezingRainLight = 66,
  FreezingRainHeavy = 67,
  SnowSlight = 71,
  SnowModerate = 73,
  SnowHeavy = 75,
  SnowGrains = 77,
  RainShowersSlight = 80,
  RainShowersModerate = 81,
  RainShowersViolent = 82,
  SnowShowersSlight = 85,
  SnowShowersHeavy = 86,
  Thunderstorm = 95,
  ThunderstormHailSlight = 96,
  ThunderstormHailHeavy = 99,
}

const UNRANKED_WEATHER_SEVERITY = 999;
const HEAT_DANGER_TEMP_C = 35;
const HEAT_WARNING_TEMP_C = 31;
const COLD_WARNING_TEMP_C = -10;

enum HourlySampleHour {
  H06 = 6,
  H09 = 9,
  H12 = 12,
  H15 = 15,
  H18 = 18,
  H21 = 21,
}

const WEATHER_CODE_SEVERITY_ORDER: number[] = [
  WmoCode.ThunderstormHailHeavy,
  WmoCode.ThunderstormHailSlight,
  WmoCode.Thunderstorm,
  WmoCode.RainShowersViolent,
  WmoCode.RainShowersModerate,
  WmoCode.RainShowersSlight,
  WmoCode.FreezingRainHeavy,
  WmoCode.FreezingRainLight,
  WmoCode.RainHeavy,
  WmoCode.RainModerate,
  WmoCode.RainSlight,
  WmoCode.FreezingDrizzleDense,
  WmoCode.FreezingDrizzleLight,
  WmoCode.DrizzleDense,
  WmoCode.DrizzleModerate,
  WmoCode.DrizzleLight,
  WmoCode.SnowShowersHeavy,
  WmoCode.SnowShowersSlight,
  WmoCode.SnowHeavy,
  WmoCode.SnowModerate,
  WmoCode.SnowSlight,
  WmoCode.SnowGrains,
  WmoCode.DepositingRimeFog,
  WmoCode.Fog,
  WmoCode.Overcast,
  WmoCode.PartlyCloudy,
  WmoCode.MostlyClear,
  WmoCode.Clear,
];

/** Bildet aus mehreren Tageswetter-Messungen (z. B. für eine Tour mit mehreren Stationen) eine
 *  zusammenfassende Temperatur-Range und bestimmt das prägnanteste Wetter-Icon (Issue #152). */
export function summarizeWeatherRange(weathers: DailyWeather[]): WeatherRangeSummary | null {
  if (!weathers.length) {
    return null;
  }

  const temps = weathers
    .map((w) => (w.tempMax != null ? Math.round(w.tempMax) : null))
    .filter((temp): temp is number => temp != null);

  if (!temps.length) {
    return null;
  }

  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const tempLabel = minTemp === maxTemp ? `${minTemp}°` : `${minTemp}°–${maxTemp}°`;

  const validCodes = weathers
    .map((w) => w.weatherCode)
    .filter((code): code is number => code != null);
  let bestCode = validCodes[0] ?? 0;
  let bestIdx = WEATHER_CODE_SEVERITY_ORDER.indexOf(bestCode);

  if (bestIdx === -1) {
    bestIdx = UNRANKED_WEATHER_SEVERITY;
  }

  for (let i = 1; i < validCodes.length; i++) {
    const code = validCodes[i];
    let idx = WEATHER_CODE_SEVERITY_ORDER.indexOf(code);

    if (idx === -1) {
      idx = UNRANKED_WEATHER_SEVERITY;
    }

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
    if (day.date < today) {
      continue;
    }

    const formattedDate = formatDateShared(day.date, { includeYear: false });

    // Hitze
    if (day.tempMax != null && day.tempMax >= HEAT_DANGER_TEMP_C) {
      alerts.push({
        id: `heat-danger-${day.date}`,
        type: 'heat',
        severity: 'danger',
        title: 'Extreme Hitze-Warnung',
        description: `Extreme Hitze bis zu ${Math.round(day.tempMax)}°C am ${formattedDate} erwartet.`,
        date: day.date,
      });
    } else if (day.tempMax != null && day.tempMax >= HEAT_WARNING_TEMP_C) {
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
    if (
      day.weatherCode != null &&
      [
        WmoCode.Thunderstorm,
        WmoCode.ThunderstormHailSlight,
        WmoCode.ThunderstormHailHeavy,
      ].includes(day.weatherCode)
    ) {
      alerts.push({
        id: `storm-${day.date}`,
        type: 'storm',
        severity: 'danger',
        title: 'Gewitter- / Unwetter-Warnung',
        description: `Schwere Gewitter oder Sturmböen am ${formattedDate} erwartet.`,
        date: day.date,
      });
    } else if (
      day.weatherCode != null &&
      [WmoCode.RainShowersViolent, WmoCode.RainHeavy, WmoCode.FreezingRainHeavy].includes(
        day.weatherCode
      )
    ) {
      alerts.push({
        id: `rain-${day.date}`,
        type: 'rain',
        severity: 'warning',
        title: 'Starkregen-Warnung',
        description: `Heftiger Niederschlag am ${formattedDate} vorhergesagt.`,
        date: day.date,
      });
    } else if (
      day.weatherCode != null &&
      [WmoCode.SnowHeavy, WmoCode.SnowShowersHeavy].includes(day.weatherCode)
    ) {
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
    if (day.tempMin != null && day.tempMin <= COLD_WARNING_TEMP_C) {
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
  temp: number | null;
  weatherCode: number | null;
  precipitationProbability: number | null;
}

interface OpenMeteoHourlyResponse {
  hourly: {
    time: string[];
    weathercode: (number | null)[];
    temperature_2m: (number | null)[];
    precipitation_probability_max?: (number | null)[];
    precipitation_probability?: (number | null)[];
  };
}

function parseHourlyResponse(data: OpenMeteoHourlyResponse): HourlyWeather[] {
  const result: HourlyWeather[] = [];

  if (data.hourly?.time && Array.isArray(data.hourly.time)) {
    data.hourly.time.forEach((timeStr, i) => {
      const hourStr = timeStr.split('T')[1] ?? '';
      const hourNum = parseInt(hourStr.split(':')[0], 10);

      if (
        ![
          HourlySampleHour.H06,
          HourlySampleHour.H09,
          HourlySampleHour.H12,
          HourlySampleHour.H15,
          HourlySampleHour.H18,
          HourlySampleHour.H21,
        ].includes(hourNum)
      ) {
        return;
      }

      const rawTemp = data.hourly.temperature_2m?.[i];
      const rawCode = data.hourly.weathercode?.[i];

      // Strikte Validierung: null oder undefined darf niemals durch Math.round() zu 0° verfälscht werden!
      if (
        rawTemp != null &&
        typeof rawTemp === 'number' &&
        !Number.isNaN(rawTemp) &&
        rawCode != null &&
        typeof rawCode === 'number' &&
        !Number.isNaN(rawCode)
      ) {
        result.push({
          time: hourStr,
          temp: Math.round(rawTemp),
          weatherCode: rawCode,
          precipitationProbability: data.hourly.precipitation_probability?.[i] ?? null,
        });
      }
    });
  }

  return result;
}

/** Holt stündliche Wetterdaten für die Tages-Detail-Ansicht (Issue #133, über Backend-Proxy #538).
 *  Unterstützt sowohl zukünftige Tage (Forecast-Quelle) als auch vergangene Urlaubs-Tage
 *  (Archive-Quelle mit ERA5/Modell-Reanalysis). */
export async function fetchHourlyForecast(
  lat: number,
  lng: number,
  date: string,
  model = 'ecmwf_ifs025'
): Promise<HourlyWeather[]> {
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

  const roundedLat = roundWeatherCoord(lat);
  const roundedLng = roundWeatherCoord(lng);
  const today = toLocalDateString(new Date());
  const isPast = date < today;

  async function tryFetch(
    source: 'forecast' | 'archive',
    useModel: boolean
  ): Promise<HourlyWeather[]> {
    const params = new URLSearchParams({
      source,
      lat: String(roundedLat),
      lng: String(roundedLng),
      hourly: 'weathercode,temperature_2m,precipitation_probability',
      timezone: 'auto',
      start_date: date,
      end_date: date,
    });

    if (useModel && model) {
      params.set('models', model);
    }

    const data = await runWithWeatherConcurrency(() =>
      api.get<OpenMeteoHourlyResponse>(`/weather?${params}`, {
        timeoutMs: WEATHER_REQUEST_TIMEOUT_MS,
        skipOfflineDetection: true,
      })
    );
    return parseHourlyResponse(data);
  }

  if (isPast) {
    // Für vergangene Tage nutzen wir die Archive-Quelle, da die Forecast-API
    // für frühere Termine keine stündlichen Vorhersagedaten mehr vorhält bzw. null zurückgibt.
    try {
      const fromArchive = await tryFetch('archive', true);

      if (fromArchive.length > 0) {
        return fromArchive;
      }
    } catch {
      // Weiter zum nächsten Fallback
    }

    try {
      // Falls das spezifische Wettermodell für diesen vergangenen Zeitraum keine Daten hat,
      // liefert das globale ERA5-Reanalysis-Archiv verlässliche Verlaufsdaten.
      const fromArchiveDefault = await tryFetch('archive', false);

      if (fromArchiveDefault.length > 0) {
        return fromArchiveDefault;
      }
    } catch {
      // Weiter zum nächsten Fallback
    }

    try {
      // Zusätzlicher Fallback auf Forecast-Quelle für ganz junge vergangene Tage (z. B. gestern)
      const fromForecast = await tryFetch('forecast', true);

      if (fromForecast.length > 0) {
        return fromForecast;
      }
    } catch {
      // Keine Daten verfügbar
    }

    return [];
  }

  // Für heute oder die Zukunft: reguläre Forecast-Quelle
  try {
    const fromForecast = await tryFetch('forecast', true);

    if (fromForecast.length > 0) {
      return fromForecast;
    }
  } catch {
    // Weiter zum Fallback
  }

  try {
    const fromForecastDefault = await tryFetch('forecast', false);

    if (fromForecastDefault.length > 0) {
      return fromForecastDefault;
    }
  } catch {
    // Weiter zum Fallback
  }

  // Falls für den heutigen Tag im Grenzfall die Forecast-Quelle versagt, liefert das Archiv ggf. bereits Werte
  try {
    const fromArchive = await tryFetch('archive', false);

    if (fromArchive.length > 0) {
      return fromArchive;
    }
  } catch {
    // Keine Daten verfügbar
  }

  return [];
}

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

const WEATHER_CODE_META: Record<number, { icon: string; label: string }> = {
  0: { icon: '☀️', label: 'Klar' },
  1: { icon: '🌤️', label: 'Überwiegend klar' },
  2: { icon: '⛅', label: 'Teilweise bewölkt' },
  3: { icon: '☁️', label: 'Bedeckt' },
  45: { icon: '🌫️', label: 'Nebel' },
  48: { icon: '🌫️', label: 'Reifnebel' },
  51: { icon: '🌦️', label: 'Leichter Nieselregen' },
  53: { icon: '🌦️', label: 'Nieselregen' },
  55: { icon: '🌧️', label: 'Starker Nieselregen' },
  56: { icon: '🌧️', label: 'Gefrierender Nieselregen' },
  57: { icon: '🌧️', label: 'Starker gefrierender Nieselregen' },
  61: { icon: '🌦️', label: 'Leichter Regen' },
  63: { icon: '🌧️', label: 'Regen' },
  65: { icon: '🌧️', label: 'Starker Regen' },
  66: { icon: '🌧️', label: 'Gefrierender Regen' },
  67: { icon: '🌧️', label: 'Starker gefrierender Regen' },
  71: { icon: '🌨️', label: 'Leichter Schneefall' },
  73: { icon: '🌨️', label: 'Schneefall' },
  75: { icon: '❄️', label: 'Starker Schneefall' },
  77: { icon: '❄️', label: 'Schneegriesel' },
  80: { icon: '🌦️', label: 'Leichte Regenschauer' },
  81: { icon: '🌧️', label: 'Regenschauer' },
  82: { icon: '⛈️', label: 'Heftige Regenschauer' },
  85: { icon: '🌨️', label: 'Leichte Schneeschauer' },
  86: { icon: '❄️', label: 'Starke Schneeschauer' },
  95: { icon: '⛈️', label: 'Gewitter' },
  96: { icon: '⛈️', label: 'Gewitter mit Hagel' },
  99: { icon: '⛈️', label: 'Starkes Gewitter mit Hagel' },
};

export function weatherCodeMeta(code: number): { icon: string; label: string } {
  return WEATHER_CODE_META[code] ?? { icon: '🌡️', label: 'Unbekannt' };
}

// Einfacher Modul-Cache statt Store: pro (gerundeter) Koordinate reicht ein Fetch pro Session, die
// Vorhersage ändert sich nicht innerhalb eines Dashboard-Aufrufs.
let cache: { key: string; promise: Promise<DailyWeather[]> } | null = null;

export function fetchWeatherForecast(lat: number, lng: number): Promise<DailyWeather[]> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (cache?.key === key) return cache.promise;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    past_days: '1',
    forecast_days: '16',
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

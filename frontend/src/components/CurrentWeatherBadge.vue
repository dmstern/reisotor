<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { fetchWeatherForecast, weatherCodeMeta, type DailyWeather } from '../utils/weather';
import { toLocalDateString } from '../utils/dateFormat';
import WeatherIcon from './WeatherIcon.vue';

// Kompaktes Wetter-Pill für die mobile Kartenansicht (TripMap.vue) - zeigt bewusst NUR den
// aktuellen Tag statt des ganzen Urlaubszeitraums wie im Dashboard/der Kalender-Schublade, um die
// kleine Bildschirmfläche nicht zu überfrachten (siehe Konsistenz-Check-Anlass: das Karten-Wetter
// existierte bisher nur über die Kalender-Schublade, die auf Mobil eine eigene Route statt eines
// gleichzeitig mit der Karte sichtbaren Drawers ist - das Feature "verschwand" dadurch komplett).
const props = defineProps<{ lat: number | null; lng: number | null; model?: string }>();

const today = ref<DailyWeather | null>(null);

async function load() {
  if (props.lat == null || props.lng == null) {
    today.value = null;
    return;
  }
  try {
    const days = await fetchWeatherForecast(props.lat, props.lng, props.model);
    const todayStr = toLocalDateString(new Date());
    today.value = days.find((d) => d.date === todayStr) ?? null;
  } catch {
    today.value = null;
  }
}

onMounted(load);
watch(() => [props.lat, props.lng, props.model], load);

const meta = computed(() => (today.value ? weatherCodeMeta(today.value.weatherCode) : null));
</script>

<template>
  <div v-if="today && meta" class="current-weather-badge" :title="`Heute: ${meta.label}`">
    <WeatherIcon class="icon" :size="18" :code="today.weatherCode" />
    <span class="temp">{{ Math.round(today.tempMax) }}° / {{ Math.round(today.tempMin) }}°</span>
  </div>
</template>

<style scoped>
/* Gleicher Squircle-/Rahmen-Look wie .fit-btn/.focus-banner daneben auf der Karte, statt einer neu
   erfundenen Optik. */
.current-weather-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: 6px 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  white-space: nowrap;
}

.icon {
  font-size: 1.1rem;
}
</style>

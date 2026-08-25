<script setup lang="ts">
import { computed } from 'vue';
import { useIconStyleStore } from '../stores/iconStyle';
import { weatherCodeMeta } from '../utils/weather';
import AppIcon from './AppIcon.vue';

// Zentrale Render-Stelle für Wetter-Icons (eigener stores/iconStyle.ts-Bereich "weather", siehe
// ICON_GROUP_OPTIONS) statt an jeder der zahlreichen Aufrufstellen (Dashboard, Kalender,
// Spot-/Ausflugskarten, Tagebuch, ...) dieselbe Einfärbungs-/Teile-Logik zu wiederholen. Mehrteilige
// Bedingungen (Regen/Schneefall/Gewitter = Wolke + Tropfen/Flocke/Blitz) lassen sich nicht als ein
// einzelnes, einfarbiges Tabler-Icon sinnvoll einfärben - dafür stapelt diese Komponente bei
// aktivierter Einfärbung zwei einzeln eingefärbte Icons, statt das kombinierte Icon pauschal
// umzufärben. Ohne Einfärbung (Default aus) bleibt exakt das bisherige, einzelne Kombi-Icon
// bestehen - keine optische Änderung für Nutzer:innen, die das Setting nicht anfassen.
const props = withDefaults(defineProps<{ code: number; size?: number; title?: string }>(), {
  size: 20,
});

const iconStyle = useIconStyleStore();
const meta = computed(() => weatherCodeMeta(props.code));
const showParts = computed(
  () =>
    iconStyle.colorizeWeather &&
    iconStyle.styleForGroup('weather') === 'icons' &&
    !!meta.value.parts
);
const accentSize = computed(() => Math.round(props.size * 0.62));
</script>

<template>
  <span
    v-if="showParts"
    class="weather-icon-parts"
    :style="{ width: size + 'px', height: size + 'px' }"
    :title="title"
  >
    <AppIcon
      class="weather-icon-base"
      :icon="meta.parts![0].icon"
      group="weather"
      :color="meta.parts![0].color"
      :size="size"
    />
    <AppIcon
      class="weather-icon-accent"
      :icon="meta.parts![1].icon"
      group="weather"
      :color="meta.parts![1].color"
      :force-variant="meta.parts![1].forceFilled ? 'filled' : undefined"
      :size="accentSize"
    />
  </span>
  <AppIcon
    v-else
    :icon="meta.tabler"
    group="weather"
    :color="iconStyle.colorizeWeather ? meta.color : undefined"
    :size="size"
    :title="title"
  />
</template>

<style scoped>
.weather-icon-parts {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.weather-icon-base {
  position: absolute;
  inset: 0;
}

.weather-icon-accent {
  position: absolute;
  right: -15%;
  bottom: -15%;
}
</style>

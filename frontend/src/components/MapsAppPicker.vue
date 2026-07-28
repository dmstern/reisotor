<script setup lang="ts">
import { ref } from 'vue';

// Eigenständige Komponente statt Duplikat in jedem Detail-Dialog (Spot/Unterkunft/Reise): zeigt
// ein kleines Auswahlmenü der gängigen Karten-Apps als offizielle Universal-Links (öffnet die App,
// falls installiert, sonst die Web-Vorschau) – kein User-Agent-Sniffing nötig. Ursprünglich Teil
// von TripMap.vue's Info-Panel, das mit der direkten Pin-Klick→Detail-Dialog-Kopplung entfallen
// ist (siehe TripMap.vue) – hier wiederverwendbar in jedem Detail-Dialog, der Koordinaten besitzt.
const props = defineProps<{ lat: number; lng: number; title: string; mapsLink?: string | null }>();
const open = ref(false);
</script>

<template>
  <div class="maps-picker">
    <button type="button" class="card-action-btn" @click="open = !open">🗺️ In Karten-App öffnen ↗</button>
    <template v-if="open">
      <div class="picker-backdrop" @click="open = false"></div>
      <div class="picker-menu">
        <a
          :href="`https://maps.apple.com/?ll=${props.lat},${props.lng}&q=${encodeURIComponent(props.title)}`"
          target="_blank"
          rel="noopener"
          @click="open = false"
        >
          🍎 Apple Maps
        </a>
        <a
          :href="`https://www.google.com/maps/search/?api=1&query=${props.lat},${props.lng}`"
          target="_blank"
          rel="noopener"
          @click="open = false"
        >
          🗺️ Google Maps
        </a>
        <a v-if="props.mapsLink" :href="props.mapsLink" target="_blank" rel="noopener" @click="open = false">
          🔗 Ursprünglichen Link öffnen
        </a>
      </div>
    </template>
  </div>
</template>

<style scoped>
.maps-picker {
  position: relative;
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 200px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 21;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu a {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.picker-menu a:hover {
  background: var(--color-hover);
}
</style>

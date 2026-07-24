<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { api } from '../api/client';
import type { Accommodation, Spot } from '../api/types';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;

onMounted(async () => {
  const [spots, accommodation] = await Promise.all([
    api.get<Spot[]>('/spots'),
    api.get<Accommodation | null>('/accommodation'),
  ]);

  if (!mapEl.value) return;
  map = L.map(mapEl.value);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  }).addTo(map);

  const points: L.LatLngExpression[] = [];

  for (const spot of spots) {
    if (spot.lat == null || spot.lng == null) continue;
    const point: L.LatLngExpression = [spot.lat, spot.lng];
    points.push(point);
    L.marker(point)
      .addTo(map)
      .bindPopup(`<strong>${spot.name}</strong>${spot.category ? `<br>${spot.category}` : ''}`);
  }

  if (accommodation?.lat != null && accommodation.lng != null) {
    const point: L.LatLngExpression = [accommodation.lat, accommodation.lng];
    points.push(point);
    L.marker(point).addTo(map).bindPopup(`<strong>🛏️ ${accommodation.name}</strong>`);
  }

  if (points.length > 1) {
    L.polyline(points, { color: '#2a7f74', weight: 3, opacity: 0.6, dashArray: '6 6' }).addTo(map);
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
  } else if (points.length === 1) {
    map.setView(points[0], 13);
  } else {
    map.setView([48.1351, 11.582], 5); // Fallback: Mitteleuropa
  }
});

onUnmounted(() => {
  map?.remove();
  map = null;
});
</script>

<template>
  <div class="map-page">
    <h1 class="title">Karte</h1>
    <div ref="mapEl" class="map"></div>
  </div>
</template>

<style scoped>
.map-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
}

.title {
  padding: var(--space-3) var(--space-4) 0;
  margin: 0;
}

.map {
  flex: 1;
  margin: var(--space-3) var(--space-4) var(--space-4);
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}
</style>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import type { Accommodation, Excursion, Spot } from '../api/types';
import { useTripStore } from '../stores/trip';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';
import SpotCard from '../components/SpotCard.vue';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const spots = ref<Spot[]>([]);
const excursions = ref<Excursion[]>([]);
const accommodations = ref<Accommodation[]>([]);
const loading = ref(true);
const showForm = ref(false);

const form = ref({ name: '', category: '', link: '', note: '', lat: '', lng: '' });

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markersLayer: L.LayerGroup | null = null;

function emojiPin(emoji: string, color: string) {
  return L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:${color};
      transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid white;">
      <span style="transform:rotate(45deg);font-size:15px;line-height:1;">${emoji}</span></div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -30],
  });
}

const spotIcon = emojiPin('📍', '#2a7f74');
const excursionIcon = emojiPin('🎒', '#e08e45');
const accommodationIcon = emojiPin('🛏️', '#5b6ee1');

const excursionsOnMap = computed(() => excursions.value.filter((i) => i.lat != null && i.lng != null));
const accommodationsOnMap = computed(() =>
  accommodations.value.filter((a) => a.lat != null && a.lng != null),
);

async function loadAll() {
  const [spotsRes, excursionsRes, accommodationRes] = await Promise.all([
    api.get<Spot[]>(`/spots?trip_id=${tripId}`),
    api.get<Excursion[]>(`/ideas?trip_id=${tripId}`),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
  ]);
  spots.value = spotsRes;
  excursions.value = excursionsRes;
  accommodations.value = accommodationRes;
}

function renderMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const points: L.LatLngExpression[] = [];

  for (const spot of spots.value) {
    if (spot.lat == null || spot.lng == null) continue;
    const point: L.LatLngExpression = [spot.lat, spot.lng];
    points.push(point);
    L.marker(point, { icon: spotIcon })
      .addTo(markersLayer)
      .bindPopup(`<strong>📍 ${spot.name}</strong>${spot.category ? `<br>${spot.category}` : ''}`);
  }

  for (const excursion of excursionsOnMap.value) {
    const point: L.LatLngExpression = [excursion.lat as number, excursion.lng as number];
    points.push(point);
    L.marker(point, { icon: excursionIcon })
      .addTo(markersLayer)
      .bindPopup(
        `<strong>💡 ${excursion.title}</strong>${excursion.status === 'planned' ? '<br>Geplant' : ''}`,
      );
  }

  for (const acc of accommodationsOnMap.value) {
    const point: L.LatLngExpression = [acc.lat as number, acc.lng as number];
    points.push(point);
    L.marker(point, { icon: accommodationIcon })
      .addTo(markersLayer)
      .bindPopup(`<strong>🛏️ ${acc.name}</strong>`);
  }

  if (points.length > 1) {
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
  } else if (points.length === 1) {
    map.setView(points[0], 13);
  } else {
    map.setView([48.1351, 11.582], 5); // Fallback: Mitteleuropa
  }
}

onMounted(async () => {
  await loadAll();
  loading.value = false;
  // Der Karten-Container steckt hinter v-if="!loading" und existiert im DOM
  // erst, nachdem Vue den Zustandswechsel gerendert hat – ohne nextTick() ist
  // mapEl.value hier immer noch null und die Karte wird nie initialisiert.
  await nextTick();

  if (!mapEl.value) return;
  map = L.map(mapEl.value);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap-Mitwirkende',
    maxZoom: 19,
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  renderMarkers();
});

onUnmounted(() => {
  map?.remove();
  map = null;
});

async function addSpot() {
  if (!form.value.name.trim()) return;
  let lat = form.value.lat ? Number(form.value.lat) : undefined;
  let lng = form.value.lng ? Number(form.value.lng) : undefined;
  if (lat == null && lng == null && form.value.link) {
    const parsed = parseLatLngFromMapsLink(form.value.link);
    if (parsed) {
      lat = parsed.lat;
      lng = parsed.lng;
    }
  }

  const created = await api.post<Spot>('/spots', {
    trip_id: tripId,
    name: form.value.name.trim(),
    category: form.value.category || undefined,
    link: form.value.link || undefined,
    note: form.value.note || undefined,
    lat,
    lng,
  });
  spots.value.unshift(created);
  form.value = { name: '', category: '', link: '', note: '', lat: '', lng: '' };
  showForm.value = false;
  renderMarkers();
}

async function removeSpot(id: number) {
  await api.delete(`/spots/${id}`);
  spots.value = spots.value.filter((s) => s.id !== id);
  renderMarkers();
}
</script>

<template>
  <div class="karte" v-if="!loading">
    <h1 class="title">Karte</h1>
    <div ref="mapEl" class="map"></div>

    <div class="legend">
      <span><i class="dot" style="background:#2a7f74"></i> Spots</span>
      <span><i class="dot" style="background:#e08e45"></i> Ausflüge</span>
      <span><i class="dot" style="background:#5b6ee1"></i> Unterkunft</span>
    </div>

    <div class="spots-section">
      <div class="header">
        <h2>Spots</h2>
        <button @click="showForm = !showForm">{{ showForm ? 'Abbrechen' : '+ Neuer Spot' }}</button>
      </div>

      <form v-if="showForm" class="card add-form" @submit.prevent="addSpot">
        <input v-model="form.name" type="text" placeholder="Name" required />
        <input v-model="form.category" type="text" placeholder="Kategorie (z. B. Restaurant)" />
        <input v-model="form.link" type="url" placeholder="Link (z. B. Google Maps)" />
        <textarea v-model="form.note" placeholder="Notiz (optional)" rows="2"></textarea>
        <div class="coords-row">
          <input v-model="form.lat" type="number" step="any" placeholder="Lat (optional, sonst aus Link)" />
          <input v-model="form.lng" type="number" step="any" placeholder="Lng (optional, sonst aus Link)" />
        </div>
        <button type="submit">Speichern</button>
      </form>

      <div class="grid cards">
        <SpotCard v-for="spot in spots" :key="spot.id" :spot="spot" @remove="removeSpot" />
      </div>
      <p v-if="!spots.length" class="empty">Noch keine Spots eingetragen.</p>
    </div>
  </div>
</template>

<style scoped>
.karte {
  display: flex;
  flex-direction: column;
  padding: var(--space-3) var(--space-4) var(--space-4);
  gap: var(--space-3);
}

.title {
  margin: 0;
}

.map {
  height: 45vh;
  min-height: 320px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.legend {
  display: flex;
  gap: var(--space-4);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}

.spots-section {
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.coords-row {
  display: flex;
  gap: var(--space-2);
}

.coords-row input {
  flex: 1;
}

.cards {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.empty {
  color: var(--color-text-muted);
}
</style>

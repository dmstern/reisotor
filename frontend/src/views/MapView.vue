<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api/client';
import type { Accommodation, Excursion } from '../api/types';
import { useTripStore } from '../stores/trip';

// Die Karte ist eine reine Anzeige (Batch 4): Sie zeigt nur Punkte, die in ihren
// Ursprungssichten (Reise, Ausflüge, Unterkunft) mit Koordinaten hinterlegt wurden.
// Anlegen/Bearbeiten gibt es hier nicht – ein Klick auf einen Punkt zeigt eine kurze
// Info mit einem Sprung-Button zur jeweiligen Ursprungssicht (Architekturregel Batch 3).
type MapKind = 'trip' | 'excursion' | 'accommodation';

interface MapPoint {
  key: string;
  kind: MapKind;
  id: number;
  lat: number;
  lng: number;
  title: string;
}

const MAP_KIND_META: Record<MapKind, { icon: string; color: string; label: string }> = {
  trip: { icon: '🧳', color: '#2a78d6', label: 'Reise' },
  excursion: { icon: '🎒', color: '#eb6834', label: 'Ausflug' },
  accommodation: { icon: '🛏️', color: '#1baf7a', label: 'Unterkunft' },
};
const MAP_KINDS: MapKind[] = ['trip', 'excursion', 'accommodation'];

const route = useRoute();
const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const excursions = ref<Excursion[]>([]);
const accommodations = ref<Accommodation[]>([]);
const loading = ref(true);
const selectedPoint = ref<MapPoint | null>(null);

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

const icons: Record<MapKind, L.DivIcon> = {
  trip: emojiPin(MAP_KIND_META.trip.icon, MAP_KIND_META.trip.color),
  excursion: emojiPin(MAP_KIND_META.excursion.icon, MAP_KIND_META.excursion.color),
  accommodation: emojiPin(MAP_KIND_META.accommodation.icon, MAP_KIND_META.accommodation.color),
};

const points = computed<MapPoint[]>(() => {
  const result: MapPoint[] = [];
  const trip = tripStore.currentTrip;
  if (trip && trip.lat != null && trip.lng != null) {
    result.push({ key: `trip-${trip.id}`, kind: 'trip', id: trip.id, lat: trip.lat, lng: trip.lng, title: trip.name });
  }
  for (const e of excursions.value) {
    if (e.lat != null && e.lng != null) {
      result.push({ key: `excursion-${e.id}`, kind: 'excursion', id: e.id, lat: e.lat, lng: e.lng, title: e.title });
    }
  }
  for (const a of accommodations.value) {
    if (a.lat != null && a.lng != null) {
      result.push({
        key: `accommodation-${a.id}`,
        kind: 'accommodation',
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        title: a.name,
      });
    }
  }
  return result;
});

async function loadAll() {
  const [excursionsRes, accommodationRes] = await Promise.all([
    api.get<Excursion[]>(`/ideas?trip_id=${tripId}`),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
  ]);
  excursions.value = excursionsRes;
  accommodations.value = accommodationRes;
}

function selectPoint(point: MapPoint) {
  selectedPoint.value = point;
}

function renderMarkers() {
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();

  const latLngs: L.LatLngExpression[] = [];
  for (const point of points.value) {
    const latlng: L.LatLngExpression = [point.lat, point.lng];
    latLngs.push(latlng);
    L.marker(latlng, { icon: icons[point.kind] })
      .addTo(markersLayer)
      .on('click', () => selectPoint(point));
  }

  // "Auf Karte anzeigen" aus Ausflüge/Unterkunft springt mit ?focus=<key> hierher
  // und soll direkt auf den jeweiligen Punkt zentrieren.
  const focusKey = typeof route.query.focus === 'string' ? route.query.focus : null;
  const focusPoint = focusKey ? points.value.find((p) => p.key === focusKey) : null;

  if (focusPoint) {
    map.setView([focusPoint.lat, focusPoint.lng], 15);
    selectPoint(focusPoint);
  } else if (latLngs.length > 1) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
  } else if (latLngs.length === 1) {
    map.setView(latLngs[0], 13);
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

function jumpToTrip() {
  tripStore.requestEditTrip();
}
</script>

<template>
  <div class="karte" v-if="!loading">
    <h1 class="title">Karte</h1>
    <div ref="mapEl" class="map"></div>

    <div class="legend">
      <span v-for="kind in MAP_KINDS" :key="kind">
        <i class="dot" :style="{ background: MAP_KIND_META[kind].color }"></i>
        {{ MAP_KIND_META[kind].icon }} {{ MAP_KIND_META[kind].label }}
      </span>
    </div>

    <div class="card info-panel" v-if="selectedPoint">
      <button type="button" class="close-btn" aria-label="Schließen" @click="selectedPoint = null">✕</button>
      <div class="info-head">
        <span class="info-icon">{{ MAP_KIND_META[selectedPoint.kind].icon }}</span>
        <div>
          <h3>{{ selectedPoint.title }}</h3>
          <span class="info-category">{{ MAP_KIND_META[selectedPoint.kind].label }}</span>
        </div>
      </div>
      <button v-if="selectedPoint.kind === 'trip'" type="button" class="secondary jump-btn" @click="jumpToTrip">
        Zur Reise
      </button>
      <router-link v-else-if="selectedPoint.kind === 'excursion'" to="/excursions" class="secondary jump-btn">
        Zu den Ausflügen
      </router-link>
      <router-link v-else to="/accommodation" class="secondary jump-btn"> Zur Unterkunft </router-link>
    </div>

    <p v-if="!points.length" class="empty">
      Noch keine Orte mit Koordinaten hinterlegt. Füge bei Reise, Ausflügen oder Unterkunft einen
      Google-Maps-Link hinzu, damit sie hier erscheinen.
    </p>
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
  height: 55vh;
  min-height: 360px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.legend {
  display: flex;
  flex-wrap: wrap;
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

.info-panel {
  position: relative;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.close-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  padding: 4px;
  line-height: 1;
}

.info-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.info-icon {
  font-size: 1.6rem;
}

.info-head h3 {
  margin: 0;
  font-size: 1rem;
}

.info-category {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.jump-btn {
  align-self: flex-start;
  text-decoration: none;
}

.empty {
  color: var(--color-text-muted);
}
</style>

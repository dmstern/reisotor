<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TripFormData } from '../stores/trip';
import { parseLatLngFromMapsLink } from '../utils/googleMaps';

const props = defineProps<{ initial?: TripFormData; submitLabel?: string }>();
const emit = defineEmits<{ (e: 'submit', data: TripFormData): void }>();

function blankForm(): TripFormData {
  return { name: '', destination: '', start_date: '', end_date: '', maps_link: '' };
}

const form = ref<TripFormData>(props.initial ? { ...props.initial } : blankForm());
const mapsLinkResolved = ref<boolean | null>(null);

watch(
  () => props.initial,
  (initial) => {
    form.value = initial ? { ...initial } : blankForm();
    mapsLinkResolved.value = null;
  },
);

function checkMapsLink() {
  if (!form.value.maps_link) {
    mapsLinkResolved.value = null;
    return;
  }
  mapsLinkResolved.value = parseLatLngFromMapsLink(form.value.maps_link) != null;
}

function onSubmit() {
  if (!form.value.name.trim() || !form.value.start_date || !form.value.end_date) return;
  const parsed = parseLatLngFromMapsLink(form.value.maps_link);
  emit('submit', {
    name: form.value.name.trim(),
    destination: form.value.destination || undefined,
    start_date: form.value.start_date,
    end_date: form.value.end_date,
    maps_link: form.value.maps_link || undefined,
    lat: parsed?.lat,
    lng: parsed?.lng,
  });
}
</script>

<template>
  <form class="trip-form" @submit.prevent="onSubmit">
    <label>
      Name des Urlaubs
      <input v-model="form.name" type="text" placeholder="z. B. Italien 2026" required />
    </label>
    <label>
      Ziel (optional)
      <input v-model="form.destination" type="text" placeholder="z. B. Toskana" />
    </label>
    <div class="dates-row">
      <label>
        Start
        <input v-model="form.start_date" type="date" required />
      </label>
      <label>
        Ende
        <input v-model="form.end_date" type="date" required />
      </label>
    </div>
    <label>
      Google-Maps-Link (optional)
      <input v-model="form.maps_link" type="url" @blur="checkMapsLink" />
    </label>
    <p v-if="mapsLinkResolved === true" class="hint success">📍 Standort erkannt – erscheint auf der Karte</p>
    <p v-if="mapsLinkResolved === false" class="hint">Standort konnte nicht automatisch erkannt werden.</p>
    <button type="submit">{{ submitLabel ?? 'Speichern' }}</button>
  </form>
</template>

<style scoped>
.trip-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint {
  margin: -4px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint.success {
  color: var(--color-success);
}

.dates-row {
  display: flex;
  gap: var(--space-2);
}

.dates-row label {
  flex: 1;
}
</style>

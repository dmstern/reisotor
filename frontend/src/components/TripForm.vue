<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TripFormData } from '../stores/trip';
import { buildOsmLink, parseLatLngFromMapsLink } from '../utils/googleMaps';
import LocationPicker from './LocationPicker.vue';
import ImageUrlInput from './ImageUrlInput.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// locationError: vom Aufrufer (TripSwitcher.vue) gesetzt, wenn nach dem Speichern auffällt, dass
// auch die serverseitige Maps-Link-Auflösung fehlgeschlagen ist (z. B. Google-Bot-Blocking eines
// Kurzlinks) – öffnet dann automatisch den manuellen Karten-Picker als Fallback.
const props = defineProps<{
  initial?: TripFormData;
  submitLabel?: string;
  locationError?: boolean;
}>();
const emit = defineEmits<{ (e: 'submit', data: TripFormData): void }>();

function blankForm(): TripFormData {
  return {
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    maps_link: '',
    image_url: '',
    packing_category_required: true,
  };
}

const form = ref<TripFormData>(props.initial ? { ...props.initial } : blankForm());
const mapsLinkResolved = ref<boolean | null>(null);
const manualPin = ref<{ lat: number; lng: number } | null>(null);
const pickerOpen = ref(false);
const showOptional = ref(false);

watch(
  () => props.initial,
  (initial) => {
    form.value = initial ? { ...initial } : blankForm();
    mapsLinkResolved.value = null;
    manualPin.value = null;
    pickerOpen.value = false;
    showOptional.value = false;
  }
);

// Öffnet den Picker und die optionalen Felder automatisch, sobald der Aufrufer einen Fehlschlag meldet;
// ein danach gesetzter Pin löst automatisch einen erneuten Speicherversuch aus.
watch(
  () => props.locationError,
  (err) => {
    if (err) {
      showOptional.value = true;
      pickerOpen.value = true;
    }
  }
);

// Ein manuell gesetzter Pin übernimmt das Maps-Link-Feld als OpenStreetMap-Link derselben
// Koordinate – zur besseren Nachvollziehbarkeit, welcher Standort tatsächlich für z. B. die
// Wetterabfrage verwendet wird.
watch(manualPin, (pin) => {
  if (!pin) return;
  form.value.maps_link = buildOsmLink(pin.lat, pin.lng);
  mapsLinkResolved.value = true;
  if (props.locationError) onSubmit();
});

function checkMapsLink() {
  if (!form.value.maps_link) {
    mapsLinkResolved.value = null;
    return;
  }
  mapsLinkResolved.value = parseLatLngFromMapsLink(form.value.maps_link) != null;
}

function onSubmit() {
  if (!form.value.name.trim()) return;
  const parsed = parseLatLngFromMapsLink(form.value.maps_link ?? undefined);
  emit('submit', {
    name: form.value.name.trim(),
    destination: form.value.destination || undefined,
    start_date: form.value.start_date || undefined,
    end_date: form.value.end_date || undefined,
    maps_link: form.value.maps_link || undefined,
    lat: manualPin.value?.lat ?? parsed?.lat,
    lng: manualPin.value?.lng ?? parsed?.lng,
    image_url: form.value.image_url || undefined,
    packing_category_required: form.value.packing_category_required ?? true,
  });
}
</script>

<template>
  <form class="trip-form" @submit.prevent="onSubmit">
    <label>
      Name des Urlaubs
      <input v-model="form.name" type="text" placeholder="z. B. Italien 2026" required />
    </label>

    <fieldset class="collapsible-fieldset">
      <legend>
        <Button
          type="button"
          variant="ghost"
          class="collapsible-toggle"
          :aria-expanded="showOptional"
          @click="showOptional = !showOptional"
        >
          <span>Optionale Angaben</span>
          <AppIcon
            :icon="ACTION_ICONS.chevronDown"
            :size="14"
            group="actions"
            class="caret"
            :class="{ open: showOptional }"
          />
        </Button>
      </legend>
      <div v-if="showOptional" class="collapsible-content">
        <div class="dates-row">
          <label>
            Start (optional)
            <input v-model="form.start_date" type="date" />
          </label>
          <label>
            Ende (optional)
            <input v-model="form.end_date" type="date" />
          </label>
        </div>

        <label>
          Ziel (optional)
          <input v-model="form.destination" type="text" placeholder="z. B. Toskana" />
        </label>

        <div class="card location-box">
          <span class="field-label">Standort (optional)</span>
          <p class="hint">
            Wird für die Wetter-Anzeige und die Position auf der Karte verwendet. Du kannst das auch
            später in den Urlaubs-Einstellungen ergänzen.
          </p>
          <label>
            Maps-Link (Google/Apple)
            <input v-model="form.maps_link" type="url" @blur="checkMapsLink" />
          </label>
          <p v-if="mapsLinkResolved === true" class="hint success">
            <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" /> Standort erkannt
            – erscheint auf der Karte
          </p>
          <p v-if="mapsLinkResolved === false" class="hint">
            Standort konnte nicht automatisch erkannt werden.
          </p>
          <p v-if="locationError" class="hint error">
            <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Standort konnte
            auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um ihn manuell
            zu setzen.
          </p>
          <Button
            type="button"
            variant="ghost"
            class="picker-toggle"
            @click="pickerOpen = !pickerOpen"
          >
            <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" /> Standort manuell
            setzen
            <AppIcon
              :icon="ACTION_ICONS.chevronDown"
              :size="12"
              group="actions"
              class="picker-caret"
              :class="{ open: pickerOpen }"
            />
          </Button>
          <LocationPicker v-if="pickerOpen" v-model="manualPin" />
        </div>

        <div class="field-group">
          <span class="field-label">Bild für das Dashboard-Banner (optional)</span>
          <ImageUrlInput v-model="form.image_url" placeholder="https://…" />
        </div>

        <label class="checkbox-label">
          <input v-model="form.packing_category_required" type="checkbox" />
          Kategorie in der Packliste ist Pflichtfeld
        </label>
      </div>
    </fieldset>

    <div class="form-actions">
      <Button type="submit">{{ submitLabel ?? 'Speichern' }}</Button>
    </div>
  </form>
</template>

<style scoped>
.trip-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

label,
.field-group {
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

.hint.error {
  color: var(--color-danger);
}

.collapsible-fieldset {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  padding: var(--space-2) var(--space-3) var(--space-3);
  margin: var(--space-2) 0;
  background: var(--color-bg);
}

.collapsible-fieldset legend {
  padding: 0 var(--space-1);
  margin: 0;
}

.collapsible-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 8px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
  background: var(--color-surface) !important;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  cursor: pointer;
  box-shadow: none;
}

.collapsible-toggle:hover {
  background: var(--color-hover) !important;
}

.collapsible-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.caret {
  flex-shrink: 0;
  transition: transform 0.15s ease;
}

.caret.open {
  transform: rotate(180deg);
}

.picker-toggle {
  align-self: flex-start;
  padding: 6px 12px;
  font-size: 0.85rem;
}

.picker-caret {
  margin-left: 4px;
  opacity: 0.6;
  transition: transform 0.15s ease;
}

.picker-caret.open {
  transform: rotate(180deg);
}

.dates-row {
  display: flex;
  gap: var(--space-2);
}

.dates-row label {
  flex: 1;
}

.checkbox-label {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  color: var(--color-text);
}

.location-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.location-box .field-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.location-box .hint {
  margin-top: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>

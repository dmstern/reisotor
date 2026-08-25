<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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

// Assistent (Issue #76): nur beim Neuanlegen (kein initial) - beim Bearbeiten eines bestehenden
// Urlaubs sieht man weiterhin alle Felder auf einmal, ein schrittweiser Assistent würde dort nur im
// Weg stehen (man will meist gezielt ein einzelnes Feld ändern, nicht durchklicken).
const wizard = computed(() => !props.initial);
type StepId = 'basics' | 'destination' | 'location' | 'extra';
const STEPS: { id: StepId; optional: boolean }[] = [
  { id: 'basics', optional: false },
  { id: 'destination', optional: true },
  { id: 'location', optional: true },
  { id: 'extra', optional: true },
];
const step = ref(0);
const isLastStep = computed(() => step.value === STEPS.length - 1);
const currentStepOptional = computed(() => STEPS[step.value].optional);
const showStep = (id: StepId) => !wizard.value || STEPS[step.value].id === id;
const canProceedBasics = computed(
  () => !!form.value.name.trim() && !!form.value.start_date && !!form.value.end_date
);

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

watch(
  () => props.initial,
  (initial) => {
    form.value = initial ? { ...initial } : blankForm();
    mapsLinkResolved.value = null;
    manualPin.value = null;
    pickerOpen.value = false;
    step.value = 0;
  }
);

// Öffnet den Picker automatisch, sobald der Aufrufer einen Fehlschlag meldet; ein danach gesetzter
// Pin löst automatisch einen erneuten Speicherversuch aus (kein separater "Speichern"-Klick nötig).
watch(
  () => props.locationError,
  (err) => {
    if (err) pickerOpen.value = true;
  }
);
// Ein manuell gesetzter Pin übernimmt das Maps-Link-Feld als OpenStreetMap-Link derselben
// Koordinate – zur besseren Nachvollziehbarkeit, welcher Standort tatsächlich für z. B. die
// Wetterabfrage verwendet wird (der Nutzer kann den Link danach anklicken/gegenchecken), statt dass
// das Feld leer bzw. auf dem alten (evtl. falsch aufgelösten) Link stehen bleibt.
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

function goBack() {
  if (step.value > 0) step.value -= 1;
}

// Sowohl "Weiter" als auch "Überspringen" rufen dieselbe Funktion auf - Felder sind auf allen
// Schritten außer dem ersten optional, ein separates Leeren beim Überspringen würde nur bereits
// eingegebene Daten unerwartet verwerfen.
function goNextOrSubmit() {
  if (isLastStep.value) {
    onSubmit();
    return;
  }
  step.value += 1;
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
    lat: manualPin.value?.lat ?? parsed?.lat,
    lng: manualPin.value?.lng ?? parsed?.lng,
    image_url: form.value.image_url || undefined,
    packing_category_required: form.value.packing_category_required ?? true,
  });
}
</script>

<template>
  <form class="trip-form" @submit.prevent="onSubmit">
    <p v-if="wizard" class="wizard-progress">Schritt {{ step + 1 }} von {{ STEPS.length }}</p>

    <template v-if="showStep('basics')">
      <label>
        Name des Urlaubs
        <input v-model="form.name" type="text" placeholder="z. B. Italien 2026" required />
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
    </template>

    <template v-if="showStep('destination')">
      <label>
        Ziel (optional)
        <input v-model="form.destination" type="text" placeholder="z. B. Toskana" />
      </label>
    </template>

    <template v-if="showStep('location')">
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
          <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" /> Standort erkannt –
          erscheint auf der Karte
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
    </template>

    <template v-if="showStep('extra')">
      <div class="field-group">
        <span class="field-label">Bild für das Dashboard-Banner (optional)</span>
        <ImageUrlInput v-model="form.image_url" placeholder="https://…" />
      </div>
      <label class="checkbox-label">
        <input v-model="form.packing_category_required" type="checkbox" />
        Kategorie in der Packliste ist Pflichtfeld
      </label>
    </template>

    <div class="form-actions">
      <Button v-if="wizard && step > 0" type="button" variant="secondary" @click="goBack"
        >Zurück</Button
      >
      <div class="form-actions-right">
        <Button
          v-if="wizard && currentStepOptional && !isLastStep"
          type="button"
          variant="secondary"
          @click="goNextOrSubmit"
        >
          Überspringen
        </Button>
        <Button
          v-if="wizard && !isLastStep"
          type="button"
          :disabled="!canProceedBasics"
          @click="goNextOrSubmit"
        >
          Weiter
        </Button>
        <Button v-if="!wizard || isLastStep" type="submit">{{ submitLabel ?? 'Speichern' }}</Button>
      </div>
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

.wizard-progress {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.form-actions-right {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-left: auto;
}
</style>

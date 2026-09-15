<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { TripFormData } from '../stores/trip';
import { buildOsmLink, parseLatLngFromMapsLink } from '../utils/googleMaps';
import LocationPicker from './LocationPicker.vue';
import CoverImagePicker from './CoverImagePicker.vue';
import TabBar, { type TabBarItem } from './TabBar.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Card from './primitives/Card.vue';
import Checkbox from './primitives/Checkbox.vue';
import CheckboxCard from './primitives/CheckboxCard.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import { IconCloud } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';

const WEATHER_ICON: IconDef = { id: 'cloud', emoji: '🌤️', outline: IconCloud };

// locationError: vom Aufrufer (TripSwitcher.vue) gesetzt, wenn nach dem Speichern auffällt, dass
// auch die serverseitige Maps-Link-Auflösung fehlgeschlagen ist (z. B. Google-Bot-Blocking eines
// Kurzlinks) – öffnet dann automatisch den manuellen Karten-Picker als Fallback.
const props = defineProps<{
  initial?: TripFormData;
  submitLabel?: string;
  locationError?: boolean;
  initialTab?: 'general' | 'settings';
}>();
const emit = defineEmits<{ (e: 'submit', data: TripFormData): void }>();

const TABS: TabBarItem[] = [
  { key: 'general', label: 'Allgemein', icon: ACTION_ICONS.edit },
  { key: 'settings', label: 'Einstellungen', icon: ACTION_ICONS.filterSettings },
];

const activeTab = ref<'general' | 'settings'>(props.initialTab ?? 'general');
const showTabs = computed(() => Boolean(props.initial));

function blankForm(): TripFormData {
  return {
    name: '',
    destination: '',
    start_date: '',
    end_date: '',
    maps_link: '',
    image_url: '',
    packing_category_required: true,
    weather_model: 'ecmwf_ifs025',
  };
}

const form = ref<TripFormData>(props.initial ? { ...props.initial } : blankForm());
const mapsLinkResolved = ref<boolean | null>(null);
const manualPin = ref<{ lat: number; lng: number } | null>(null);
const pickerOpen = ref(false);
const showOptional = ref(false);

const dateError = computed(() => {
  if (form.value.start_date && form.value.end_date && form.value.start_date > form.value.end_date) {
    return 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  }
  return '';
});

watch(
  () => props.initial,
  (initial) => {
    form.value = initial ? { ...initial } : blankForm();
    mapsLinkResolved.value = null;
    manualPin.value = null;
    pickerOpen.value = false;
    showOptional.value = false;
    activeTab.value = props.initialTab ?? 'general';
  }
);

watch(
  () => props.initialTab,
  (tab) => {
    if (tab) activeTab.value = tab;
  }
);

// Öffnet den Picker und die optionalen Felder automatisch, sobald der Aufrufer einen Fehlschlag meldet;
// ein danach gesetzter Pin löst automatisch einen erneuten Speicherversuch aus.
watch(
  () => props.locationError,
  (err) => {
    if (err) {
      activeTab.value = 'general';
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
  if (!form.value.name.trim()) {
    activeTab.value = 'general';
    return;
  }
  if (dateError.value) {
    activeTab.value = 'general';
    showOptional.value = true;
    return;
  }
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
    weather_model: form.value.weather_model || 'ecmwf_ifs025',
  });
}
</script>

<template>
  <form class="trip-form" @submit.prevent="onSubmit">
    <TabBar
      v-if="showTabs"
      :tabs="TABS"
      :active-key="activeTab"
      class="trip-tab-bar"
      @select="activeTab = $event as 'general' | 'settings'"
    />

    <div v-show="!showTabs || activeTab === 'general'" class="tab-content">
      <CoverImagePicker
        v-model="form.image_url"
        :placeholder-icon="SECTION_ICON_DEFS.dashboard"
        modal-title="Dashboard-Banner bearbeiten"
      />

      <label for="auto-id-1788301175440-11">
        Name des Urlaubs
        <Input
          id="auto-id-1788301175440-11"
          v-model="form.name"
          type="text"
          placeholder="z. B. Italien 2026"
          required
        />
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
            <label for="auto-id-1788301175440-12">
              Start (optional)
              <Input id="auto-id-1788301175440-12" v-model="form.start_date" type="date" />
            </label>
            <label for="auto-id-1788301175440-13">
              Ende (optional)
              <Input id="auto-id-1788301175440-13" v-model="form.end_date" type="date" />
            </label>
          </div>
          <p v-if="dateError" class="hint error">
            <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
            {{ dateError }}
          </p>

          <label for="auto-id-1788301175440-14">
            Ziel (optional)
            <Input
              id="auto-id-1788301175440-14"
              v-model="form.destination"
              type="text"
              placeholder="z. B. Toskana"
            />
          </label>

          <Card class="location-box">
            <span class="field-label">Standort (optional)</span>
            <p class="hint">
              Wird für die Wetter-Anzeige und die Position auf der Karte verwendet.
            </p>
            <label for="auto-id-1788301175440-15">
              Maps-Link (Google/Apple)
              <Input
                id="auto-id-1788301175440-15"
                v-model="form.maps_link"
                type="url"
                @blur="checkMapsLink"
              />
            </label>
            <p v-if="mapsLinkResolved === true" class="hint success">
              <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" /> Standort
              erkannt – erscheint auf der Karte
            </p>
            <p v-if="mapsLinkResolved === false" class="hint">
              Standort konnte nicht automatisch erkannt werden.
            </p>
            <p v-if="locationError" class="hint error">
              <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Standort
              konnte auch automatisch nicht ermittelt werden. Bitte tippe unten auf die Karte, um
              ihn manuell zu setzen.
            </p>
            <fieldset class="collapsible-fieldset">
              <legend>
                <Button
                  type="button"
                  variant="ghost"
                  class="collapsible-toggle picker-toggle"
                  :aria-expanded="pickerOpen"
                  @click="pickerOpen = !pickerOpen"
                >
                  <span>
                    <AppIcon :icon="ACTION_ICONS.myLocation" :size="14" group="actions" />
                    Standort manuell setzen
                  </span>
                  <AppIcon
                    :icon="ACTION_ICONS.chevronDown"
                    :size="14"
                    group="actions"
                    class="caret"
                    :class="{ open: pickerOpen }"
                  />
                </Button>
              </legend>
              <div v-if="pickerOpen" class="collapsible-content">
                <LocationPicker v-model="manualPin" />
              </div>
            </fieldset>
          </Card>
        </div>
      </fieldset>
    </div>

    <div v-if="showTabs && activeTab === 'settings'" class="tab-content settings-tab">
      <Card class="settings-card">
        <div class="settings-card-header">
          <AppIcon :icon="WEATHER_ICON" :size="18" group="weather" />
          <span class="field-label">Wetter</span>
        </div>
        <p class="hint">
          Wettervorhersage über Open-Meteo. Wähle das am besten geeignete Wettermodell für die
          Urlaubsregion (z. B. ECMWF für Europa, ICON für Deutschland &amp; Alpen, GFS für die USA
          oder JMA für Japan).
        </p>
        <label for="trip-weather-model" class="field-group">
          Wettermodell
          <Select id="trip-weather-model" v-model="form.weather_model">
            <option
              v-for="option in WEATHER_MODEL_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </Select>
        </label>
      </Card>

      <CheckboxCard
        id="trip-packing-category-required"
        v-model="form.packing_category_required"
        :icon="SECTION_ICON_DEFS.packing"
        label="Kategorie in der Packliste ist Pflichtfeld"
        description="Beim Anlegen neuer Packlisten-Einträge muss eine Kategorie ausgewählt werden"
      />
    </div>

    <div class="actions-row">
      <div class="spacer"></div>
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

.trip-tab-bar {
  margin-bottom: var(--space-1);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.settings-tab {
  gap: var(--space-3);
}

.settings-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
}

.settings-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
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

.collapsible-fieldset:not(:has(.collapsible-content)) {
  border-color: transparent;
  background: transparent;
  padding: 0;
  margin: var(--space-1) 0;
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
  flex-wrap: wrap;
  gap: var(--space-2);
}

.dates-row label {
  flex: 1 1 130px;
  min-width: 130px;
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

.spacer {
  flex: 1;
}
</style>

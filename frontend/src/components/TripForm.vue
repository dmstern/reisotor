<script setup lang="ts">
import { ref, watch, computed, useId } from 'vue';
import type { TripFormData } from '../stores/trip';
import { buildGoogleMapsLink, buildOsmLink, parseLatLngFromMapsLink } from '../utils/googleMaps';
import LocationPicker, { type PlaceSearchResult } from './LocationPicker.vue';
import CoverImagePicker from './CoverImagePicker.vue';
import TabBar, { type TabBarItem } from './TabBar.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Card from './primitives/Card.vue';

import CheckboxCard from './primitives/CheckboxCard.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import { IconCloud } from '@tabler/icons-vue';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { WEATHER_MODEL_OPTIONS } from '../stores/weatherProvider';
import TripCategorySettings from './TripCategorySettings.vue';
import TripPermissionsSettings from './TripPermissionsSettings.vue';

export type TripFormTab = 'general' | 'settings' | 'categories' | 'permissions';

const WEATHER_ICON: IconDef = { id: 'cloud', emoji: '🌤️', outline: IconCloud };

// locationError: vom Aufrufer (TripSwitcher.vue) gesetzt, wenn nach dem Speichern auffällt, dass
// auch die serverseitige Maps-Link-Auflösung fehlgeschlagen ist (z. B. Google-Bot-Blocking eines
// Kurzlinks) – öffnet dann automatisch den manuellen Karten-Picker als Fallback.
const props = defineProps<{
  initial?: TripFormData;
  submitLabel?: string;
  locationError?: boolean;
  initialTab?: TripFormTab;
  tripId?: number;
}>();
const emit = defineEmits<{
  (e: 'submit', data: TripFormData): void;
  (e: 'delete'): void;
  (e: 'navigate'): void;
}>();

const TABS: TabBarItem[] = [
  { key: 'general', label: 'Allgemein', icon: ACTION_ICONS.edit },
  { key: 'settings', label: 'Einstellungen', icon: ACTION_ICONS.filterSettings },
  { key: 'categories', label: 'Kategorien', icon: FORM_FIELD_ICONS.category },
  { key: 'permissions', label: 'Zugriffsberechtigungen', icon: FORM_FIELD_ICONS.visibility },
];

const activeTab = ref<TripFormTab>(props.initialTab ?? 'general');
const showTabs = computed(() => Boolean(props.initial));
const canDelete = computed(() => Boolean(props.initial));

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
const manualPin = ref<{ lat: number; lng: number } | null>(
  props.initial?.lat != null && props.initial?.lng != null
    ? { lat: props.initial.lat, lng: props.initial.lng }
    : null
);
const showOptional = ref(false);

const nameId = useId();
const startDateId = useId();
const endDateId = useId();

const dateError = computed(() => {
  if (form.value.start_date && form.value.end_date && form.value.start_date > form.value.end_date) {
    return 'Das Enddatum darf nicht vor dem Startdatum liegen.';
  }
  return '';
});

function areCoordsEqual(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

const isLocationModified = computed(() => {
  if (!props.initial) return false;
  const initialPin =
    props.initial.lat != null && props.initial.lng != null
      ? { lat: props.initial.lat, lng: props.initial.lng }
      : null;
  const pinChanged = !areCoordsEqual(manualPin.value, initialPin);
  const destinationChanged =
    (form.value.destination || '').trim() !== (props.initial.destination || '').trim();
  const mapsLinkChanged =
    (form.value.maps_link || '').trim() !== (props.initial.maps_link || '').trim();
  return pinChanged || destinationChanged || mapsLinkChanged;
});

const isNameModified = computed(() => {
  if (!props.initial) return false;
  return (form.value.name || '').trim() !== (props.initial.name || '').trim();
});

const isStartDateModified = computed(() => {
  if (!props.initial) return false;
  return (form.value.start_date || '') !== (props.initial.start_date || '');
});

const isEndDateModified = computed(() => {
  if (!props.initial) return false;
  return (form.value.end_date || '') !== (props.initial.end_date || '');
});

const isImageModified = computed(() => {
  if (!props.initial) return false;
  return (form.value.image_url || '').trim() !== (props.initial.image_url || '').trim();
});

const isWeatherModelModified = computed(() => {
  if (!props.initial) return false;
  return (form.value.weather_model || '') !== (props.initial.weather_model || '');
});

watch(
  () => props.initial,
  (initial) => {
    form.value = initial ? { ...initial } : blankForm();
    manualPin.value =
      initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : null;
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

// Öffnet die optionalen Felder automatisch, sobald der Aufrufer einen Fehlschlag meldet;
// ein danach gesetzter Pin löst automatisch einen erneuten Speicherversuch aus.
watch(
  () => props.locationError,
  (err) => {
    if (err) {
      activeTab.value = 'general';
      showOptional.value = true;
    }
  }
);

// Ein manuell gesetzter Pin übernimmt das Maps-Link-Feld als OpenStreetMap-Link derselben
// Koordinate – zur besseren Nachvollziehbarkeit, welcher Standort tatsächlich für z. B. die
// Wetterabfrage verwendet wird.
watch(manualPin, (pin) => {
  if (!pin) return;
  if (!form.value.maps_link) {
    form.value.maps_link = buildOsmLink(pin.lat, pin.lng);
  }
  if (props.locationError) onSubmit();
});

function onLocationSelect(place: PlaceSearchResult) {
  form.value.destination = place.formatted_address || place.name;
  const coords = { lat: place.lat, lng: place.lng };
  manualPin.value = coords;
  form.value.maps_link = buildGoogleMapsLink(place.lat, place.lng);
}

function onLocationClear() {
  manualPin.value = null;
  form.value.destination = '';
  form.value.maps_link = '';
}

function onLocationReset() {
  if (!props.initial) {
    onLocationClear();
    return;
  }
  form.value.destination = props.initial.destination ?? '';
  form.value.maps_link = props.initial.maps_link ?? '';
  manualPin.value =
    props.initial.lat != null && props.initial.lng != null
      ? { lat: props.initial.lat, lng: props.initial.lng }
      : null;
}

const isUploadingCoverImage = ref(false);

function onSubmit() {
  if (isUploadingCoverImage.value) return;
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
      @select="activeTab = $event as TripFormTab"
    />

    <div v-show="!showTabs || activeTab === 'general'" class="tab-content">
      <CoverImagePicker
        v-model="form.image_url"
        v-model:uploading="isUploadingCoverImage"
        :placeholder-icon="ACTION_ICONS.vacation"
        modal-title="Dashboard-Banner bearbeiten"
        :modified="isImageModified"
        :initial-value="props.initial?.image_url ?? ''"
        :search-context="{ name: form.destination || form.name }"
      />

      <label :for="nameId">
        <span class="label-text">
          Name des Urlaubs <span class="required-indicator" aria-hidden="true">*</span>
        </span>
        <Input
          :id="nameId"
          v-model="form.name"
          type="text"
          placeholder="z. B. Italien 2026"
          required
          :modified="isNameModified"
        />
      </label>

      <CollapsibleFieldset v-model="showOptional" label="Optionale Angaben">
        <div class="dates-row">
          <label :for="startDateId">
            Start
            <Input
              :id="startDateId"
              v-model="form.start_date"
              type="date"
              :modified="isStartDateModified"
            />
          </label>
          <label :for="endDateId">
            Ende
            <Input
              :id="endDateId"
              v-model="form.end_date"
              type="date"
              :modified="isEndDateModified"
            />
          </label>
        </div>
        <p v-if="dateError" class="hint error">
          <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
          {{ dateError }}
        </p>

        <Card class="location-box" :class="{ 'is-modified': isLocationModified }">
          <span class="field-label">Ziel &amp; Standort</span>
          <p class="hint">Wird für die Wetter-Anzeige und die Position auf der Karte verwendet.</p>
          <p v-if="locationError" class="hint error">
            <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Standort konnte
            auch automatisch nicht ermittelt werden. Bitte tippe auf die Karte, um ihn manuell zu
            setzen.
          </p>
          <LocationPicker
            v-model="manualPin"
            :address="form.destination"
            :maps-link="form.maps_link"
            placeholder="Reiseziel, Stadt oder Maps-Link eingeben..."
            :modified="isLocationModified"
            @update:address="form.destination = $event"
            @update:maps-link="form.maps_link = $event"
            @select="onLocationSelect"
            @clear="onLocationClear"
            @reset="onLocationReset"
          />
        </Card>
      </CollapsibleFieldset>
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
          <Select
            id="trip-weather-model"
            v-model="form.weather_model"
            :modified="isWeatherModelModified"
          >
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

    <div v-if="showTabs && activeTab === 'categories'" class="tab-content categories-tab">
      <TripCategorySettings
        v-if="props.tripId"
        :trip-id="props.tripId"
        @navigate="emit('navigate')"
      />
    </div>

    <div v-if="showTabs && activeTab === 'permissions'" class="tab-content permissions-tab">
      <TripPermissionsSettings v-if="props.tripId" :trip-id="props.tripId" />
    </div>

    <div v-if="activeTab !== 'categories' && activeTab !== 'permissions'" class="actions-row">
      <Button
        v-if="canDelete"
        type="button"
        variant="danger"
        secondary
        :icon="ACTION_ICONS.delete"
        :disabled="isUploadingCoverImage"
        @click="emit('delete')"
      >
        Löschen
      </Button>
      <div class="spacer"></div>
      <Button type="submit" :disabled="isUploadingCoverImage">{{
        submitLabel ?? 'Speichern'
      }}</Button>
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

.settings-tab,
.permissions-tab {
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

.label-text {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.hint {
  margin: -4px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.hint.success {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-success);
}

.hint.error {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--color-danger);
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

.location-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.location-box.is-modified {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 1px var(--color-accent);
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

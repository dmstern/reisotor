<script setup lang="ts">
import type { TravelItem } from '../api/types';
import { linkLabel } from '../utils/linkLabel';
import { formatTravelDuration, travelDurationMinutes } from '../utils/travelDuration';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import DetailModal from './DetailModal.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import FileAttachments from './FileAttachments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import AppIcon from './AppIcon.vue';

// Eigenständige Komponente statt inline in TravelSection.vue, da dieser Dialog auch von anderer Stelle
// geöffnet werden muss (TripMap.vue's Stationsliste, falls der Abflug-/Ankunftsort dort als
// Ausflug-Station eingeplant ist) – gleiches Vorgehen wie
// SpotDetailDialog.vue. Beide Seiten (Abflug/Ankunft) zeigen denselben
// vollständigen Eintrag, daher hier ein einziger Dialog statt zwei separater.
defineProps<{
  modelValue: boolean;
  item: TravelItem;
  payerLabel: string | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
  (e: 'show-on-map-from'): void;
  (e: 'show-on-map-to'): void;
}>();

function travelDuration(item: TravelItem) {
  const minutes = travelDurationMinutes(item.departure_time, item.arrival_time);
  return minutes == null ? null : formatTravelDuration(minutes);
}
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="item.title"
    :placeholder-icon="travelTypeIconDef(item.type)"
    @edit="emit('edit')"
  >
    <p v-if="item.from_location || item.to_location" class="detail-row">
      <span class="detail-label">Strecke</span>
      {{ item.from_location || '?' }} → {{ item.to_location || '?' }}
    </p>
    <p v-if="item.date || item.departure_time" class="detail-row">
      <span class="detail-label">Zeit</span>
      <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" /> {{ item.date || '' }}
      <span v-if="item.departure_time">
        · {{ item.departure_time }}<span v-if="item.arrival_time">–{{ item.arrival_time }}</span> Uhr
      </span>
      <span v-if="travelDuration(item)"> ({{ travelDuration(item) }})</span>
    </p>
    <p v-if="item.checkin_info" class="detail-row">
      <span class="detail-label">Vorher da sein</span>
      <AppIcon :icon="ACTION_ICONS.duration" :size="14" group="actions" /> {{ item.checkin_info }}
    </p>
    <p v-if="item.luggage" class="detail-row">
      <span class="detail-label">Gepäck</span>
      <AppIcon :icon="ACTION_ICONS.luggage" :size="14" group="actions" /> {{ item.luggage }}
    </p>
    <p v-if="item.seat" class="detail-row">
      <span class="detail-label">Sitzplatz</span>
      <AppIcon :icon="ACTION_ICONS.seat" :size="14" group="actions" /> {{ item.seat }}
    </p>
    <p v-if="item.amount != null" class="detail-row">
      <span class="detail-label">Kosten</span>
      <AppIcon :icon="FORM_FIELD_ICONS.amount" :size="14" group="formFields" /> {{ item.amount.toFixed(2) }} €
      <span v-if="item.paid_by_user_id"> · bezahlt von {{ payerLabel }}</span>
    </p>
    <RichTextDisplay v-if="item.note" class="detail-row note" :content="item.note" :format="item.note_format" />
    <FileAttachments domain="ideas" :entity-id="item.id" :editable="false" />
    <div class="detail-actions">
      <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="card-action-btn">
        {{ linkLabel(item.link) }} ↗
      </a>
      <button
        v-if="item.from_lat != null && item.from_lng != null"
        type="button"
        class="card-action-btn"
        @click="emit('show-on-map-from')"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> Abflug auf Karte anzeigen
      </button>
      <MapsAppPicker
        v-if="item.from_lat != null && item.from_lng != null"
        :lat="item.from_lat"
        :lng="item.from_lng"
        :title="`${item.title} (Abflug/Abfahrt)`"
        :maps-link="item.from_maps_link"
      />
      <button
        v-if="item.to_lat != null && item.to_lng != null"
        type="button"
        class="card-action-btn"
        @click="emit('show-on-map-to')"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> Ankunft auf Karte anzeigen
      </button>
      <MapsAppPicker
        v-if="item.to_lat != null && item.to_lng != null"
        :lat="item.to_lat"
        :lng="item.to_lng"
        :title="`${item.title} (Ankunft)`"
        :maps-link="item.to_maps_link"
      />
    </div>
  </DetailModal>
</template>

<style scoped>
.note {
  overflow-wrap: anywhere;
}
</style>

<script setup lang="ts">
import type { TravelItem } from '../api/types';
import { linkLabel } from '../utils/linkLabel';
import {
  formatTravelDuration,
  travelDurationMinutes,
  tourTotalDurationMinutes,
} from '../utils/travelDuration';
import { useExcursionsStore } from '../stores/excursions';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import DetailModal from './DetailModal.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import FileAttachments from './FileAttachments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Badge from './primitives/Badge.vue';
import DetailRow from './primitives/DetailRow.vue';

// Eigenständige Komponente statt inline in TravelSection.vue, da dieser Dialog auch von anderer Stelle
// geöffnet werden muss (TripMap.vue's Stationsliste, falls der Abflug-/Ankunftsort dort als
// Ausflug-Station eingeplant ist). Beide Seiten (Abflug/Ankunft) zeigen denselben
// vollständigen Eintrag, daher hier ein einziger Dialog statt zwei separater.
defineProps<{
  modelValue: boolean;
  item: TravelItem;
  payerLabel: string | null;
  hasMultipleMembers?: boolean;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
  (e: 'show-on-map-from'): void;
  (e: 'show-on-map-to'): void;
}>();

const excursionsStore = useExcursionsStore();

function travelDuration(item: TravelItem) {
  const excursion = excursionsStore.excursions.find((e) => e.id === item.id);
  const minutes = excursion
    ? tourTotalDurationMinutes(excursion)
    : travelDurationMinutes(item.departure_time, item.arrival_time);
  return minutes == null ? null : formatTravelDuration(minutes);
}
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="item.title"
    :placeholder-icon="travelTypeIconDef(item.type)"
    :category-label="item.type || 'Reise'"
    :category-icon="travelTypeIconDef(item.type)"
    theme-color="var(--color-travel)"
    theme-tint="var(--color-travel-tint)"
    @edit="emit('edit')"
  >
    <template #meta>
      <Badge v-if="item.date">
        <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
        {{ formatDateShared(item.date) }}
      </Badge>
      <Badge v-if="travelDuration(item)">
        <AppIcon :icon="ACTION_ICONS.duration" :size="12" group="actions" />
        {{ travelDuration(item) }}
      </Badge>
    </template>
    <DetailRow v-if="item.from_location || item.to_location" label="Strecke">
      {{ item.from_location || '?' }} → {{ item.to_location || '?' }}
    </DetailRow>
    <DetailRow v-if="item.date || item.departure_time" label="Zeit">
      <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
      {{ item.date || '' }}
      <span v-if="item.departure_time" class="nobr">
        · {{ item.departure_time
        }}<template v-if="item.arrival_time">&ndash;{{ item.arrival_time }}</template
        >&nbsp;Uhr
      </span>
      <span v-if="travelDuration(item)" class="nobr"> ({{ travelDuration(item) }})</span>
    </DetailRow>
    <DetailRow v-if="item.checkin_info" label="Vorher da sein">
      <AppIcon :icon="ACTION_ICONS.duration" :size="14" group="actions" /> {{ item.checkin_info }}
    </DetailRow>
    <DetailRow v-if="item.luggage" label="Gepäck">
      <AppIcon :icon="ACTION_ICONS.luggage" :size="14" group="actions" /> {{ item.luggage }}
    </DetailRow>
    <DetailRow v-if="item.seat" label="Sitzplatz">
      <AppIcon :icon="ACTION_ICONS.seat" :size="14" group="actions" /> {{ item.seat }}
    </DetailRow>
    <DetailRow v-if="item.amount != null" label="Kosten">
      <AppIcon :icon="FORM_FIELD_ICONS.amount" :size="14" group="formFields" />
      <span class="nobr">{{ item.amount.toFixed(2) }}&nbsp;€</span>
      <span v-if="hasMultipleMembers !== false && item.paid_by_user_id">
        · bezahlt von {{ payerLabel }}</span
      >
    </DetailRow>
    <RichTextDisplay
      v-if="item.note"
      class="detail-row note"
      :content="item.note"
      :format="item.note_format"
    />
    <FileAttachments domain="ideas" :entity-id="item.id" :editable="false" />
    <div class="detail-actions">
      <Button
        v-if="item.link"
        :href="item.link"
        target="_blank"
        rel="noopener"
        variant="card-action"
      >
        {{ linkLabel(item.link) }} ↗
      </Button>
      <Button
        v-if="item.from_lat != null && item.from_lng != null"
        variant="card-action"
        size="sm"
        @click="emit('show-on-map-from')"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> Abflug auf Karte
        anzeigen
      </Button>
      <MapsAppPicker
        v-if="item.from_lat != null && item.from_lng != null"
        :lat="item.from_lat"
        :lng="item.from_lng"
        :title="`${item.title} (Abflug/Abfahrt)`"
        :maps-link="item.from_maps_link"
      />
      <Button
        v-if="item.to_lat != null && item.to_lng != null"
        variant="card-action"
        size="sm"
        @click="emit('show-on-map-to')"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> Ankunft auf Karte
        anzeigen
      </Button>
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

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
</style>

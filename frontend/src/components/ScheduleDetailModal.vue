<script setup lang="ts">
import type { useScheduleItemDetail } from '../composables/useScheduleItemDetail';
import DetailModal from './DetailModal.vue';
import DetailRow from './primitives/DetailRow.vue';
import LinkedEntityButton from './primitives/LinkedEntityButton.vue';
import AppIcon from './AppIcon.vue';
import WeatherIcon from './WeatherIcon.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import FileAttachments from './FileAttachments.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import CalendarExportDropdown from './CalendarExportDropdown.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { formatDate } from '../utils/dateFormat';
import { isEmptyRichText } from '../utils/richText';

defineProps<{
  modelValue: boolean;
  detail: ReturnType<typeof useScheduleItemDetail>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="detail.viewingItem.value?.title ?? ''"
    :image-url="detail.viewingImageUrl.value"
    :collage-images="detail.viewingCollageImages.value"
    :placeholder-icon="detail.viewingCategoryInfo.value.icon"
    :category-label="detail.viewingCategoryInfo.value.label"
    :category-icon="detail.viewingCategoryInfo.value.icon"
    :theme-color="detail.viewingCategoryInfo.value.themeColor"
    :theme-tint="detail.viewingCategoryInfo.value.themeTint"
    @edit="detail.editViewingItem"
  >
    <template #meta>
      <span v-if="detail.viewingItem.value" class="detail-badge">
        <AppIcon :icon="FORM_FIELD_ICONS.date" :size="12" group="formFields" />
        {{ detail.formatViewingDate(detail.viewingItem.value.date) }}
      </span>
      <span
        v-if="
          detail.viewingWeatherEntry.value &&
          (detail.viewingWeatherEntry.value.weather.tempMax != null ||
            detail.viewingWeatherEntry.value.weather.tempMin != null)
        "
        class="detail-badge weather-badge"
      >
        <WeatherIcon :code="detail.viewingWeatherEntry.value.weather.weatherCode" :size="13" />
        <template
          v-if="
            detail.viewingWeatherEntry.value.weather.tempMax != null &&
            detail.viewingWeatherEntry.value.weather.tempMin != null
          "
        >
          {{ Math.round(detail.viewingWeatherEntry.value.weather.tempMax) }}° /
          {{ Math.round(detail.viewingWeatherEntry.value.weather.tempMin) }}°
        </template>
        <template v-else>
          {{
            Math.round(
              detail.viewingWeatherEntry.value.weather.tempMax ??
                detail.viewingWeatherEntry.value.weather.tempMin!
            )
          }}°
        </template>
      </span>
    </template>

    <DetailRow v-if="detail.viewingItem.value?.time" label="Zeit">
      <AppIcon :icon="FORM_FIELD_ICONS.time" :size="14" group="formFields" />
      {{ detail.viewingItem.value.time
      }}<template v-if="detail.viewingItem.value.end_time">
        – {{ detail.viewingItem.value.end_time }}</template
      >
    </DetailRow>

    <DetailRow
      v-if="
        detail.viewingItem.value?.end_date &&
        detail.viewingItem.value.end_date !== detail.viewingItem.value.date
      "
      label="Zeitraum"
    >
      <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
      {{ formatDate(detail.viewingItem.value.date) }} –
      {{ formatDate(detail.viewingItem.value.end_date) }}
    </DetailRow>

    <DetailRow
      v-if="!detail.linkedTitleFor(detail.viewingEntry.value) && detail.viewingItem.value?.location"
      label="Ort"
    >
      <AppIcon :icon="FORM_FIELD_ICONS.location" :size="14" group="formFields" />
      {{ detail.viewingItem.value.location }}
    </DetailRow>

    <DetailRow
      v-if="detail.linkedTitleFor(detail.viewingEntry.value)"
      label="Verknüpfter Ort"
      tag="div"
      class="linked-entity-row"
    >
      <LinkedEntityButton
        :label="detail.linkedTitleFor(detail.viewingEntry.value)!"
        :image-url="detail.viewingLinkedEntityImageUrl.value"
        :icon="detail.viewingEntry.value?.iconDef ?? FORM_FIELD_ICONS.location"
        :icon-group="detail.viewingLinkedEntityIconGroup.value"
        class="linked-entity-btn"
        @click="detail.navigateToLinkedEntity"
      />
    </DetailRow>

    <RichTextDisplay
      v-if="detail.viewingItem.value?.note && !isEmptyRichText(detail.viewingItem.value.note)"
      :content="detail.viewingItem.value.note"
      format="html"
      class="detail-row note"
    />

    <FileAttachments
      v-if="detail.viewingItem.value"
      domain="schedule"
      :entity-id="detail.viewingItem.value.id"
      :editable="false"
    />

    <div
      v-if="detail.viewingEffectiveCoords.value || detail.viewingEntry.value"
      class="detail-actions"
    >
      <MapsAppPicker
        v-if="detail.viewingEffectiveCoords.value"
        :lat="detail.viewingEffectiveCoords.value.lat"
        :lng="detail.viewingEffectiveCoords.value.lng"
        :title="detail.viewingEffectiveCoords.value.title"
        :maps-link="detail.viewingEffectiveCoords.value.mapsLink"
      />
      <CalendarExportDropdown
        v-if="detail.viewingEntry.value"
        :entry="detail.viewingEntry.value"
        variant="tonal"
        size="sm"
        label="In meinen Kalender"
        :show-label="true"
      />
    </div>
  </DetailModal>
</template>

<style scoped>
.detail-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
  background: var(--color-hover);
  color: var(--color-text-muted);
  border: var(--border-width) solid var(--color-border);
}

.detail-badge.weather-badge {
  background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 20%, transparent);
  color: var(--color-text);
}

.linked-entity-row {
  margin-top: var(--space-2);
  margin-bottom: var(--space-1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-width: 0;
}

.detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: var(--border-width) solid var(--color-border);
}
</style>

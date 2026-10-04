<script setup lang="ts">
import type { useScheduleItemDetail } from '../composables/useScheduleItemDetail';
import DetailModal from './DetailModal.vue';
import DetailRow from './primitives/DetailRow.vue';
import Badge from './primitives/Badge.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import WeatherIcon from './WeatherIcon.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import FileAttachments from './FileAttachments.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import CalendarExportDropdown from './CalendarExportDropdown.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
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
          (detail.viewingWeatherEntry.value.weather.tempMax !== 0 ||
            detail.viewingWeatherEntry.value.weather.tempMin !== 0)
        "
        class="detail-badge weather-badge"
      >
        <WeatherIcon :code="detail.viewingWeatherEntry.value.weather.weatherCode" :size="13" />
        {{ Math.round(detail.viewingWeatherEntry.value.weather.tempMax) }}° /
        {{ Math.round(detail.viewingWeatherEntry.value.weather.tempMin) }}°
      </span>
      <Badge v-if="detail.viewingItem.value?.auto_created" variant="primary" size="sm">
        <AppIcon :icon="ACTION_ICONS.sparkles" :size="12" group="actions" />
        Automatisch angelegt
      </Badge>
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
      :label="detail.viewingEntry.value?.spotId != null ? 'Verknüpfter Ort' : 'Verknüpfte Tour'"
      tag="div"
      class="linked-entity-row"
    >
      <Button
        variant="secondary"
        size="sm"
        class="linked-entity-btn"
        @click="detail.navigateToLinkedEntity"
      >
        <AppIcon
          :icon="
            detail.viewingEntry.value?.iconDef ??
            (detail.viewingEntry.value?.spotId != null
              ? FORM_FIELD_ICONS.location
              : SECTION_ICON_DEFS.excursions)
          "
          :size="15"
          group="categories"
        />
        <span class="linked-entity-title">{{
          detail.linkedTitleFor(detail.viewingEntry.value)
        }}</span>
        <AppIcon
          :icon="ACTION_ICONS.scrollRight"
          :size="12"
          group="actions"
          class="linked-entity-chevron"
        />
      </Button>
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
        variant="card-action"
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
}

.linked-entity-row {
  margin-top: var(--space-2);
  margin-bottom: var(--space-1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

.linked-entity-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
}

.linked-entity-title {
  min-width: 0;
  max-width: 32ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.linked-entity-chevron {
  margin-left: var(--space-1);
  opacity: 0.6;
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

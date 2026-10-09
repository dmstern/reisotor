<script setup lang="ts">
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

defineProps<{
  routeLabel?: string | null;
  stationsSummaryText?: string | null;
  effectiveDepartureTime?: string | null;
  effectiveArrivalTime?: string | null;
  travelDuration?: string | null;
}>();
</script>

<template>
  <div class="tour-route-line">
    <p v-if="routeLabel" class="route" :title="routeLabel">{{ routeLabel }}</p>
    <p
      v-else-if="stationsSummaryText"
      class="route tour-stations-summary"
      :title="stationsSummaryText"
    >
      {{ stationsSummaryText }}
    </p>
    <p v-if="effectiveDepartureTime || effectiveArrivalTime" class="departure-arrival">
      <span class="time-block" v-if="effectiveDepartureTime">
        <AppIcon :icon="FORM_FIELD_ICONS.time" :size="13" group="formFields" />
        {{ effectiveDepartureTime
        }}<template v-if="effectiveArrivalTime">&ndash;{{ effectiveArrivalTime }}</template
        >&nbsp;Uhr
      </span>
      <span v-else-if="effectiveArrivalTime" class="time-block">
        <AppIcon :icon="FORM_FIELD_ICONS.time" :size="13" group="formFields" />
        Ankunft {{ effectiveArrivalTime }}&nbsp;Uhr
      </span>
      <span v-if="travelDuration" class="duration-separator">·</span>
      <span v-if="travelDuration" class="duration">{{ travelDuration }}</span>
    </p>
  </div>
</template>

<style scoped>
.tour-route-line {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.route {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.35;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tour-stations-summary {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.departure-arrival {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.35;
  color: var(--color-text-muted);
}

.departure-arrival .time-block {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  white-space: nowrap;
}

.departure-arrival .duration-separator {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.departure-arrival .duration {
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>

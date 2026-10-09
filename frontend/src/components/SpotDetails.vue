<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../api/types';
import { parseContact } from '../utils/contact';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import AppIcon from './AppIcon.vue';
import DetailRow from './primitives/DetailRow.vue';
import RichTextDisplay from './RichTextDisplay.vue';

const props = defineProps<{
  spot: Spot;
  expanded: boolean;
  isAccommodation: boolean;
  payerLabel?: string | null;
  hasMultipleMembers?: boolean;
}>();

const hasDetails = computed(() => props.isAccommodation || !!props.spot.address);

function formatAccommodationDate(d: string | null) {
  if (!d) return null;
  return formatDateShared(d);
}
</script>

<template>
  <div v-if="hasDetails" class="spot-accordion" :class="{ 'is-expanded': expanded }">
    <div class="spot-accordion-inner accordion-stagger">
      <DetailRow v-if="isAccommodation && (spot.start_date || spot.end_date)" label="Zeitraum">
        <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
        {{ formatAccommodationDate(spot.start_date) || '?' }} –
        {{ formatAccommodationDate(spot.end_date) || '?' }}
      </DetailRow>
      <DetailRow v-if="spot.address" label="Adresse">
        {{ spot.address }}
      </DetailRow>
      <template v-if="isAccommodation">
        <DetailRow v-if="spot.checkin || spot.checkout" label="Check-in/-out">
          {{ spot.checkin || '–' }} · {{ spot.checkout || '–' }}
        </DetailRow>
        <DetailRow
          v-if="spot.contact && parseContact(spot.contact).kind === 'phone'"
          label="Kontakt"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.contact" :size="14" group="formFields" />
          <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
        </DetailRow>
        <DetailRow
          v-else-if="spot.contact && parseContact(spot.contact).kind === 'email'"
          label="Kontakt"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.email" :size="14" group="formFields" />
          <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
        </DetailRow>
        <DetailRow v-else-if="spot.contact" label="Kontakt">
          <RichTextDisplay class="contact-text" :content="spot.contact" />
        </DetailRow>
        <DetailRow v-if="spot.amount != null" label="Kosten">
          <AppIcon :icon="FORM_FIELD_ICONS.amount" :size="14" group="formFields" />
          <span class="nobr">{{ spot.amount.toFixed(2) }}&nbsp;€</span>
          <span v-if="hasMultipleMembers !== false && spot.paid_by_user_id">
            · bezahlt von {{ payerLabel }}</span
          >
        </DetailRow>
      </template>
    </div>
  </div>
</template>

<style scoped>
.spot-accordion {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition:
    grid-template-rows 0.22s cubic-bezier(0.32, 0.72, 0, 1) 0s,
    visibility 0s linear 0.22s;
}

.spot-accordion.is-expanded {
  grid-template-rows: 1fr;
  visibility: visible;
  transition:
    grid-template-rows 0.35s cubic-bezier(0.32, 0.72, 0, 1) 0.14s,
    visibility 0s linear 0.14s;
}

.spot-accordion-inner {
  display: block;
  overflow: hidden;
  padding: 3px;
  margin: -3px;
}

.spot-accordion.is-expanded .spot-accordion-inner {
  overflow: visible;
}

.spot-accordion-inner > * {
  transition:
    opacity 0.2s ease 0s,
    transform 0.2s ease 0s;
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
}

.spot-accordion.is-expanded .spot-accordion-inner > * {
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition-delay: calc(var(--stagger-idx, 0) * 35ms + 140ms);
}

.contact-text :deep(br:last-child) {
  display: none;
}

.nobr {
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .spot-accordion,
  .spot-accordion-inner > * {
    transition: none;
  }
}
</style>

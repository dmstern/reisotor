<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../api/types';
import { parseContact } from '../utils/contact';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { ACTION_ICONS } from '../utils/actionIcons';
import { linkLabel } from '../utils/linkLabel';
import { travelTypeIconDef } from '../utils/travelTypeIcon';
import { formatTravelDuration } from '../utils/travelDuration';
import {
  formatSpotDistance,
  type SpotAccommodationDistanceInfo,
} from '../utils/spotAccommodationDistance';
import AppIcon from './AppIcon.vue';
import DetailRow from './primitives/DetailRow.vue';
import CopyButton from './primitives/CopyButton.vue';
import RichTextDisplay from './RichTextDisplay.vue';

const props = defineProps<{
  spot: Spot;
  expanded: boolean;
  isAccommodation: boolean;
  payerLabel?: string | null;
  hasMultipleMembers?: boolean;
  accommodationDistance?: SpotAccommodationDistanceInfo | null;
}>();

const hasDetails = computed(
  () =>
    props.isAccommodation ||
    !!props.spot.address ||
    !!props.spot.link ||
    !!props.accommodationDistance
);

function formatAccommodationDate(dateStr: string | null) {
  if (!dateStr) {
    return null;
  }

  return formatDateShared(dateStr);
}

const periodText = computed(() => {
  const start = formatAccommodationDate(props.spot.start_date);
  const end = formatAccommodationDate(props.spot.end_date);

  if (start && end) {
    return `${start} – ${end}`;
  }

  return start || end || '';
});

const checkinCheckoutText = computed(() => {
  if (props.spot.checkin && props.spot.checkout) {
    return `${props.spot.checkin} · ${props.spot.checkout}`;
  }

  return props.spot.checkin || props.spot.checkout || '';
});

/**
 * Zerlegt eine einzeilige Adresse an Kommas in zusammenhängende Segmente
 * (z. B. ["Av. 24 de Julho 49,", "1200-479 Lisboa"]), damit PLZ + Ort
 * nicht vor dem Komma an der Straße kleben bleiben und erst in sich umbrechen,
 * wenn ein einzelnes Segment breiter als die gesamte Spalte ist.
 */
const addressChunks = computed(() => {
  const raw = props.spot.address?.trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(/,\s*/)
    .filter(Boolean)
    .map((part, index, list) => (index < list.length - 1 ? `${part},` : part));
});
</script>

<template>
  <div v-if="hasDetails" class="spot-accordion" :class="{ 'is-expanded': expanded }">
    <dl class="spot-accordion-inner accordion-stagger">
      <DetailRow
        v-if="isAccommodation && (spot.start_date || spot.end_date)"
        label="Zeitraum"
        icon="period"
      >
        <span class="detail-chunk">
          {{ formatAccommodationDate(spot.start_date) || '?' }} –
          {{ formatAccommodationDate(spot.end_date) || '?' }}
        </span>
        <CopyButton
          v-if="periodText"
          :text="periodText"
          label="Zeitraum kopieren"
          toast-message="Zeitraum in die Zwischenablage kopiert."
        />
      </DetailRow>
      <DetailRow v-if="spot.address" label="Adresse" icon="location">
        <template v-for="(chunk, idx) in addressChunks" :key="idx">
          <span class="detail-chunk">{{ chunk }}</span
          >{{ idx < addressChunks.length - 1 ? ' ' : '' }}
        </template>
        <CopyButton
          :text="spot.address"
          label="Adresse kopieren"
          toast-message="Adresse in die Zwischenablage kopiert."
        />
      </DetailRow>
      <template v-if="isAccommodation">
        <DetailRow v-if="spot.checkin || spot.checkout" label="Check-in/-out" icon="time">
          <span class="detail-chunk">{{ spot.checkin || '–' }} · {{ spot.checkout || '–' }}</span>
          <CopyButton
            v-if="checkinCheckoutText"
            :text="checkinCheckoutText"
            label="Check-in/-out kopieren"
            toast-message="Check-in/-out in die Zwischenablage kopiert."
          />
        </DetailRow>
        <DetailRow
          v-if="spot.contact && parseContact(spot.contact).kind === 'phone'"
          label="Kontakt"
          icon="contact"
        >
          <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
          <CopyButton
            :text="spot.contact"
            label="Telefonnummer kopieren"
            toast-message="Telefonnummer in die Zwischenablage kopiert."
          />
        </DetailRow>
        <DetailRow
          v-else-if="spot.contact && parseContact(spot.contact).kind === 'email'"
          label="Kontakt"
          icon="email"
        >
          <a :href="parseContact(spot.contact).href" @click.stop>{{ spot.contact }}</a>
          <CopyButton
            :text="spot.contact"
            label="E-Mail-Adresse kopieren"
            toast-message="E-Mail-Adresse in die Zwischenablage kopiert."
          />
        </DetailRow>
        <DetailRow v-else-if="spot.contact" label="Kontakt" icon="contact">
          <RichTextDisplay class="contact-text" :content="spot.contact" />
          <CopyButton
            :text="spot.contact"
            label="Kontakt kopieren"
            toast-message="Kontakt in die Zwischenablage kopiert."
          />
        </DetailRow>
        <DetailRow v-if="spot.amount != null" label="Kosten" icon="amount">
          <span class="nobr">{{ spot.amount.toFixed(2) }}&nbsp;€</span>
          <span v-if="hasMultipleMembers !== false && spot.paid_by_user_id" class="detail-chunk">
            · bezahlt von {{ payerLabel }}</span
          >
          <CopyButton
            :text="`${spot.amount.toFixed(2)} €`"
            label="Kosten kopieren"
            toast-message="Kosten in die Zwischenablage kopiert."
          />
        </DetailRow>
      </template>
      <DetailRow v-if="spot.link" :label="isAccommodation ? 'Buchung' : 'Website'" icon="link">
        <a
          :href="spot.link"
          target="_blank"
          rel="noopener noreferrer"
          class="spot-external-link"
          @click.stop
        >
          <span>{{ linkLabel(spot.link) }}</span>
          <AppIcon :icon="ACTION_ICONS.externalLink" :size="12" group="actions" />
        </a>
        <CopyButton
          :text="spot.link"
          :label="isAccommodation ? 'Buchungs-Link kopieren' : 'Link kopieren'"
          :toast-message="
            isAccommodation
              ? 'Buchungs-Link in die Zwischenablage kopiert.'
              : 'Link in die Zwischenablage kopiert.'
          "
        />
      </DetailRow>
      <DetailRow
        v-if="!isAccommodation && accommodationDistance"
        label="Entfernung"
        :icon="ACTION_ICONS.distance"
        icon-group="actions"
      >
        <span class="detail-chunk">
          {{
            formatSpotDistance(
              accommodationDistance.distanceMeters,
              accommodationDistance.isFallback
            )
          }}
        </span>
        <span v-if="accommodationDistance.durationSeconds != null" class="detail-chunk">
          ·
          <AppIcon
            :icon="
              travelTypeIconDef(
                accommodationDistance.profile === 'foot-walking' ? 'zu Fuß' : 'Auto'
              )
            "
            :size="13"
            group="actions"
            force-style="icons"
            class="spot-distance-transport-icon"
          />
          ca.
          {{
            formatTravelDuration(
              Math.max(1, Math.round(accommodationDistance.durationSeconds / 60))
            )
          }}
        </span>
        <span v-else-if="accommodationDistance.isFallback" class="detail-chunk"> · Luftlinie </span>
        {{ ' '
        }}<span class="spot-accommodation-name detail-chunk"
          >(von {{ accommodationDistance.accommodationTitle }})</span
        >
      </DetailRow>
    </dl>
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
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: var(--space-md);
  row-gap: var(--space-1-5);
  align-items: baseline;
  overflow: hidden;
  padding: 3px;
  margin: -3px;
}

.spot-accordion-inner :deep(.detail-row) {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid;
  margin: 0;
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

.spot-external-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  word-break: break-all;
}

.spot-external-link:hover {
  color: var(--color-primary-hover, var(--color-primary));
}

.spot-distance-transport-icon {
  vertical-align: -1px;
  margin-right: 1px;
}

.spot-accommodation-name {
  color: var(--color-text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .spot-accordion,
  .spot-accordion-inner > * {
    transition: none;
  }
}
</style>

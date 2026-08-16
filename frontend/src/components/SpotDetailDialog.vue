<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import { parseContact } from '../utils/contact';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import { useSpotsStore } from '../stores/spots';
import DetailModal from './DetailModal.vue';
import CategoryChip from './CategoryChip.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import FileAttachments from './FileAttachments.vue';
import RichTextDisplay from './RichTextDisplay.vue';
import AppIcon from './AppIcon.vue';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { ACTION_ICONS } from '../utils/actionIcons';

// Eigenständige Komponente statt inline in SpotCard.vue, da dieser Dialog auch von anderer Stelle
// geöffnet werden muss (TripMap.vue's Stationsliste, ExcursionDetailDialog.vue's Stationen) – nicht
// nur aus der Spots-Übersicht heraus. Zeigt bei Kategorie "Unterkunft" zusätzlich deren
// Zusatzfelder (Adresse/Zeitraum/Check-in-out/Kontakt/Kosten) – seit der Verschmelzung von
// Unterkunft in Spots (siehe Migrationskommentar in db/index.ts) ist das kein eigener Dialog mehr,
// sondern nur noch eine Kategorie wie jede andere.
const props = defineProps<{
  modelValue: boolean;
  spot: Spot;
  creatorLabel: string | null;
  likeCount: number;
  liked: boolean;
  comments: CommentItem[];
  /** Nur für Kategorie "Unterkunft" mit gesetztem paid_by_user_id relevant. */
  payerLabel?: string | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
  (e: 'toggle-like'): void;
  (e: 'submit-comment', content: string): void;
  (e: 'remove-comment', id: number): void;
  (e: 'show-on-map'): void;
}>();

const spotsStore = useSpotsStore();
const isAccommodation = computed(() => props.spot.category === 'Unterkunft');

function formatDate(d: string | null) {
  if (!d) return null;
  return formatDateShared(d);
}
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="spot.title"
    :image-url="spot.image_url"
    :placeholder-icon="spotCategoryMeta(spot.category).tabler"
    @edit="emit('edit')"
  >
    <p v-if="creatorLabel" class="detail-row"><span class="detail-label">Von</span>{{ creatorLabel }}</p>
    <p v-if="spot.category" class="detail-row"><CategoryChip :category="spot.category" /></p>

    <button
      v-if="!isAccommodation"
      type="button"
      class="done-toggle"
      :class="{ active: !!spot.done }"
      :aria-pressed="!!spot.done"
      @click="spotsStore.setDone(spot.id, !spot.done)"
    >
      <template v-if="spot.done">
        <AppIcon :icon="ACTION_ICONS.done" :size="14" group="actions" /> Gemacht
      </template>
      <template v-else>
        <AppIcon :icon="ACTION_ICONS.notDone" :size="14" group="actions" /> Als gemacht markieren
      </template>
    </button>

    <template v-if="isAccommodation">
      <p v-if="spot.start_date || spot.end_date" class="detail-row">
        <span class="detail-label">Zeitraum</span>
        <AppIcon :icon="FORM_FIELD_ICONS.period" :size="14" group="formFields" />
        {{ formatDate(spot.start_date) || '?' }} – {{ formatDate(spot.end_date) || '?' }}
      </p>
      <p v-if="spot.address" class="detail-row">
        <span class="detail-label">Adresse</span>{{ spot.address }}
      </p>
      <div v-if="spot.lat != null && spot.lng != null" class="detail-actions map-actions">
        <button type="button" class="card-action-btn" @click="emit('show-on-map')">
          <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> Auf Karte anzeigen
        </button>
        <MapsAppPicker :lat="spot.lat" :lng="spot.lng" :title="spot.title" :maps-link="spot.maps_link" />
      </div>
      <p v-if="spot.checkin || spot.checkout" class="detail-row">
        <span class="detail-label">Check-in/-out</span>
        {{ spot.checkin || '–' }} · {{ spot.checkout || '–' }}
      </p>
      <p v-if="spot.contact && parseContact(spot.contact).kind === 'phone'" class="detail-row">
        <span class="detail-label">Kontakt</span>
        <AppIcon :icon="FORM_FIELD_ICONS.contact" :size="14" group="formFields" />
        <a :href="parseContact(spot.contact).href">{{ spot.contact }}</a>
      </p>
      <p v-else-if="spot.contact && parseContact(spot.contact).kind === 'email'" class="detail-row">
        <span class="detail-label">Kontakt</span>
        <AppIcon :icon="FORM_FIELD_ICONS.email" :size="14" group="formFields" />
        <a :href="parseContact(spot.contact).href">{{ spot.contact }}</a>
      </p>
      <p v-else-if="spot.contact" class="detail-row">
        <span class="detail-label">Kontakt</span>
        <span class="contact-text richtext" v-html="renderRichText(spot.contact)"></span>
      </p>
      <p v-if="spot.amount != null" class="detail-row">
        <span class="detail-label">Kosten</span>
        <AppIcon :icon="FORM_FIELD_ICONS.amount" :size="14" group="formFields" /> {{ spot.amount.toFixed(2) }} €
        <span v-if="spot.paid_by_user_id"> · bezahlt von {{ payerLabel }}</span>
      </p>
    </template>

    <RichTextDisplay v-if="spot.note" class="detail-row note" :content="spot.note" :format="spot.note_format" />
    <div class="social-row">
      <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
    </div>
    <Comments
      :comments="comments"
      @submit="(content) => emit('submit-comment', content)"
      @remove="(id) => emit('remove-comment', id)"
    />
    <FileAttachments domain="spots" :entity-id="spot.id" :editable="false" />
    <div v-if="!isAccommodation" class="detail-actions">
      <button
        v-if="spot.lat != null && spot.lng != null"
        type="button"
        class="card-action-btn"
        @click="emit('show-on-map')"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> Auf Karte anzeigen
      </button>
      <MapsAppPicker v-if="spot.lat != null && spot.lng != null" :lat="spot.lat" :lng="spot.lng" :title="spot.title" :maps-link="spot.maps_link" />
    </div>
  </DetailModal>
</template>

<style scoped>
.note {
  overflow-wrap: anywhere;
}

.social-row {
  margin-top: var(--space-2);
}

.contact-text :deep(br:last-child) {
  display: none;
}

/* Gleicher Chip-Grundstil wie ExcursionDetailDialog.vue's .done-toggle für optische Konsistenz
   zwischen Miniatur-Karte und Detail-Ansicht. */
.done-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  corner-shape: round;
  padding: 4px 12px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  cursor: pointer;
  margin-bottom: var(--space-2);
}

.done-toggle.active {
  color: var(--color-success);
  font-weight: 600;
}
</style>

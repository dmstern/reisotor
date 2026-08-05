<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../api/types';
import { spotCategoryMeta } from '../utils/spotCategory';
import { renderRichText } from '../utils/richText';
import { parseContact } from '../utils/contact';
import { formatDate as formatDateShared } from '../utils/dateFormat';
import DetailModal from './DetailModal.vue';
import CategoryChip from './CategoryChip.vue';
import MapsAppPicker from './MapsAppPicker.vue';
import LikeButton from './LikeButton.vue';
import Comments, { type CommentItem } from './Comments.vue';
import FileAttachments from './FileAttachments.vue';

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
    :placeholder-icon="spotCategoryMeta(spot.category).icon"
    @edit="emit('edit')"
  >
    <p v-if="creatorLabel" class="detail-row"><span class="detail-label">Von</span>{{ creatorLabel }}</p>
    <p v-if="spot.category" class="detail-row"><CategoryChip :category="spot.category" /></p>

    <template v-if="isAccommodation">
      <p v-if="spot.start_date || spot.end_date" class="detail-row">
        <span class="detail-label">Zeitraum</span>
        🗓️ {{ formatDate(spot.start_date) || '?' }} – {{ formatDate(spot.end_date) || '?' }}
      </p>
      <p v-if="spot.address" class="detail-row">
        <span class="detail-label">Adresse</span>{{ spot.address }}
      </p>
      <div v-if="spot.lat != null && spot.lng != null" class="detail-actions map-actions">
        <button type="button" class="card-action-btn" @click="emit('show-on-map')">🗺️ Auf Karte anzeigen</button>
        <MapsAppPicker :lat="spot.lat" :lng="spot.lng" :title="spot.title" :maps-link="spot.maps_link" />
      </div>
      <p v-if="spot.checkin || spot.checkout" class="detail-row">
        <span class="detail-label">Check-in/-out</span>
        {{ spot.checkin || '–' }} · {{ spot.checkout || '–' }}
      </p>
      <p v-if="spot.contact && parseContact(spot.contact).kind === 'phone'" class="detail-row">
        <span class="detail-label">Kontakt</span>
        📞 <a :href="parseContact(spot.contact).href">{{ spot.contact }}</a>
      </p>
      <p v-else-if="spot.contact && parseContact(spot.contact).kind === 'email'" class="detail-row">
        <span class="detail-label">Kontakt</span>
        📧 <a :href="parseContact(spot.contact).href">{{ spot.contact }}</a>
      </p>
      <p v-else-if="spot.contact" class="detail-row">
        <span class="detail-label">Kontakt</span>
        <span class="contact-text richtext" v-html="renderRichText(spot.contact)"></span>
      </p>
      <p v-if="spot.amount != null" class="detail-row">
        <span class="detail-label">Kosten</span>
        💶 {{ spot.amount.toFixed(2) }} €
        <span v-if="spot.paid_by_user_id"> · bezahlt von {{ payerLabel }}</span>
      </p>
    </template>

    <div v-if="spot.note" class="detail-row note richtext" v-html="renderRichText(spot.note)"></div>
    <div class="social-row">
      <LikeButton :count="likeCount" :liked="liked" @toggle="emit('toggle-like')" />
    </div>
    <Comments
      :comments="comments"
      @submit="(content) => emit('submit-comment', content)"
      @remove="(id) => emit('remove-comment', id)"
    />
    <FileAttachments domain="spots" :entity-id="spot.id" />
    <div v-if="!isAccommodation" class="detail-actions">
      <button
        v-if="spot.lat != null && spot.lng != null"
        type="button"
        class="card-action-btn"
        @click="emit('show-on-map')"
      >
        🗺️ Auf Karte anzeigen
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
</style>

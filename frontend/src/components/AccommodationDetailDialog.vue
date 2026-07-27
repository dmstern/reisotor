<script setup lang="ts">
import type { Accommodation } from '../api/types';
import { renderRichText } from '../utils/richText';
import { parseContact } from '../utils/contact';
import DetailModal from './DetailModal.vue';

// Eigenständige Komponente statt inline in AccommodationView.vue, da dieser Dialog auch von anderer
// Stelle geöffnet werden muss (MapView.vue's Stationsliste, ExcursionDetailDialog.vue's Stationen,
// falls die Unterkunft dort als Ausflug-Station eingeplant ist) – gleiches Vorgehen wie
// SpotDetailDialog.vue/ExcursionDetailDialog.vue.
defineProps<{
  modelValue: boolean;
  accommodation: Accommodation;
  payerLabel: string | null;
}>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'edit'): void;
  (e: 'show-on-map'): void;
}>();

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
</script>

<template>
  <DetailModal
    :model-value="modelValue"
    @update:model-value="(v) => emit('update:modelValue', v)"
    :title="accommodation.name"
    placeholder-icon="🛏️"
    @edit="emit('edit')"
  >
    <p v-if="accommodation.start_date || accommodation.end_date" class="detail-row">
      <span class="detail-label">Zeitraum</span>
      🗓️ {{ formatDate(accommodation.start_date) || '?' }} – {{ formatDate(accommodation.end_date) || '?' }}
    </p>
    <p v-if="accommodation.address" class="detail-row">
      <span class="detail-label">Adresse</span>{{ accommodation.address }}
    </p>
    <p v-if="accommodation.checkin || accommodation.checkout" class="detail-row">
      <span class="detail-label">Check-in/-out</span>
      {{ accommodation.checkin || '–' }} · {{ accommodation.checkout || '–' }}
    </p>
    <p v-if="accommodation.contact && parseContact(accommodation.contact).kind === 'phone'" class="detail-row">
      <span class="detail-label">Kontakt</span>
      📞 <a :href="parseContact(accommodation.contact).href">{{ accommodation.contact }}</a>
    </p>
    <p v-else-if="accommodation.contact && parseContact(accommodation.contact).kind === 'email'" class="detail-row">
      <span class="detail-label">Kontakt</span>
      📧 <a :href="parseContact(accommodation.contact).href">{{ accommodation.contact }}</a>
    </p>
    <p v-else-if="accommodation.contact" class="detail-row">
      <span class="detail-label">Kontakt</span>
      <span class="contact-text" v-html="renderRichText(accommodation.contact)"></span>
    </p>
    <p v-if="accommodation.amount != null" class="detail-row">
      <span class="detail-label">Kosten</span>
      💶 {{ accommodation.amount.toFixed(2) }} €
      <span v-if="accommodation.paid_by_user_id"> · bezahlt von {{ payerLabel }}</span>
    </p>
    <div v-if="accommodation.note" class="detail-row note" v-html="renderRichText(accommodation.note)"></div>
    <div class="detail-actions">
      <button
        v-if="accommodation.lat != null && accommodation.lng != null"
        type="button"
        class="card-action-btn"
        @click="emit('show-on-map')"
      >
        🗺️ Auf Karte anzeigen
      </button>
    </div>
  </DetailModal>
</template>

<style scoped>
.note {
  overflow-wrap: anywhere;
}

.contact-text :deep(br:last-child) {
  display: none;
}
</style>

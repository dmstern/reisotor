<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ExcursionLeg, Spot, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Button from './primitives/Button.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { travelTypeIcon } from '../utils/travelTypeIcon';
import { spotCategoryMeta } from '../utils/spotCategory';

const TRANSPORT_TYPE_OPTIONS = [
  'Zug',
  'Flug',
  'Bus',
  'Auto',
  'Fähre',
  'Fahrrad',
  'zu Fuß',
  'Sonstiges',
];

const props = defineProps<{
  modelValue: boolean;
  fromSpot?: Spot | null;
  toSpot?: Spot | null;
  leg?: ExcursionLeg | null;
  users: User[];
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', leg: ExcursionLeg): void;
  (e: 'delete'): void;
}>();

const form = ref({
  transport_type: 'Zug',
  departure_time: '',
  arrival_time: '',
  checkin_info: '',
  seat: '',
  luggage: '',
  ticket_link: '',
  note: '',
  amount: '',
  paid_by_user_id: '',
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    if (props.leg) {
      form.value = {
        transport_type: props.leg.transport_type || 'Zug',
        departure_time: props.leg.departure_time || '',
        arrival_time: props.leg.arrival_time || '',
        checkin_info: props.leg.checkin_info || '',
        seat: props.leg.seat || '',
        luggage: props.leg.luggage || '',
        ticket_link: props.leg.ticket_link || '',
        note: props.leg.note || '',
        amount: props.leg.amount != null ? String(props.leg.amount) : '',
        paid_by_user_id: props.leg.paid_by_user_id != null ? String(props.leg.paid_by_user_id) : '',
      };
    } else {
      form.value = {
        transport_type: 'Zug',
        departure_time: '',
        arrival_time: '',
        checkin_info: '',
        seat: '',
        luggage: '',
        ticket_link: '',
        note: '',
        amount: '',
        paid_by_user_id: '',
      };
    }
  },
  { immediate: true }
);

const modalTitle = computed(() => {
  const fromName = props.fromSpot?.title || 'Start';
  const toName = props.toSpot?.title || 'Ziel';
  return `Teilstrecke: ${fromName} → ${toName}`;
});

const hasExistingData = computed(() => {
  if (!props.leg) return false;
  return !!(
    props.leg.transport_type ||
    props.leg.departure_time ||
    props.leg.arrival_time ||
    props.leg.checkin_info ||
    props.leg.seat ||
    props.leg.luggage ||
    props.leg.ticket_link ||
    props.leg.note ||
    props.leg.amount
  );
});

function onSave() {
  if (!props.fromSpot || !props.toSpot) return;
  const legData: ExcursionLeg = {
    id: props.leg?.id,
    position: props.leg?.position ?? 0,
    from_spot_id: props.fromSpot.id,
    to_spot_id: props.toSpot.id,
    transport_type: form.value.transport_type || null,
    departure_time: form.value.departure_time || null,
    arrival_time: form.value.arrival_time || null,
    checkin_info: form.value.checkin_info.trim() || null,
    seat: form.value.seat.trim() || null,
    luggage: form.value.luggage.trim() || null,
    ticket_link: form.value.ticket_link.trim() || null,
    note: form.value.note.trim() || null,
    amount: form.value.amount ? Number(form.value.amount) : null,
    paid_by_user_id:
      form.value.amount && form.value.paid_by_user_id ? Number(form.value.paid_by_user_id) : null,
    budget_expense_id: props.leg?.budget_expense_id,
  };
  emit('save', legData);
  emit('update:modelValue', false);
}

function onDelete() {
  emit('delete');
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    size="md"
    @update:model-value="(val) => emit('update:modelValue', val)"
  >
    <form class="leg-form" @submit.prevent="onSave">
      <div class="route-summary" v-if="fromSpot && toSpot">
        <span class="spot-pill">
          <AppIcon
            :icon="spotCategoryMeta(fromSpot.category).tabler"
            :size="14"
            group="categories"
          />
          {{ fromSpot.title }}
        </span>
        <span class="arrow">→</span>
        <span class="spot-pill">
          <AppIcon :icon="spotCategoryMeta(toSpot.category).tabler" :size="14" group="categories" />
          {{ toSpot.title }}
        </span>
      </div>

      <FormField icon="category" label="Verkehrsmittel">
        <select v-model="form.transport_type">
          <option v-for="t in TRANSPORT_TYPE_OPTIONS" :key="t" :value="t">
            {{ travelTypeIcon(t) }} {{ t }}
          </option>
        </select>
      </FormField>

      <div class="row">
        <FormField icon="time" label="Abfahrt / Abflug">
          <input v-model="form.departure_time" type="time" />
        </FormField>
        <FormField icon="time" label="Ankunft">
          <input v-model="form.arrival_time" type="time" />
        </FormField>
      </div>

      <FormField icon="note" label="Vorher da sein / Treffpunkt">
        <input
          v-model="form.checkin_info"
          type="text"
          placeholder="z. B. Gleis 4 / 2 Std. vorher am Flughafen"
        />
      </FormField>

      <div class="row">
        <FormField icon="note" label="Sitzplatz">
          <input v-model="form.seat" type="text" placeholder="z. B. Wagen 21, Platz 44" />
        </FormField>
        <FormField icon="note" label="Gepäck">
          <input
            v-model="form.luggage"
            type="text"
            placeholder="z. B. 1x Koffer 23kg, Handgepäck"
          />
        </FormField>
      </div>

      <FormField icon="link" label="Buchungslink / Ticket-URL">
        <input v-model="form.ticket_link" type="url" placeholder="https://..." />
      </FormField>

      <div class="row">
        <FormField icon="amount" label="Ticketkosten (€)">
          <input
            v-model="form.amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="z. B. 49.90"
          />
        </FormField>
        <FormField v-if="users.length > 1" icon="shared" label="Bezahlt von">
          <select v-model="form.paid_by_user_id">
            <option value="">– wählen –</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </select>
        </FormField>
      </div>
      <p v-if="users.length > 1 && form.amount && !form.paid_by_user_id" class="hint">
        Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
      </p>

      <FormField icon="note" label="Notiz zur Teilstrecke">
        <input v-model="form.note" type="text" placeholder="Tipps zum Umstieg, Buchungscode etc." />
      </FormField>

      <div class="actions-row">
        <Button v-if="hasExistingData" type="button" variant="danger" size="sm" @click="onDelete">
          <AppIcon :icon="ACTION_ICONS.delete" :size="14" group="actions" /> Teilstrecke leeren
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="ghost" @click="emit('update:modelValue', false)">
          Abbrechen
        </Button>
        <Button type="submit" variant="primary"> Übernehmen </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.leg-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.route-summary {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.04));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.9rem;
  font-weight: 500;
}

.spot-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.arrow {
  color: var(--color-text-muted);
  font-weight: 700;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.spacer {
  flex: 1;
}

@media (max-width: 600px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>

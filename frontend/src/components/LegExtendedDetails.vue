<script setup lang="ts">
import type { User } from '../api/types';
import type { ExtendedFieldsConfig } from '../utils/legTransportConfig';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';

const checkinInfo = defineModel<string>('checkinInfo', { default: '' });
const seat = defineModel<string>('seat', { default: '' });
const luggage = defineModel<string>('luggage', { default: '' });
const ticketLink = defineModel<string>('ticketLink', { default: '' });
const amount = defineModel<string>('amount', { default: '' });
const paidByUserId = defineModel<string>('paidByUserId', { default: '' });
const note = defineModel<string>('note', { default: '' });

const props = defineProps<{
  extendedConfig: ExtendedFieldsConfig;
  showsSeatField: boolean;
  users: User[];
  hasExtendedData: boolean;
}>();
</script>

<template>
  <CollapsibleFieldset label="Erweiterte Angaben" :open-initial="props.hasExtendedData">
    <FormField
      :icon="props.extendedConfig.icons.checkin"
      :label="props.extendedConfig.labels.checkin"
    >
      <Input
        v-model="checkinInfo"
        type="text"
        :placeholder="props.extendedConfig.placeholders.checkin"
      />
    </FormField>

    <div v-if="props.showsSeatField" class="row">
      <FormField :icon="props.extendedConfig.icons.seat" :label="props.extendedConfig.labels.seat">
        <Input v-model="seat" type="text" :placeholder="props.extendedConfig.placeholders.seat" />
      </FormField>
      <FormField
        :icon="props.extendedConfig.icons.luggage"
        :label="props.extendedConfig.labels.luggage"
      >
        <Input
          v-model="luggage"
          type="text"
          :placeholder="props.extendedConfig.placeholders.luggage"
        />
      </FormField>
    </div>
    <FormField
      v-else
      :icon="props.extendedConfig.icons.luggage"
      :label="props.extendedConfig.labels.luggage"
    >
      <Input
        v-model="luggage"
        type="text"
        :placeholder="props.extendedConfig.placeholders.luggage"
      />
    </FormField>

    <FormField
      :icon="props.extendedConfig.icons.ticketLink"
      :label="props.extendedConfig.labels.ticketLink"
    >
      <Input
        v-model="ticketLink"
        type="url"
        :placeholder="props.extendedConfig.placeholders.ticketLink"
      />
    </FormField>

    <div class="row">
      <FormField
        :icon="props.extendedConfig.icons.amount"
        :label="props.extendedConfig.labels.amount"
      >
        <Input
          v-model="amount"
          type="number"
          step="0.01"
          min="0"
          :placeholder="props.extendedConfig.placeholders.amount"
        />
      </FormField>
      <FormField v-if="props.users.length > 1" icon="shared" label="Bezahlt von">
        <Select v-model="paidByUserId">
          <option value="">– wählen –</option>
          <option v-for="u in props.users" :key="u.id" :value="String(u.id)">
            {{ u.avatar }} {{ u.username }}
          </option>
        </Select>
      </FormField>
    </div>
    <p v-if="props.users.length > 1 && amount && !paidByUserId" class="hint">
      Ohne Zahler:in wird der Betrag nicht in der Budgetplanung berücksichtigt.
    </p>

    <FormField :icon="props.extendedConfig.icons.note" :label="props.extendedConfig.labels.note">
      <Input v-model="note" type="text" :placeholder="props.extendedConfig.placeholders.note" />
    </FormField>
  </CollapsibleFieldset>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

@container (max-width: 480px) {
  .row {
    grid-template-columns: 1fr;
  }
}
</style>

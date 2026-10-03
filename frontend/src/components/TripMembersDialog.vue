<script setup lang="ts">
import type { Trip } from '../api/types';
import Modal from './Modal.vue';
import TripPermissionsSettings from './TripPermissionsSettings.vue';

const props = defineProps<{ modelValue: boolean; trip: Trip | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="`Mitglieder – ${props.trip?.name ?? ''}`"
    @update:model-value="close"
  >
    <TripPermissionsSettings
      v-if="modelValue && props.trip"
      :trip-id="props.trip.id"
      :trip="props.trip"
    />
  </Modal>
</template>

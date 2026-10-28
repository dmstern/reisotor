<script setup lang="ts">
import { computed } from 'vue';
import type { Trip } from '../api/types';
import Modal from './Modal.vue';
import TripPermissionsSettings from './TripPermissionsSettings.vue';
import { useTripStore } from '../stores/trip';

const props = defineProps<{ modelValue: boolean; trip: Trip | null }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const tripStore = useTripStore();
const currentTrip = computed(() => {
  const trip = props.trip;
  if (!trip) return null;
  return tripStore.trips.find((t) => t.id === trip.id) ?? trip;
});

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="`Mitglieder – ${currentTrip?.name ?? ''}`"
    @update:model-value="close"
  >
    <TripPermissionsSettings
      v-if="modelValue && currentTrip"
      :trip-id="currentTrip.id"
      :trip="currentTrip"
    />
  </Modal>
</template>

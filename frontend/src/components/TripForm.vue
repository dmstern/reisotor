<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TripFormData } from '../stores/trip';

const props = defineProps<{ initial?: TripFormData; submitLabel?: string }>();
const emit = defineEmits<{ (e: 'submit', data: TripFormData): void }>();

function blankForm(): TripFormData {
  return { name: '', destination: '', start_date: '', end_date: '' };
}

const form = ref<TripFormData>(props.initial ? { ...props.initial } : blankForm());

watch(
  () => props.initial,
  (initial) => {
    form.value = initial ? { ...initial } : blankForm();
  },
);

function onSubmit() {
  if (!form.value.name.trim() || !form.value.start_date || !form.value.end_date) return;
  emit('submit', {
    name: form.value.name.trim(),
    destination: form.value.destination || undefined,
    start_date: form.value.start_date,
    end_date: form.value.end_date,
  });
}
</script>

<template>
  <form class="trip-form" @submit.prevent="onSubmit">
    <label>
      Name der Reise
      <input v-model="form.name" type="text" placeholder="z. B. Italien 2026" required />
    </label>
    <label>
      Ziel (optional)
      <input v-model="form.destination" type="text" placeholder="z. B. Toskana" />
    </label>
    <div class="dates-row">
      <label>
        Start
        <input v-model="form.start_date" type="date" required />
      </label>
      <label>
        Ende
        <input v-model="form.end_date" type="date" required />
      </label>
    </div>
    <button type="submit">{{ submitLabel ?? 'Speichern' }}</button>
  </form>
</template>

<style scoped>
.trip-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.dates-row {
  display: flex;
  gap: var(--space-2);
}

.dates-row label {
  flex: 1;
}
</style>

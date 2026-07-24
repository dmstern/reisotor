<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { Accommodation } from '../api/types';

const loading = ref(true);
const saving = ref(false);
const saved = ref(false);

const form = ref({
  name: '',
  address: '',
  link: '',
  checkin: '',
  checkout: '',
  contact: '',
  note: '',
  lat: '',
  lng: '',
});

onMounted(async () => {
  const acc = await api.get<Accommodation | null>('/accommodation');
  if (acc) {
    form.value = {
      name: acc.name ?? '',
      address: acc.address ?? '',
      link: acc.link ?? '',
      checkin: acc.checkin ?? '',
      checkout: acc.checkout ?? '',
      contact: acc.contact ?? '',
      note: acc.note ?? '',
      lat: acc.lat != null ? String(acc.lat) : '',
      lng: acc.lng != null ? String(acc.lng) : '',
    };
  }
  loading.value = false;
});

async function save() {
  saving.value = true;
  saved.value = false;
  try {
    await api.put<Accommodation>('/accommodation', {
      name: form.value.name.trim(),
      address: form.value.address || undefined,
      link: form.value.link || undefined,
      checkin: form.value.checkin || undefined,
      checkout: form.value.checkout || undefined,
      contact: form.value.contact || undefined,
      note: form.value.note || undefined,
      lat: form.value.lat ? Number(form.value.lat) : undefined,
      lng: form.value.lng ? Number(form.value.lng) : undefined,
    });
    saved.value = true;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Unterkunft</h1>

    <form class="card form" @submit.prevent="save">
      <label>
        Name
        <input v-model="form.name" type="text" required />
      </label>
      <label>
        Adresse
        <input v-model="form.address" type="text" />
      </label>
      <label>
        Link (Buchungsseite o. Ä.)
        <input v-model="form.link" type="url" />
      </label>
      <div class="row">
        <label>
          Check-in
          <input v-model="form.checkin" type="text" placeholder="z. B. 15:00" />
        </label>
        <label>
          Check-out
          <input v-model="form.checkout" type="text" placeholder="z. B. 11:00" />
        </label>
      </div>
      <label>
        Kontakt
        <input v-model="form.contact" type="text" />
      </label>
      <label>
        Notizen
        <textarea v-model="form.note" rows="3"></textarea>
      </label>
      <div class="row">
        <label>
          Lat
          <input v-model="form.lat" type="number" step="any" />
        </label>
        <label>
          Lng
          <input v-model="form.lng" type="number" step="any" />
        </label>
      </div>

      <button type="submit" :disabled="saving">{{ saving ? 'Speichern…' : 'Speichern' }}</button>
      <p v-if="saved" class="saved">Gespeichert ✓</p>
    </form>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 520px;
}

label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-weight: 600;
  font-size: 0.9rem;
  flex: 1;
}

.row {
  display: flex;
  gap: var(--space-3);
}

.saved {
  color: var(--color-success);
  margin: 0;
}
</style>

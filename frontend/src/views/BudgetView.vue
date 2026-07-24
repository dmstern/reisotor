<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { BudgetItem } from '../api/types';
import BudgetTable from '../components/BudgetTable.vue';

const items = ref<BudgetItem[]>([]);
const loading = ref(true);
const showForm = ref(false);

const form = ref({ title: '', category: '', amount: '', paid_by: '' });

onMounted(async () => {
  items.value = await api.get<BudgetItem[]>('/budget');
  loading.value = false;
});

const summary = computed(() => {
  const total = items.value.reduce((sum, i) => sum + i.amount, 0);
  const paid = items.value.filter((i) => i.is_paid).reduce((sum, i) => sum + i.amount, 0);
  return { total, paid, rest: total - paid };
});

async function addItem() {
  if (!form.value.title.trim() || !form.value.amount) return;
  const created = await api.post<BudgetItem>('/budget', {
    title: form.value.title.trim(),
    category: form.value.category || undefined,
    amount: Number(form.value.amount),
    paid_by: form.value.paid_by || undefined,
  });
  items.value.unshift(created);
  form.value = { title: '', category: '', amount: '', paid_by: '' };
  showForm.value = false;
}

async function togglePaid(item: BudgetItem) {
  const updated = await api.put<BudgetItem>(`/budget/${item.id}`, {
    title: item.title,
    category: item.category ?? undefined,
    amount: item.amount,
    paid_by: item.paid_by ?? undefined,
    is_paid: !item.is_paid,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

async function remove(id: number) {
  await api.delete(`/budget/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header">
      <h1>Budget</h1>
      <button @click="showForm = !showForm">{{ showForm ? 'Abbrechen' : '+ Position' }}</button>
    </div>

    <div class="card summary">
      <div>
        <span class="label">Gesamt</span>
        <strong>{{ summary.total.toFixed(2) }} €</strong>
      </div>
      <div>
        <span class="label">Bezahlt</span>
        <strong class="paid">{{ summary.paid.toFixed(2) }} €</strong>
      </div>
      <div>
        <span class="label">Rest</span>
        <strong class="rest">{{ summary.rest.toFixed(2) }} €</strong>
      </div>
    </div>

    <form v-if="showForm" class="card add-form" @submit.prevent="addItem">
      <input v-model="form.title" type="text" placeholder="Titel" required />
      <input v-model="form.category" type="text" placeholder="Kategorie" />
      <input v-model="form.amount" type="number" step="0.01" placeholder="Betrag" required />
      <input v-model="form.paid_by" type="text" placeholder="Bezahlt von (optional)" />
      <button type="submit">Speichern</button>
    </form>

    <div class="card table-wrap">
      <BudgetTable :items="items" @toggle-paid="togglePaid" @remove="remove" />
    </div>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.summary {
  display: flex;
  gap: var(--space-5);
  margin-bottom: var(--space-4);
}

.summary div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.paid {
  color: var(--color-success);
}

.rest {
  color: var(--color-accent);
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.add-form input {
  flex: 1;
  min-width: 120px;
}

.table-wrap {
  padding: 0;
  overflow-x: auto;
}

.table-wrap table {
  min-width: 480px;
}
</style>

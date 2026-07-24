<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type {
  BudgetCategoryTarget,
  BudgetExpense,
  BudgetTarget,
  BudgetTransfer,
  User,
} from '../api/types';
import { assignCategoryColors } from '../utils/categoryColors';
import BudgetMeter from '../components/BudgetMeter.vue';

const users = ref<User[]>([]);
const expenses = ref<BudgetExpense[]>([]);
const targets = ref<BudgetTarget[]>([]);
const categoryTargets = ref<BudgetCategoryTarget[]>([]);
const transfers = ref<BudgetTransfer[]>([]);
const loading = ref(true);

const today = () => new Date().toISOString().slice(0, 10);

async function refreshTargets() {
  targets.value = await api.get<BudgetTarget[]>('/budget/targets');
}
async function refreshCategoryTargets() {
  categoryTargets.value = await api.get<BudgetCategoryTarget[]>('/budget/category-targets');
}

onMounted(async () => {
  const [u, e, t, ct, tr] = await Promise.all([
    api.get<User[]>('/users'),
    api.get<BudgetExpense[]>('/budget'),
    api.get<BudgetTarget[]>('/budget/targets'),
    api.get<BudgetCategoryTarget[]>('/budget/category-targets'),
    api.get<BudgetTransfer[]>('/budget/transfers'),
  ]);
  users.value = u;
  expenses.value = e;
  targets.value = t;
  categoryTargets.value = ct;
  transfers.value = tr;

  totalTargetInput.value = String(totalTarget.value || '');
  for (const user of u) {
    userTargetInputs.value[user.id] = String(userTarget(user.id) || '');
  }

  loading.value = false;
});

function userName(id: number | null) {
  if (id == null) return 'Gemeinsam';
  return users.value.find((u) => u.id === id)?.username ?? '?';
}
function userAvatar(id: number | null) {
  if (id == null) return '🤝';
  return users.value.find((u) => u.id === id)?.avatar ?? '❓';
}

// --- Zielbudgets ---
const totalTarget = computed(() => targets.value.find((t) => t.owner_id === null)?.amount ?? 0);
function userTarget(userId: number) {
  return targets.value.find((t) => t.owner_id === userId)?.amount ?? 0;
}

const totalTargetInput = ref('');
const userTargetInputs = ref<Record<number, string>>({});
const targetSaved = ref<string | null>(null);

async function saveTotalTarget() {
  await api.put('/budget/targets', { owner_id: null, amount: Number(totalTargetInput.value) || 0 });
  await refreshTargets();
  targetSaved.value = 'total';
  window.setTimeout(() => (targetSaved.value = null), 1500);
}

async function saveUserTarget(userId: number) {
  await api.put('/budget/targets', { owner_id: userId, amount: Number(userTargetInputs.value[userId]) || 0 });
  await refreshTargets();
  targetSaved.value = `user-${userId}`;
  window.setTimeout(() => (targetSaved.value = null), 1500);
}

// --- Kategorien-Zielbudgets ---
const newCategoryForm = ref({ category: '', amount: '' });

async function saveCategoryTarget(category: string, amount: string) {
  await api.put('/budget/category-targets', { category, amount: Number(amount) || 0 });
  await refreshCategoryTargets();
}

async function addCategoryTarget() {
  if (!newCategoryForm.value.category.trim()) return;
  await saveCategoryTarget(newCategoryForm.value.category.trim(), newCategoryForm.value.amount);
  newCategoryForm.value = { category: '', amount: '' };
}

async function removeCategoryTarget(id: number) {
  await api.delete(`/budget/category-targets/${id}`);
  await refreshCategoryTargets();
}

// --- Ausgaben (Bezahlungen) ---
const totalSpent = computed(() => expenses.value.reduce((s, e) => s + e.amount, 0));
function spentByUser(userId: number) {
  return expenses.value.filter((e) => e.paid_by_user_id === userId).reduce((s, e) => s + e.amount, 0);
}

const expenseCategories = computed(() => {
  const set = new Set<string>();
  categoryTargets.value.forEach((c) => set.add(c.category));
  expenses.value.forEach((e) => e.category && set.add(e.category));
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
});

const showExpenseForm = ref(false);
const editingExpenseId = ref<number | null>(null);
const expenseForm = ref({
  title: '',
  category: '',
  amount: '',
  paid_by_user_id: '',
  date: today(),
  note: '',
});

function resetExpenseForm() {
  expenseForm.value = { title: '', category: '', amount: '', paid_by_user_id: '', date: today(), note: '' };
  editingExpenseId.value = null;
}

function startEditExpense(expense: BudgetExpense) {
  editingExpenseId.value = expense.id;
  expenseForm.value = {
    title: expense.title,
    category: expense.category ?? '',
    amount: String(expense.amount),
    paid_by_user_id: expense.paid_by_user_id != null ? String(expense.paid_by_user_id) : '',
    date: expense.date ?? today(),
    note: expense.note ?? '',
  };
  showExpenseForm.value = true;
}

async function submitExpense() {
  if (!expenseForm.value.title.trim() || !expenseForm.value.amount) return;
  const body = {
    title: expenseForm.value.title.trim(),
    category: expenseForm.value.category || undefined,
    amount: Number(expenseForm.value.amount),
    paid_by_user_id: expenseForm.value.paid_by_user_id ? Number(expenseForm.value.paid_by_user_id) : undefined,
    date: expenseForm.value.date || undefined,
    note: expenseForm.value.note || undefined,
  };

  if (editingExpenseId.value) {
    const updated = await api.put<BudgetExpense>(`/budget/${editingExpenseId.value}`, body);
    const idx = expenses.value.findIndex((e) => e.id === updated.id);
    if (idx !== -1) expenses.value[idx] = updated;
  } else {
    const created = await api.post<BudgetExpense>('/budget', body);
    expenses.value.unshift(created);
  }
  resetExpenseForm();
  showExpenseForm.value = false;
}

async function removeExpense(id: number) {
  await api.delete(`/budget/${id}`);
  expenses.value = expenses.value.filter((e) => e.id !== id);
}

// --- Überweisungen ---
const showTransferForm = ref(false);
const transferForm = ref({ from_user_id: '', to_user_id: '', amount: '', date: today(), note: '' });

async function submitTransfer() {
  if (!transferForm.value.from_user_id || !transferForm.value.to_user_id || !transferForm.value.amount) return;
  if (transferForm.value.from_user_id === transferForm.value.to_user_id) return;
  const created = await api.post<BudgetTransfer>('/budget/transfers', {
    from_user_id: Number(transferForm.value.from_user_id),
    to_user_id: Number(transferForm.value.to_user_id),
    amount: Number(transferForm.value.amount),
    date: transferForm.value.date || undefined,
    note: transferForm.value.note || undefined,
  });
  transfers.value.unshift(created);
  transferForm.value = { from_user_id: '', to_user_id: '', amount: '', date: today(), note: '' };
  showTransferForm.value = false;
}

async function removeTransfer(id: number) {
  await api.delete(`/budget/transfers/${id}`);
  transfers.value = transfers.value.filter((t) => t.id !== id);
}

// --- Salden / Schulden ---
const balances = computed(() => {
  const n = users.value.length;
  if (n === 0) return [];
  const fairShare = totalSpent.value / n;
  return users.value.map((u) => {
    const paid = spentByUser(u.id);
    const received = transfers.value.filter((t) => t.to_user_id === u.id).reduce((s, t) => s + t.amount, 0);
    const sent = transfers.value.filter((t) => t.from_user_id === u.id).reduce((s, t) => s + t.amount, 0);
    // Eine Überweisung ist eine Schuldenrückzahlung: wer sendet, baut Schulden ab (net steigt);
    // wer empfängt, hat bereits Ausgleich bekommen (net sinkt).
    const net = paid - fairShare + sent - received;
    return { user: u, paid, fairShare, net };
  });
});

const twoPersonSummary = computed(() => {
  if (balances.value.length !== 2) return null;
  const [a, b] = balances.value;
  if (Math.abs(a.net) < 0.01) return { settled: true as const };
  const [debtor, creditor] = a.net < 0 ? [a, b] : [b, a];
  return { settled: false as const, debtor: debtor.user, creditor: creditor.user, amount: Math.abs(a.net) };
});

// --- Kategorien-Breakdown ---
const categoryBreakdown = computed(() => {
  const names = new Set<string>();
  categoryTargets.value.forEach((c) => names.add(c.category));
  expenses.value.forEach((e) => names.add(e.category?.trim() || 'Sonstiges'));
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'de'));
  const colors = assignCategoryColors(sorted);
  return sorted.map((category) => ({
    category,
    spent: expenses.value
      .filter((e) => (e.category?.trim() || 'Sonstiges') === category)
      .reduce((s, e) => s + e.amount, 0),
    target: categoryTargets.value.find((c) => c.category === category)?.amount ?? 0,
    color: colors.get(category) ?? '#8a8a86',
  }));
});
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Budget</h1>

    <div class="grid kpis">
      <div class="card kpi">
        <span class="kpi-label">Gesamtbudget</span>
        <strong class="kpi-value">{{ totalTarget.toFixed(2) }} €</strong>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Ausgegeben</span>
        <strong class="kpi-value">{{ totalSpent.toFixed(2) }} €</strong>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Rest</span>
        <strong class="kpi-value" :class="{ negative: totalTarget - totalSpent < 0 }">
          {{ (totalTarget - totalSpent).toFixed(2) }} €
        </strong>
      </div>
    </div>

    <!-- Salden -->
    <div class="card">
      <h2>Wer schuldet wem?</h2>
      <p v-if="twoPersonSummary?.settled" class="settled">✅ Ausgeglichen – niemand schuldet aktuell etwas.</p>
      <p v-else-if="twoPersonSummary" class="debt-sentence">
        {{ userAvatar(twoPersonSummary.debtor.id) }} <strong>{{ twoPersonSummary.debtor.username }}</strong>
        schuldet {{ userAvatar(twoPersonSummary.creditor.id) }}
        <strong>{{ twoPersonSummary.creditor.username }}</strong> noch
        <strong class="debt-amount">{{ twoPersonSummary.amount.toFixed(2) }} €</strong>
      </p>

      <ul class="balance-list">
        <li v-for="b in balances" :key="b.user.id">
          <span>{{ b.user.avatar }} {{ b.user.username }}</span>
          <span :class="b.net >= 0 ? 'positive' : 'negative'">
            {{ b.net >= 0 ? 'bekommt' : 'schuldet' }} {{ Math.abs(b.net).toFixed(2) }} €
          </span>
        </li>
      </ul>
      <p class="hint">
        Berechnung: Ausgaben werden zu gleichen Teilen unter allen Nutzer:innen aufgeteilt; Überweisungen
        gleichen das direkt aus.
      </p>
    </div>

    <!-- Kategorien -->
    <div class="card">
      <h2>Kategorien</h2>
      <BudgetMeter
        v-for="c in categoryBreakdown"
        :key="c.category"
        :label="c.category"
        :spent="c.spent"
        :target="c.target"
        :color="c.color"
      />
    </div>

    <!-- Zielbudgets bearbeiten -->
    <div class="card">
      <h2>Zielbudgets bearbeiten</h2>
      <div class="target-row">
        <label>Gesamt</label>
        <input v-model="totalTargetInput" type="number" step="0.01" />
        <button class="secondary" @click="saveTotalTarget">Speichern</button>
        <span v-if="targetSaved === 'total'" class="saved-hint">✓</span>
      </div>
      <div class="target-row" v-for="u in users" :key="u.id">
        <label>{{ u.avatar }} {{ u.username }}</label>
        <input v-model="userTargetInputs[u.id]" type="number" step="0.01" />
        <button class="secondary" @click="saveUserTarget(u.id)">Speichern</button>
        <span v-if="targetSaved === `user-${u.id}`" class="saved-hint">✓</span>
      </div>

      <h3>Kategorien-Budgets</h3>
      <div class="target-row" v-for="c in categoryTargets" :key="c.id">
        <label>{{ c.category }}</label>
        <input
          type="number"
          step="0.01"
          :value="c.amount"
          @change="saveCategoryTarget(c.category, ($event.target as HTMLInputElement).value)"
        />
        <button class="secondary" @click="removeCategoryTarget(c.id)">✕</button>
      </div>
      <form class="target-row" @submit.prevent="addCategoryTarget">
        <input v-model="newCategoryForm.category" type="text" placeholder="Neue Kategorie" />
        <input v-model="newCategoryForm.amount" type="number" step="0.01" placeholder="Ziel €" />
        <button type="submit">+ Hinzufügen</button>
      </form>
    </div>

    <!-- Bezahlungen -->
    <div class="card">
      <div class="header">
        <h2>Bezahlungen</h2>
        <button
          @click="
            showExpenseForm = !showExpenseForm;
            if (!showExpenseForm) resetExpenseForm();
          "
        >
          {{ showExpenseForm ? 'Abbrechen' : '+ Bezahlung eintragen' }}
        </button>
      </div>

      <form v-if="showExpenseForm" class="add-form" @submit.prevent="submitExpense">
        <input v-model="expenseForm.title" type="text" placeholder="Titel" required />
        <input v-model="expenseForm.category" type="text" list="budget-categories" placeholder="Kategorie" />
        <datalist id="budget-categories">
          <option v-for="c in expenseCategories" :key="c" :value="c" />
        </datalist>
        <input v-model="expenseForm.amount" type="number" step="0.01" placeholder="Betrag" required />
        <select v-model="expenseForm.paid_by_user_id" required>
          <option value="" disabled>Bezahlt von…</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
        <input v-model="expenseForm.date" type="date" />
        <input v-model="expenseForm.note" type="text" placeholder="Notiz (optional)" />
        <button type="submit">{{ editingExpenseId ? 'Speichern' : 'Hinzufügen' }}</button>
      </form>

      <table class="data-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Titel</th>
            <th>Kategorie</th>
            <th>Bezahlt von</th>
            <th>Betrag</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in expenses" :key="e.id">
            <td>{{ e.date || '–' }}</td>
            <td>{{ e.title }}<span v-if="e.note" class="note"> · {{ e.note }}</span></td>
            <td>{{ e.category || '–' }}</td>
            <td>{{ userAvatar(e.paid_by_user_id) }} {{ userName(e.paid_by_user_id) }}</td>
            <td>{{ e.amount.toFixed(2) }} €</td>
            <td class="actions">
              <button class="secondary" @click="startEditExpense(e)">✎</button>
              <button class="secondary" @click="removeExpense(e.id)">✕</button>
            </td>
          </tr>
          <tr v-if="!expenses.length">
            <td colspan="6" class="empty">Noch keine Bezahlungen eingetragen.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Überweisungen -->
    <div class="card">
      <div class="header">
        <h2>Überweisungen</h2>
        <button @click="showTransferForm = !showTransferForm">
          {{ showTransferForm ? 'Abbrechen' : '+ Überweisung eintragen' }}
        </button>
      </div>

      <form v-if="showTransferForm" class="add-form" @submit.prevent="submitTransfer">
        <select v-model="transferForm.from_user_id" required>
          <option value="" disabled>Von…</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
        <select v-model="transferForm.to_user_id" required>
          <option value="" disabled>An…</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
        <input v-model="transferForm.amount" type="number" step="0.01" placeholder="Betrag" required />
        <input v-model="transferForm.date" type="date" />
        <input v-model="transferForm.note" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Eintragen</button>
      </form>

      <table class="data-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Von</th>
            <th>An</th>
            <th>Betrag</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in transfers" :key="t.id">
            <td>{{ t.date || '–' }}</td>
            <td>{{ userAvatar(t.from_user_id) }} {{ userName(t.from_user_id) }}</td>
            <td>{{ userAvatar(t.to_user_id) }} {{ userName(t.to_user_id) }}</td>
            <td>{{ t.amount.toFixed(2) }} €</td>
            <td class="actions">
              <button class="secondary" @click="removeTransfer(t.id)">✕</button>
            </td>
          </tr>
          <tr v-if="!transfers.length">
            <td colspan="5" class="empty">Noch keine Überweisungen eingetragen.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.kpis {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  margin-bottom: var(--space-4);
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kpi-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.kpi-value {
  font-size: 1.4rem;
  color: var(--color-primary-dark);
}

.kpi-value.negative {
  color: var(--color-danger);
}

.page > .card {
  margin-bottom: var(--space-4);
}

.card h2 {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
}

.card h3 {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: var(--space-3) 0 var(--space-2);
}

.settled {
  color: var(--color-success);
  font-weight: 600;
}

.debt-sentence {
  font-size: 1rem;
}

.debt-amount {
  color: var(--color-accent);
}

.balance-list {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.balance-list li {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
  padding: 4px 0;
}

.positive {
  color: var(--color-success);
  font-weight: 600;
}

.negative {
  color: var(--color-danger);
  font-weight: 600;
}

.hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: var(--space-2) 0 0;
}

.target-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.target-row label {
  flex: 1;
  min-width: 100px;
  font-size: 0.9rem;
}

.target-row input {
  width: 120px;
}

.saved-hint {
  color: var(--color-success);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.add-form input,
.add-form select {
  flex: 1;
  min-width: 130px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  text-align: left;
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.88rem;
}

.data-table th {
  color: var(--color-text-muted);
  font-weight: 600;
}

.note {
  color: var(--color-text-muted);
  font-size: 0.82rem;
}

.actions {
  display: flex;
  gap: 4px;
}

.actions button {
  padding: 4px 8px;
  font-size: 0.8rem;
}

.empty {
  color: var(--color-text-muted);
  text-align: center;
}
</style>

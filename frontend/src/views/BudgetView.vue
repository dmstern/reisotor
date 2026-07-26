<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type {
  Accommodation,
  Budget,
  BudgetAllocation,
  BudgetExpense,
  BudgetTransfer,
  TravelItem,
  User,
} from '../api/types';
import { useTripStore } from '../stores/trip';
import { assignCategoryColors } from '../utils/categoryColors';
import BudgetMeter from '../components/BudgetMeter.vue';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import Combobox from '../components/Combobox.vue';

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const users = ref<User[]>([]);
const expenses = ref<BudgetExpense[]>([]);
const budgets = ref<Budget[]>([]);
const allocations = ref<BudgetAllocation[]>([]);
const transfers = ref<BudgetTransfer[]>([]);
const accommodations = ref<Accommodation[]>([]);
const travelItems = ref<TravelItem[]>([]);
const loading = ref(true);

const today = () => new Date().toISOString().slice(0, 10);

async function refreshBudgets() {
  budgets.value = await api.get<Budget[]>(`/budget/budgets?trip_id=${tripId}`);
}
async function refreshAllocations() {
  allocations.value = await api.get<BudgetAllocation[]>(`/budget/allocations?trip_id=${tripId}`);
}

onMounted(async () => {
  const [u, e, b, a, tr, acc, travel] = await Promise.all([
    api.get<User[]>('/users'),
    api.get<BudgetExpense[]>(`/budget?trip_id=${tripId}`),
    api.get<Budget[]>(`/budget/budgets?trip_id=${tripId}`),
    api.get<BudgetAllocation[]>(`/budget/allocations?trip_id=${tripId}`),
    api.get<BudgetTransfer[]>(`/budget/transfers?trip_id=${tripId}`),
    api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
    api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
  ]);
  users.value = u;
  expenses.value = e;
  budgets.value = b;
  allocations.value = a;
  transfers.value = tr;
  accommodations.value = acc;
  travelItems.value = travel;
  loading.value = false;
});

/** Bezahlungen, die automatisch aus einem Unterkunft- oder Reise-Eintrag erzeugt wurden
 *  (siehe accommodation.ts/travel.ts `planBudgetExpense`), sind hier gemäß der Architekturregel
 *  aus Batch 3 nicht direkt editier-/löschbar – stattdessen springt man zur Ursprungssicht. */
function autoSourceFor(expenseId: number): { label: string; path: string } | null {
  if (accommodations.value.some((a) => a.budget_expense_id === expenseId)) {
    return { label: 'Zur Unterkunft', path: '/accommodation' };
  }
  if (travelItems.value.some((t) => t.budget_expense_id === expenseId)) {
    return { label: 'Zur Reise', path: '/travel' };
  }
  return null;
}

function userName(id: number | null) {
  if (id == null) return 'Gemeinsam';
  return users.value.find((u) => u.id === id)?.username ?? '?';
}
function userAvatar(id: number | null) {
  if (id == null) return '🤝';
  return users.value.find((u) => u.id === id)?.avatar ?? '❓';
}
function budgetLabel(budget: Budget) {
  return budget.owner_id == null ? '🤝 Gemeinsam' : `${userAvatar(budget.owner_id)} ${userName(budget.owner_id)}`;
}

// --- Budgets (persönlich oder geteilt) ---
function allocationsFor(budgetId: number) {
  return allocations.value.filter((a) => a.budget_id === budgetId);
}
function budgetTotal(budgetId: number) {
  return allocationsFor(budgetId).reduce((s, a) => s + a.amount, 0);
}
// Kein manuelles Gesamtbudget mehr: die Summe ergibt sich automatisch aus allen Budgets.
const grandTotal = computed(() => budgets.value.reduce((s, b) => s + budgetTotal(b.id), 0));

const newBudgetForm = ref({ name: '', kind: 'shared' as 'shared' | 'personal', owner_id: '' });
const showNewBudgetForm = ref(false);

async function addBudget() {
  if (!newBudgetForm.value.name.trim()) return;
  if (newBudgetForm.value.kind === 'personal' && !newBudgetForm.value.owner_id) return;
  const created = await api.post<Budget>('/budget/budgets', {
    trip_id: tripId,
    name: newBudgetForm.value.name.trim(),
    owner_id: newBudgetForm.value.kind === 'personal' ? Number(newBudgetForm.value.owner_id) : undefined,
  });
  budgets.value.push(created);
  newBudgetForm.value = { name: '', kind: 'shared', owner_id: '' };
  showNewBudgetForm.value = false;
}

function closeNewBudgetForm() {
  showNewBudgetForm.value = false;
  newBudgetForm.value = { name: '', kind: 'shared', owner_id: '' };
}

async function removeBudget(id: number) {
  await api.delete(`/budget/budgets/${id}`);
  budgets.value = budgets.value.filter((b) => b.id !== id);
  allocations.value = allocations.value.filter((a) => a.budget_id !== id);
}

const newCategoryForms = ref<Record<number, { category: string; amount: string }>>({});
function categoryForm(budgetId: number) {
  if (!newCategoryForms.value[budgetId]) {
    newCategoryForms.value[budgetId] = { category: '', amount: '' };
  }
  return newCategoryForms.value[budgetId];
}

async function saveAllocation(budgetId: number, category: string, amount: string) {
  await api.put('/budget/allocations', { budget_id: budgetId, category, amount: Number(amount) || 0 });
  await refreshAllocations();
}

async function addAllocation(budgetId: number) {
  const form = categoryForm(budgetId);
  if (!form.category.trim()) return;
  await saveAllocation(budgetId, form.category.trim(), form.amount);
  newCategoryForms.value[budgetId] = { category: '', amount: '' };
}

async function removeAllocation(id: number) {
  await api.delete(`/budget/allocations/${id}`);
  allocations.value = allocations.value.filter((a) => a.id !== id);
}

// --- Ausgaben (Bezahlungen) ---
const totalSpent = computed(() => expenses.value.reduce((s, e) => s + e.amount, 0));

/** Ausgaben ohne budget_id (u. a. automatisch aus Unterkunft/Reise erzeugte) werden dem
 *  geteilten Budget anhand des Kategorienamens zugeordnet, damit sie in der Aufschlüsselung
 *  auftauchen, ohne dass jede Alt-Ausgabe nachträglich manuell zugewiesen werden muss. */
function spentFor(budget: Budget, category: string) {
  return expenses.value
    .filter((e) => {
      if (e.budget_id === budget.id) return true;
      if (e.budget_id == null && budget.owner_id == null && (e.category ?? '') === category) return true;
      return false;
    })
    .reduce((s, e) => s + e.amount, 0);
}

const expenseCategories = computed(() => {
  const set = new Set<string>();
  allocations.value.forEach((a) => set.add(a.category));
  expenses.value.forEach((e) => e.category && set.add(e.category));
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
});

const showExpenseForm = ref(false);
const emptyExpenseForm = () => ({
  title: '',
  category: '',
  amount: '',
  paid_by_user_id: '',
  date: today(),
  note: '',
  budget_id: '',
});
const expenseForm = ref(emptyExpenseForm());

const editingExpense = ref<BudgetExpense | null>(null);
const editExpenseForm = ref(emptyExpenseForm());

function expenseToBody(f: ReturnType<typeof emptyExpenseForm>) {
  return {
    trip_id: tripId,
    title: f.title.trim(),
    category: f.category || undefined,
    amount: Number(f.amount),
    paid_by_user_id: f.paid_by_user_id ? Number(f.paid_by_user_id) : undefined,
    date: f.date || undefined,
    note: f.note || undefined,
    budget_id: f.budget_id ? Number(f.budget_id) : undefined,
  };
}

async function submitExpense() {
  if (!expenseForm.value.title.trim() || !expenseForm.value.amount) return;
  const created = await api.post<BudgetExpense>('/budget', expenseToBody(expenseForm.value));
  expenses.value.unshift(created);
  expenseForm.value = emptyExpenseForm();
  showExpenseForm.value = false;
}

function closeExpenseForm() {
  showExpenseForm.value = false;
  expenseForm.value = emptyExpenseForm();
}

function startEditExpense(expense: BudgetExpense) {
  editingExpense.value = expense;
  editExpenseForm.value = {
    title: expense.title,
    category: expense.category ?? '',
    amount: String(expense.amount),
    paid_by_user_id: expense.paid_by_user_id != null ? String(expense.paid_by_user_id) : '',
    date: expense.date ?? today(),
    note: expense.note ?? '',
    budget_id: expense.budget_id != null ? String(expense.budget_id) : '',
  };
}

async function submitEditExpense() {
  if (!editingExpense.value || !editExpenseForm.value.title.trim() || !editExpenseForm.value.amount) return;
  const updated = await api.put<BudgetExpense>(
    `/budget/${editingExpense.value.id}`,
    expenseToBody(editExpenseForm.value),
  );
  const idx = expenses.value.findIndex((e) => e.id === updated.id);
  if (idx !== -1) expenses.value[idx] = updated;
  editingExpense.value = null;
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
    trip_id: tripId,
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

function closeTransferForm() {
  showTransferForm.value = false;
  transferForm.value = { from_user_id: '', to_user_id: '', amount: '', date: today(), note: '' };
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
    const paid = expenses.value.filter((e) => e.paid_by_user_id === u.id).reduce((s, e) => s + e.amount, 0);
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

// --- Kategorienfarben (konsistent über alle Budgets hinweg) ---
const categoryColors = computed(() => {
  const names = new Set<string>();
  allocations.value.forEach((a) => names.add(a.category));
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'de'));
  return assignCategoryColors(sorted);
});
</script>

<template>
  <div class="page" v-if="!loading">
    <h1>Budget</h1>

    <div class="grid kpis">
      <div class="card kpi">
        <span class="kpi-label">Gesamtbudget</span>
        <strong class="kpi-value">{{ grandTotal.toFixed(2) }} €</strong>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Ausgegeben</span>
        <strong class="kpi-value">{{ totalSpent.toFixed(2) }} €</strong>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Rest</span>
        <strong class="kpi-value" :class="{ negative: grandTotal - totalSpent < 0 }">
          {{ (grandTotal - totalSpent).toFixed(2) }} €
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

    <!-- Budgets -->
    <div class="card">
      <div class="header">
        <h2>Budgets</h2>
        <button @click="showNewBudgetForm = true">+ Budget anlegen</button>
      </div>
      <p class="hint">
        Legt persönliche oder geteilte Budgets an und teilt sie in Kategorien auf. Das Gesamtbudget oben
        ergibt sich automatisch aus der Summe aller Kategorien aller Budgets.
      </p>

      <Modal :model-value="showNewBudgetForm" title="Budget anlegen" @update:model-value="(v) => !v && closeNewBudgetForm()">
        <form class="new-budget-form" @submit.prevent="addBudget">
          <input v-model="newBudgetForm.name" type="text" placeholder="Name (z. B. Souvenirs)" required />
          <select v-model="newBudgetForm.kind">
            <option value="shared">Geteilt</option>
            <option value="personal">Persönlich</option>
          </select>
          <select v-if="newBudgetForm.kind === 'personal'" v-model="newBudgetForm.owner_id" required>
            <option value="" disabled>Nutzer:in wählen…</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
          </select>
          <button type="submit">Anlegen</button>
        </form>
      </Modal>

      <TransitionGroup tag="div" name="list" class="budget-list">
        <div class="budget-block" v-for="budget in budgets" :key="budget.id">
          <div class="budget-head">
            <h3>{{ budget.name }} <span class="owner-tag">{{ budgetLabel(budget) }}</span></h3>
            <div class="budget-head-actions">
              <strong>{{ budgetTotal(budget.id).toFixed(2) }} €</strong>
              <DeleteButton small @click="removeBudget(budget.id)" />
            </div>
          </div>

          <div class="category-row" v-for="a in allocationsFor(budget.id)" :key="a.id">
            <BudgetMeter
              :label="a.category"
              :spent="spentFor(budget, a.category)"
              :target="a.amount"
              :color="categoryColors.get(a.category) ?? '#8a8a86'"
            />
            <div class="category-edit">
              <input
                type="number"
                step="0.01"
                :value="a.amount"
                @change="saveAllocation(budget.id, a.category, ($event.target as HTMLInputElement).value)"
              />
              <DeleteButton small @click="removeAllocation(a.id)" />
            </div>
          </div>
          <form class="target-row" @submit.prevent="addAllocation(budget.id)">
            <input v-model="categoryForm(budget.id).category" type="text" placeholder="Neue Kategorie" />
            <input v-model="categoryForm(budget.id).amount" type="number" step="0.01" placeholder="Ziel €" />
            <button type="submit">+ Hinzufügen</button>
          </form>
        </div>
        <p v-if="!budgets.length" key="empty" class="empty">Noch keine Budgets angelegt.</p>
      </TransitionGroup>
    </div>

    <!-- Bezahlungen -->
    <div class="card">
      <div class="header">
        <h2>Bezahlungen</h2>
        <button @click="showExpenseForm = true">+ Bezahlung eintragen</button>
      </div>

      <Modal :model-value="showExpenseForm" title="Bezahlung eintragen" @update:model-value="(v) => !v && closeExpenseForm()">
        <form class="add-form" @submit.prevent="submitExpense">
          <input v-model="expenseForm.title" type="text" placeholder="Titel" required />
          <Combobox v-model="expenseForm.category" :options="expenseCategories" placeholder="Kategorie" />
          <input v-model="expenseForm.amount" type="number" step="0.01" placeholder="Betrag" required />
          <select v-model="expenseForm.paid_by_user_id" required>
            <option value="" disabled>Bezahlt von…</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
          </select>
          <select v-model="expenseForm.budget_id">
            <option value="">Kein Budget</option>
            <option v-for="b in budgets" :key="b.id" :value="String(b.id)">{{ b.name }} ({{ budgetLabel(b) }})</option>
          </select>
          <input v-model="expenseForm.date" type="date" />
          <input v-model="expenseForm.note" type="text" placeholder="Notiz (optional)" />
          <button type="submit">Hinzufügen</button>
        </form>
      </Modal>

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
        <TransitionGroup tag="tbody" name="list">
          <tr v-for="e in expenses" :key="e.id">
            <td>{{ e.date || '–' }}</td>
            <td>{{ e.title }}<span v-if="e.note" class="note"> · {{ e.note }}</span></td>
            <td>{{ e.category || '–' }}</td>
            <td>{{ userAvatar(e.paid_by_user_id) }} {{ userName(e.paid_by_user_id) }}</td>
            <td>{{ e.amount.toFixed(2) }} €</td>
            <td class="actions">
              <template v-if="autoSourceFor(e.id)">
                <router-link :to="autoSourceFor(e.id)!.path" class="card-action-btn">
                  {{ autoSourceFor(e.id)!.label }}
                </router-link>
                <DeleteButton small disabled />
              </template>
              <template v-else>
                <EditButton small @click="startEditExpense(e)" />
                <DeleteButton small @click="removeExpense(e.id)" />
              </template>
            </td>
          </tr>
          <tr v-if="!expenses.length" key="empty">
            <td colspan="6" class="empty">Noch keine Bezahlungen eingetragen.</td>
          </tr>
        </TransitionGroup>
      </table>
    </div>

    <!-- Überweisungen -->
    <div class="card">
      <div class="header">
        <h2>Überweisungen</h2>
        <button @click="showTransferForm = true">💸 Überweisung eintragen</button>
      </div>

      <Modal :model-value="showTransferForm" title="Überweisung eintragen" @update:model-value="(v) => !v && closeTransferForm()">
        <form class="add-form" @submit.prevent="submitTransfer">
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
      </Modal>

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
        <TransitionGroup tag="tbody" name="list">
          <tr v-for="t in transfers" :key="t.id">
            <td>{{ t.date || '–' }}</td>
            <td>{{ userAvatar(t.from_user_id) }} {{ userName(t.from_user_id) }}</td>
            <td>{{ userAvatar(t.to_user_id) }} {{ userName(t.to_user_id) }}</td>
            <td>{{ t.amount.toFixed(2) }} €</td>
            <td class="actions">
              <DeleteButton small @click="removeTransfer(t.id)" />
            </td>
          </tr>
          <tr v-if="!transfers.length" key="empty">
            <td colspan="5" class="empty">Noch keine Überweisungen eingetragen.</td>
          </tr>
        </TransitionGroup>
      </table>
    </div>

    <Modal
      :model-value="editingExpense !== null"
      title="Bezahlung bearbeiten"
      @update:model-value="(v) => !v && (editingExpense = null)"
    >
      <form class="add-form" @submit.prevent="submitEditExpense">
        <input v-model="editExpenseForm.title" type="text" placeholder="Titel" required />
        <Combobox v-model="editExpenseForm.category" :options="expenseCategories" placeholder="Kategorie" />
        <input v-model="editExpenseForm.amount" type="number" step="0.01" placeholder="Betrag" required />
        <select v-model="editExpenseForm.paid_by_user_id" required>
          <option value="" disabled>Bezahlt von…</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
        </select>
        <select v-model="editExpenseForm.budget_id">
          <option value="">Kein Budget</option>
          <option v-for="b in budgets" :key="b.id" :value="String(b.id)">{{ b.name }} ({{ budgetLabel(b) }})</option>
        </select>
        <input v-model="editExpenseForm.date" type="date" />
        <input v-model="editExpenseForm.note" type="text" placeholder="Notiz (optional)" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
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
  margin: var(--space-2) 0 var(--space-3);
}

.new-budget-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.new-budget-form input,
.new-budget-form select {
  flex: 1;
  min-width: 140px;
}

.budget-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.budget-block {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
}

.budget-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.budget-head h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text);
}

.owner-tag {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  font-weight: 400;
}

.budget-head-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.target-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.target-row input {
  width: 120px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.category-row :deep(.meter-row) {
  flex: 1;
}

.category-edit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.category-edit input {
  width: 100px;
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
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
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.empty {
  color: var(--color-text-muted);
  text-align: center;
}
</style>

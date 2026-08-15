<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { BudgetExpense, TravelItem } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useSpotsStore } from '../stores/spots';
import { useBudgetStore } from '../stores/budget';
import { useLiveSyncStore } from '../stores/liveSync';
import { assignCategoryColors } from '../utils/categoryColors';
import { toLocalDateString } from '../utils/dateFormat';
import type { SettlementSuggestion } from '../utils/budgetBalances';
import BudgetMeter from '../components/BudgetMeter.vue';
import BudgetPotCard from '../components/BudgetPotCard.vue';
import BudgetSettlementCard from '../components/BudgetSettlementCard.vue';
import BudgetExpenseList from '../components/BudgetExpenseList.vue';
import BudgetTransferList from '../components/BudgetTransferList.vue';
import Modal from '../components/Modal.vue';
import Combobox from '../components/Combobox.vue';
import FormField from '../components/FormField.vue';
import FileAttachments from '../components/FileAttachments.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import { useDraftAutosave } from '../composables/useDraftAutosave';

const tripStore = useTripStore();
const auth = useAuthStore();
const spotsStore = useSpotsStore();
const budgetStore = useBudgetStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
// Unterkunft ist seit der Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts) ganz
// normal ein Spot der Kategorie "Unterkunft" - kein eigener Fetch mehr nötig.
const accommodations = computed(() => spotsStore.spots.filter((s) => s.category === 'Unterkunft'));
const travelItems = ref<TravelItem[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

const today = () => toLocalDateString(new Date());

async function load() {
  try {
    const [, travel] = await Promise.all([
      spotsStore.load(),
      api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
      budgetStore.load(tripId),
    ]);
    travelItems.value = travel;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  highlightedIds.value = liveSync.markSeen('budget');
  load();
});

watch(() => liveSync.domainVersion.budget, load);

/** Bezahlungen, die automatisch aus einem Unterkunft- oder Reise-Eintrag erzeugt wurden
 *  (siehe spots.ts/travel.ts `planBudgetExpense`), sind hier gemäß der Architekturregel
 *  aus Batch 3 nicht direkt editier-/löschbar – stattdessen springt man zur Ursprungssicht. Ein
 *  Unterkunft-Spot lebt seit der Verschmelzung (siehe Migrationskommentar in db/index.ts) in der
 *  normalen Spots-Sicht (/excursions) statt einer eigenen Seite, daher der Hash-Sprung dorthin
 *  (gleiches Muster wie /travel#travel-<id>, siehe hashHighlight.ts). */
function autoSourceFor(expenseId: number): { label: string; path: string } | null {
  const accommodation = accommodations.value.find((a) => a.budget_expense_id === expenseId);
  if (accommodation) {
    return { label: 'Zur Unterkunft', path: `/excursions#spot-${accommodation.id}` };
  }
  if (travelItems.value.some((t) => t.budget_expense_id === expenseId)) {
    return { label: 'Zur Reise', path: '/travel' };
  }
  return null;
}

// --- Budgets (persönlich oder geteilt) ---
const newBudgetForm = ref({ name: '', kind: 'shared' as 'shared' | 'personal', owner_id: '', target_amount: '' });
const showNewBudgetForm = ref(false);

async function addBudget() {
  if (!newBudgetForm.value.name.trim()) return;
  if (newBudgetForm.value.kind === 'personal' && !newBudgetForm.value.owner_id) return;
  await budgetStore.addBudget(tripId, {
    name: newBudgetForm.value.name.trim(),
    owner_id: newBudgetForm.value.kind === 'personal' ? Number(newBudgetForm.value.owner_id) : undefined,
    target_amount: newBudgetForm.value.target_amount ? Number(newBudgetForm.value.target_amount) : undefined,
  });
  newBudgetForm.value = { name: '', kind: 'shared', owner_id: '', target_amount: '' };
  showNewBudgetForm.value = false;
}

function closeNewBudgetForm() {
  showNewBudgetForm.value = false;
  newBudgetForm.value = { name: '', kind: 'shared', owner_id: '', target_amount: '' };
}

// Hinweis (siehe CLAUDE.md-Plan zur Budget-Überarbeitung): private Budgets sind seit der
// Privatsphäre-Härtung wirklich nur für die gewählte Person sichtbar - legt man eines im Namen
// einer/eines anderen Mitreisenden an, verschwindet es danach aus der eigenen Ansicht.
const showsPrivacyHint = computed(
  () => newBudgetForm.value.kind === 'personal' && Number(newBudgetForm.value.owner_id) !== auth.user?.id,
);

// --- Ausgaben (Bezahlungen) ---
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

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts) - nur für die Ausgaben-
// Formulare (Titel/Notiz sind hier Freitext), nicht für Budget-Anlegen/Überweisung/Kategorie-
// Zuteilung (kurze, einzelne Felder mit geringem Verlustrisiko).
const newExpenseDraft = useDraftAutosave('budgetExpense:new', expenseForm, showExpenseForm);
const editExpenseDraft = useDraftAutosave(
  () => `budgetExpense:edit:${editingExpense.value?.id}`,
  editExpenseForm,
  computed(() => editingExpense.value !== null),
);

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
  await budgetStore.submitExpense(expenseToBody(expenseForm.value));
  expenseForm.value = emptyExpenseForm();
  showExpenseForm.value = false;
  newExpenseDraft.clear();
}

function closeExpenseForm() {
  showExpenseForm.value = false;
  expenseForm.value = emptyExpenseForm();
  newExpenseDraft.clear();
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
  await budgetStore.updateExpense(editingExpense.value.id, expenseToBody(editExpenseForm.value));
  editExpenseDraft.clear();
  editingExpense.value = null;
}

function closeEditExpenseForm() {
  editExpenseDraft.clear();
  editingExpense.value = null;
}

// --- Überweisungen ---
const showTransferForm = ref(false);
const emptyTransferForm = () => ({ from_user_id: '', to_user_id: '', amount: '', date: today(), note: '' });
const transferForm = ref(emptyTransferForm());

async function submitTransfer() {
  if (!transferForm.value.from_user_id || !transferForm.value.to_user_id || !transferForm.value.amount) return;
  if (transferForm.value.from_user_id === transferForm.value.to_user_id) return;
  await budgetStore.submitTransfer({
    trip_id: tripId,
    from_user_id: Number(transferForm.value.from_user_id),
    to_user_id: Number(transferForm.value.to_user_id),
    amount: Number(transferForm.value.amount),
    date: transferForm.value.date || undefined,
    note: transferForm.value.note || undefined,
  });
  transferForm.value = emptyTransferForm();
  showTransferForm.value = false;
}

function closeTransferForm() {
  showTransferForm.value = false;
  transferForm.value = emptyTransferForm();
}

// Splitwise-artiger Ausgleichsvorschlag (siehe BudgetSettlementCard.vue): ein Klick befüllt das
// Überweisungs-Formular direkt mit dem Vorschlag, statt die Zahlen manuell abtippen zu müssen.
function useSettlementSuggestion(suggestion: SettlementSuggestion) {
  transferForm.value = {
    from_user_id: String(suggestion.from.id),
    to_user_id: String(suggestion.to.id),
    amount: suggestion.amount.toFixed(2),
    date: today(),
    note: '',
  };
  showTransferForm.value = true;
}

// --- Kategorienfarben (konsistent über alle Budgets hinweg) ---
const categoryColors = computed(() => {
  const names = new Set<string>();
  budgetStore.allocations.forEach((a) => names.add(a.category));
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'de'));
  return assignCategoryColors(sorted);
});
</script>

<template>
  <div class="page budget-page" v-if="!loading">
    <h1>Budget</h1>

    <div class="card overview-card">
      <BudgetMeter
        label="Budget"
        :spent="budgetStore.totalSpent"
        :target="budgetStore.grandTotal"
        color="var(--color-primary-dark)"
      />
      <!-- BudgetMeter zeigt den Überzug-Fall (⚠️ X € über Budget) schon selbst an - hier nur den
           positiven Rest-Fall ergänzen, den BudgetMeter (auch anderswo für Packliste/Einkaufsliste/
           ToDo genutzt, siehe DashboardView.vue) bewusst nicht kennt. -->
      <p v-if="budgetStore.grandTotal > 0 && budgetStore.remaining >= 0" class="remaining-line">
        Noch übrig: <strong>{{ budgetStore.remaining.toFixed(2) }} €</strong>
      </p>
    </div>

    <BudgetSettlementCard @use-suggestion="useSettlementSuggestion" />

    <!-- Budgets -->
    <div class="card">
      <div class="header">
        <h2>Budgets</h2>
        <button @click="showNewBudgetForm = true">+ Budget anlegen</button>
      </div>
      <p class="hint">
        Ganz einfach: ein Topf mit nur einer Gesamtsumme. Oder detaillierter: in Kategorien aufteilen,
        um daraus ein Gesamtbudget zusammenzustellen. Geteilte Töpfe sehen alle Mitreisenden, private
        Töpfe nur die gewählte Person.
      </p>

      <Modal :model-value="showNewBudgetForm" title="Budget anlegen" @update:model-value="(v) => !v && closeNewBudgetForm()">
        <form class="new-budget-form" @submit.prevent="addBudget">
          <FormField icon="title" label="Name">
            <input v-model="newBudgetForm.name" type="text" placeholder="Name (z. B. Souvenirs)" required />
          </FormField>
          <FormField icon="visibility" label="Sichtbarkeit">
            <select v-model="newBudgetForm.kind">
              <option value="shared">Geteilt (alle sehen ihn)</option>
              <option value="personal">Privat (nur eine Person sieht ihn)</option>
            </select>
          </FormField>
          <FormField v-if="newBudgetForm.kind === 'personal'" icon="person" label="Person">
            <select v-model="newBudgetForm.owner_id" required>
              <option value="" disabled>Nutzer:in wählen…</option>
              <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
          </FormField>
          <FormField icon="amount" label="Gesamtziel (optional)">
            <input v-model="newBudgetForm.target_amount" type="number" step="0.01" placeholder="Gesamtziel € (optional)" />
          </FormField>
          <p v-if="showsPrivacyHint" class="privacy-hint">
            🔒 Nur {{ budgetStore.userName(Number(newBudgetForm.owner_id)) }} sieht diesen Topf danach.
          </p>
          <button type="submit">Anlegen</button>
        </form>
      </Modal>

      <TransitionGroup tag="div" name="list" class="pot-grid">
        <BudgetPotCard v-for="budget in budgetStore.budgets" :key="budget.id" :budget="budget" :category-colors="categoryColors" />
        <p v-if="!budgetStore.budgets.length" key="empty" class="empty">Noch keine Budgets angelegt.</p>
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
          <FormField icon="title" label="Titel">
            <input v-model="expenseForm.title" type="text" placeholder="Titel" required />
          </FormField>
          <FormField icon="category" label="Kategorie">
            <Combobox v-model="expenseForm.category" :options="budgetStore.expenseCategories" placeholder="Kategorie" />
          </FormField>
          <FormField icon="amount" label="Betrag">
            <input v-model="expenseForm.amount" type="number" step="0.01" placeholder="Betrag" required />
          </FormField>
          <FormField icon="shared" label="Bezahlt von">
            <select v-model="expenseForm.paid_by_user_id" required>
              <option value="" disabled>Bezahlt von…</option>
              <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
          </FormField>
          <FormField icon="pot" label="Budget-Topf">
            <select v-model="expenseForm.budget_id">
              <option value="">Kein Budget</option>
              <option v-for="b in budgetStore.budgets" :key="b.id" :value="String(b.id)">
                {{ b.name }} ({{ budgetStore.budgetLabel(b) }})
              </option>
            </select>
          </FormField>
          <FormField icon="date" label="Datum">
            <input v-model="expenseForm.date" type="date" />
          </FormField>
          <FormField icon="note" label="Notiz">
            <input v-model="expenseForm.note" type="text" placeholder="Notiz (optional)" />
          </FormField>
          <DraftStatusBar :status="newExpenseDraft.status.value" :restored="newExpenseDraft.restored.value" />
          <button type="submit">Eintragen</button>
        </form>
      </Modal>

      <BudgetExpenseList :highlighted-ids="highlightedIds" :auto-source-for="autoSourceFor" @edit="startEditExpense" />
    </div>

    <!-- Überweisungen -->
    <div class="card">
      <div class="header">
        <h2>Überweisungen</h2>
        <button @click="showTransferForm = true">+ Überweisung eintragen</button>
      </div>

      <Modal :model-value="showTransferForm" title="Überweisung eintragen" @update:model-value="(v) => !v && closeTransferForm()">
        <form class="add-form" @submit.prevent="submitTransfer">
          <FormField icon="person" label="Von">
            <select v-model="transferForm.from_user_id" required>
              <option value="" disabled>Von…</option>
              <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
          </FormField>
          <FormField icon="person" label="An">
            <select v-model="transferForm.to_user_id" required>
              <option value="" disabled>An…</option>
              <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
          </FormField>
          <FormField icon="amount" label="Betrag">
            <input v-model="transferForm.amount" type="number" step="0.01" placeholder="Betrag" required />
          </FormField>
          <FormField icon="date" label="Datum">
            <input v-model="transferForm.date" type="date" />
          </FormField>
          <FormField icon="note" label="Notiz">
            <input v-model="transferForm.note" type="text" placeholder="Notiz (optional)" />
          </FormField>
          <button type="submit">Eintragen</button>
        </form>
      </Modal>

      <BudgetTransferList :highlighted-ids="highlightedIds" />
    </div>

    <Modal
      :model-value="editingExpense !== null"
      title="Bezahlung bearbeiten"
      @update:model-value="(v) => !v && closeEditExpenseForm()"
    >
      <form class="add-form" @submit.prevent="submitEditExpense">
        <FormField icon="title" label="Titel">
          <input v-model="editExpenseForm.title" type="text" placeholder="Titel" required />
        </FormField>
        <FormField icon="category" label="Kategorie">
          <Combobox v-model="editExpenseForm.category" :options="budgetStore.expenseCategories" placeholder="Kategorie" />
        </FormField>
        <FormField icon="amount" label="Betrag">
          <input v-model="editExpenseForm.amount" type="number" step="0.01" placeholder="Betrag" required />
        </FormField>
        <FormField icon="shared" label="Bezahlt von">
          <select v-model="editExpenseForm.paid_by_user_id" required>
            <option value="" disabled>Bezahlt von…</option>
            <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
          </select>
        </FormField>
        <FormField icon="pot" label="Budget-Topf">
          <select v-model="editExpenseForm.budget_id">
            <option value="">Kein Budget</option>
            <option v-for="b in budgetStore.budgets" :key="b.id" :value="String(b.id)">
              {{ b.name }} ({{ budgetStore.budgetLabel(b) }})
            </option>
          </select>
        </FormField>
        <FormField icon="date" label="Datum">
          <input v-model="editExpenseForm.date" type="date" />
        </FormField>
        <FormField icon="note" label="Notiz">
          <input v-model="editExpenseForm.note" type="text" placeholder="Notiz (optional)" />
        </FormField>
        <DraftStatusBar :status="editExpenseDraft.status.value" :restored="editExpenseDraft.restored.value" />
        <button type="submit">Speichern</button>
      </form>
      <FileAttachments v-if="editingExpense" domain="budget" :entity-id="editingExpense.id" />
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
/* Mehr Breite als der globale .page-Rahmen, damit die Budget-Töpfe auf Desktop tatsächlich
   nebeneinander Platz haben (siehe .pot-grid unten) - dasselbe Muster wie ShoppingListView.vue/
   PackingListView.vue. */
.budget-page {
  max-width: 1400px;
}

.overview-card {
  margin-bottom: var(--space-4);
}

.overview-card :deep(.meter-head) {
  font-size: 1.05rem;
}

.overview-card :deep(.track) {
  height: 14px;
}

.remaining-line {
  margin: var(--space-1) 0 0;
  font-size: 0.9rem;
  color: var(--color-success);
}

.budget-page > .card {
  margin-bottom: var(--space-4);
}

.budget-page :deep(h2) {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
}

.hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: var(--space-2) 0 var(--space-3);
}

.header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.new-budget-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.privacy-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.pot-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.add-form .form-field {
  flex: 1;
  min-width: 130px;
}

/* Ohne eigenes FormField-Label würde der Absenden-Button, sobald er in derselben umgebrochenen
   Flex-Zeile wie ein FormField landet, vom Flex-Default align-items:stretch auf dessen (größere)
   Höhe gezogen (Konsistenz-Prinzip, siehe DESIGN.md). flex-basis:100% erzwingt stattdessen immer
   eine eigene, volle Zeile - Absenden-Button bekommt so app-weit dieselbe, natürliche Höhe. */
.add-form button[type='submit'] {
  flex: 1 1 100%;
}

.empty {
  text-align: center;
}

/* Desktop: Budget-Töpfe nebeneinander statt untereinander, um den vorhandenen Platz besser zu
   nutzen - auto-fit/minmax statt einer festen Spaltenzahl. Gleicher Breakpoint wie
   ShoppingListView.vue/PackingListView.vue (bei 800px wären die Karten mit Meter + Kategorie-Zeilen
   zu eng). */
@media (min-width: 900px) {
  .pot-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>

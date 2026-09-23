<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { BudgetExpense } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useAuthStore } from '../stores/auth';
import { useSpotsStore } from '../stores/spots';
import { useExcursionsStore } from '../stores/excursions';
import { useBudgetStore } from '../stores/budget';
import { useLiveSyncStore } from '../stores/liveSync';
import { deriveTravelItems } from '../utils/deriveTravelItems';
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
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Card from '../components/primitives/Card.vue';
import Badge from '../components/primitives/Badge.vue';
import Input from '../components/primitives/Input.vue';
import Select from '../components/primitives/Select.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import CollapsibleFieldset from '../components/primitives/CollapsibleFieldset.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { useDraftAutosave } from '../composables/useDraftAutosave';

const tripStore = useTripStore();
const auth = useAuthStore();
const spotsStore = useSpotsStore();
const excursionsStore = useExcursionsStore();
const budgetStore = useBudgetStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
// Unterkunft ist seit der Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts) ganz
// normal ein Spot der Kategorie "Unterkunft" - kein eigener Fetch mehr nötig.
const accommodations = computed(() => spotsStore.spots.filter((s) => s.category === 'Unterkunft'));
// #176: keine eigene Reise-Etappen-Liste mehr, sondern aus role-getaggten Touren abgeleitet (siehe
// utils/deriveTravelItems.ts) - excursionsStore lädt automatisch bei erster Verwendung.
const travelItems = computed(() => deriveTravelItems(excursionsStore.excursions, spotsStore.spots));
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

const today = () => toLocalDateString(new Date());

async function load() {
  try {
    await Promise.all([spotsStore.load(), budgetStore.load()]);
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

/** Bezahlungen, die automatisch aus einem Unterkunft-Spot oder einer Reise-Etappe (Tour mit
 *  gesetzter role) erzeugt wurden (siehe spots.ts/ideas.ts `planBudgetExpense`/
 *  `planIdeaBudgetExpense`), sind hier gemäß der Architekturregel aus Batch 3 nicht direkt
 *  editier-/löschbar – stattdessen springt man zur Ursprungssicht. Ein Unterkunft-Spot lebt seit der
 *  Verschmelzung (siehe Migrationskommentar in db/index.ts) in der normalen Spots-Sicht
 *  (/excursions) statt einer eigenen Seite, eine Reise-Etappe seit #176 als normale Tour in
 *  derselben Sicht (#196: keine eigene "Reise"-Gruppierung mehr) - beide per Hash-Sprung
 *  (hashHighlight.ts). */
function autoSourceFor(expenseId: number): { label: string; path: string } | null {
  const accommodation = accommodations.value.find((a) => a.budget_expense_id === expenseId);
  if (accommodation) {
    return { label: 'Zur Unterkunft', path: `/excursions#spot-${accommodation.id}` };
  }
  const travelItem = travelItems.value.find((t) => t.budget_expense_id === expenseId);
  if (travelItem) {
    return { label: 'Zur Reise', path: `/excursions#excursion-${travelItem.id}` };
  }
  return null;
}

// --- Budgets (persönlich oder geteilt) ---
const newBudgetForm = ref({
  name: '',
  kind: 'shared' as 'shared' | 'personal',
  owner_id: '',
  target_amount: '',
});
const showNewBudgetForm = ref(false);

async function addBudget() {
  if (!newBudgetForm.value.name.trim()) return;
  if (newBudgetForm.value.kind === 'personal' && !newBudgetForm.value.owner_id) return;
  await budgetStore.addBudget(tripId, {
    name: newBudgetForm.value.name.trim(),
    owner_id:
      newBudgetForm.value.kind === 'personal' ? Number(newBudgetForm.value.owner_id) : undefined,
    target_amount: newBudgetForm.value.target_amount
      ? Number(newBudgetForm.value.target_amount)
      : undefined,
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
  () =>
    newBudgetForm.value.kind === 'personal' &&
    Number(newBudgetForm.value.owner_id) !== auth.user?.id
);

// --- Ausgaben (Bezahlungen) ---
const showExpenseForm = ref(false);
const showExpenseDetails = ref(false);
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
const showEditExpenseDetails = ref(false);
const editExpenseForm = ref(emptyExpenseForm());

const expenseDetailsCount = computed(() => {
  let count = 0;
  if (expenseForm.value.budget_id) count++;
  if (expenseForm.value.note) count++;
  return count > 0 ? count : undefined;
});

const editExpenseDetailsCount = computed(() => {
  let count = 0;
  if (editExpenseForm.value.budget_id) count++;
  if (editExpenseForm.value.note) count++;
  return count > 0 ? count : undefined;
});

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts) - nur für die Ausgaben-
// Formulare (Titel/Notiz sind hier Freitext), nicht für Budget-Anlegen/Überweisung/Kategorie-
// Zuteilung (kurze, einzelne Felder mit geringem Verlustrisiko).
const newExpenseDraft = useDraftAutosave('budgetExpense:new', expenseForm, showExpenseForm);
const editExpenseDraft = useDraftAutosave(
  () => `budgetExpense:edit:${editingExpense.value?.id}`,
  editExpenseForm,
  computed(() => editingExpense.value !== null)
);

watch(
  () => [showExpenseForm.value, expenseForm.value.budget_id, expenseForm.value.note],
  ([isOpen, budgetId, note]) => {
    if (isOpen && (budgetId || note)) {
      showExpenseDetails.value = true;
    }
  }
);

function expenseToBody(f: ReturnType<typeof emptyExpenseForm>) {
  const fallbackPaidBy = budgetStore.users.length === 1 ? budgetStore.users[0].id : auth.user?.id;
  return {
    trip_id: tripId,
    title: f.title.trim(),
    category: f.category || undefined,
    amount: Number(f.amount),
    paid_by_user_id: f.paid_by_user_id ? Number(f.paid_by_user_id) : fallbackPaidBy,
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
  showExpenseDetails.value = false;
  newExpenseDraft.clear();
}

function closeExpenseForm() {
  showExpenseForm.value = false;
  showExpenseDetails.value = false;
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
  showEditExpenseDetails.value = Boolean(expense.budget_id || expense.note);
}

async function submitEditExpense() {
  if (!editingExpense.value || !editExpenseForm.value.title.trim() || !editExpenseForm.value.amount)
    return;
  await budgetStore.updateExpense(editingExpense.value.id, expenseToBody(editExpenseForm.value));
  editExpenseDraft.clear();
  editingExpense.value = null;
  showEditExpenseDetails.value = false;
}

function closeEditExpenseForm() {
  editExpenseDraft.clear();
  editingExpense.value = null;
  showEditExpenseDetails.value = false;
}

// --- Überweisungen ---
const showTransferForm = ref(false);
const showTransferDetails = ref(false);
const emptyTransferForm = () => ({
  from_user_id: '',
  to_user_id: '',
  amount: '',
  date: today(),
  note: '',
});
const transferForm = ref(emptyTransferForm());

async function submitTransfer() {
  if (
    !transferForm.value.from_user_id ||
    !transferForm.value.to_user_id ||
    !transferForm.value.amount
  )
    return;
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
  showTransferDetails.value = false;
}

function closeTransferForm() {
  showTransferForm.value = false;
  showTransferDetails.value = false;
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
  showTransferDetails.value = false;
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
    <div class="budget-header-bar">
      <div class="title-wrap">
        <h1>Budget</h1>
        <span
          v-if="budgetStore.grandTotal > 0"
          class="budget-kpi-pill"
          :class="{ 'is-over': budgetStore.remaining < 0 }"
        >
          <span class="pill-dot" aria-hidden="true"></span>
          <span v-if="budgetStore.remaining < 0">
            <span class="nobr">{{ Math.abs(budgetStore.remaining).toFixed(2) }}&nbsp;€</span> über
            Budget
          </span>
          <span v-else>
            <span class="nobr"
              >{{
                Math.round((budgetStore.totalSpent / budgetStore.grandTotal) * 100)
              }}&nbsp;%</span
            >
            ausgeschöpft
          </span>
        </span>
      </div>
    </div>

    <!-- Main Content Grid: Linke Spalte Budgets/Töpfe & Übersicht, Rechte Spalte Bezahlungen, Überweisungen & Abrechnung -->
    <div class="budget-main-grid">
      <!-- Linke Spalte: Gesamt-Übersicht & Budgets / Töpfe -->
      <div class="budget-col-pots">
        <Card class="overview-card">
          <div class="overview-header">
            <h2>Gesamt-Übersicht</h2>
            <Badge v-if="budgetStore.expenses.length">
              {{ budgetStore.expenses.length }}
              {{ budgetStore.expenses.length === 1 ? 'Ausgabe' : 'Ausgaben' }}
            </Badge>
          </div>
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
            Noch übrig: <strong class="nobr">{{ budgetStore.remaining.toFixed(2) }}&nbsp;€</strong>
          </p>
        </Card>

        <Card class="pots-card">
          <div class="header">
            <h2>Budgets</h2>
            <Button @click="showNewBudgetForm = true"
              ><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Budget
              anlegen</Button
            >
          </div>
          <p v-if="budgetStore.users.length > 1" class="hint">
            Ganz einfach: ein Topf mit nur einer Gesamtsumme. Oder detaillierter: in Kategorien
            aufteilen, um daraus ein Gesamtbudget zusammenzustellen. Geteilte Töpfe sehen alle
            Mitreisenden, private Töpfe nur die gewählte Person.
          </p>
          <p v-else class="hint">
            Ganz einfach: ein Topf mit nur einer Gesamtsumme. Oder detaillierter: in Kategorien
            aufteilen, um daraus ein Gesamtbudget zusammenzustellen.
          </p>

          <Modal
            :model-value="showNewBudgetForm"
            title="Budget anlegen"
            @update:model-value="(v) => !v && closeNewBudgetForm()"
          >
            <form class="new-budget-form edit-form" @submit.prevent="addBudget">
              <FormField icon="title" label="Name" required v-slot="{ id }">
                <Input
                  :id="id"
                  v-model="newBudgetForm.name"
                  type="text"
                  placeholder="Name (z. B. Souvenirs)"
                  required
                />
              </FormField>
              <div v-if="budgetStore.users.length > 1" class="row">
                <FormField icon="visibility" label="Sichtbarkeit" v-slot="{ id }">
                  <Select :id="id" v-model="newBudgetForm.kind">
                    <option value="shared">Geteilt (alle sehen ihn)</option>
                    <option value="personal">Privat (nur eine Person sieht ihn)</option>
                  </Select>
                </FormField>
                <FormField
                  v-if="newBudgetForm.kind === 'personal'"
                  icon="person"
                  label="Person"
                  required
                  v-slot="{ id }"
                >
                  <Select :id="id" v-model="newBudgetForm.owner_id" required>
                    <option value="" disabled>Nutzer:in wählen…</option>
                    <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
                      {{ u.avatar }} {{ u.username }}
                    </option>
                  </Select>
                </FormField>
              </div>
              <p v-if="showsPrivacyHint" class="privacy-hint">
                <AppIcon :icon="ACTION_ICONS.private" :size="14" group="actions" /> Nur
                {{ budgetStore.userName(Number(newBudgetForm.owner_id)) }} sieht diesen Topf danach.
              </p>
              <FormField icon="amount" label="Gesamtziel" v-slot="{ id }">
                <Input
                  :id="id"
                  v-model="newBudgetForm.target_amount"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  placeholder="Gesamtziel €"
                />
              </FormField>
              <div class="actions-row">
                <div class="spacer"></div>
                <Button type="submit">Anlegen</Button>
              </div>
            </form>
          </Modal>

          <TransitionGroup tag="div" name="list" class="pot-grid">
            <BudgetPotCard
              v-for="budget in budgetStore.budgets"
              :key="budget.id"
              :budget="budget"
              :category-colors="categoryColors"
            />
            <EmptyState v-if="!budgetStore.budgets.length" key="empty">
              Noch keine Budgets angelegt.
            </EmptyState>
          </TransitionGroup>
        </Card>
      </div>

      <!-- Rechte Spalte: Wer schuldet wem?, Bezahlungen & Überweisungen -->
      <div class="budget-col-transactions">
        <BudgetSettlementCard
          v-if="budgetStore.users.length > 1"
          class="budget-settlement-card"
          @use-suggestion="useSettlementSuggestion"
        />

        <!-- Ausgaben -->
        <Card class="expenses-card">
          <div class="header">
            <h2>Ausgaben</h2>
            <Button @click="showExpenseForm = true"
              ><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Ausgabe
              eintragen</Button
            >
          </div>

          <Modal
            :model-value="showExpenseForm"
            title="Ausgabe eintragen"
            @update:model-value="(v) => !v && closeExpenseForm()"
          >
            <form class="edit-form add-form" @submit.prevent="submitExpense">
              <FormField icon="title" label="Titel" required v-slot="{ id }">
                <Input
                  :id="id"
                  v-model="expenseForm.title"
                  type="text"
                  placeholder="Titel (z. B. Restaurant, Tickets)"
                  required
                />
              </FormField>

              <div class="row">
                <FormField icon="amount" label="Betrag" required v-slot="{ id }">
                  <Input
                    :id="id"
                    v-model="expenseForm.amount"
                    type="number"
                    inputmode="decimal"
                    step="0.01"
                    placeholder="Betrag €"
                    required
                  />
                </FormField>
                <FormField icon="category" label="Kategorie" v-slot="{ id }">
                  <Combobox
                    :id="id"
                    v-model="expenseForm.category"
                    :options="budgetStore.expenseCategories"
                    placeholder="Kategorie"
                  />
                </FormField>
              </div>

              <div class="row">
                <FormField
                  v-if="budgetStore.users.length > 1"
                  icon="shared"
                  label="Bezahlt von"
                  required
                  v-slot="{ id }"
                >
                  <Select :id="id" v-model="expenseForm.paid_by_user_id" required>
                    <option value="" disabled>Bezahlt von…</option>
                    <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
                      {{ u.avatar }} {{ u.username }}
                    </option>
                  </Select>
                </FormField>
                <FormField icon="date" label="Datum" v-slot="{ id }">
                  <Input :id="id" v-model="expenseForm.date" type="date" />
                </FormField>
              </div>

              <CollapsibleFieldset
                v-model="showExpenseDetails"
                label="Weitere Angaben"
                :count="expenseDetailsCount"
                :icon="FORM_FIELD_ICONS.pot"
                icon-group="formFields"
              >
                <FormField icon="pot" label="Budget-Topf" v-slot="{ id }">
                  <Select :id="id" v-model="expenseForm.budget_id">
                    <option value="">Kein Budget</option>
                    <option v-for="b in budgetStore.budgets" :key="b.id" :value="String(b.id)">
                      {{ b.name }} ({{ budgetStore.budgetLabel(b) }})
                    </option>
                  </Select>
                </FormField>
                <FormField icon="note" label="Notiz" v-slot="{ id }">
                  <Input :id="id" v-model="expenseForm.note" type="text" placeholder="Notiz" />
                </FormField>
              </CollapsibleFieldset>

              <DraftStatusBar
                :status="newExpenseDraft.status.value"
                :restored="newExpenseDraft.restored.value"
              />
              <div class="actions-row">
                <div class="spacer"></div>
                <Button type="submit">Eintragen</Button>
              </div>
            </form>
          </Modal>

          <BudgetExpenseList
            :highlighted-ids="highlightedIds"
            :auto-source-for="autoSourceFor"
            @edit="startEditExpense"
          />
        </Card>

        <!-- Überweisungen -->
        <Card v-if="budgetStore.users.length > 1" class="transfers-card">
          <div class="header">
            <h2>Überweisungen</h2>
            <Button @click="showTransferForm = true"
              ><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Überweisung
              eintragen</Button
            >
          </div>

          <Modal
            :model-value="showTransferForm"
            title="Überweisung eintragen"
            @update:model-value="(v) => !v && closeTransferForm()"
          >
            <form class="edit-form add-form" @submit.prevent="submitTransfer">
              <div class="row">
                <FormField icon="person" label="Von" required v-slot="{ id }">
                  <Select :id="id" v-model="transferForm.from_user_id" required>
                    <option value="" disabled>Von…</option>
                    <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
                      {{ u.avatar }} {{ u.username }}
                    </option>
                  </Select>
                </FormField>
                <FormField icon="person" label="An" required v-slot="{ id }">
                  <Select :id="id" v-model="transferForm.to_user_id" required>
                    <option value="" disabled>An…</option>
                    <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
                      {{ u.avatar }} {{ u.username }}
                    </option>
                  </Select>
                </FormField>
              </div>

              <div class="row">
                <FormField icon="amount" label="Betrag" required v-slot="{ id }">
                  <Input
                    :id="id"
                    v-model="transferForm.amount"
                    type="number"
                    inputmode="decimal"
                    step="0.01"
                    placeholder="Betrag €"
                    required
                  />
                </FormField>
                <FormField icon="date" label="Datum" v-slot="{ id }">
                  <Input :id="id" v-model="transferForm.date" type="date" />
                </FormField>
              </div>

              <CollapsibleFieldset
                v-model="showTransferDetails"
                label="Weitere Angaben"
                :count="transferForm.note ? 1 : undefined"
                :icon="FORM_FIELD_ICONS.note"
                icon-group="formFields"
              >
                <FormField icon="note" label="Notiz" v-slot="{ id }">
                  <Input :id="id" v-model="transferForm.note" type="text" placeholder="Notiz" />
                </FormField>
              </CollapsibleFieldset>

              <div class="actions-row">
                <div class="spacer"></div>
                <Button type="submit">Eintragen</Button>
              </div>
            </form>
          </Modal>

          <BudgetTransferList :highlighted-ids="highlightedIds" />
        </Card>
      </div>
    </div>

    <Modal
      :model-value="editingExpense !== null"
      title="Ausgabe bearbeiten"
      @update:model-value="(v) => !v && closeEditExpenseForm()"
    >
      <form class="edit-form add-form" @submit.prevent="submitEditExpense">
        <FormField icon="title" label="Titel" required v-slot="{ id }">
          <Input
            :id="id"
            v-model="editExpenseForm.title"
            type="text"
            placeholder="Titel (z. B. Restaurant, Tickets)"
            required
          />
        </FormField>

        <div class="row">
          <FormField icon="amount" label="Betrag" required v-slot="{ id }">
            <Input
              :id="id"
              v-model="editExpenseForm.amount"
              type="number"
              inputmode="decimal"
              step="0.01"
              placeholder="Betrag €"
              required
            />
          </FormField>
          <FormField icon="category" label="Kategorie" v-slot="{ id }">
            <Combobox
              :id="id"
              v-model="editExpenseForm.category"
              :options="budgetStore.expenseCategories"
              placeholder="Kategorie"
            />
          </FormField>
        </div>

        <div class="row">
          <FormField
            v-if="budgetStore.users.length > 1"
            icon="shared"
            label="Bezahlt von"
            required
            v-slot="{ id }"
          >
            <Select :id="id" v-model="editExpenseForm.paid_by_user_id" required>
              <option value="" disabled>Bezahlt von…</option>
              <option
                v-if="
                  editExpenseForm.paid_by_user_id &&
                  !budgetStore.users.some(
                    (u) => String(u.id) === String(editExpenseForm.paid_by_user_id)
                  )
                "
                :value="String(editExpenseForm.paid_by_user_id)"
                disabled
              >
                👤 Ehemaliges Mitglied
              </option>
              <option v-for="u in budgetStore.users" :key="u.id" :value="String(u.id)">
                {{ u.avatar }} {{ u.username }}
              </option>
            </Select>
          </FormField>
          <FormField icon="date" label="Datum" v-slot="{ id }">
            <Input :id="id" v-model="editExpenseForm.date" type="date" />
          </FormField>
        </div>

        <CollapsibleFieldset
          v-model="showEditExpenseDetails"
          label="Weitere Angaben"
          :count="editExpenseDetailsCount"
          :icon="FORM_FIELD_ICONS.pot"
          icon-group="formFields"
        >
          <FormField icon="pot" label="Budget-Topf" v-slot="{ id }">
            <Select :id="id" v-model="editExpenseForm.budget_id">
              <option value="">Kein Budget</option>
              <option v-for="b in budgetStore.budgets" :key="b.id" :value="String(b.id)">
                {{ b.name }} ({{ budgetStore.budgetLabel(b) }})
              </option>
            </Select>
          </FormField>
          <FormField icon="note" label="Notiz" v-slot="{ id }">
            <Input :id="id" v-model="editExpenseForm.note" type="text" placeholder="Notiz" />
          </FormField>
        </CollapsibleFieldset>

        <FileAttachments v-if="editingExpense" domain="budget" :entity-id="editingExpense.id" />
        <DraftStatusBar
          :status="editExpenseDraft.status.value"
          :restored="editExpenseDraft.restored.value"
        />
        <div class="actions-row">
          <div class="spacer"></div>
          <Button type="submit">Speichern</Button>
        </div>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.budget-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.budget-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.title-wrap h1 {
  margin: 0;
}

.budget-kpi-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
  color: var(--color-primary-dark);
  border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
  animation: pill-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.budget-kpi-pill.is-over {
  background: color-mix(in srgb, var(--color-danger) 12%, var(--color-surface));
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

@keyframes pill-pop {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Main 2-Column Content Grid:
   Desktop: Linke Spalte (Gesamt-Übersicht + Budgets), Rechte Spalte (Abrechnung + Bezahlungen + Überweisungen).
   Dadurch muss die Gesamt-Übersicht nicht künstlich auf die Höhe der Abrechnungskarte gestreckt werden
   und die Budgets-Kachel rutscht unmittelbar darunter, ohne verschenkten vertikalen Leerraum.
   Mobil: display: contents löst die Spalten-Wrapper auf, sodass die Karten in logischer Reihenfolge
   (Gesamt-Übersicht -> Wer schuldet wem? -> Budgets -> Bezahlungen -> Überweisungen) untereinander stehen. */
.budget-main-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@media (min-width: 960px) {
  .budget-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-4);
  }
}

@media (min-width: 1500px) {
  .budget-main-grid {
    grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
    gap: var(--space-5);
  }
}

.budget-col-pots,
.budget-col-transactions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

.overview-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: 0;
}

.overview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-1);
}

.overview-header h2 {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
  margin: 0;
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

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.edit-form .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form .row > * {
  flex: 1;
  min-width: 140px;
}

.edit-form .actions-row {
  margin-top: var(--space-2);
}

.edit-form .actions-row button[type='submit'] {
  flex: initial;
}

.privacy-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.pot-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* Auf Desktop / breitem Monitor können Pots innerhalb der Card mehrspaltig sein */
@media (min-width: 768px) {
  .pot-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
    align-items: start;
    gap: var(--space-3);
  }
}

/* Cards animation on view mount */
.overview-card,
.settlement-card,
.pots-card,
.expenses-card,
.transfers-card {
  animation: card-appear 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.settlement-card {
  animation-delay: 70ms;
}

.pots-card {
  animation-delay: 130ms;
}

.expenses-card {
  animation-delay: 190ms;
}

.transfers-card {
  animation-delay: 250ms;
}

@keyframes card-appear {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .budget-kpi-pill,
  .overview-card,
  .settlement-card,
  .pots-card,
  .expenses-card,
  .transfers-card {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
</style>

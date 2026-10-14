<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { Budget, BudgetExpense, BudgetTransfer } from '../api/types';
import type { SettlementSuggestion } from '../utils/budgetBalances';
import { useSpotsStore } from '../stores/spots';
import { useBudgetStore } from '../stores/budget';
import { useLiveSyncStore } from '../stores/liveSync';
import BudgetOverviewCard from '../components/BudgetOverviewCard.vue';
import BudgetPotCard from '../components/BudgetPotCard.vue';
import BudgetSettlementCard from '../components/BudgetSettlementCard.vue';
import BudgetExpenseList from '../components/BudgetExpenseList.vue';
import BudgetTransferList from '../components/BudgetTransferList.vue';
import BudgetPotModal from '../components/BudgetPotModal.vue';
import BudgetExpenseModal from '../components/BudgetExpenseModal.vue';
import BudgetTransferModal from '../components/BudgetTransferModal.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Card from '../components/primitives/Card.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useBudgetSources } from '../composables/useBudgetSources';

const spotsStore = useSpotsStore();
const budgetStore = useBudgetStore();
const liveSync = useLiveSyncStore();
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

// Modals state
const showPotModal = ref(false);
const editingBudget = ref<Budget | null>(null);

const showExpenseModal = ref(false);
const editingExpense = ref<BudgetExpense | null>(null);
const expenseInitialType = ref<'expense' | 'income'>('expense');

const showTransferModal = ref(false);
const editingTransfer = ref<BudgetTransfer | null>(null);
const settlementSuggestion = ref<SettlementSuggestion | null>(null);

const { autoSourceFor, categoryColors } = useBudgetSources();

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

function openCreateBudget() {
  editingBudget.value = null;
  showPotModal.value = true;
}

function openEditBudget(budget: Budget) {
  editingBudget.value = budget;
  showPotModal.value = true;
}

function openCreateExpense(type: 'expense' | 'income' = 'expense') {
  editingExpense.value = null;
  expenseInitialType.value = type;
  showExpenseModal.value = true;
}

function openEditExpense(expense: BudgetExpense) {
  editingExpense.value = expense;
  showExpenseModal.value = true;
}

function openCreateTransfer() {
  editingTransfer.value = null;
  settlementSuggestion.value = null;
  showTransferModal.value = true;
}

function openEditTransfer(transfer: BudgetTransfer) {
  editingTransfer.value = transfer;
  settlementSuggestion.value = null;
  showTransferModal.value = true;
}

function openTransferWithSuggestion(suggestion: SettlementSuggestion) {
  editingTransfer.value = null;
  settlementSuggestion.value = suggestion;
  showTransferModal.value = true;
}
</script>

<template>
  <div class="page budget-page" v-if="!loading">
    <div class="budget-header-bar">
      <div class="title-wrap">
        <h1>Budget</h1>
        <span
          v-if="budgetStore.grandTotal > 0"
          class="budget-kpi-pill"
          :class="{
            'is-over': budgetStore.remaining < 0,
            'is-warning':
              budgetStore.remaining >= 0 && budgetStore.remaining / budgetStore.grandTotal <= 0.2,
          }"
        >
          <span class="pill-dot" aria-hidden="true"></span>
          <span v-if="budgetStore.remaining < 0">
            <span class="nobr">{{ Math.abs(budgetStore.remaining).toFixed(2) }}&nbsp;€</span> über
            Budget
          </span>
          <span v-else>
            <span class="nobr"
              >{{
                Math.max(0, Math.round((budgetStore.totalSpent / budgetStore.grandTotal) * 100))
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
        <BudgetOverviewCard />

        <Card class="pots-card">
          <div class="header">
            <h2>Budgets</h2>
            <Button @click="openCreateBudget"
              ><AppIcon :icon="ACTION_ICONS.moneybagPlus" :size="14" group="actions" /> Budget
              anlegen</Button
            >
          </div>
          <p v-if="budgetStore.users.length > 1" class="hint">
            Ganz einfach: ein Topf mit nur einer Gesamtsumme. Oder detaillierter: in Kategorien
            aufteilen, um daraus ein Gesamtbudget zusammenzustellen. Geteilte Töpfe sehen alle
            Mitreisenden, private Töpfe nur du selbst.
          </p>
          <p v-else class="hint">
            Ganz einfach: ein Topf mit nur einer Gesamtsumme. Oder detaillierter: in Kategorien
            aufteilen, um daraus ein Gesamtbudget zusammenzustellen.
          </p>

          <TransitionGroup tag="div" name="list" class="pot-grid">
            <BudgetPotCard
              v-for="budget in budgetStore.budgets"
              :key="budget.id"
              :budget="budget"
              :category-colors="categoryColors"
              @edit="openEditBudget"
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
          @use-suggestion="openTransferWithSuggestion"
        />

        <!-- Ausgaben & Einnahmen -->
        <Card class="expenses-card">
          <div class="header">
            <h2>Ausgaben & Einnahmen</h2>
            <Button @click="openCreateExpense('expense')"
              ><AppIcon :icon="ACTION_ICONS.cashCoin" :size="14" group="actions" /> Ausgabe /
              Einnahme eintragen</Button
            >
          </div>

          <BudgetExpenseList
            :highlighted-ids="highlightedIds"
            :auto-source-for="autoSourceFor"
            @edit="openEditExpense"
          />
        </Card>

        <!-- Überweisungen -->
        <Card v-if="budgetStore.users.length > 1" class="transfers-card">
          <div class="header">
            <h2>Überweisungen</h2>
            <Button @click="openCreateTransfer"
              ><AppIcon :icon="ACTION_ICONS.cashMove" :size="14" group="actions" /> Überweisung
              eintragen</Button
            >
          </div>

          <BudgetTransferList :highlighted-ids="highlightedIds" @edit="openEditTransfer" />
        </Card>
      </div>
    </div>

    <!-- Modals -->
    <BudgetPotModal v-model="showPotModal" :budget="editingBudget" />
    <BudgetExpenseModal
      v-model="showExpenseModal"
      :expense="editingExpense"
      :initial-type="expenseInitialType"
    />
    <BudgetTransferModal
      v-model="showTransferModal"
      :transfer="editingTransfer"
      :suggestion="settlementSuggestion"
    />
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
  gap: var(--radius-xs);
  font-size: var(--font-size-sm);
  font-weight: 600;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
  color: var(--color-success);
  border: 1px solid color-mix(in srgb, var(--color-success) 25%, transparent);
  animation: pill-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.budget-kpi-pill.is-warning {
  background: color-mix(in srgb, var(--color-warning) 12%, var(--color-surface));
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
}

.budget-kpi-pill.is-over {
  background: color-mix(in srgb, var(--color-danger) 12%, var(--color-surface));
  color: var(--color-danger);
  border-color: color-mix(in srgb, var(--color-danger) 25%, transparent);
}

.pill-dot {
  width: var(--radius-xs);
  height: var(--radius-xs);
  border-radius: var(--radius-full);
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
   Container-resilient gegenüber der Kalenderschublade auf Desktop. */
.budget-main-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

@container app-main (min-width: 960px) {
  .budget-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    align-items: start;
    gap: var(--space-4);
  }
}

@container app-main (min-width: 1500px) {
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

.budget-page :deep(h2) {
  font-size: var(--font-size-md);
  color: var(--color-primary-dark);
}

.hint {
  font-size: var(--font-size-xs);
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

/* Budget-Cards werden immer einspaltig untereinander dargestellt, damit ungleiche
   Höhen durch ein-/ausgeklappte Kategorien keine Lücken im Layout erzeugen */
.pot-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

/* Cards animation on view mount */
.pots-card,
.expenses-card,
.transfers-card {
  animation: card-appear 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
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
  .pots-card,
  .expenses-card,
  .transfers-card {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
</style>

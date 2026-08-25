<script setup lang="ts">
import Button from './primitives/Button.vue';
import { computed, ref } from 'vue';
import type { Budget } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import BudgetMeter from './BudgetMeter.vue';
import DeleteButton from './DeleteButton.vue';
import FormField from './FormField.vue';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
  budget: Budget;
  categoryColors: Map<string, string>;
}>();

const store = useBudgetStore();

const allocations = computed(() => store.allocationsFor(props.budget.id));
const effectiveTarget = computed(() => store.budgetTarget(props.budget));

// Einfacher Modus (nur target_amount, keine Kategorien): alle direkt diesem Topf zugeordneten
// Ausgaben zählen unmittelbar. Detaillierter Modus: Summe je Kategorie über spentFor (das auch
// Alt-Ausgaben ohne budget_id per Kategorienamen dem geteilten Topf zuordnet).
const totalSpentForBudget = computed(() =>
  allocations.value.length
    ? allocations.value.reduce((s, a) => s + store.spentFor(props.budget, a.category), 0)
    : store.expenses.filter((e) => e.budget_id === props.budget.id).reduce((s, e) => s + e.amount, 0),
);

const isSimpleMode = computed(() => allocations.value.length === 0);

const targetInput = ref<string>(props.budget.target_amount != null ? String(props.budget.target_amount) : '');

async function updateTargetAmount() {
  const value = targetInput.value.trim();
  await store.updateBudget(props.budget.id, {
    name: props.budget.name,
    owner_id: props.budget.owner_id ?? undefined,
    target_amount: value ? Number(value) : undefined,
  });
}

const newCategory = ref('');
const newCategoryAmount = ref('');

async function addCategory() {
  if (!newCategory.value.trim()) return;
  await store.saveAllocation(props.budget.id, newCategory.value.trim(), Number(newCategoryAmount.value) || 0);
  newCategory.value = '';
  newCategoryAmount.value = '';
}

const displayBudgetName = computed(() =>
  props.budget.name === 'Gemeinsames Budget' && store.users.length <= 1
    ? 'Hauptbudget'
    : props.budget.name,
);

function updateAllocationAmount(category: string, value: string) {
  store.saveAllocation(props.budget.id, category, Number(value) || 0);
}
</script>

<template>
  <Card class="pot-card">
    <div class="pot-head">
      <div class="pot-title">
        <h3>{{ displayBudgetName }}</h3>
        <span v-if="store.users.length > 1" class="kind-badge">
          <template v-if="budget.owner_id == null"><AppIcon :icon="ACTION_ICONS.shared" :size="14" group="actions" /> Geteilt</template>
          <template v-else
            ><AppIcon :icon="ACTION_ICONS.private" :size="14" group="actions" /> {{ store.userAvatar(budget.owner_id) }}
            {{ store.userName(budget.owner_id) }}</template
          >
        </span>
      </div>
      <DeleteButton small @click="store.removeBudget(budget.id)" />
    </div>

    <BudgetMeter label="Gesamt" :spent="totalSpentForBudget" :target="effectiveTarget" color="var(--color-primary-dark)" />

    <label class="target-input">
      Ziel (gesamt, optional)
      <div class="target-input-row">
        <input v-model="targetInput" type="number" step="0.01" placeholder="z. B. 500" @change="updateTargetAmount" />
        <span>€</span>
      </div>
    </label>

    <template v-if="!isSimpleMode || allocations.length">
      <div class="category-row" v-for="a in allocations" :key="a.id">
        <BudgetMeter
          :label="a.category"
          :spent="store.spentFor(budget, a.category)"
          :target="a.amount"
          :color="categoryColors.get(a.category) ?? '#8a8a86'"
        />
        <div class="category-edit">
          <input
            type="number"
            step="0.01"
            :value="a.amount"
            @change="updateAllocationAmount(a.category, ($event.target as HTMLInputElement).value)"
          />
          <DeleteButton small @click="store.removeAllocation(a.id)" />
        </div>
      </div>
    </template>

    <details class="add-category">
      <summary><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Kategorie hinzufügen (optional)</summary>
      <form class="add-category-form" @submit.prevent="addCategory">
        <FormField icon="category" label="Neue Kategorie">
          <input v-model="newCategory" type="text" placeholder="Neue Kategorie" />
        </FormField>
        <FormField icon="amount" label="Ziel">
          <input v-model="newCategoryAmount" type="number" step="0.01" placeholder="Ziel €" />
        </FormField>
        <Button type="submit"><AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Hinzufügen</Button>
      </form>
    </details>
  </Card>
</template>

<style scoped>
.pot-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  /* Schmaler als das globale .card-Padding (var(--space-4) = 24px): Pot-Karten stecken bereits in
     der äußeren "Budgets"-Karte (siehe BudgetView.vue) - zwei volle Karten-Paddings ineinander
     ließen auf schmalen Mobilbreiten zu wenig Platz für die Meter-Beschriftungen. */
  padding: var(--space-3);
}

.pot-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.pot-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pot-title h3 {
  margin: 0;
  font-size: 0.95rem;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.kind-badge {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.target-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.target-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.target-input input {
  width: 120px;
  max-width: 100%;
}

.category-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.category-row :deep(.meter-row) {
  flex: 1;
  min-width: 140px;
}

.category-edit {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.category-edit input {
  width: 90px;
  max-width: 30vw;
}

.add-category {
  font-size: 0.85rem;
}

.add-category summary {
  cursor: pointer;
  color: var(--color-primary-dark);
}

.add-category-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.add-category-form .form-field {
  flex: 1;
  min-width: 110px;
}
</style>

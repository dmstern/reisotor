<script setup lang="ts">
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import { computed, ref, watch } from 'vue';
import type { Budget } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import BudgetMeter from './BudgetMeter.vue';
import EditButton from './EditButton.vue';
import DeleteButton from './DeleteButton.vue';
import FormField from './FormField.vue';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import Accordion from './primitives/Accordion.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
  budget: Budget;
  categoryColors: Map<string, string>;
}>();

const emit = defineEmits<{
  (e: 'edit', budget: Budget): void;
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
    : store.expenses
        .filter((e) => e.budget_id === props.budget.id)
        .reduce((s, e) => s + e.amount, 0)
);

const isSimpleMode = computed(() => allocations.value.length === 0);

const targetInput = ref<string>(
  props.budget.target_amount != null ? String(props.budget.target_amount) : ''
);

watch(
  () => props.budget.target_amount,
  (val) => {
    targetInput.value = val != null ? String(val) : '';
  }
);

async function updateTargetAmount() {
  const value = targetInput.value.trim();
  await store.updateBudget(props.budget.id, {
    name: props.budget.name,
    owner_id: props.budget.owner_id,
    target_amount: value ? Number(value) : null,
  });
}

const showAddCategory = ref(false);
const newCategory = ref('');
const newCategoryAmount = ref('');

async function addCategory() {
  if (!newCategory.value.trim()) return;
  await store.saveAllocation(
    props.budget.id,
    newCategory.value.trim(),
    Number(newCategoryAmount.value) || 0
  );
  newCategory.value = '';
  newCategoryAmount.value = '';
  showAddCategory.value = false;
}

const displayBudgetName = computed(() =>
  props.budget.name === 'Gemeinsames Budget' && store.users.length <= 1
    ? 'Hauptbudget'
    : props.budget.name
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
          <template v-if="budget.owner_id == null"
            ><AppIcon :icon="ACTION_ICONS.shared" :size="14" group="actions" /> Geteilt</template
          >
          <template v-else
            ><AppIcon :icon="ACTION_ICONS.private" :size="14" group="actions" /> Privat</template
          >
        </span>
      </div>
      <EditButton small aria-label="Budget bearbeiten" @click="emit('edit', budget)" />
    </div>

    <div class="category-row total-row">
      <BudgetMeter
        label="Gesamt"
        :spent="totalSpentForBudget"
        :target="effectiveTarget"
        color="var(--color-primary-dark)"
      />
      <div class="category-edit total-edit">
        <Input
          :id="`budget-target-${budget.id}`"
          v-model="targetInput"
          type="number"
          step="0.01"
          size="sm"
          class="category-amount-input"
          :aria-label="`Ziel (gesamt) für ${displayBudgetName}`"
          placeholder="0"
          @change="updateTargetAmount"
        />
        <span v-if="allocations.length" class="btn-spacer" aria-hidden="true"></span>
      </div>
    </div>

    <template v-if="!isSimpleMode || allocations.length">
      <div class="category-row" v-for="(a, idx) in allocations" :key="a.id">
        <BudgetMeter
          :label="a.category"
          :spent="store.spentFor(budget, a.category)"
          :target="a.amount"
          :color="categoryColors.get(a.category) ?? 'var(--color-text-muted)'"
          :delay="(idx + 1) * 45"
        />
        <div class="category-edit">
          <Input
            type="number"
            step="0.01"
            size="sm"
            class="category-amount-input"
            :aria-label="`Betrag für Kategorie ${a.category}`"
            :model-value="String(a.amount)"
            @change="updateAllocationAmount(a.category, ($event.target as HTMLInputElement).value)"
          />
          <DeleteButton small @click="store.removeAllocation(a.id)" />
        </div>
      </div>
    </template>

    <div class="add-category">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="add-category-toggle"
        :aria-expanded="showAddCategory"
        @click="showAddCategory = !showAddCategory"
      >
        <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" />
        <span>Kategorie hinzufügen</span>
        <AppIcon
          :icon="ACTION_ICONS.chevronDown"
          :size="14"
          group="actions"
          class="toggle-chevron"
          :class="{ 'is-open': showAddCategory }"
        />
      </Button>

      <Accordion :expanded="showAddCategory" :inert-when-closed="false">
        <form class="add-category-form" @submit.prevent="addCategory">
          <FormField icon="category" label="Neue Kategorie" v-slot="{ id }">
            <Input :id="id" v-model="newCategory" type="text" placeholder="Neue Kategorie" />
          </FormField>
          <FormField icon="amount" label="Ziel" v-slot="{ id }">
            <Input
              :id="id"
              v-model="newCategoryAmount"
              type="number"
              step="0.01"
              placeholder="Ziel €"
            />
          </FormField>
          <Button type="submit">
            <AppIcon :icon="ACTION_ICONS.add" :size="14" group="actions" /> Hinzufügen
          </Button>
        </form>
      </Accordion>
    </div>
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

.btn-spacer {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
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

.category-amount-input {
  width: 90px;
  max-width: 30vw;
}

.add-category {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.add-category-toggle {
  align-self: flex-start;
  color: var(--color-primary-dark);
  font-size: 0.82rem;
  font-weight: 600;
  padding: 4px 8px;
  gap: 6px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.add-category-toggle:hover {
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.toggle-chevron {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  color: var(--color-text-muted);
}

.toggle-chevron.is-open {
  transform: rotate(180deg);
}

.add-category-form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  margin-top: var(--space-1);
  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
  border: 1px dashed color-mix(in srgb, var(--color-primary) 20%, transparent);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.add-category-form .form-field {
  flex: 1;
  min-width: 110px;
}
</style>

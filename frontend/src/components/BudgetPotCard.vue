<script setup lang="ts">
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import { computed, ref, watch } from 'vue';
import type { Budget } from '../api/types';
import { useBudgetStore } from '../stores/budget';
import BudgetMeter from './BudgetMeter.vue';
import EditButton from './EditButton.vue';
import FormField from './FormField.vue';
import AppIcon from './AppIcon.vue';
import Card from './primitives/Card.vue';
import Accordion from './primitives/Accordion.vue';
import CategoryCombobox from './CategoryCombobox.vue';
import IconButton from './primitives/IconButton.vue';
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

const isExpanded = ref(true);
const hasCategories = computed(() => allocations.value.length > 0);

function toggleExpand() {
  if (hasCategories.value) {
    isExpanded.value = !isExpanded.value;
  }
}

function onHeaderClick() {
  if (hasCategories.value) {
    toggleExpand();
  }
}

function onTotalSectionClick(e: MouseEvent) {
  if (!isExpanded.value && hasCategories.value) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, button, select, textarea, label')) return;
    isExpanded.value = true;
  }
}
</script>

<template>
  <Card class="pot-card" :class="{ 'is-collapsed': !isExpanded && hasCategories }">
    <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
    <div class="pot-head" :class="{ 'is-collapsible': hasCategories }" @click="onHeaderClick">
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
      <div class="pot-actions">
        <EditButton small aria-label="Budget bearbeiten" @click="emit('edit', budget)" />
        <IconButton
          v-if="hasCategories"
          variant="ghost"
          size="sm"
          class="collapse-btn"
          :class="{ 'is-open': isExpanded }"
          :icon="ACTION_ICONS.chevronDown"
          :aria-expanded="isExpanded"
          :aria-controls="`budget-categories-${budget.id}`"
          :aria-label="isExpanded ? 'Kategorien einklappen' : 'Kategorien ausklappen'"
          :title="isExpanded ? 'Kategorien einklappen' : 'Kategorien ausklappen'"
          @click.stop="toggleExpand"
        />
      </div>
    </div>

    <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
    <div
      class="total-section"
      :class="{
        'has-categories': hasCategories,
        'is-collapsed': !isExpanded && hasCategories,
      }"
      @click="onTotalSectionClick"
    >
      <div class="total-row">
        <BudgetMeter
          label="Gesamt"
          :spent="totalSpentForBudget"
          :target="effectiveTarget"
          color="var(--color-primary-dark)"
          :prominent="hasCategories"
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
          <span v-if="hasCategories" class="btn-spacer" aria-hidden="true"></span>
        </div>
      </div>
    </div>

    <!-- Bei vorhandenen Kategorien: Alle Kategorie-Details im Accordion zusammengefasst -->
    <Accordion
      v-if="hasCategories"
      :id="`budget-categories-${budget.id}`"
      :expanded="isExpanded"
      :inert-when-closed="true"
      class="categories-accordion"
    >
      <div class="categories-wrapper">
        <div class="categories-header">
          <span class="categories-title">Kategorien</span>
        </div>
        <div class="categories-list">
          <div class="category-row" v-for="(a, idx) in allocations" :key="a.id">
            <BudgetMeter
              :label="a.category"
              :spent="store.spentFor(budget, a.category)"
              :target="a.amount"
              :color="categoryColors.get(a.category) ?? 'var(--color-text-muted)'"
              :delay="(idx + 1) * 45"
              :warning="
                store.isDuplicateCategory(budget.id, a.category)
                  ? 'Diese Kategorie ist mehreren Budgets zugeordnet – Ausgaben dafür fließen in mehrere Budgets ein.'
                  : undefined
              "
            />
            <div class="category-edit">
              <Input
                type="number"
                step="0.01"
                size="sm"
                class="category-amount-input"
                :aria-label="`Betrag für Kategorie ${a.category}`"
                :model-value="String(a.amount)"
                @change="
                  updateAllocationAmount(a.category, ($event.target as HTMLInputElement).value)
                "
              />
              <IconButton
                variant="ghost"
                size="sm"
                :icon="ACTION_ICONS.close"
                class="remove-category-btn"
                :title="`Kategorie „${a.category}“ aus dem Budget entfernen`"
                :aria-label="`Kategorie ${a.category} aus dem Budget entfernen`"
                @click.stop="store.removeAllocation(a.id)"
              />
            </div>
          </div>
        </div>

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
                <CategoryCombobox
                  :id="id"
                  v-model="newCategory"
                  type="expense"
                  placeholder="Neue Kategorie"
                />
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
      </div>
    </Accordion>

    <!-- Bei einfachem Budget (0 Kategorien): "+ Kategorie hinzufügen" direkt anbieten -->
    <div v-else class="add-category">
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
            <CategoryCombobox
              :id="id"
              v-model="newCategory"
              type="expense"
              placeholder="Neue Kategorie"
            />
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
  width: 100%;
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

.pot-head.is-collapsible {
  cursor: pointer;
  user-select: none;
}

.pot-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.collapse-btn :deep(svg),
.collapse-btn :deep(.btn__icon) {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  color: var(--color-text-muted);
}

.collapse-btn.is-open :deep(svg),
.collapse-btn.is-open :deep(.btn__icon) {
  transform: rotate(180deg);
}

.pot-head.is-collapsible:hover .collapse-btn :deep(svg),
.pot-head.is-collapsible:hover .collapse-btn :deep(.btn__icon) {
  color: var(--color-primary);
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

.total-section {
  width: 100%;
}

.total-section.has-categories {
  background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
  border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border));
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  padding: var(--space-1) var(--space-3);
}

.total-section.is-collapsed {
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.total-section.is-collapsed:hover {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface));
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
}

.total-section.is-collapsed .category-edit {
  cursor: default;
}

.total-section.has-categories .total-row :deep(.meter-row) {
  padding: var(--space-1) 0;
}

.categories-accordion {
  width: 100%;
  margin-top: 2px;
}

.categories-accordion:not(.is-expanded) {
  margin-top: calc(-1 * var(--space-2));
}

.categories-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.categories-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  padding: 0 4px;
}

.categories-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  border-left: 2px solid color-mix(in srgb, var(--color-primary) 20%, var(--color-border));
  margin-left: 6px;
  padding-left: var(--space-2);
}

.category-row,
.total-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.category-row :deep(.meter-row),
.total-row :deep(.meter-row) {
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

.remove-category-btn {
  color: var(--color-text-muted);
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

.remove-category-btn:hover {
  color: var(--color-text);
}

.add-category {
  display: flex;
  flex-direction: column;
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
  margin-top: var(--space-2);
  background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
  border: 1px dashed color-mix(in srgb, var(--color-primary) 20%, transparent);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.add-category-form .form-field {
  flex: 1;
  min-width: 110px;
}

@media (prefers-reduced-motion: reduce) {
  .collapse-btn :deep(svg),
  .collapse-btn :deep(.btn__icon) {
    transition: none;
  }
}
</style>

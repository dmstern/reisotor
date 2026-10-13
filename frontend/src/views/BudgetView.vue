<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useSpotsStore } from '../stores/spots';
import { useBudgetStore } from '../stores/budget';
import { useLiveSyncStore } from '../stores/liveSync';
import BudgetMeter from '../components/BudgetMeter.vue';
import BudgetPotCard from '../components/BudgetPotCard.vue';
import BudgetSettlementCard from '../components/BudgetSettlementCard.vue';
import BudgetExpenseList from '../components/BudgetExpenseList.vue';
import BudgetTransferList from '../components/BudgetTransferList.vue';
import Modal from '../components/Modal.vue';
import CategoryCombobox from '../components/CategoryCombobox.vue';
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
import { useBudgetPotForms } from '../composables/useBudgetPotForms';
import { useBudgetExpenseForms } from '../composables/useBudgetExpenseForms';
import { useBudgetTransferForm } from '../composables/useBudgetTransferForm';
import { useBudgetSources } from '../composables/useBudgetSources';

const spotsStore = useSpotsStore();
const budgetStore = useBudgetStore();
const liveSync = useLiveSyncStore();
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

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

// --- Töpfe, Ausgaben, Überweisungen & Quellen via Composables ---
const {
  newBudgetForm,
  showNewBudgetForm,
  addBudget,
  closeNewBudgetForm,
  editingBudget,
  editBudgetForm,
  startEditBudget,
  closeEditBudgetForm,
  submitEditBudget,
  deleteEditingBudget,
} = useBudgetPotForms();

const {
  showExpenseForm,
  showExpenseDetails,
  expenseForm,
  editingExpense,
  isExpenseUploadingAttachments,
  showEditExpenseDetails,
  editExpenseForm,
  expenseDetailsCount,
  editExpenseDetailsCount,
  newExpenseDraft,
  editExpenseDraft,
  submitExpense,
  closeExpenseForm,
  discardNewExpenseDraft,
  startEditExpense,
  submitEditExpense,
  closeEditExpenseForm,
  discardEditExpenseDraft,
} = useBudgetExpenseForms();

const {
  showTransferForm,
  showTransferDetails,
  transferForm,
  submitTransfer,
  closeTransferForm,
  useSettlementSuggestion,
} = useBudgetTransferForm();

const { autoSourceFor, categoryColors } = useBudgetSources();
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
            Mitreisenden, private Töpfe nur du selbst.
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
                    <option value="shared">Geteilt (für alle im Urlaub sichtbar)</option>
                    <option value="personal">Privat (nur für mich sichtbar)</option>
                  </Select>
                </FormField>
              </div>
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
                <Button
                  type="button"
                  variant="secondary"
                  class="btn-cancel"
                  @click="closeNewBudgetForm"
                >
                  Abbrechen
                </Button>
                <Button type="submit">Anlegen</Button>
              </div>
            </form>
          </Modal>

          <Modal
            :model-value="editingBudget !== null"
            title="Budget bearbeiten"
            @update:model-value="(v) => !v && closeEditBudgetForm()"
          >
            <form class="edit-budget-form edit-form" @submit.prevent="submitEditBudget">
              <FormField icon="title" label="Name" required v-slot="{ id }">
                <Input
                  :id="id"
                  v-model="editBudgetForm.name"
                  type="text"
                  placeholder="Name (z. B. Souvenirs)"
                  required
                />
              </FormField>
              <div v-if="budgetStore.users.length > 1" class="row">
                <FormField icon="visibility" label="Sichtbarkeit" v-slot="{ id }">
                  <Select :id="id" v-model="editBudgetForm.kind">
                    <option value="shared">Geteilt (für alle im Urlaub sichtbar)</option>
                    <option value="personal">Privat (nur für mich sichtbar)</option>
                  </Select>
                </FormField>
              </div>
              <FormField icon="amount" label="Gesamtziel" v-slot="{ id }">
                <Input
                  :id="id"
                  v-model="editBudgetForm.target_amount"
                  type="number"
                  inputmode="decimal"
                  step="0.01"
                  placeholder="Gesamtziel €"
                />
              </FormField>
              <div class="actions-row">
                <Button
                  type="button"
                  variant="danger"
                  secondary
                  :icon="ACTION_ICONS.delete"
                  @click="deleteEditingBudget"
                >
                  Löschen
                </Button>
                <div class="spacer"></div>
                <Button
                  type="button"
                  variant="secondary"
                  class="btn-cancel"
                  @click="closeEditBudgetForm"
                >
                  Abbrechen
                </Button>
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </Modal>

          <TransitionGroup tag="div" name="list" class="pot-grid">
            <BudgetPotCard
              v-for="budget in budgetStore.budgets"
              :key="budget.id"
              :budget="budget"
              :category-colors="categoryColors"
              @edit="startEditBudget"
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
            :confirm-close="newExpenseDraft.isDirty.value"
            confirm-close-mode="draft"
            confirm-close-entity="Ausgabe"
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
                  <CategoryCombobox
                    :id="id"
                    v-model="expenseForm.category"
                    type="expense"
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
                :can-discard="true"
                mode="create"
                @discard="discardNewExpenseDraft"
              />
              <div class="actions-row">
                <div class="spacer"></div>
                <Button
                  type="button"
                  variant="secondary"
                  class="btn-cancel"
                  @click="closeExpenseForm"
                >
                  Abbrechen
                </Button>
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
                <Button
                  type="button"
                  variant="secondary"
                  class="btn-cancel"
                  @click="closeTransferForm"
                >
                  Abbrechen
                </Button>
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
      :confirm-close="editExpenseDraft.isDirty.value"
      confirm-close-entity="Ausgabe"
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
            <CategoryCombobox
              :id="id"
              v-model="editExpenseForm.category"
              type="expense"
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

        <FileAttachments
          v-if="editingExpense"
          domain="budget"
          :entity-id="editingExpense.id"
          v-model:uploading="isExpenseUploadingAttachments"
        />
        <DraftStatusBar
          :status="editExpenseDraft.status.value"
          :restored="editExpenseDraft.restored.value"
          :can-discard="true"
          mode="edit"
          @discard="discardEditExpenseDraft"
        />
        <div class="actions-row">
          <div class="spacer"></div>
          <Button
            type="button"
            variant="secondary"
            class="btn-cancel"
            @click="closeEditExpenseForm"
          >
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isExpenseUploadingAttachments">Speichern</Button>
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

.privacy-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  font-size: 0.82rem;
  color: var(--color-text-muted);
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

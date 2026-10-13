<script setup lang="ts">
import { ref } from 'vue';
import type { PackingItem } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useUiSettingsStore } from '../stores/uiSettings';
import { usePackingList, DEFAULT_PACKING_CATEGORY } from '../composables/usePackingList';
import PackingItemRow from '../components/PackingItem.vue';
import Modal from '../components/Modal.vue';
import Combobox from '../components/Combobox.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import ListSettingsMenu from '../components/ListSettingsMenu.vue';
import FormField from '../components/FormField.vue';
import Button from '../components/primitives/Button.vue';
import Select from '../components/primitives/Select.vue';
import Input from '../components/primitives/Input.vue';
import Badge from '../components/primitives/Badge.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const auth = useAuthStore();
const uiSettings = useUiSettingsStore();

const {
  tripId,
  items,
  users,
  loading,
  highlightedIds,
  categoryRequired,
  categories,
  subcategories,
  lists,
  overallProgress,
  quickAddCategories,
  quickAddSubcategories,
  quickAddQuantities,
  updateCounts,
  quickAdd,
  submitEdit: submitEditItem,
  remove,
  groupByCategory,
  progress,
} = usePackingList();

const editingItem = ref<PackingItem | null>(null);
const editForm = ref({ label: '', category: '', subcategory: '', quantity: 1, ownerId: 'shared' });

function startEdit(item: PackingItem) {
  editingItem.value = item;
  editForm.value = {
    label: item.label,
    category: item.category ?? (categoryRequired.value ? DEFAULT_PACKING_CATEGORY : ''),
    subcategory: item.subcategory ?? '',
    quantity: item.quantity,
    ownerId: item.owner_id == null ? 'shared' : String(item.owner_id),
  };
}

async function submitEdit() {
  if (!editingItem.value) return;
  await submitEditItem(
    editingItem.value.id,
    editForm.value,
    editingItem.value.laid_out_count,
    editingItem.value.packed_count
  );
  editingItem.value = null;
}

async function deleteEditingItem() {
  if (!editingItem.value) return;
  const id = editingItem.value.id;
  editingItem.value = null;
  await remove(id);
}
</script>

<template>
  <div class="page packing-page" v-if="!loading">
    <div class="page-header-row">
      <div class="page-header-top">
        <div class="page-title-group">
          <div class="title-with-pill">
            <h1>Packliste</h1>
            <div class="progress-pill-group">
              <Badge
                :variant="
                  overallProgress.packed === overallProgress.total && overallProgress.total > 0
                    ? 'success'
                    : 'primary'
                "
                size="sm"
              >
                {{ overallProgress.packed }}/{{ overallProgress.total }} gepackt
              </Badge>
              <span v-if="overallProgress.total > 0" class="progress-percentage">
                {{ Math.round((overallProgress.packed / overallProgress.total) * 100) }}%
              </span>
            </div>
          </div>
          <div v-if="overallProgress.total > 0" class="header-progress-track" aria-hidden="true">
            <div
              class="header-progress-bar"
              :style="{
                width: `${Math.round((overallProgress.packed / overallProgress.total) * 100)}%`,
              }"
            ></div>
          </div>
        </div>
        <ListSettingsMenu
          v-model:hide-completed="uiSettings.hideCompletedPacking"
          hide-completed-label="Gepackte ausblenden"
        />
      </div>
    </div>

    <div class="lists-grid">
      <section
        class="list-section animate-cascade"
        v-for="(list, index) in lists"
        :key="list.key"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
      >
        <div class="list-header" v-if="users.length > 1">
          <h2>{{ list.title }}</h2>
          <span class="progress"
            >{{ progress(list.items).packed }}/{{ progress(list.items).total }} gepackt</span
          >
        </div>

        <QuickAddRow
          class="card"
          :placeholder="
            users.length > 1 ? `Neuer Gegenstand für ${list.title}` : 'Neuer Gegenstand'
          "
          @submit="(label) => quickAdd(list, label)"
        >
          <template #extra>
            <div class="pack-quick-extra">
              <Combobox
                v-model="quickAddCategories[list.key]"
                :options="categories"
                placeholder="Kategorie"
                size="sm"
              />
              <Combobox
                v-model="quickAddSubcategories[list.key]"
                :options="subcategories"
                placeholder="Unterkategorie"
                size="sm"
              />
              <label :for="`quick-add-qty-${list.key}`" class="qty-field quick-add-qty">
                <Input
                  :id="`quick-add-qty-${list.key}`"
                  v-model.number="quickAddQuantities[list.key]"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  step="1"
                  placeholder="1"
                  size="sm"
                />
              </label>
            </div>
          </template>
        </QuickAddRow>

        <div
          class="card group"
          v-for="catGroup in groupByCategory(list.items)"
          :key="catGroup.category"
        >
          <h3>{{ catGroup.category }}</h3>
          <template v-for="sub in catGroup.subgroups" :key="sub.subcategory ?? '_'">
            <h4 v-if="sub.subcategory" class="subcategory">{{ sub.subcategory }}</h4>
            <TransitionGroup tag="ul" name="list" class="list">
              <PackingItemRow
                v-for="item in sub.items"
                :key="item.id"
                :item="item"
                :highlighted="highlightedIds.has(item.id)"
                @update-counts="updateCounts"
                @edit="startEdit"
              />
            </TransitionGroup>
          </template>
        </div>
        <div v-if="!list.items.length" class="card empty-card">
          <EmptyState>Noch keine Gegenstände auf dieser Liste.</EmptyState>
        </div>
        <div
          v-else-if="uiSettings.hideCompletedPacking && !groupByCategory(list.items).length"
          class="card empty-card"
        >
          <EmptyState>Alle Gegenstände eingepackt.</EmptyState>
        </div>
      </section>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Gegenstand bearbeiten"
      full-height
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField icon="title" label="Gegenstand" required v-slot="{ id }">
          <Input :id="id" v-model="editForm.label" type="text" placeholder="Gegenstand" required />
        </FormField>
        <FormField
          icon="category"
          label="Kategorie"
          :required="Boolean(categoryRequired)"
          v-slot="{ id }"
        >
          <Combobox
            :id="id"
            v-model="editForm.category"
            :options="categories"
            placeholder="Kategorie"
          />
        </FormField>
        <FormField icon="category" label="Unterkategorie" v-slot="{ id }">
          <Combobox
            :id="id"
            v-model="editForm.subcategory"
            :options="subcategories"
            placeholder="Unterkategorie (z. B. Outfit Tag 1)"
          />
        </FormField>
        <FormField icon="amount" label="Anzahl" required v-slot="{ id }">
          <Input
            :id="id"
            v-model.number="editForm.quantity"
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
          />
        </FormField>
        <FormField v-if="users.length > 1" icon="person" label="Liste" v-slot="{ id }">
          <Select :id="id" v-model="editForm.ownerId">
            <option value="shared">🤝 Gemeinsam</option>
            <option
              v-if="
                editForm.ownerId !== 'shared' &&
                !users.some((u) => String(u.id) === String(editForm.ownerId))
              "
              :value="String(editForm.ownerId)"
              disabled
            >
              👤 Ehemaliges Mitglied
            </option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.id === auth.user?.id ? 'Meine Liste' : u.username }}
            </option>
          </Select>
        </FormField>
        <div class="actions-row">
          <Button
            type="button"
            variant="danger"
            secondary
            :icon="ACTION_ICONS.delete"
            @click="deleteEditingItem"
          >
            Löschen
          </Button>
          <div class="spacer"></div>
          <Button type="button" variant="secondary" class="btn-cancel" @click="editingItem = null">
            Abbrechen
          </Button>
          <Button type="submit">Speichern</Button>
        </div>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.page-header-row {
  margin-bottom: var(--space-3);
}

.page-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.page-title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.title-with-pill {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.progress-pill-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.progress-percentage {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.header-progress-track {
  width: 100%;
  max-width: 320px;
  height: 4px;
  background: var(--color-hover);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.header-progress-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

:deep(.quick-add-row) {
  margin-bottom: var(--space-3);
}

.pack-quick-extra {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  /* Volle Breite statt nur der eigenen Inhaltsbreite - sonst bricht das umschließende
     .extra-fields (QuickAddRow.vue) diesen einzelnen Kind-Container gar nicht erst um, bevor er
     intern zu wrappen beginnt, was die Felder unnötig eng zusammenquetscht. */
  width: 100%;
}

.pack-quick-extra :deep(.combobox) {
  flex: 1 1 110px;
  min-width: 90px;
}

.quick-add-qty {
  flex: 0 0 auto;
  margin: 0;
}

.quick-add-qty input,
.quick-add-qty :deep(input) {
  width: 56px;
  height: 36px;
  min-height: 36px;
  padding: 4px 8px;
  font-size: 0.85rem;
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  color: var(--color-text);
  box-sizing: border-box;
}

.quick-add-qty input:focus,
.quick-add-qty :deep(input:focus) {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lists-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.list-section {
  min-width: 0;
}

.list-section:focus-within {
  position: relative;
  z-index: 5;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-2);
}

.list-header h2 {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
  margin: 0;
}

.progress {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.group {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
}

.group h3 {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-2);
}

.subcategory {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: var(--space-2) 0 4px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.empty {
  font-size: 0.9rem;
}

.empty-card {
  margin-bottom: var(--space-3);
}

/* Desktop: Listen nebeneinander statt untereinander, um den vorhandenen Platz besser zu nutzen
   (Batch-Anfrage) – auto-fit/minmax statt einer festen Spaltenzahl, damit sich die Spaltenzahl der
   tatsächlichen Fensterbreite und Anzahl an Listen (gemeinsam + je Person) anpasst. */
@media (min-width: 900px) {
  .lists-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>

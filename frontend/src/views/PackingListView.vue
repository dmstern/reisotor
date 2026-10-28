<script setup lang="ts">
import { ref } from 'vue';
import type { PackingItem } from '../api/types';
import { useUiSettingsStore } from '../stores/uiSettings';
import { usePackingList, type PackingEditFormInput } from '../composables/usePackingList';
import PackingItemRow from '../components/PackingItem.vue';
import PackingEditModal from '../components/PackingEditModal.vue';
import ListProgressHeader from '../components/ListProgressHeader.vue';
import Combobox from '../components/Combobox.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import ListSettingsMenu from '../components/ListSettingsMenu.vue';
import Input from '../components/primitives/Input.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';

const uiSettings = useUiSettingsStore();

const {
  tripId: _tripId,
  items: _items,
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

async function handleEditSubmit(
  id: number,
  form: PackingEditFormInput,
  laidOutCount: number,
  packedCount: number
) {
  await submitEditItem(id, form, laidOutCount, packedCount);
  editingItem.value = null;
}

async function handleEditDelete(id: number) {
  editingItem.value = null;
  await remove(id);
}
</script>

<template>
  <div class="page packing-page" v-if="!loading">
    <ListProgressHeader
      title="Packliste"
      :total="overallProgress.total"
      :completed="overallProgress.packed"
      completed-label="gepackt"
    >
      <template #actions>
        <ListSettingsMenu
          v-model:hide-completed="uiSettings.hideCompletedPacking"
          hide-completed-label="Gepackte ausblenden"
        />
      </template>
    </ListProgressHeader>

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
                @edit="editingItem = $event"
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

    <PackingEditModal
      :item="editingItem"
      :users="users"
      :categories="categories"
      :subcategories="subcategories"
      :category-required="Boolean(categoryRequired)"
      @close="editingItem = null"
      @submit="handleEditSubmit"
      @delete="handleEditDelete"
    />
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
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
  outline: 2px solid var(--color-focus-ring, var(--color-primary));
  outline-offset: 1px;
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

.empty-card {
  margin-bottom: var(--space-3);
}

/* Desktop: Listen nebeneinander statt untereinander, um den vorhandenen Platz besser zu nutzen
   (Batch-Anfrage) – auto-fit/minmax statt einer festen Spaltenzahl, damit sich die Spaltenzahl der
   tatsächlichen Fensterbreite und Anzahl an Listen (gemeinsam + je Person) anpasst. */
@container app-main (min-width: 900px) {
  .lists-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>

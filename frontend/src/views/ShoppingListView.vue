<script setup lang="ts">
import { ref } from 'vue';
import type { Period, ShoppingItem } from '../api/types';
import { useUiSettingsStore } from '../stores/uiSettings';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useShoppingList } from '../composables/useShoppingList';
import {
  useShoppingGrouping,
  UNASSIGNED_SHOP,
  type ShoppingGroup as Group,
} from '../composables/useShoppingGrouping';
import { PERIOD_META } from '../utils/period';
import ListProgressHeader from '../components/ListProgressHeader.vue';
import ListSettingsMenu from '../components/ListSettingsMenu.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import Combobox from '../components/Combobox.vue';
import Select from '../components/primitives/Select.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import ShoppingAddForm from '../components/ShoppingAddForm.vue';
import ShoppingItemRow from '../components/ShoppingItemRow.vue';
import ShoppingEditModal from '../components/ShoppingEditModal.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const uiSettings = useUiSettingsStore();

const {
  tripId,
  items,
  users,
  loading,
  highlightedIds,
  progress,
  toggle,
  reassign: reassignItem,
  addItem: submitNewItem,
  quickAddToGroup: submitQuickAdd,
  submitEdit: updateItem,
  remove,
} = useShoppingList();

const { groupBy, defaultGroupBy, groupByOptions, groupedItems, knownShops, hasItemMeta } =
  useShoppingGrouping(items, users);

const newBuyer = ref('');
const newShop = usePersistedRef(() => (tripId ? `reisotor-shopping-last-shop:${tripId}` : ''), '');
const newPeriod = usePersistedRef<Period | ''>(
  () => (tripId ? `reisotor-shopping-last-period:${tripId}` : ''),
  ''
);
const editingItem = ref<ShoppingItem | null>(null);

async function handleReassign(item: ShoppingItem, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const assigned_to_user_id = value ? Number(value) : null;
  await reassignItem(item, assigned_to_user_id);
}

async function quickAddToGroup(group: Group, label: string) {
  await submitQuickAdd({
    groupKey: group.key,
    groupBy: groupBy.value,
    label,
    fallbackBuyer: newBuyer.value,
    fallbackShop: newShop.value,
    fallbackPeriod: newPeriod.value,
    unassignedShopLabel: UNASSIGNED_SHOP,
  });
}
</script>

<template>
  <div class="page shopping-page" v-if="!loading">
    <ListProgressHeader
      title="Einkaufsliste"
      :total="progress.total"
      :completed="progress.checked"
      completed-label="erledigt"
    >
      <template #actions>
        <ListSettingsMenu
          v-model:group-by="groupBy"
          :group-by-options="groupByOptions"
          :default-group-by="defaultGroupBy"
          v-model:hide-completed="uiSettings.hideCompletedShopping"
          hide-completed-label="Erledigte ausblenden"
        />
      </template>
    </ListProgressHeader>

    <ShoppingAddForm
      :users="users"
      :known-shops="knownShops"
      v-model:last-shop="newShop"
      v-model:last-period="newPeriod"
      @submit="submitNewItem"
    />

    <div class="groups-grid" :class="{ 'groups-grid--masonry masonry': groupBy === 'shop' }">
      <section
        class="group-section animate-cascade"
        v-for="(group, index) in groupedItems"
        :key="group.key"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
      >
        <h2>{{ group.label }}</h2>
        <div class="card group-card">
          <TransitionGroup tag="ul" name="list" class="list">
            <ShoppingItemRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :users="users"
              :group-by="groupBy"
              :is-highlighted="highlightedIds.has(item.id)"
              :has-meta="hasItemMeta(item)"
              @toggle="toggle"
              @reassign="handleReassign"
              @edit="(it) => (editingItem = it)"
            />
            <EmptyState v-if="!group.items.length" :key="`${group.key}-empty`" tag="li">
              {{
                uiSettings.hideCompletedShopping
                  ? 'Keine offenen Einträge.'
                  : 'Noch keine Einträge.'
              }}
            </EmptyState>
          </TransitionGroup>

          <QuickAddRow
            class="group-quick-add"
            :icon="ACTION_ICONS.shoppingCartPlus"
            placeholder="Artikel hinzufügen…"
            @submit="(label) => quickAddToGroup(group, label)"
          >
            <template #extra>
              <Select
                v-if="users.length > 1 && groupBy !== 'buyer'"
                v-model="newBuyer"
                aria-label="Einkäufer:in"
                size="sm"
              >
                <option value="">Kein:e Käufer:in</option>
                <option v-for="u in users" :key="u.id" :value="String(u.id)">
                  {{ u.avatar }} {{ u.username }}
                </option>
              </Select>
              <Combobox
                v-if="groupBy !== 'shop'"
                v-model="newShop"
                :options="knownShops"
                placeholder="Shop"
                size="sm"
              />
              <Select
                v-if="groupBy !== 'period'"
                v-model="newPeriod"
                aria-label="Zeitraum"
                size="sm"
              >
                <option value="">Zeitraum</option>
                <option value="before">{{ PERIOD_META.before }}</option>
                <option value="during">{{ PERIOD_META.during }}</option>
              </Select>
            </template>
          </QuickAddRow>
        </div>
      </section>
    </div>

    <ShoppingEditModal
      :item="editingItem"
      :known-shops="knownShops"
      @close="editingItem = null"
      @submit="updateItem"
      @delete="remove"
    />
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.groups-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.group-section {
  min-width: 0;
}

.groups-grid--masonry > .group-section {
  margin-bottom: 0;
}

.group-section:focus-within {
  position: relative;
  z-index: 5;
}

.group-section h2 {
  font-size: var(--font-size-sm);
  color: var(--color-primary-dark);
  margin-bottom: var(--space-2);
}

.group-card {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
}

.group-quick-add,
.group-quick-add.expanded {
  padding: var(--space-3) 0 0 0;
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-2);
  border-radius: 0;
  box-shadow: none;
}

.group-quick-add :deep(select) {
  width: auto;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* Desktop: Klassisches Grid oder Masonry */
@container app-main (min-width: 900px) {
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }

  .groups-grid--masonry {
    display: block;
    column-width: 360px;
    column-gap: var(--space-4);
  }

  .groups-grid--masonry > .group-section {
    break-inside: avoid;
    margin-bottom: var(--space-4);
  }
}
</style>

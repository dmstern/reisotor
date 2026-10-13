<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TodoItem, TodoPriority, Period } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useUiSettingsStore } from '../stores/uiSettings';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useTodoList } from '../composables/useTodoList';
import {
  useTodoGrouping,
  TODO_PRIORITY_META as PRIORITY_META,
} from '../composables/useTodoGrouping';
import { PERIOD_META } from '../utils/period';
import ListProgressHeader from '../components/ListProgressHeader.vue';
import ListSettingsMenu from '../components/ListSettingsMenu.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import Select from '../components/primitives/Select.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import TodoAddForm from '../components/TodoAddForm.vue';
import TodoItemRow from '../components/TodoItemRow.vue';
import TodoEditModal from '../components/TodoEditModal.vue';

const tripStore = useTripStore();
const uiSettings = useUiSettingsStore();

const {
  items,
  users,
  loading,
  highlightedIds,
  focusedTodoId,
  progress,
  clearFocusedTodo,
  addItem: submitNewTodo,
  quickAddToGroup: submitQuickAdd,
  toggleDone,
  submitEdit: updateTodo,
  remove,
} = useTodoList();

const {
  groupBy,
  sortBy,
  defaultGroupBy,
  defaultSortBy,
  groupByOptions,
  sortByOptions,
  groupedItems,
  periodFor,
  formatDate,
  isOverdue,
  hasTodoMeta,
} = useTodoGrouping(
  items,
  users,
  computed(() => tripStore.currentTrip)
);

const lastAssignee = usePersistedRef('reisotor-todo-last-assignee', '');
const editingItem = ref<TodoItem | null>(null);

function startEdit(item: TodoItem) {
  clearFocusedTodo();
  editingItem.value = item;
}

const quickAddPriority = ref<TodoPriority>('medium');
const quickAddPeriod = ref<Period | ''>('');

async function quickAddToGroup(group: { key: string }, label: string) {
  await submitQuickAdd({
    groupKey: group.key,
    groupBy: groupBy.value,
    label,
    priority: quickAddPriority.value,
    period: quickAddPeriod.value,
    fallbackAssignee: lastAssignee.value,
  });
}
</script>

<template>
  <div class="page todo-page" v-if="!loading">
    <ListProgressHeader
      title="ToDo"
      :total="progress.total"
      :completed="progress.done"
      completed-label="erledigt"
    >
      <template #actions>
        <ListSettingsMenu
          v-model:group-by="groupBy"
          :group-by-options="groupByOptions"
          :default-group-by="defaultGroupBy"
          v-model:sort-by="sortBy"
          :sort-by-options="sortByOptions"
          :default-sort-by="defaultSortBy"
          v-model:hide-completed="uiSettings.hideCompletedTodos"
          hide-completed-label="Erledigte ausblenden"
        />
      </template>
    </ListProgressHeader>

    <TodoAddForm :users="users" v-model:last-assignee="lastAssignee" @submit="submitNewTodo" />

    <div class="groups-grid">
      <section
        class="group-section animate-cascade"
        v-for="(group, index) in groupedItems"
        :key="group.key"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
      >
        <h2>{{ group.label }}</h2>
        <div class="card group-card">
          <TransitionGroup tag="ul" name="list" class="list">
            <TodoItemRow
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :users="users"
              :group-by="groupBy"
              :is-highlighted="highlightedIds.has(item.id)"
              :is-focused="focusedTodoId === item.id"
              :period-label="periodFor(item) ? PERIOD_META[periodFor(item)!] : null"
              :formatted-date="formatDate(item.due_date)"
              :is-overdue="isOverdue(item)"
              :has-meta="hasTodoMeta(item)"
              @toggle-done="toggleDone"
              @click="clearFocusedTodo"
              @edit="startEdit"
            />
            <EmptyState v-if="!group.items.length" :key="`${group.key}-empty`" tag="li">
              {{
                uiSettings.hideCompletedTodos ? 'Keine offenen Aufgaben.' : 'Noch keine Aufgaben.'
              }}
            </EmptyState>
          </TransitionGroup>

          <QuickAddRow
            class="group-quick-add"
            placeholder="Aufgabe hinzufügen…"
            @submit="(label) => quickAddToGroup(group, label)"
          >
            <template #extra>
              <Select
                v-if="users.length > 1 && groupBy !== 'assignee'"
                v-model="lastAssignee"
                aria-label="Zuweisung"
                size="sm"
              >
                <option value="">Nicht zugewiesen</option>
                <option v-for="u in users" :key="u.id" :value="String(u.id)">
                  {{ u.avatar }} {{ u.username }}
                </option>
              </Select>
              <Select
                v-if="groupBy !== 'period'"
                v-model="quickAddPeriod"
                aria-label="Zeitraum"
                size="sm"
              >
                <option value="">Zeitraum</option>
                <option value="before">{{ PERIOD_META.before }}</option>
                <option value="during">{{ PERIOD_META.during }}</option>
              </Select>
              <Select v-model="quickAddPriority" aria-label="Priorität" size="sm">
                <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
                  {{ meta.icon }} {{ meta.label }}
                </option>
              </Select>
            </template>
          </QuickAddRow>
        </div>
      </section>
    </div>

    <TodoEditModal
      :item="editingItem"
      :users="users"
      @close="editingItem = null"
      @submit="updateTodo"
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

/* Desktop: Gruppen nebeneinander statt untereinander */
@container app-main (min-width: 900px) {
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>

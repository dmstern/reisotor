<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TodoItem, TodoPriority, Period } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useUiSettingsStore } from '../stores/uiSettings';
import { useToast } from '../composables/useToast';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useTodoList } from '../composables/useTodoList';
import {
  useTodoGrouping,
  TODO_PRIORITY_META as PRIORITY_META,
} from '../composables/useTodoGrouping';
import { PERIOD_META } from '../utils/period';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import FormField from '../components/FormField.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import ListSettingsMenu from '../components/ListSettingsMenu.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import CheckableListItem from '../components/primitives/CheckableListItem.vue';
import Select from '../components/primitives/Select.vue';
import Input from '../components/primitives/Input.vue';
import Accordion from '../components/primitives/Accordion.vue';
import Badge from '../components/primitives/Badge.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

const tripStore = useTripStore();
const uiSettings = useUiSettingsStore();
const { showToast } = useToast();

const {
  tripId,
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
  toBody,
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
  userLabel,
  userAvatar,
  userName,
  formatDate,
  isOverdue,
  hasTodoMeta,
} = useTodoGrouping(
  items,
  users,
  computed(() => tripStore.currentTrip)
);

const lastAssignee = usePersistedRef('reisotor-todo-last-assignee', '');

const emptyForm = () => ({
  title: '',
  assigned_to_user_id: lastAssignee.value,
  due_date: '',
  period: '' as Period | '',
  priority: 'medium' as TodoPriority,
  note: '',
});

const newForm = ref(emptyForm());
const editingItem = ref<TodoItem | null>(null);
const editForm = ref(emptyForm());
const editTitleTouched = ref(false);

watch(
  () => newForm.value.due_date,
  (newVal, oldVal) => {
    if (newVal && !oldVal && newForm.value.period) {
      showToast({ message: 'Das genaue Datum ersetzt den groben Zeitraum.', type: 'info' });
      newForm.value.period = '';
    }
  }
);
watch(
  () => editForm.value.due_date,
  (newVal, oldVal) => {
    if (newVal && !oldVal && editForm.value.period) {
      showToast({ message: 'Das genaue Datum ersetzt den groben Zeitraum.', type: 'info' });
      editForm.value.period = '';
    }
  }
);

const newDraft = useDraftAutosave('todos:new', newForm, ref(true));
const editDraft = useDraftAutosave(
  () => `todos:edit:${editingItem.value?.id}`,
  editForm,
  computed(() => editingItem.value !== null)
);

const showNewDetails = usePersistedRef('reisotor-todo-show-details', false);

watch(
  () => newDraft.restored.value,
  (restored) => {
    if (restored && (newForm.value.due_date || newForm.value.note)) {
      showNewDetails.value = true;
    }
  }
);

async function addItem() {
  if (!newForm.value.title.trim()) return;
  await submitNewTodo(newForm.value);
  lastAssignee.value = newForm.value.assigned_to_user_id;
  newForm.value = emptyForm();
  newDraft.clear();
}

function discardNewDraft() {
  newForm.value = emptyForm();
  showNewDetails.value = false;
  newDraft.clear();
  showToast({ message: 'Entwurf verworfen.', type: 'info' });
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

function startEdit(item: TodoItem) {
  editTitleTouched.value = false;
  clearFocusedTodo();
  editForm.value = {
    title: item.title,
    assigned_to_user_id: item.assigned_to_user_id != null ? String(item.assigned_to_user_id) : '',
    due_date: item.due_date ?? '',
    period: (item.period as Period | '') ?? '',
    priority: item.priority,
    note: item.note ?? '',
  };
  editingItem.value = item;
}

async function submitEdit() {
  if (!editForm.value.title.trim()) {
    editTitleTouched.value = true;
    return;
  }
  if (!editingItem.value) return;
  await updateTodo(editingItem.value.id, editForm.value, !!editingItem.value.done);
  editDraft.clear();
  editingItem.value = null;
}

function closeEditForm() {
  editTitleTouched.value = false;
  editDraft.clear();
  editingItem.value = null;
}

function discardEditDraft() {
  if (!editingItem.value) return;
  startEdit(editingItem.value);
  editDraft.clear();
  showToast({ message: 'Änderungen verworfen.', type: 'info' });
}

async function deleteEditingItem() {
  if (!editingItem.value) return;
  const id = editingItem.value.id;
  closeEditForm();
  await remove(id);
}
</script>

<template>
  <div class="page todo-page" v-if="!loading">
    <div class="page-header-row">
      <div class="page-header-top">
        <div class="page-title-group">
          <div class="title-with-pill">
            <h1>ToDo</h1>
            <div class="progress-pill-group">
              <Badge
                :variant="
                  progress.done === progress.total && progress.total > 0 ? 'success' : 'primary'
                "
                size="sm"
              >
                {{ progress.done }}/{{ progress.total }} erledigt
              </Badge>
              <span v-if="progress.total > 0" class="progress-percentage">
                {{ Math.round((progress.done / progress.total) * 100) }}%
              </span>
            </div>
          </div>
          <div v-if="progress.total > 0" class="header-progress-track" aria-hidden="true">
            <div
              class="header-progress-bar"
              :style="{ width: `${Math.round((progress.done / progress.total) * 100)}%` }"
            ></div>
          </div>
        </div>
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
      </div>
    </div>

    <!-- Progressives Schnelleingabe-Formular -->
    <form class="add-form card" @submit.prevent="addItem">
      <div class="quick-input-row">
        <div class="main-input-wrap">
          <FormField icon="title" label="Aufgabe" required v-slot="{ id }">
            <div class="input-inline-action-wrap">
              <Input
                :id="id"
                v-model="newForm.title"
                type="text"
                placeholder="Neue Aufgabe"
                required
              />
              <Button
                type="submit"
                class="inline-submit-btn"
                variant="primary"
                size="sm"
                :icon="ACTION_ICONS.send"
                :disabled="!newForm.title.trim()"
                aria-label="Hinzufügen"
                title="Hinzufügen"
              />
            </div>
          </FormField>
        </div>

        <div class="quick-input-actions">
          <Button
            type="button"
            variant="ghost"
            class="details-toggle-btn"
            :aria-expanded="showNewDetails"
            @click="showNewDetails = !showNewDetails"
          >
            <AppIcon
              :icon="showNewDetails ? ACTION_ICONS.chevronUp : ACTION_ICONS.chevronDown"
              :size="14"
              group="actions"
            />
            <span>Details</span>
          </Button>
        </div>
      </div>

      <!-- Sanft ausklappbare Detail-Felder -->
      <Accordion :expanded="showNewDetails" :inert-when-closed="false">
        <div class="form-details-grid">
          <FormField v-if="users.length > 1" icon="person" label="Bearbeiter:in" v-slot="{ id }">
            <Select :id="id" v-model="newForm.assigned_to_user_id">
              <option value="">Nicht zugewiesen</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">
                {{ u.avatar }} {{ u.username }}
              </option>
            </Select>
          </FormField>

          <FormField icon="date" label="Fällig" v-slot="{ id }">
            <Input :id="id" v-model="newForm.due_date" type="date" />
          </FormField>

          <FormField icon="period" label="Zeitraum" v-slot="{ id }">
            <Select :id="id" v-model="newForm.period" :disabled="!!newForm.due_date">
              <option value="">(Nach Datum / Ohne)</option>
              <option v-for="(label, key) in PERIOD_META" :key="key" :value="key">
                {{ label }}
              </option>
            </Select>
          </FormField>

          <FormField icon="priority" label="Priorität" v-slot="{ id }">
            <Select :id="id" v-model="newForm.priority">
              <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
                {{ meta.icon }} {{ meta.label }}
              </option>
            </Select>
          </FormField>

          <FormField icon="note" label="Notiz" v-slot="{ id }">
            <Input :id="id" v-model="newForm.note" type="text" placeholder="Notiz" />
          </FormField>
        </div>
      </Accordion>

      <DraftStatusBar
        :status="newDraft.status.value"
        :restored="newDraft.restored.value"
        :can-discard="true"
        @discard="discardNewDraft"
      />
    </form>

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
            <CheckableListItem
              v-for="item in group.items"
              :key="item.id"
              :id="`todo-${item.id}`"
              :done="!!item.done"
              :highlighted="highlightedIds.has(item.id)"
              :focused="focusedTodoId === item.id"
              @click="clearFocusedTodo"
            >
              <div class="item-main">
                <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                <label :for="'todo-item-' + item.id" class="check">
                  <Checkbox
                    :id="'todo-item-' + item.id"
                    :checked="!!item.done"
                    @change="toggleDone(item)"
                  />
                  <span
                    v-if="item.priority"
                    class="priority"
                    :title="`Priorität: ${PRIORITY_META[item.priority].label}`"
                    :aria-label="`Priorität: ${PRIORITY_META[item.priority].label}`"
                  >
                    <AppIcon
                      :icon="ACTION_ICONS.priorityDot"
                      :size="10"
                      :color="PRIORITY_META[item.priority].color"
                      group="actions"
                    />
                  </span>
                  <span
                    class="item-title title"
                    :class="{ 'row__text--done': item.done, 'text-done': item.done }"
                  >
                    {{ item.title }}
                  </span>
                </label>

                <div v-if="hasTodoMeta(item)" class="item-meta">
                  <PendingSyncBadge v-if="item._pending" />
                  <Badge
                    v-if="item.due_date"
                    :variant="isOverdue(item) ? 'danger' : 'default'"
                    size="sm"
                    class="due-badge"
                  >
                    <AppIcon :icon="FORM_FIELD_ICONS.date" :size="11" group="formFields" />
                    <span>{{ formatDate(item.due_date) }}</span>
                  </Badge>
                  <Badge
                    v-if="groupBy !== 'period' && periodFor(item)"
                    size="sm"
                    class="period-badge"
                  >
                    <AppIcon :icon="FORM_FIELD_ICONS.period" :size="11" group="formFields" />
                    <span>{{ PERIOD_META[periodFor(item)!] }}</span>
                  </Badge>
                  <span v-if="item.note" class="note" :title="item.note">
                    <AppIcon :icon="FORM_FIELD_ICONS.note" :size="11" group="formFields" />
                    <span class="note-text">{{ item.note }}</span>
                  </span>
                </div>
              </div>

              <template #actions>
                <span
                  v-if="
                    users.length > 1 &&
                    groupBy !== 'assignee' &&
                    userAvatar(item.assigned_to_user_id)
                  "
                  class="assignee-avatar-pill"
                  :title="`Zugewiesen an: ${userName(item.assigned_to_user_id)}`"
                >
                  {{ userAvatar(item.assigned_to_user_id) }}
                </span>
                <EditButton small @click="startEdit(item)" />
              </template>
            </CheckableListItem>
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

    <Modal
      :model-value="editingItem !== null"
      title="Aufgabe bearbeiten"
      full-height
      :confirm-close="editDraft.isDirty.value"
      confirm-close-entity="Aufgabe"
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField
          icon="title"
          label="Titel"
          required
          :invalid="editTitleTouched && !editForm.title.trim()"
          :error="
            editTitleTouched && !editForm.title.trim()
              ? 'Dieses Feld muss noch ausgefüllt werden.'
              : undefined
          "
          v-slot="{ id, invalid }"
        >
          <Input
            :id="id"
            v-model="editForm.title"
            type="text"
            placeholder="Titel"
            required
            :invalid="invalid"
            @blur="editTitleTouched = true"
          />
        </FormField>
        <FormField v-if="users.length > 1" icon="person" label="Bearbeiter:in" v-slot="{ id }">
          <Select :id="id" v-model="editForm.assigned_to_user_id">
            <option value="">Nicht zugewiesen</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.username }}
            </option>
          </Select>
        </FormField>
        <FormField icon="date" label="Fällig" v-slot="{ id }">
          <Input :id="id" v-model="editForm.due_date" type="date" />
        </FormField>
        <FormField icon="period" label="Zeitraum" v-slot="{ id }">
          <Select :id="id" v-model="editForm.period" :disabled="!!editForm.due_date">
            <option value="">(Nach Datum / Ohne)</option>
            <option v-for="(label, key) in PERIOD_META" :key="key" :value="key">
              {{ label }}
            </option>
          </Select>
        </FormField>
        <FormField icon="priority" label="Priorität" v-slot="{ id }">
          <Select :id="id" v-model="editForm.priority">
            <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
              {{ meta.icon }} {{ meta.label }}
            </option>
          </Select>
        </FormField>
        <FormField icon="note" label="Notiz" v-slot="{ id }">
          <Input :id="id" v-model="editForm.note" type="text" placeholder="Notiz" />
        </FormField>
        <DraftStatusBar
          :status="editDraft.status.value"
          :restored="editDraft.restored.value"
          :can-discard="true"
          mode="edit"
          @discard="discardEditDraft"
        />
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
          <Button type="button" variant="secondary" class="btn-cancel" @click="closeEditForm">
            Abbrechen
          </Button>
          <Button
            type="submit"
            :disabled="!editForm.title.trim()"
            :title="
              !editForm.title.trim()
                ? 'Bitte gib zuerst einen Titel für die Aufgabe ein'
                : undefined
            "
          >
            Speichern
          </Button>
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

/* Progressives Schnelleingabe-Formular */
.add-form {
  position: relative;
  z-index: 1;
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.add-form:focus-within {
  z-index: 5;
}

.quick-input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.main-input-wrap {
  flex: 1;
  min-width: 160px;
}

.main-input-wrap :deep(.form-field) {
  margin-bottom: 0;
}

.input-inline-action-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-inline-action-wrap :deep(.input) {
  width: 100%;
  padding-right: 44px;
}

.inline-submit-btn {
  position: absolute;
  right: 6px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  translate: none;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition:
    background 0.15s ease,
    opacity 0.15s ease,
    scale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.inline-submit-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.inline-submit-btn:hover:not(:disabled) {
  translate: none;
  scale: 1.05;
}

.inline-submit-btn:active:not(:disabled) {
  translate: none;
  transform: none;
  scale: 0.95;
}

.quick-input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.details-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.form-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
  margin-top: var(--space-2);
}

@media (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

@container app-main (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

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
  font-size: 0.95rem;
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

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
  min-width: 0;
  width: 100%;
}

.check :deep(.checkbox) {
  flex-shrink: 0;
  margin-top: 1.5px;
}

.priority {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 3px;
}

.item-title {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--color-text);
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: pretty;
  hyphens: auto;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 4px 8px;
  flex-wrap: wrap;
  margin-left: 28px;
  min-width: 0;
}

.due-badge,
.period-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.due-badge span,
.period-badge span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assignee-avatar-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  font-size: 0.85rem;
  line-height: 1;
  flex-shrink: 0;
}

.note {
  display: inline-flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  max-width: 100%;
  min-width: 0;
  line-height: 1.35;
}

.note :deep(.app-icon),
.note svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.note-text {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: normal;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Desktop: Gruppen nebeneinander statt untereinander, um den vorhandenen Platz besser zu nutzen –
   auto-fit/minmax statt einer festen Spaltenzahl, damit sich die Spaltenzahl der tatsächlichen
   Fensterbreite und Anzahl an Gruppen anpasst. Exakt dasselbe Muster wie PackingListView.vue. */
@media (min-width: 900px) {
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>

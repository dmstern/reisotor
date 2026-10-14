<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { TodoItem, TodoPriority, User, Period } from '../api/types';
import type { TodoFormInput } from '../composables/useTodoList';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { useToast } from '../composables/useToast';
import { PERIOD_META } from '../utils/period';
import { ACTION_ICONS } from '../utils/actionIcons';
import { TODO_PRIORITY_META as PRIORITY_META } from '../composables/useTodoGrouping';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import DraftStatusBar from './DraftStatusBar.vue';

const props = defineProps<{
  item: TodoItem | null;
  users: User[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', id: number, form: TodoFormInput, done: boolean): void;
  (e: 'delete', id: number): void;
}>();

const { showToast } = useToast();

const emptyForm = () => ({
  title: '',
  assigned_to_user_id: '' as string | number,
  due_date: '',
  period: '' as Period | '',
  priority: 'medium' as TodoPriority,
  note: '',
});

const editForm = ref(emptyForm());
const editTitleTouched = ref(false);

const editDraft = useDraftAutosave(
  () => `todos:edit:${props.item?.id}`,
  editForm,
  computed(() => props.item !== null)
);

watch(
  () => props.item,
  (newItem) => {
    editTitleTouched.value = false;
    if (newItem) {
      editForm.value = {
        title: newItem.title,
        assigned_to_user_id:
          newItem.assigned_to_user_id != null ? String(newItem.assigned_to_user_id) : '',
        due_date: newItem.due_date ?? '',
        period: (newItem.period as Period | '') ?? '',
        priority: newItem.priority,
        note: newItem.note ?? '',
      };
    }
  },
  { immediate: true }
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

function handleSubmit() {
  if (!editForm.value.title.trim()) {
    editTitleTouched.value = true;
    return;
  }
  if (!props.item) return;
  emit('submit', props.item.id, { ...editForm.value }, !!props.item.done);
  editDraft.clear();
  emit('close');
}

function handleClose() {
  editTitleTouched.value = false;
  editDraft.clear();
  emit('close');
}

function discardDraft() {
  if (!props.item) return;
  editForm.value = {
    title: props.item.title,
    assigned_to_user_id:
      props.item.assigned_to_user_id != null ? String(props.item.assigned_to_user_id) : '',
    due_date: props.item.due_date ?? '',
    period: (props.item.period as Period | '') ?? '',
    priority: props.item.priority,
    note: props.item.note ?? '',
  };
  editDraft.clear();
  showToast({ message: 'Änderungen verworfen.', type: 'info' });
}

function handleDelete() {
  if (!props.item) return;
  const id = props.item.id;
  handleClose();
  emit('delete', id);
}
</script>

<template>
  <Modal
    :model-value="item !== null"
    title="Aufgabe bearbeiten"
    full-height
    :confirm-close="editDraft.isDirty.value"
    confirm-close-entity="Aufgabe"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form" @submit.prevent="handleSubmit">
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
        @discard="discardDraft"
      />

      <div class="actions-row">
        <Button
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          @click="handleDelete"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" :disabled="!editForm.title.trim()">
          Speichern
        </Button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4) 0;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.spacer {
  flex: 1;
}
</style>

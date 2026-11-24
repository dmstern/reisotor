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
const initialSnapshot = ref<ReturnType<typeof emptyForm> | null>(null);
const editTitleTouched = ref(false);

watch(
  () => props.item,
  (newItem) => {
    editTitleTouched.value = false;

    if (newItem) {
      const initial = {
        title: newItem.title,
        assigned_to_user_id:
          newItem.assigned_to_user_id != null ? String(newItem.assigned_to_user_id) : '',
        due_date: newItem.due_date ?? '',
        period: (newItem.period as Period | '') ?? '',
        priority: newItem.priority,
        note: newItem.note ?? '',
      };
      editForm.value = { ...initial };
      initialSnapshot.value = initial;
    } else {
      initialSnapshot.value = null;
    }
  },
  { immediate: true }
);

const isTitleModified = computed(
  () => initialSnapshot.value !== null && editForm.value.title !== initialSnapshot.value.title
);
const isAssignedModified = computed(
  () =>
    initialSnapshot.value !== null &&
    String(editForm.value.assigned_to_user_id) !== String(initialSnapshot.value.assigned_to_user_id)
);
const isDueDateModified = computed(
  () => initialSnapshot.value !== null && editForm.value.due_date !== initialSnapshot.value.due_date
);
const isPeriodModified = computed(
  () => initialSnapshot.value !== null && editForm.value.period !== initialSnapshot.value.period
);
const isPriorityModified = computed(
  () => initialSnapshot.value !== null && editForm.value.priority !== initialSnapshot.value.priority
);
const isNoteModified = computed(
  () => initialSnapshot.value !== null && editForm.value.note !== initialSnapshot.value.note
);

const editDraft = useDraftAutosave(
  () => `todos:edit:${props.item?.id}`,
  editForm,
  computed(() => props.item !== null)
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

  if (!props.item) {
    return;
  }

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
  if (!props.item) {
    return;
  }

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
  if (!props.item) {
    return;
  }

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
        :modified="isTitleModified"
        :error="
          editTitleTouched && !editForm.title.trim()
            ? 'Dieses Feld muss noch ausgefüllt werden.'
            : undefined
        "
        v-slot="{ id, invalid, modified }"
      >
        <Input
          :id="id"
          v-model="editForm.title"
          type="text"
          placeholder="Titel"
          required
          :invalid="invalid"
          :modified="modified"
          @blur="editTitleTouched = true"
        />
      </FormField>

      <FormField
        v-if="users.length > 1"
        icon="person"
        label="Bearbeiter:in"
        :modified="isAssignedModified"
        v-slot="{ id, modified }"
      >
        <Select :id="id" v-model="editForm.assigned_to_user_id" :modified="modified">
          <option value="">Nicht zugewiesen</option>
          <option v-for="u in users" :key="u.id" :value="String(u.id)">
            {{ u.avatar }} {{ u.username }}
          </option>
        </Select>
      </FormField>

      <FormField icon="date" label="Fällig" :modified="isDueDateModified" v-slot="{ id, modified }">
        <Input :id="id" v-model="editForm.due_date" type="date" :modified="modified" />
      </FormField>

      <FormField
        icon="period"
        label="Zeitraum"
        :modified="isPeriodModified"
        v-slot="{ id, modified }"
      >
        <Select
          :id="id"
          v-model="editForm.period"
          :disabled="!!editForm.due_date"
          :modified="modified"
        >
          <option value="">(Nach Datum / Ohne)</option>
          <option v-for="(label, key) in PERIOD_META" :key="key" :value="key">
            {{ label }}
          </option>
        </Select>
      </FormField>

      <FormField
        icon="priority"
        label="Priorität"
        :modified="isPriorityModified"
        v-slot="{ id, modified }"
      >
        <Select :id="id" v-model="editForm.priority" :modified="modified">
          <option v-for="(meta, key) in PRIORITY_META" :key="key" :value="key">
            {{ meta.icon }} {{ meta.label }}
          </option>
        </Select>
      </FormField>

      <FormField icon="note" label="Notiz" :modified="isNoteModified" v-slot="{ id, modified }">
        <Input
          :id="id"
          v-model="editForm.note"
          type="text"
          placeholder="Notiz"
          :modified="modified"
        />
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
  gap: var(--space-lg);
  padding: 0;
}
</style>

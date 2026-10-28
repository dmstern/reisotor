<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TodoPriority, User, Period } from '../api/types';
import type { TodoFormInput } from '../composables/useTodoList';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useToast } from '../composables/useToast';
import { PERIOD_META } from '../utils/period';
import { ACTION_ICONS } from '../utils/actionIcons';
import { TODO_PRIORITY_META as PRIORITY_META } from '../composables/useTodoGrouping';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import Accordion from './primitives/Accordion.vue';
import AppIcon from './AppIcon.vue';
import DraftStatusBar from './DraftStatusBar.vue';

const props = defineProps<{
  users: User[];
  lastAssignee: string;
}>();

const emit = defineEmits<{
  (e: 'submit', form: TodoFormInput): void;
  (e: 'update:lastAssignee', value: string): void;
}>();

const { showToast } = useToast();

const emptyForm = () => ({
  title: '',
  assigned_to_user_id:
    props.lastAssignee && props.users.some((u) => String(u.id) === props.lastAssignee)
      ? props.lastAssignee
      : '',
  due_date: '',
  period: '' as Period | '',
  priority: 'medium' as TodoPriority,
  note: '',
});

const newForm = ref(emptyForm());
const showNewDetails = usePersistedRef('reisotor-todo-show-details', false);

const newDraft = useDraftAutosave('todos:new', newForm, ref(true));

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
  () => newDraft.restored.value,
  (restored) => {
    if (restored && (newForm.value.due_date || newForm.value.note)) {
      showNewDetails.value = true;
    }
  }
);

function handleSubmit() {
  if (!newForm.value.title.trim()) return;
  emit('submit', { ...newForm.value });
  if (newForm.value.assigned_to_user_id !== props.lastAssignee) {
    emit('update:lastAssignee', newForm.value.assigned_to_user_id);
  }
  newForm.value = emptyForm();
  newDraft.clear();
}

function discardDraft() {
  newForm.value = emptyForm();
  showNewDetails.value = false;
  newDraft.clear();
  showToast({ message: 'Entwurf verworfen.', type: 'info' });
}
</script>

<template>
  <form class="add-form card" @submit.prevent="handleSubmit">
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
      mode="create"
      @discard="discardDraft"
    />
  </form>
</template>

<style scoped>
.add-form {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
}

.quick-input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.main-input-wrap {
  flex: 1 1 240px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.quick-input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

@container app-main (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

@container app-main (max-width: 480px) {
  .quick-input-actions {
    width: 100%;
    margin-left: 0;
  }

  .details-toggle-btn {
    width: 100%;
    justify-content: center;
  }
}

.details-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: var(--input-height, 44px);
  padding: 0 var(--space-3);
  color: var(--color-text-muted);
}

.details-toggle-btn:hover {
  color: var(--color-text);
}

.form-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  padding-top: var(--space-3);
  margin-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
}
</style>

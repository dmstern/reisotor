<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PackingItem, User } from '../api/types';
import type { PackingEditFormInput } from '../composables/usePackingList';
import { useAuthStore } from '../stores/auth';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { useToast } from '../composables/useToast';
import { ACTION_ICONS } from '../utils/actionIcons';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Combobox from './Combobox.vue';
import Button from './primitives/Button.vue';
import DraftStatusBar from './DraftStatusBar.vue';

const props = defineProps<{
  item: PackingItem | null;
  users: User[];
  categories: string[];
  subcategories: string[];
  categoryRequired: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (
    e: 'submit',
    id: number,
    form: PackingEditFormInput,
    laidOutCount: number,
    packedCount: number
  ): void;
  (e: 'delete', id: number): void;
}>();

const auth = useAuthStore();
const { showToast } = useToast();

const editForm = ref<PackingEditFormInput>({
  label: '',
  category: '',
  subcategory: '',
  quantity: 1,
  ownerId: 'shared',
});

const editDraft = useDraftAutosave(
  () => `packing:edit:${props.item?.id}`,
  editForm,
  computed(() => props.item !== null)
);

watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      editForm.value = {
        label: newItem.label,
        category: newItem.category ?? (props.categoryRequired ? 'Sonstiges' : ''),
        subcategory: newItem.subcategory ?? '',
        quantity: newItem.quantity,
        ownerId: newItem.owner_id == null ? 'shared' : String(newItem.owner_id),
      };
    }
  },
  { immediate: true }
);

function handleSubmit() {
  if (!editForm.value.label.trim()) return;
  if (props.categoryRequired && !editForm.value.category?.trim()) return;
  if (!props.item) return;

  emit(
    'submit',
    props.item.id,
    { ...editForm.value },
    props.item.laid_out_count,
    props.item.packed_count
  );
  editDraft.clear();
  emit('close');
}

function handleClose() {
  editDraft.clear();
  emit('close');
}

function discardDraft() {
  if (!props.item) return;
  editForm.value = {
    label: props.item.label,
    category: props.item.category ?? (props.categoryRequired ? 'Sonstiges' : ''),
    subcategory: props.item.subcategory ?? '',
    quantity: props.item.quantity,
    ownerId: props.item.owner_id == null ? 'shared' : String(props.item.owner_id),
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
    title="Gegenstand bearbeiten"
    full-height
    :confirm-close="editDraft.isDirty.value"
    confirm-close-entity="Gegenstand"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form" @submit.prevent="handleSubmit">
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
        <Button type="submit">Speichern</Button>
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
  flex-wrap: wrap;
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

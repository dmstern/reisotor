<script setup lang="ts">
import { ref, watch } from 'vue';
import type { PackingItem, User } from '../api/types';
import type { PackingEditFormInput } from '../composables/usePackingList';
import { useAuthStore } from '../stores/auth';
import { ACTION_ICONS } from '../utils/actionIcons';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Combobox from './Combobox.vue';
import Button from './primitives/Button.vue';

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

const editForm = ref<PackingEditFormInput>({
  label: '',
  category: '',
  subcategory: '',
  quantity: 1,
  ownerId: 'shared',
});

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
  emit('close');
}

function handleDelete() {
  if (!props.item) return;
  const id = props.item.id;
  emit('close');
  emit('delete', id);
}
</script>

<template>
  <Modal
    :model-value="item !== null"
    title="Gegenstand bearbeiten"
    full-height
    @update:model-value="(v) => !v && emit('close')"
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
        <Button type="button" variant="secondary" class="btn-cancel" @click="emit('close')">
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

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Period, ShoppingItem } from '../api/types';
import type { ShoppingFormInput } from '../composables/useShoppingList';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { useToast } from '../composables/useToast';
import { PERIOD_META } from '../utils/period';
import { ACTION_ICONS } from '../utils/actionIcons';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Combobox from './Combobox.vue';
import Button from './primitives/Button.vue';
import DraftStatusBar from './DraftStatusBar.vue';

const props = defineProps<{
  item: ShoppingItem | null;
  knownShops: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', id: number, form: ShoppingFormInput, checked: boolean): void;
  (e: 'delete', id: number): void;
}>();

const { showToast } = useToast();

const editForm = ref({
  label: '',
  link: '',
  note: '',
  shop: '',
  period: '' as Period | '',
});

const editLabelTouched = ref(false);

const editDraft = useDraftAutosave(
  () => `shopping:edit:${props.item?.id}`,
  editForm,
  computed(() => props.item !== null)
);

watch(
  () => props.item,
  (newItem) => {
    editLabelTouched.value = false;
    if (newItem) {
      editForm.value = {
        label: newItem.label,
        link: newItem.link ?? '',
        note: newItem.note ?? '',
        shop: newItem.shop ?? '',
        period: (newItem.period as Period | '') ?? '',
      };
    }
  },
  { immediate: true }
);

function handleSubmit() {
  if (!editForm.value.label.trim()) {
    editLabelTouched.value = true;
    return;
  }
  if (!props.item) return;
  emit(
    'submit',
    props.item.id,
    {
      label: editForm.value.label.trim(),
      assigned_to_user_id: props.item.assigned_to_user_id,
      link: editForm.value.link || undefined,
      note: editForm.value.note || undefined,
      shop: editForm.value.shop || undefined,
      period: editForm.value.period || undefined,
    },
    !!props.item.checked
  );
  editDraft.clear();
  emit('close');
}

function handleClose() {
  editLabelTouched.value = false;
  editDraft.clear();
  emit('close');
}

function discardDraft() {
  if (!props.item) return;
  editForm.value = {
    label: props.item.label,
    link: props.item.link ?? '',
    note: props.item.note ?? '',
    shop: props.item.shop ?? '',
    period: (props.item.period as Period | '') ?? '',
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
    title="Artikel bearbeiten"
    full-height
    :confirm-close="editDraft.isDirty.value"
    confirm-close-entity="Eintrag"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form class="edit-form" @submit.prevent="handleSubmit">
      <FormField
        icon="title"
        label="Artikel"
        required
        :invalid="editLabelTouched && !editForm.label.trim()"
        :error="
          editLabelTouched && !editForm.label.trim()
            ? 'Dieses Feld muss noch ausgefüllt werden.'
            : undefined
        "
        v-slot="{ id, invalid }"
      >
        <Input
          :id="id"
          v-model="editForm.label"
          type="text"
          placeholder="Artikel"
          required
          :invalid="invalid"
          @blur="editLabelTouched = true"
        />
      </FormField>

      <FormField icon="shop" label="Shop" v-slot="{ id }">
        <Combobox :id="id" v-model="editForm.shop" :options="knownShops" placeholder="Shop/Laden" />
      </FormField>

      <FormField icon="period" label="Zeitraum" v-slot="{ id }">
        <Select :id="id" v-model="editForm.period">
          <option value="">Kein Zeitraum</option>
          <option value="before">{{ PERIOD_META.before }}</option>
          <option value="during">{{ PERIOD_META.during }}</option>
        </Select>
      </FormField>

      <FormField icon="link" label="Link" v-slot="{ id }">
        <Input :id="id" v-model="editForm.link" type="url" placeholder="Link" />
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
        <Button type="submit" variant="primary" :disabled="!editForm.label.trim()">
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

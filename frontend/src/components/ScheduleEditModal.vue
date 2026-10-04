<script setup lang="ts">
import type { ScheduleItem } from '../api/types';
import type { useScheduleItemForm } from '../composables/useScheduleItemForm';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import RichTextEditor from './RichTextEditor.vue';
import FileAttachments from './FileAttachments.vue';
import DraftStatusBar from './DraftStatusBar.vue';
import Button from './primitives/Button.vue';
import ScheduleLocationFields from './ScheduleLocationFields.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
  item: ScheduleItem | null;
  form: ReturnType<typeof useScheduleItemForm>;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const {
  editForm,
  showEditTitleError,
  editTitleTouched,
  showEditLocationSection,
  isItemUploadingAttachments,
  editDraft,
  canSaveEditScheduleItem,
  editScheduleItemTooltip,
  submitEdit,
  closeEditForm,
  discardEditDraft,
  deleteEditingItem,
} = props.form;
</script>

<template>
  <Modal
    :model-value="item !== null"
    title="Termin bearbeiten"
    full-height
    :confirm-close="editDraft.isDirty.value"
    confirm-close-title="Ungespeicherte Änderungen verwerfen?"
    confirm-close-message="Du hast ungespeicherte Änderungen an diesem Termin vorgenommen. Möchtest du sie verwerfen oder weiter bearbeiten?"
    confirm-close-confirm-label="Änderungen verwerfen"
    @update:model-value="(v) => !v && emit('close')"
  >
    <form class="edit-form" @submit.prevent="submitEdit">
      <FormField
        icon="title"
        label="Titel"
        required
        :invalid="showEditTitleError"
        :error="showEditTitleError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
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

      <div class="row">
        <FormField icon="date" label="Startdatum" required v-slot="{ id }">
          <Input :id="id" :model-value="item?.date" type="date" disabled readonly />
        </FormField>
        <FormField icon="time" label="Startzeit" v-slot="{ id }">
          <Input :id="id" v-model="editForm.time" type="time" />
        </FormField>
      </div>

      <div class="row">
        <FormField icon="date" label="Enddatum" v-slot="{ id }">
          <Input :id="id" v-model="editForm.endDate" type="date" :min="item?.date" />
        </FormField>
        <FormField icon="time" label="Enduhrzeit" v-slot="{ id }">
          <Input :id="id" v-model="editForm.endTime" type="time" />
        </FormField>
      </div>

      <ScheduleLocationFields
        v-model:link-key="editForm.linkKey"
        v-model:location="editForm.location"
        v-model:maps-link="editForm.mapsLink"
        v-model:expanded="showEditLocationSection"
      />

      <FormField icon="note" label="Notiz">
        <RichTextEditor v-model="editForm.note" placeholder="Notiz" compact expandable />
      </FormField>

      <FileAttachments
        v-if="item"
        domain="schedule"
        :entity-id="item.id"
        v-model:uploading="isItemUploadingAttachments"
      />

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
          :disabled="isItemUploadingAttachments"
          @click="deleteEditingItem"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="closeEditForm">
          Abbrechen
        </Button>
        <Button type="submit" :disabled="!canSaveEditScheduleItem" :title="editScheduleItemTooltip">
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
  gap: var(--space-2);
}

.edit-form .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form .row > * {
  flex: 1;
  min-width: 140px;
}

.edit-form button[type='submit'] {
  flex: 1 1 100%;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.spacer {
  flex: 1;
}
</style>

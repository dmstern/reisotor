<script setup lang="ts">
import type { useScheduleItemForm } from '../composables/useScheduleItemForm';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import RichTextEditor from './RichTextEditor.vue';
import DraftStatusBar from './DraftStatusBar.vue';
import Button from './primitives/Button.vue';
import ScheduleLocationFields from './ScheduleLocationFields.vue';

const props = defineProps<{
  modelValue: boolean;
  form: ReturnType<typeof useScheduleItemForm>;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const {
  newTitle,
  newStartDate,
  newTime,
  newEndDate,
  newEndTime,
  newLinkKey,
  newLocation,
  newMapsLink,
  newNote,
  showAddLocationSection,
  showNewTitleError,
  showNewStartDateError,
  canAddScheduleItem,
  addScheduleItemTooltip,
  newTitleTouched,
  newStartDateTouched,
  newDraft,
  addItem,
  closeAddForm,
  discardNewDraft,
} = props.form;
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Termin anlegen"
    full-height
    :confirm-close="newDraft.isDirty.value"
    confirm-close-title="Entwurf verwerfen?"
    confirm-close-message="Du hast bereits Eingaben für diesen Termin gemacht. Möchtest du den Entwurf verwerfen?"
    confirm-close-confirm-label="Entwurf verwerfen"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <form class="edit-form" @submit.prevent="addItem">
      <FormField
        icon="title"
        label="Titel"
        required
        :invalid="showNewTitleError"
        :error="showNewTitleError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
        v-slot="{ id, invalid }"
      >
        <Input
          :id="id"
          v-model="newTitle"
          type="text"
          placeholder="Titel"
          required
          :invalid="invalid"
          @blur="newTitleTouched = true"
        />
      </FormField>

      <div class="row">
        <FormField
          icon="date"
          label="Startdatum"
          required
          :invalid="showNewStartDateError"
          :error="showNewStartDateError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
          v-slot="{ id, invalid }"
        >
          <Input
            :id="id"
            v-model="newStartDate"
            type="date"
            required
            :invalid="invalid"
            @blur="newStartDateTouched = true"
          />
        </FormField>
        <FormField icon="time" label="Startzeit" v-slot="{ id }">
          <Input :id="id" v-model="newTime" type="time" />
        </FormField>
      </div>

      <div class="row">
        <FormField icon="date" label="Enddatum" v-slot="{ id }">
          <Input :id="id" v-model="newEndDate" type="date" :min="newStartDate || undefined" />
        </FormField>
        <FormField icon="time" label="Enduhrzeit" v-slot="{ id }">
          <Input :id="id" v-model="newEndTime" type="time" />
        </FormField>
      </div>

      <ScheduleLocationFields
        v-model:link-key="newLinkKey"
        v-model:location="newLocation"
        v-model:maps-link="newMapsLink"
        v-model:expanded="showAddLocationSection"
      />

      <FormField icon="note" label="Notiz">
        <RichTextEditor v-model="newNote" placeholder="Notiz" compact expandable />
      </FormField>

      <DraftStatusBar
        :status="newDraft.status.value"
        :restored="newDraft.restored.value"
        :can-discard="true"
        mode="create"
        @discard="discardNewDraft"
      />

      <div class="actions-row">
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="closeAddForm">
          Abbrechen
        </Button>
        <Button type="submit" :disabled="!canAddScheduleItem" :title="addScheduleItemTooltip">
          Hinzufügen
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

.actions-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.actions-row button[type='submit'] {
  flex: 1 1 auto;
}

@media (max-width: 480px) {
  .actions-row button[type='submit'] {
    flex: 1 1 100%;
  }
}

.spacer {
  flex: 1;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import type { ScheduleItem } from '../api/types';
import { linkKeyFor, type useScheduleItemForm } from '../composables/useScheduleItemForm';
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

const isTitleModified = computed(
  () => props.item !== null && editForm.value.title !== props.item.title
);
const isTimeModified = computed(
  () => props.item !== null && editForm.value.time !== (props.item.time ?? '')
);
const isEndDateModified = computed(
  () => props.item !== null && editForm.value.endDate !== (props.item.end_date ?? '')
);
const isEndTimeModified = computed(
  () => props.item !== null && editForm.value.endTime !== (props.item.end_time ?? '')
);
const isLinkKeyModified = computed(
  () => props.item !== null && editForm.value.linkKey !== linkKeyFor(props.item)
);
const isLocationModified = computed(
  () => props.item !== null && editForm.value.location !== (props.item.location ?? '')
);
const isMapsLinkModified = computed(
  () => props.item !== null && editForm.value.mapsLink !== (props.item.maps_link ?? '')
);
const isNoteModified = computed(
  () => props.item !== null && editForm.value.note !== (props.item.note ?? '')
);
</script>

<template>
  <Modal
    :model-value="item !== null"
    title="Termin bearbeiten"
    full-height
    :confirm-close="editDraft.isDirty.value"
    confirm-close-entity="Termin"
    @update:model-value="(v) => !v && emit('close')"
  >
    <form class="edit-form" @submit.prevent="submitEdit">
      <FormField
        icon="title"
        label="Titel"
        required
        :invalid="showEditTitleError"
        :modified="isTitleModified"
        :error="showEditTitleError ? 'Dieses Feld muss noch ausgefüllt werden.' : undefined"
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

      <div class="row">
        <FormField icon="date" label="Startdatum" required v-slot="{ id }">
          <Input :id="id" :model-value="item?.date" type="date" disabled readonly />
        </FormField>
        <FormField
          icon="time"
          label="Startzeit"
          :modified="isTimeModified"
          v-slot="{ id, modified }"
        >
          <Input :id="id" v-model="editForm.time" type="time" :modified="modified" />
        </FormField>
      </div>

      <div class="row">
        <FormField
          icon="date"
          label="Enddatum"
          :modified="isEndDateModified"
          v-slot="{ id, modified }"
        >
          <Input
            :id="id"
            v-model="editForm.endDate"
            type="date"
            :min="item?.date"
            :modified="modified"
          />
        </FormField>
        <FormField
          icon="time"
          label="Enduhrzeit"
          :modified="isEndTimeModified"
          v-slot="{ id, modified }"
        >
          <Input :id="id" v-model="editForm.endTime" type="time" :modified="modified" />
        </FormField>
      </div>

      <ScheduleLocationFields
        v-model:link-key="editForm.linkKey"
        v-model:location="editForm.location"
        v-model:maps-link="editForm.mapsLink"
        v-model:expanded="showEditLocationSection"
        :modified-fields="{
          linkKey: isLinkKeyModified,
          location: isLocationModified,
          mapsLink: isMapsLinkModified,
        }"
      />

      <FormField icon="note" label="Notiz" :modified="isNoteModified" v-slot="{ modified }">
        <RichTextEditor
          v-model="editForm.note"
          placeholder="Notiz"
          compact
          expandable
          :modified="modified"
        />
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

<style scoped lang="scss">
.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.edit-form .row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.edit-form .row > * {
  flex: 1 1 140px;
  min-width: 0;
}

@include media-down('mobile') {
  .edit-form .row {
    flex-direction: column;
  }

  .edit-form .row > * {
    flex: 1 1 auto;
    width: 100%;
  }
}

.actions-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.spacer {
  flex: 1;
}
</style>

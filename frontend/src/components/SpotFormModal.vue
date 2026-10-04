<script setup lang="ts">
import { toRef, watch } from 'vue';
import type { ScheduleItem, Spot, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import ButtonGroup from './primitives/ButtonGroup.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import LocationPicker from './LocationPicker.vue';
import CoverImagePicker from './CoverImagePicker.vue';
import RichTextEditor from './RichTextEditor.vue';
import TourAssignPicker from './TourAssignPicker.vue';
import FileAttachments from './FileAttachments.vue';
import DraftStatusBar from './DraftStatusBar.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import InfoPopover from './primitives/InfoPopover.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { formatDate } from '../utils/dateFormat';
import { spotCategoryMeta } from '../utils/spotCategory';
import { useSpotForm, SPOT_SIDE_OPTIONS } from '../composables/useSpotForm';

const props = defineProps<{
  show: boolean;
  spot?: Spot | null;
  tripId: number;
  users: User[];
  spotScheduledDates: Map<number, string>;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:spot', value: Spot | null): void;
  (e: 'openScheduleDetail', item: unknown): void;
}>();

const usersRef = toRef(props, 'users');
const spotScheduledDatesRef = toRef(props, 'spotScheduledDates');

const spotFormComposable = useSpotForm({
  tripId: props.tripId,
  users: usersRef,
  spotScheduledDates: spotScheduledDatesRef,
});

const {
  showSpotForm,
  spotForm,
  newSpotDraft,
  openSpotForm,
  closeSpotForm,
  discardNewSpotDraft,
  addSpot,
  editingSpot,
  editSpotDraft,
  startEditSpot,
  closeEditSpotForm,
  discardEditSpotDraft,
  submitEditSpot,
  deleteEditingSpot,
  activeSpotForm,
  spotTitleTouched,
  showSpotTitleError,
  canSaveSpot,
  spotSaveTooltip,
  isSpotModalDirty,
  spotManualPin,
  spotLocationError,
  editSpotLocationError,
  isSpotUploadingAttachments,
  isSpotUploadingCoverImage,
  spotPreviewImages,
  spotPreviewImage,
  editSpotPreviewImage,
  spotImageSearchContext,
  resetEditSpotImage,
  spotReferencePoints,
  editSpotReferencePoints,
  spotPickerCenter,
  showSpotScheduleSection,
  editSpotScheduledItems,
  toggleScheduledItemDone,
  removeScheduledItemFromSpot,
  openScheduledItemDetail,
  addSchedulePopoverOpen,
  addScheduleDateVal,
  addScheduleBtnRef,
  addScheduleMenuStyle,
  toggleAddSchedulePopover,
  submitAddSpotToDate,
  allTourTitles,
  removeTourTitle,
  getTourDate,
  isTourTravel,
  onSpotMapsLinkUpdate,
  onSpotLocationSelect,
  spotLocationPickerRef,
  onSpotLocationClear,
  resetEditSpotLocation,
  isEditSpotLocationModified,
  isEditSpotSideModified,
  isEditSpotImageModified,
  isEditSpotNoteModified,
  isEditSpotStartDateModified,
  isEditSpotEndDateModified,
  isEditSpotCheckinModified,
  isEditSpotCheckoutModified,
  isEditSpotContactModified,
  isEditSpotAmountModified,
  isEditSpotPaidByModified,
} = spotFormComposable;

watch(
  () => [props.show, props.spot],
  ([show, spot]) => {
    if (show) {
      if (spot) {
        startEditSpot(spot as Spot);
      } else {
        openSpotForm();
      }
    }
  },
  { immediate: true }
);

function handleClose() {
  if (editingSpot.value !== null) {
    closeEditSpotForm();
  } else {
    closeSpotForm();
  }
  emit('update:show', false);
  emit('update:spot', null);
}

async function handleAddSpot() {
  await addSpot();
  if (!showSpotForm.value) {
    emit('update:show', false);
    emit('update:spot', null);
  }
}

async function handleSubmitEditSpot() {
  await submitEditSpot();
  if (editingSpot.value === null) {
    emit('update:show', false);
    emit('update:spot', null);
  }
}

async function handleDeleteSpot() {
  await deleteEditingSpot();
  if (editingSpot.value === null) {
    emit('update:show', false);
    emit('update:spot', null);
  }
}

function handleOpenScheduledItem(item: ScheduleItem) {
  openScheduledItemDetail(item);
  emit('openScheduleDetail', item);
}
</script>

<template>
  <Modal
    :model-value="show || editingSpot !== null"
    :title="editingSpot !== null ? 'Spot bearbeiten' : 'Neuer Spot'"
    full-height
    :confirm-close="isSpotModalDirty"
    :confirm-close-mode="editingSpot !== null ? 'unsaved' : 'draft'"
    confirm-close-entity="Spot"
    @update:model-value="(v) => !v && handleClose()"
  >
    <form
      class="edit-form"
      @submit.prevent="editingSpot !== null ? handleSubmitEditSpot() : handleAddSpot()"
    >
      <!-- 1. Standort-Bereich (Vollflächige Minikarte mit schwebender Suche & Polaroid-Card) -->
      <div class="spot-location-section">
        <LocationPicker
          ref="spotLocationPickerRef"
          v-model="spotManualPin"
          v-model:title="activeSpotForm.title"
          v-model:category="activeSpotForm.category"
          :address="activeSpotForm.address"
          :maps-link="activeSpotForm.maps_link"
          :proximity-bias="spotPickerCenter"
          :center="spotPickerCenter"
          :reference-points="editingSpot !== null ? editSpotReferencePoints : spotReferencePoints"
          :title-required="true"
          :title-invalid="showSpotTitleError"
          :modified="isEditSpotLocationModified"
          @update:address="activeSpotForm.address = $event"
          @update:maps-link="onSpotMapsLinkUpdate"
          @select="onSpotLocationSelect"
          @clear="onSpotLocationClear"
          @reset="resetEditSpotLocation"
          @blur="spotTitleTouched = true"
        >
          <template #media>
            <CoverImagePicker
              v-model="activeSpotForm.image_url"
              v-model:uploading="isSpotUploadingCoverImage"
              variant="polaroid"
              :preview-image="editingSpot !== null ? editSpotPreviewImage : spotPreviewImage"
              :placeholder-icon="spotCategoryMeta(activeSpotForm.category).tabler"
              icon-group="categories"
              modal-title="Spot-Bild bearbeiten"
              :modified="isEditSpotImageModified"
              :initial-value="editingSpot !== null ? (editingSpot.image_url ?? '') : ''"
              :search-context="spotImageSearchContext"
              :initial-suggestions="spotPreviewImages"
              @reset="resetEditSpotImage"
            />
          </template>
        </LocationPicker>
        <p v-if="showSpotTitleError" class="hint error">
          <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
          Bitte gib einen Titel für den Spot ein.
        </p>
        <p
          v-if="editingSpot !== null ? editSpotLocationError : spotLocationError"
          class="hint error"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" /> Der Standort konnte
          auch automatisch nicht ermittelt werden. Bitte tippe auf die Karte, um ihn manuell zu
          setzen.
        </p>
      </div>

      <div
        class="spot-side-field"
        :class="{ 'is-modified': isEditSpotSideModified }"
        role="group"
        aria-label="Bereich des Standorts"
      >
        <div class="spot-side-header">
          <span class="spot-side-label">
            <span>Bereich</span>
            <span
              v-if="isEditSpotSideModified"
              class="modified-dot"
              title="Geändert"
              aria-label="Geändert"
            />
          </span>
          <InfoPopover
            title="Was bedeutet Bereich?"
            aria-label="Erklärung zum Standort-Bereich"
            :menu-width="280"
          >
            <p>
              <strong>Urlaubsort:</strong> z. B. Ausflugsziele, Restaurants oder Unterkünfte am
              Reiseziel.
            </p>
            <p>
              <strong>Heimat-Seite:</strong> z. B. der heimische Flughafen/Bahnhof/Zuhause für
              Reise-Etappen.
            </p>
            <p class="popover-tip">
              🗺️ Wird für das Auswählen des passenden Kartenausschnitts verwendet.
            </p>
          </InfoPopover>
        </div>
        <SegmentedToggle
          id="spotFormSideToggle"
          class="spot-side-toggle"
          :model-value="activeSpotForm.is_home ? 'home' : 'vacation'"
          :options="SPOT_SIDE_OPTIONS"
          @update:model-value="(val) => (activeSpotForm.is_home = val === 'home')"
        />
      </div>

      <template v-if="activeSpotForm.category === 'Unterkunft'">
        <div class="row">
          <FormField
            icon="date"
            label="Check-in-Datum"
            :modified="isEditSpotStartDateModified"
            v-slot="{ modified }"
          >
            <Input v-model="activeSpotForm.start_date" type="date" :modified="modified" />
          </FormField>
          <FormField
            icon="date"
            label="Check-out-Datum"
            :modified="isEditSpotEndDateModified"
            v-slot="{ modified }"
          >
            <Input v-model="activeSpotForm.end_date" type="date" :modified="modified" />
          </FormField>
        </div>
        <div class="row">
          <FormField
            icon="time"
            label="Check-in-Zeit"
            :modified="isEditSpotCheckinModified"
            v-slot="{ modified }"
          >
            <Input
              v-model="activeSpotForm.checkin"
              type="text"
              placeholder="Check-in (z. B. 15:00)"
              :modified="modified"
            />
          </FormField>
          <FormField
            icon="time"
            label="Check-out-Zeit"
            :modified="isEditSpotCheckoutModified"
            v-slot="{ modified }"
          >
            <Input
              v-model="activeSpotForm.checkout"
              type="text"
              placeholder="Check-out (z. B. 11:00)"
              :modified="modified"
            />
          </FormField>
        </div>
        <FormField
          icon="contact"
          label="Kontakt"
          :modified="isEditSpotContactModified"
          v-slot="{ modified }"
        >
          <Input
            v-model="activeSpotForm.contact"
            type="text"
            placeholder="Kontakt (Telefon/E-Mail/Text)"
            :modified="modified"
          />
        </FormField>
        <div class="row">
          <FormField
            icon="amount"
            label="Kosten"
            :modified="isEditSpotAmountModified"
            v-slot="{ modified }"
          >
            <Input
              v-model="activeSpotForm.amount"
              type="number"
              step="0.01"
              placeholder="Kosten (€)"
              :modified="modified"
            />
          </FormField>
          <FormField
            v-if="users.length > 1"
            icon="shared"
            label="Bezahlt von"
            :modified="isEditSpotPaidByModified"
            v-slot="{ modified }"
          >
            <Select v-model="activeSpotForm.paid_by_user_id" :modified="modified">
              <option value="">Bezahlt von –</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">
                {{ u.avatar }} {{ u.username }}
              </option>
            </Select>
          </FormField>
        </div>
      </template>

      <FormField icon="note" label="Notiz" :modified="isEditSpotNoteModified">
        <RichTextEditor v-model="activeSpotForm.note" placeholder="Notiz" compact expandable />
      </FormField>

      <!-- Kombiniertes "Einplanen"-Fieldset: Touren zuordnen + Datum einplanen in einem Bereich -->
      <CollapsibleFieldset
        v-model="showSpotScheduleSection"
        label="Einplanen"
        :icon="FORM_FIELD_ICONS.date"
        icon-group="formFields"
      >
        <template #count>
          <span
            v-if="activeSpotForm.tourTitles.length || editSpotScheduledItems.length"
            class="picker-count"
          >
            ({{
              [
                activeSpotForm.tourTitles.length
                  ? `${activeSpotForm.tourTitles.length} ${activeSpotForm.tourTitles.length === 1 ? 'Tour' : 'Touren'}`
                  : '',
                editSpotScheduledItems.length && editingSpot !== null
                  ? `${editSpotScheduledItems.length} ${editSpotScheduledItems.length === 1 ? 'Termin' : 'Termine'}`
                  : '',
              ]
                .filter(Boolean)
                .join(', ')
            }})
          </span>
        </template>
        <p class="schedule-hint">
          <AppIcon :icon="ACTION_ICONS.info" :size="12" group="actions" />
          Ordne den Spot einer Tour zu oder plane ihn direkt für ein Datum ein (ohne Tour).
        </p>

        <!-- Oben: Datum-Hinzufügen-Button (nur im Edit-Modus) & Tour-zuordnen-Combobox -->
        <div class="schedule-controls">
          <div v-if="editingSpot !== null" class="schedule-actions-row">
            <button
              ref="addScheduleBtnRef"
              type="button"
              class="add-schedule-btn"
              title="Zu einem Datum einplanen"
              @click="toggleAddSchedulePopover($event)"
            >
              <AppIcon :icon="ACTION_ICONS.add" :size="13" group="actions" />
              <span>Datum hinzufügen</span>
            </button>
            <Teleport to="body">
              <template v-if="addSchedulePopoverOpen">
                <PickerMenu
                  class="add-schedule-popover"
                  :style="addScheduleMenuStyle"
                  @close="addSchedulePopoverOpen = false"
                >
                  <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                  <label
                    style="
                      display: block;
                      font-size: 0.85rem;
                      font-weight: 500;
                      margin-bottom: var(--space-2);
                    "
                  >
                    <span>Datum auswählen:</span>
                    <Input
                      type="date"
                      v-model="addScheduleDateVal"
                      class="field-input"
                      style="width: 100%; margin-top: var(--space-2); margin-bottom: var(--space-3)"
                      @keyup.enter="submitAddSpotToDate"
                    />
                  </label>
                  <ButtonGroup align="end" no-margin>
                    <Button
                      type="button"
                      variant="secondary"
                      small
                      @click="addSchedulePopoverOpen = false"
                    >
                      Abbrechen
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      small
                      :disabled="!addScheduleDateVal"
                      @click="submitAddSpotToDate"
                    >
                      Hinzufügen
                    </Button>
                  </ButtonGroup>
                </PickerMenu>
              </template>
            </Teleport>
          </div>
          <div v-else class="new-spot-schedule-row">
            <FormField icon="date" label="Direkt für Datum einplanen">
              <Input type="date" v-model="spotForm.scheduledDate" placeholder="Datum auswählen" />
            </FormField>
          </div>

          <!-- Tour zuordnen (Combobox, in beiden Modi: Neu + Edit) -->
          <TourAssignPicker
            v-model="activeSpotForm.tourTitles"
            :tour-options="allTourTitles"
            :category="activeSpotForm.category"
            :is-home="activeSpotForm.is_home"
            :hide-chips="true"
            :hide-hint="true"
          />
        </div>

        <!-- Danach: Gemeinsame Chips für ausgewählte Touren (orange) & Termine (grau) -->
        <div
          v-if="
            activeSpotForm.tourTitles.length ||
            (editingSpot !== null && editSpotScheduledItems.length)
          "
          class="assign-chips"
        >
          <!-- Tour-Chips (orange) & Reise-Chips (grün) -->
          <span
            v-for="title in activeSpotForm.tourTitles"
            :key="'tour-' + title"
            class="assign-chip tour-chip"
            :class="isTourTravel(title) ? 'assign-chip--travel' : 'assign-chip--tour'"
          >
            <span class="assign-chip-action">
              <AppIcon
                :icon="
                  isTourTravel(title) ? SECTION_ICON_DEFS.travel : SECTION_ICON_DEFS.excursions
                "
                :size="12"
                group="navigation"
              />
              <span class="assign-chip-label">
                {{ title
                }}<template v-if="getTourDate(title)">
                  &nbsp;·&nbsp;{{ formatDate(getTourDate(title)!) }}</template
                >
              </span>
            </span>
            <button
              type="button"
              class="assign-chip-remove"
              :aria-label="`Von '${title}' entfernen`"
              title="Entfernen"
              @click="removeTourTitle(title)"
            >
              <AppIcon :icon="ACTION_ICONS.close" :size="11" group="actions" />
            </button>
          </span>

          <!-- Termin-Chips: grau (--color-calendar-appointment), nur im Edit-Modus -->
          <template v-if="editingSpot !== null">
            <span
              v-for="item in editSpotScheduledItems"
              :key="'sched-' + item.id"
              class="assign-chip assign-chip--schedule"
              :class="{ 'is-done': !!item.done }"
            >
              <button
                type="button"
                class="assign-chip-done-toggle"
                :title="item.done ? 'Als nicht besucht markieren' : 'Als besucht markieren'"
                :aria-label="item.done ? 'Als nicht besucht markieren' : 'Als besucht markieren'"
                @click.stop="toggleScheduledItemDone(item)"
              >
                <AppIcon
                  :icon="item.done ? ACTION_ICONS.done : ACTION_ICONS.notDone"
                  :size="13"
                  group="actions"
                />
              </button>
              <button
                type="button"
                class="assign-chip-action"
                title="Termin im Kalender öffnen"
                @click="handleOpenScheduledItem(item)"
              >
                <span class="assign-chip-label">{{ formatDate(item.date) }}</span>
              </button>
              <button
                type="button"
                class="assign-chip-remove"
                :aria-label="`Termin am ${formatDate(item.date)} entfernen`"
                title="Termin entfernen"
                @click="removeScheduledItemFromSpot(item)"
              >
                <AppIcon :icon="ACTION_ICONS.close" :size="11" group="actions" />
              </button>
            </span>
          </template>
        </div>
      </CollapsibleFieldset>

      <FileAttachments
        v-if="editingSpot"
        domain="spots"
        :entity-id="editingSpot.id"
        v-model:uploading="isSpotUploadingAttachments"
      />
      <DraftStatusBar
        :status="editingSpot !== null ? editSpotDraft.status.value : newSpotDraft.status.value"
        :restored="
          editingSpot !== null ? editSpotDraft.restored.value : newSpotDraft.restored.value
        "
        :mode="editingSpot !== null ? 'edit' : 'create'"
        :can-discard="true"
        @discard="editingSpot !== null ? discardEditSpotDraft() : discardNewSpotDraft()"
      />
      <div class="actions-row">
        <Button
          v-if="editingSpot !== null"
          type="button"
          variant="danger"
          secondary
          :icon="ACTION_ICONS.delete"
          :disabled="isSpotUploadingAttachments || isSpotUploadingCoverImage"
          @click="handleDeleteSpot"
        >
          Löschen
        </Button>
        <div class="spacer"></div>
        <Button type="button" variant="secondary" class="btn-cancel" @click="handleClose">
          Abbrechen
        </Button>
        <Button type="submit" :disabled="!canSaveSpot" :title="spotSaveTooltip">
          {{ editingSpot !== null ? 'Speichern' : 'Hinzufügen' }}
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

.spacer {
  flex: 1;
}

.spot-location-section {
  position: relative;
  z-index: var(--z-card-elevated, 5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

.spot-location-section:focus-within,
.spot-location-section:has(.open),
.spot-location-section:has(.location-dropdown) {
  z-index: var(--z-popover, 1100);
}

.spot-side-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-top: var(--space-2);
  margin-bottom: var(--space-4);
}

.spot-side-header {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.spot-side-toggle {
  width: fit-content;
  min-width: min(280px, 100%);
  max-width: 340px;
  align-self: flex-start;
}

.spot-side-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.spot-side-field.is-modified .spot-side-label {
  color: var(--color-accent-dark, var(--color-accent));
}

.schedule-hint {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.3;
}

.schedule-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.add-schedule-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 5px 12px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-size: 0.82rem;
  font-weight: 500;
  border: 1px dashed var(--color-border-strong);
  background: var(--color-hover);
  color: var(--color-text);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.add-schedule-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-calendar-appointment);
  color: var(--color-calendar-appointment);
}

.add-schedule-popover {
  width: 240px;
  padding: var(--space-3);
  z-index: 1100;
}

.assign-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.assign-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: var(--radius-pill);
  padding: 3px 6px 3px 10px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  border: 1px solid;
  line-height: 1.2;
}

.assign-chip--tour {
  background: var(--color-tour-tint);
  border-color: var(--color-tour-border);
  color: var(--color-tour);
}

.assign-chip--travel {
  background: var(--color-travel-tint);
  border-color: var(--color-travel-border);
  color: var(--color-travel);
}

.assign-chip--schedule {
  background: var(--color-calendar-appointment-tint);
  border-color: var(--color-calendar-appointment-border);
  color: var(--color-calendar-appointment);
}

.assign-chip--schedule.is-done {
  background: color-mix(in srgb, var(--color-success) 18%, transparent);
  border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
  color: var(--color-success);
}

.assign-chip-done-toggle {
  background: none;
  border: none;
  padding: 1px 2px;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  line-height: 1;
  opacity: 0.85;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease;
}

.assign-chip-done-toggle:hover {
  opacity: 1;
  transform: scale(1.15);
}

.assign-chip-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  cursor: pointer;
}

.assign-chip-action:hover {
  text-decoration: underline;
}

.assign-chip-label {
  display: inline-flex;
  align-items: center;
}

.assign-chip-remove {
  background: none;
  border: none;
  padding: 2px 3px;
  margin-left: 2px;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.assign-chip-remove:hover {
  opacity: 1;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.hint.error {
  color: var(--color-danger);
  font-size: var(--font-size-xs);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--space-1);
}

.modified-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-accent-dark, var(--color-accent));
}

@media (prefers-reduced-motion: reduce) {
  .assign-chip-done-toggle,
  .assign-chip-remove {
    transition: none;
  }
}
</style>

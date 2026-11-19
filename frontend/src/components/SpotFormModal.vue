<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import type { Spot, User } from '../api/types';
import Modal from './Modal.vue';
import FormField from './FormField.vue';
import DoneStatusField from './DoneStatusField.vue';
import Badge from './primitives/Badge.vue';
import Input from './primitives/Input.vue';
import Select from './primitives/Select.vue';
import Button from './primitives/Button.vue';
import ToggleSwitch from './primitives/ToggleSwitch.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import LocationPicker from './LocationPicker.vue';
import CoverImagePicker from './CoverImagePicker.vue';
import RichTextEditor from './RichTextEditor.vue';
import TourAssignDropdown from './TourAssignDropdown.vue';
import FileAttachments from './FileAttachments.vue';
import DraftStatusBar from './DraftStatusBar.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { formatDate } from '../utils/dateFormat';
import {
  spotCategoryMeta,
  isTransitCategory,
  isHomeCategory,
  isVacationCategory,
} from '../utils/spotCategory';
import { normalizeWebUrl } from '../utils/linkLabel';
import { useSpotForm } from '../composables/useSpotForm';

const props = defineProps<{
  show: boolean;
  spot?: Spot | null;
  defaultCategory?: string;
  defaultTourTitle?: string;
  tripId: number;
  users: User[];
  spotScheduledDates: Map<number, string>;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'update:spot', value: Spot | null): void;
  (e: 'openScheduleDetail', item: unknown): void;
  (e: 'created', spot: Spot): void;
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
  isFetchingSpotPreview,
  spotPreviewImages,
  spotPreviewImage,
  editSpotPreviewImage,
  spotImageSearchContext,
  resetEditSpotImage,
  spotReferencePoints,
  editSpotReferencePoints,
  spotPickerCenter,
  showSpotScheduleSection,
  spotDoneSummary,
  isScheduledDateDone,
  toggleScheduledDateDone,
  toggleSpotDone,
  removeScheduledDate,
  openScheduledDateInCalendar,
  addSchedulePopoverOpen,
  addScheduleDateVal,
  addScheduleBtnRef,
  addScheduleMenuStyle,
  toggleAddSchedulePopover,
  submitAddSpotToDate,
  modalTourAssignments,
  toggleTourAssignment,
  createTourAssignment,
  removeTourTitle,
  getTourDate,
  isTourTravel,
  isTourDone,
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
  isEditSpotLinkModified,
  isEditSpotDoneModified,
} = spotFormComposable;

const isAccommodation = computed(() => activeSpotForm.value.category === 'Unterkunft');

function onLinkBlur() {
  if (activeSpotForm.value.link?.trim()) {
    activeSpotForm.value.link = normalizeWebUrl(activeSpotForm.value.link);
  }
}

const scheduledCount = computed(() => activeSpotForm.value.scheduledDates?.length ?? 0);

const manualRegionVisible = ref(false);

const showSpotRegionSection = computed(() => {
  const cat = activeSpotForm.value.category;
  return (
    manualRegionVisible.value ||
    Boolean(editingSpot.value?.is_home) ||
    isTransitCategory(cat) ||
    isHomeCategory(cat) ||
    Boolean(activeSpotForm.value.is_home)
  );
});

function onRegionToggle(val: boolean) {
  activeSpotForm.value.is_home = !val;
}

function enableSpotRegionManual() {
  manualRegionVisible.value = true;
  activeSpotForm.value.is_home = true;
}

watch(
  () => [props.show, props.spot],
  ([show, spot]) => {
    manualRegionVisible.value = false;

    if (show) {
      if (spot) {
        startEditSpot(spot as Spot);
      } else {
        openSpotForm(props.defaultCategory, props.defaultTourTitle);
      }
    }
  },
  { immediate: true }
);

function handleClose() {
  manualRegionVisible.value = false;

  if (editingSpot.value !== null) {
    closeEditSpotForm();
  } else {
    closeSpotForm();
  }

  emit('update:show', false);
  emit('update:spot', null);
}

async function handleAddSpot() {
  const created = await addSpot();

  if (!created || showSpotForm.value) {
    return;
  }

  emit('created', created);
  emit('update:show', false);
  emit('update:spot', null);
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

function handleOpenScheduledDate(date: string) {
  openScheduledDateInCalendar(date);
  emit('openScheduleDetail', { date });
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
              :trip-id="tripId"
              :loading="isFetchingSpotPreview && !activeSpotForm.image_url.trim()"
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

      <!-- 2. Urlaubsregion-Schalter (bei Transit-Orten wie Flughafen/Bahnhof, bei Heimatort oder manuellem Aufruf) -->
      <div
        v-if="showSpotRegionSection"
        class="spot-region-field"
        :class="{ 'is-modified': isEditSpotSideModified }"
      >
        <div class="spot-region-row">
          <div class="spot-region-label-group">
            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
            <label for="spotRegionToggle" class="spot-region-label">
              <AppIcon
                :icon="activeSpotForm.is_home ? ACTION_ICONS.home : ACTION_ICONS.vacation"
                :size="16"
                group="actions"
                class="spot-region-icon"
              />
              <span>Teil der Urlaubsregion</span>
              <span
                v-if="isEditSpotSideModified"
                class="modified-dot"
                title="Geändert"
                aria-label="Geändert"
              />
            </label>
            <p id="spotRegionHint" class="spot-region-hint">
              {{
                activeSpotForm.is_home
                  ? 'Liegt an der Heimat-Seite (z. B. heimischer Abflughafen, Bahnhof oder Zuhause).'
                  : 'Liegt am Reiseziel (z. B. Unterkunft, Restaurant, Strand oder Zielflughafen).'
              }}
            </p>
          </div>
          <ToggleSwitch
            id="spotRegionToggle"
            aria-label="Teil der Urlaubsregion"
            aria-describedby="spotRegionHint"
            :model-value="!activeSpotForm.is_home"
            @update:model-value="onRegionToggle"
          />
        </div>
        <p
          v-if="activeSpotForm.is_home && isVacationCategory(activeSpotForm.category)"
          class="spot-region-warning-text"
        >
          <AppIcon :icon="ACTION_ICONS.warning" :size="13" group="actions" />
          <span>
            Orte der Kategorie „{{ activeSpotForm.category || 'Unterkunft' }}“ liegen üblicherweise
            am Reiseziel. Als Heimatort wird dieser Ort auf der Karte separat außerhalb der
            Urlaubsregion geführt.
          </span>
        </p>
      </div>
      <div v-else class="spot-region-override-row">
        <button
          type="button"
          class="spot-region-override-btn"
          title="Diesen Ort als Heimat-Seite außerhalb der Urlaubsregion festlegen"
          @click="enableSpotRegionManual"
        >
          <AppIcon :icon="ACTION_ICONS.home" :size="13" group="actions" />
          <span>Als Heimatort festlegen</span>
        </button>
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

      <FormField
        icon="link"
        :label="isAccommodation ? 'Buchungs-Link' : 'Website / Link'"
        :modified="isEditSpotLinkModified"
        v-slot="{ modified }"
      >
        <Input
          v-model="activeSpotForm.link"
          type="url"
          :placeholder="
            isAccommodation
              ? 'Buchungs-Link (z. B. Airbnb, Booking, Trivago)'
              : 'Website / Link (z. B. Tickets, Speisekarte)'
          "
          :modified="modified"
          @blur="onLinkBlur"
        />
      </FormField>

      <FormField icon="note" label="Notiz" :modified="isEditSpotNoteModified">
        <RichTextEditor v-model="activeSpotForm.note" placeholder="Notiz" compact expandable />
      </FormField>

      <DoneStatusField
        v-if="!isAccommodation"
        :done="spotDoneSummary.done"
        :partially-done="spotDoneSummary.partiallyDone"
        :planned="spotDoneSummary.planned"
        :disabled="spotDoneSummary.disabled"
        :toggle-label="spotDoneSummary.toggleLabel"
        :status-hint="spotDoneSummary.statusHint"
        :modified="isEditSpotDoneModified"
        :aria-label="spotDoneSummary.ariaLabel"
        :title="spotDoneSummary.title"
        @toggle="toggleSpotDone"
      />

      <!-- Kombiniertes "Einplanen"-Fieldset: Touren zuordnen + Datum einplanen in einem Bereich -->
      <CollapsibleFieldset
        v-model="showSpotScheduleSection"
        label="Einplanen"
        :icon="FORM_FIELD_ICONS.date"
        icon-group="formFields"
      >
        <template #count>
          <span v-if="activeSpotForm.tourTitles.length || scheduledCount" class="picker-count">
            ({{
              [
                activeSpotForm.tourTitles.length
                  ? `${activeSpotForm.tourTitles.length} ${activeSpotForm.tourTitles.length === 1 ? 'Tour' : 'Touren'}`
                  : '',
                scheduledCount
                  ? `${scheduledCount} ${scheduledCount === 1 ? 'Termin' : 'Termine'}`
                  : '',
              ]
                .filter(Boolean)
                .join(', ')
            }})
          </span>
        </template>
        <!-- Oben: Tour zuordnen (Pop-over) & Datum-Hinzufügen-Button -->
        <div class="schedule-controls">
          <div class="schedule-actions-row">
            <TourAssignDropdown
              :tours="modalTourAssignments"
              @toggle-tour="toggleTourAssignment"
              @create-tour="createTourAssignment"
            />
            <Button
              ref="addScheduleBtnRef"
              type="button"
              variant="secondary"
              size="sm"
              :active="addSchedulePopoverOpen"
              class="add-schedule-btn"
              title="Zu einem Datum einplanen"
              @click="toggleAddSchedulePopover($event)"
            >
              <AppIcon :icon="ACTION_ICONS.calendarPlus" :size="15" group="actions" />
              <span>Datum hinzufügen</span>
            </Button>
            <Teleport to="body">
              <template v-if="addSchedulePopoverOpen">
                <PickerMenu
                  class="add-schedule-popover"
                  :style="addScheduleMenuStyle"
                  @close="addSchedulePopoverOpen = false"
                >
                  <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                  <label class="add-schedule-label">
                    <span>Datum auswählen:</span>
                    <Input
                      type="date"
                      v-model="addScheduleDateVal"
                      class="field-input add-schedule-input"
                      @change="submitAddSpotToDate"
                      @keyup.enter="submitAddSpotToDate"
                    />
                  </label>
                </PickerMenu>
              </template>
            </Teleport>
          </div>
        </div>

        <!-- Danach: Gemeinsame Chips für ausgewählte Touren (orange) & Termine (grau) -->
        <div v-if="activeSpotForm.tourTitles.length || scheduledCount" class="assign-chips">
          <!-- Tour-Chips (orange) & Reise-Chips (grün) -->
          <Badge
            v-for="title in activeSpotForm.tourTitles"
            :key="'tour-' + title"
            class="assign-chip tour-chip"
            :class="[
              isTourTravel(title) ? 'assign-chip--travel' : 'assign-chip--tour',
              { 'is-done': isTourDone(title) },
            ]"
            variant="custom"
            size="md"
            closable
            close-button-class="assign-chip-remove"
            :close-aria-label="`Von '${title}' entfernen`"
            close-title="Entfernen"
            @close="removeTourTitle(title)"
          >
            <span
              class="assign-chip-action"
              :title="
                title +
                (getTourDate(title) ? ` · ${formatDate(getTourDate(title)!)}` : '') +
                (isTourDone(title) ? ' · Gemacht' : '')
              "
            >
              <AppIcon
                v-if="isTourDone(title)"
                :icon="ACTION_ICONS.done"
                :size="14"
                group="actions"
                class="assign-chip-tour-done-icon"
              />
              <AppIcon
                :icon="
                  isTourTravel(title) ? SECTION_ICON_DEFS.travel : SECTION_ICON_DEFS.excursions
                "
                :size="14"
                group="navigation"
              />
              <span class="assign-chip-label">
                {{ title
                }}<template v-if="getTourDate(title)">
                  &nbsp;·&nbsp;{{ formatDate(getTourDate(title)!) }}</template
                >
              </span>
            </span>
          </Badge>

          <!-- Termin-Chips: grau (--color-calendar-appointment), grün wenn besucht -->
          <Badge
            v-for="date in activeSpotForm.scheduledDates"
            :key="'sched-' + date"
            class="assign-chip assign-chip--schedule"
            :class="{ 'is-done': isScheduledDateDone(date) }"
            variant="custom"
            size="md"
            closable
            close-button-class="assign-chip-remove"
            :close-aria-label="`Termin am ${formatDate(date)} entfernen`"
            close-title="Termin entfernen"
            @close="removeScheduledDate(date)"
          >
            <button
              v-if="!isAccommodation"
              type="button"
              class="assign-chip-done-toggle"
              :title="
                isScheduledDateDone(date) ? 'Als nicht besucht markieren' : 'Als besucht markieren'
              "
              :aria-label="
                isScheduledDateDone(date) ? 'Als nicht besucht markieren' : 'Als besucht markieren'
              "
              @click.stop="toggleScheduledDateDone(date)"
            >
              <AppIcon
                :icon="isScheduledDateDone(date) ? ACTION_ICONS.done : ACTION_ICONS.notDone"
                :size="14"
                group="actions"
              />
            </button>
            <button
              v-if="editingSpot !== null"
              type="button"
              class="assign-chip-action"
              title="Termin im Kalender öffnen"
              @click="handleOpenScheduledDate(date)"
            >
              <span class="assign-chip-label">{{ formatDate(date) }}</span>
            </button>
            <span v-else class="assign-chip-action">
              <AppIcon
                v-if="isAccommodation"
                :icon="FORM_FIELD_ICONS.date"
                :size="14"
                group="formFields"
              />
              <span class="assign-chip-label">{{ formatDate(date) }}</span>
            </span>
          </Badge>
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

.spot-region-field {
  display: flex;
  flex-direction: column;
  margin-top: var(--space-1);
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-hover);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
}

.spot-region-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.spot-region-label-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.spot-region-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
}

.spot-region-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: normal;
  line-height: 1.35;
  color: var(--color-text-muted);
}

.spot-region-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.spot-region-field.is-modified .spot-region-label {
  color: var(--color-accent-dark, var(--color-accent));
}

.spot-region-override-row {
  display: flex;
  justify-content: flex-start;
  margin-top: var(--space-2);
  margin-bottom: var(--space-2);
}

.spot-region-override-btn {
  @include touch-target($expand: true);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: none;
  border: none;
  padding: 4px 6px;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
}

@include can-hover {
  .spot-region-override-btn:hover {
    color: var(--color-primary);
    background-color: var(--color-hover);
  }
}

.spot-region-warning-text {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: var(--color-warning-dark, #92400e);
}

.spot-region-override-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-focus-ring));
  outline-offset: var(--focus-ring-offset, 2px);
}

.schedule-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
}

.schedule-actions-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-width: 0;
  max-width: 100%;
}

.add-schedule-btn span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-schedule-popover {
  width: 220px;
  padding: var(--space-2) var(--space-3);
  z-index: calc(var(--z-popover, 1100) + 1);
}

.add-schedule-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text-muted);
}

.add-schedule-input {
  width: 100%;
}

.assign-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
  min-width: 0;
  max-width: 100%;
}

.assign-chip {
  min-height: 32px;
  max-width: 100%;
  box-sizing: border-box;
  font-size: var(--font-size-sm);
  font-weight: 500;
  border: 1.5px solid;
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

.assign-chip-tour-done-icon {
  color: var(--color-success);
  flex-shrink: 0;
}

.assign-chip-done-toggle {
  @include touch-target;
  background: none;
  border: none;
  padding: 2px;
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

@include can-hover {
  .assign-chip-done-toggle:hover {
    opacity: 1;
    transform: scale(1.15);
  }
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
  min-width: 0;
  max-width: 100%;
  flex: 1 1 auto;
}

button.assign-chip-action {
  cursor: pointer;
}

@include can-hover {
  button.assign-chip-action:hover {
    text-decoration: underline;
  }
}

.assign-chip-label {
  display: inline-block;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assign-chip-done-toggle:focus-visible,
button.assign-chip-action:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo);
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
  .assign-chip-done-toggle {
    transition: none;
  }
}
</style>

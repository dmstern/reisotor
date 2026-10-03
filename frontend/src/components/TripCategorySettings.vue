<script setup lang="ts">
import { useId, ref, watch, nextTick } from 'vue';
import { useTripCategorySettings } from '../composables/useTripCategorySettings';
import { useScrollFade } from '../composables/useScrollFade';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import Card from './primitives/Card.vue';
import Alert from './primitives/Alert.vue';
import EmptyState from './primitives/EmptyState.vue';
import IconButton from './primitives/IconButton.vue';
import ScrollFadeOverlay from './primitives/ScrollFadeOverlay.vue';
import Modal from './Modal.vue';
import SegmentedToggle from './SegmentedToggle.vue';
import CategoryIconPickerModal from './CategoryIconPickerModal.vue';
import TripCategoryRow from './TripCategoryRow.vue';
import TripCategoryFormFields from './TripCategoryFormFields.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = defineProps<{
  tripId: number;
}>();

const createNameId = useId();
const editNameId = useId();

const {
  activeType,
  SCOPE_OPTIONS,
  searchQuery,
  showCreateForm,
  editingCategory,
  categoryToDelete,
  showIconPicker,
  createForm,
  editForm,
  currentPickerIconId,
  filteredCategories,
  selectIcon,
  openIconPicker,
  startEdit,
  cancelEdit,
  saveEdit,
  handleCreate,
  confirmDeleteFromEdit,
  executeDelete,
  toggleHideStandard,
} = useTripCategorySettings(() => props.tripId);

const categoryListRef = ref<HTMLElement | null>(null);
const { canScrollUp, canScrollDown, updateScrollFade } = useScrollFade(categoryListRef);

watch([() => filteredCategories.value.length, activeType], () => {
  nextTick(updateScrollFade);
});
</script>

<template>
  <div class="trip-category-settings">
    <!-- 1. Bereichs-Umschalter: Ausgaben vs. Spots -->
    <div class="scope-nav">
      <SegmentedToggle
        :model-value="activeType"
        :options="SCOPE_OPTIONS"
        @update:model-value="(val) => (activeType = val as 'expense' | 'spot')"
      />

      <Button
        v-if="!showCreateForm"
        type="button"
        variant="primary"
        size="sm"
        :icon="ACTION_ICONS.add"
        @click="showCreateForm = true"
      >
        Neue Kategorie
      </Button>
    </div>

    <!-- 2. Formular: Neue Kategorie erstellen (aufklappbare Karte) -->
    <Card v-if="showCreateForm" class="create-card animate-cascade">
      <div class="card-header">
        <span class="card-title">
          Neue {{ activeType === 'expense' ? 'Ausgabenkategorie' : 'Spot-Kategorie' }}
        </span>
        <div class="spacer" />
        <IconButton
          variant="ghost"
          size="sm"
          :icon="ACTION_ICONS.close"
          title="Schließen"
          aria-label="Schließen"
          @click="showCreateForm = false"
        />
      </div>

      <TripCategoryFormFields
        v-model="createForm"
        :active-type="activeType"
        :input-name-id="createNameId"
        @open-icon-picker="openIconPicker('create')"
        @submit="handleCreate"
      />

      <div class="form-actions">
        <Button type="button" variant="ghost" size="sm" @click="showCreateForm = false">
          Abbrechen
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          :disabled="!createForm.name.trim()"
          @click="handleCreate"
        >
          Kategorie erstellen
        </Button>
      </div>
    </Card>

    <!-- 3. Suchleiste -->
    <div class="search-bar">
      <Input
        v-model="searchQuery"
        type="search"
        placeholder="Kategorien filtern..."
        aria-label="Kategorien filtern"
        class="search-input"
      />
    </div>

    <!-- 4. Kategorien-Liste -->
    <div class="category-list-wrapper">
      <div ref="categoryListRef" class="category-list" @scroll="updateScrollFade">
        <TripCategoryRow
          v-for="cat in filteredCategories"
          :key="cat.name"
          :category="cat"
          :active-type="activeType"
          @edit="startEdit"
          @toggle-hide="toggleHideStandard"
        />

        <EmptyState v-if="filteredCategories.length === 0" class="empty-hint">
          Keine Kategorien für „{{ searchQuery }}“ gefunden.
        </EmptyState>
      </div>

      <ScrollFadeOverlay :can-scroll-up="canScrollUp" :can-scroll-down="canScrollDown" />
    </div>

    <!-- 5. Kategorie bearbeiten (Dialog) -->
    <Modal
      :model-value="editingCategory !== null"
      title="Kategorie bearbeiten"
      @update:model-value="(v) => !v && cancelEdit()"
    >
      <div class="edit-dialog-content">
        <TripCategoryFormFields
          v-model="editForm"
          :active-type="activeType"
          :input-name-id="editNameId"
          @open-icon-picker="openIconPicker('edit')"
          @submit="saveEdit"
        />

        <Alert v-if="editForm.usage_count > 0" variant="warning" size="sm">
          Wird bei {{ editForm.usage_count }} bestehenden
          {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }} automatisch mit umbenannt.
        </Alert>

        <div class="actions-row">
          <Button
            v-if="editingCategory?.isCustom && editingCategory?.id"
            type="button"
            variant="danger"
            secondary
            :icon="ACTION_ICONS.delete"
            @click="confirmDeleteFromEdit"
          >
            Löschen
          </Button>
          <div class="spacer" />
          <Button type="button" variant="ghost" @click="cancelEdit">Abbrechen</Button>
          <Button
            type="button"
            variant="primary"
            :disabled="!editForm.name.trim()"
            @click="saveEdit"
          >
            Änderungen speichern
          </Button>
        </div>
      </div>
    </Modal>

    <!-- 6. Icon-Auswahl-Modal -->
    <CategoryIconPickerModal
      v-model="showIconPicker"
      :selected-icon-id="currentPickerIconId"
      @select="selectIcon"
    />

    <!-- 7. Lösch-Bestätigung -->
    <Modal
      :model-value="categoryToDelete !== null"
      title="Kategorie löschen"
      @update:model-value="(v) => !v && (categoryToDelete = null)"
    >
      <div class="delete-dialog-content">
        <p>
          Möchtest du die Kategorie <strong>„{{ categoryToDelete?.name }}“</strong> wirklich
          löschen?
        </p>

        <Alert v-if="categoryToDelete && categoryToDelete.count > 0" variant="danger" size="md">
          Diese Kategorie wird aktuell von <strong>{{ categoryToDelete.count }}</strong>
          {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }} verwendet. Beim Löschen wird die
          Kategorie bei diesen Einträgen entfernt (auf „Keine Kategorie“ gesetzt).
        </Alert>

        <div class="actions-row">
          <Button type="button" variant="ghost" @click="categoryToDelete = null">Abbrechen</Button>
          <div class="spacer" />
          <Button type="button" variant="danger" :icon="ACTION_ICONS.delete" @click="executeDelete">
            Kategorie löschen
          </Button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.trip-category-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.scope-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.create-card {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.card-title {
  font-weight: 700;
  font-size: var(--font-size-md);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.search-bar {
  margin: var(--space-1) 0;
}

.search-input {
  width: 100%;
}

.category-list-wrapper {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: min(52vh, 460px);
  overflow-y: auto;
}

.edit-dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.empty-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-4);
}

.delete-dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.actions-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.spacer {
  flex: 1;
}
</style>

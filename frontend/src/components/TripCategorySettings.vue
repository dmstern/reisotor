<script setup lang="ts">
import { useId, ref, watch, nextTick, computed } from 'vue';
import { IconArrowRight } from '@tabler/icons-vue';
import { useTripCategorySettings } from '../composables/useTripCategorySettings';
import { useTripCategoriesStore } from '../stores/tripCategories';
import { useScrollFade } from '../composables/useScrollFade';
import { getCategoryIconDef } from '../utils/categoryIcons';
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
import CategoryChip from './CategoryChip.vue';
import TripCategoryAffectedItems from './TripCategoryAffectedItems.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const props = withDefaults(
  defineProps<{
    tripId: number;
    initialType?: 'expense' | 'spot';
  }>(),
  {
    initialType: 'spot',
  }
);

const emit = defineEmits<{
  (e: 'navigate'): void;
}>();

const createNameId = useId();
const editNameId = useId();

const tripCategoriesStore = useTripCategoriesStore();

const {
  activeType,
  SCOPE_OPTIONS,
  searchQuery,
  showCreateForm,
  editingCategory,
  categoryToDelete,
  categoryToReset,
  showIconPicker,
  createForm,
  editForm,
  usageItems,
  isLoadingUsageItems,
  currentPickerIconId,
  filteredCategories,
  selectIcon,
  openIconPicker,
  startEdit,
  cancelEdit,
  saveEdit,
  handleCreate,
  confirmDeleteFromEdit,
  cancelDelete,
  executeDelete,
  promptReset,
  confirmResetFromEdit,
  cancelReset,
  executeReset,
  toggleHideStandard,
} = useTripCategorySettings(
  () => props.tripId,
  () => props.initialType
);

function onNavigate() {
  cancelEdit();
  cancelDelete();
  cancelReset();
  emit('navigate');
}

const beforeCategoryMeta = computed(() => {
  if (!editingCategory.value) return undefined;
  const meta = tripCategoriesStore.categoryMeta(editingCategory.value.name, activeType.value);
  const iconId = editingCategory.value.icon || meta.tabler.id;
  const emojiVal = editingCategory.value.emoji || meta.icon;
  return {
    label: editingCategory.value.name,
    icon: emojiVal,
    color: editingCategory.value.color || meta.color,
    tabler: getCategoryIconDef(iconId, emojiVal),
  };
});

const afterCategoryMeta = computed(() => {
  if (!editingCategory.value) return undefined;
  const iconId = editForm.value.icon || 'category';
  const emojiVal = editForm.value.emoji || '🏷️';
  return {
    label: editForm.value.name.trim() || editingCategory.value.name,
    icon: emojiVal,
    color: editForm.value.color,
    tabler: getCategoryIconDef(iconId, emojiVal),
  };
});

const categoryListRef = ref<HTMLElement | null>(null);
const { canScrollUp, canScrollDown, updateScrollFade } = useScrollFade(categoryListRef);

watch([() => filteredCategories.value.length, activeType], () => {
  nextTick(updateScrollFade);
});
</script>

<template>
  <div class="trip-category-settings">
    <!-- 1. Bereichs-Umschalter: Spots vs. Ausgaben -->
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
          @reset="promptReset"
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
          :show-preview="false"
          @open-icon-picker="openIconPicker('edit')"
          @submit="saveEdit"
        />

        <!-- Verschmolzene Vorher-Nachher-Vorschau am unteren Ende -->
        <div class="edit-preview-section">
          <div class="preview-header">
            <span class="preview-label">Vorschau:</span>
            <div class="preview-diff-row" aria-label="Vorher-Nachher-Vorschau">
              <div class="preview-stage">
                <span class="stage-tag">Vorher</span>
                <CategoryChip
                  :category="editingCategory?.name"
                  :type="activeType"
                  :custom-meta="beforeCategoryMeta"
                />
              </div>
              <IconArrowRight class="diff-arrow" aria-hidden="true" :size="16" />
              <div class="preview-stage">
                <span class="stage-tag">Nachher</span>
                <CategoryChip
                  :category="afterCategoryMeta?.label"
                  :type="activeType"
                  :custom-meta="afterCategoryMeta"
                />
              </div>
            </div>
          </div>

          <Alert v-if="editForm.usage_count > 0" variant="warning" size="sm">
            <template v-if="editForm.usage_count === 1">
              {{
                activeType === 'expense'
                  ? 'Wird bei 1 bestehenden Ausgabe'
                  : 'Wird bei 1 bestehendem Spot'
              }}
              automatisch mit angepasst.
            </template>
            <template v-else>
              Wird bei {{ editForm.usage_count }} bestehenden
              {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }} automatisch mit angepasst.
            </template>
          </Alert>

          <!-- Liste der betroffenen Einträge -->
          <TripCategoryAffectedItems
            v-if="editForm.usage_count > 0 && editingCategory"
            :items="usageItems"
            :total-count="editForm.usage_count"
            :active-type="activeType"
            :is-loading="isLoadingUsageItems"
            :category-name="editingCategory.name"
            :trip-id="props.tripId"
            @navigate="onNavigate"
          />
        </div>

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
          <Button
            v-else-if="editingCategory?.isAdapted && editingCategory?.id"
            type="button"
            variant="secondary"
            :icon="ACTION_ICONS.restore"
            @click="confirmResetFromEdit"
          >
            Auf Standard zurücksetzen
          </Button>
          <div class="spacer" />
          <Button type="button" variant="secondary" class="btn-cancel" @click="cancelEdit">
            Abbrechen
          </Button>
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
      @update:model-value="(v) => !v && cancelDelete()"
    >
      <div class="delete-dialog-content">
        <p>
          Möchtest du die Kategorie <strong>„{{ categoryToDelete?.name }}“</strong> wirklich
          löschen?
        </p>

        <Alert v-if="categoryToDelete && categoryToDelete.count > 0" variant="danger" size="md">
          <template v-if="categoryToDelete.count === 1">
            Diese Kategorie wird aktuell von <strong>1</strong>
            {{ activeType === 'expense' ? 'Ausgabe' : 'Spot' }} verwendet. Beim Löschen wird die
            Kategorie bei diesem Eintrag entfernt (auf „Keine Kategorie“ gesetzt).
          </template>
          <template v-else>
            Diese Kategorie wird aktuell von <strong>{{ categoryToDelete.count }}</strong>
            {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }} verwendet. Beim Löschen wird die
            Kategorie bei diesen Einträgen entfernt (auf „Keine Kategorie“ gesetzt).
          </template>
        </Alert>

        <TripCategoryAffectedItems
          v-if="categoryToDelete && categoryToDelete.count > 0"
          :items="usageItems"
          :total-count="categoryToDelete.count"
          :active-type="activeType"
          :is-loading="isLoadingUsageItems"
          :category-name="categoryToDelete.name"
          :trip-id="props.tripId"
          @navigate="onNavigate"
        />

        <div class="actions-row">
          <div class="spacer" />
          <Button type="button" variant="secondary" class="btn-cancel" @click="cancelDelete">
            Abbrechen
          </Button>
          <Button type="button" variant="danger" :icon="ACTION_ICONS.delete" @click="executeDelete">
            Kategorie löschen
          </Button>
        </div>
      </div>
    </Modal>

    <!-- 8. Reset-Bestätigung -->
    <Modal
      :model-value="categoryToReset !== null"
      title="Kategorie auf Standard zurücksetzen"
      @update:model-value="(v) => !v && cancelReset()"
    >
      <div class="delete-dialog-content">
        <p>
          Möchtest du die Kategorie <strong>„{{ categoryToReset?.name }}“</strong> wirklich auf den
          Standard <strong>„{{ categoryToReset?.defaultName }}“</strong> zurücksetzen?
        </p>

        <Alert v-if="categoryToReset && categoryToReset.usageCount > 0" variant="warning" size="md">
          <template v-if="categoryToReset.usageCount === 1">
            Name, Icon und Farbe werden auf die Standardwerte zurückgesetzt.
            {{
              activeType === 'expense'
                ? 'Die 1 zugeordnete Ausgabe wird'
                : 'Der 1 zugeordnete Spot wird'
            }}
            automatisch wieder der Standard-Kategorie
            <strong>„{{ categoryToReset.defaultName }}“</strong> zugeordnet.
          </template>
          <template v-else>
            Name, Icon und Farbe werden auf die Standardwerte zurückgesetzt. Die
            <strong>{{ categoryToReset.usageCount }}</strong> zugeordneten
            {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }} werden automatisch wieder der
            Standard-Kategorie <strong>„{{ categoryToReset.defaultName }}“</strong> zugeordnet.
          </template>
        </Alert>

        <TripCategoryAffectedItems
          v-if="categoryToReset && categoryToReset.usageCount > 0"
          :items="usageItems"
          :total-count="categoryToReset.usageCount"
          :active-type="activeType"
          :is-loading="isLoadingUsageItems"
          :category-name="categoryToReset.name"
          :trip-id="props.tripId"
          @navigate="onNavigate"
        />

        <div class="actions-row">
          <div class="spacer" />
          <Button type="button" variant="secondary" class="btn-cancel" @click="cancelReset">
            Abbrechen
          </Button>
          <Button
            type="button"
            variant="primary"
            :icon="ACTION_ICONS.restore"
            @click="executeReset"
          >
            Auf Standard zurücksetzen
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

.edit-preview-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--color-bg-subtle, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

:root[data-theme='dark'] .edit-preview-section {
  background: rgba(255, 255, 255, 0.03);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.preview-label {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}

.preview-diff-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.preview-stage {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.stage-tag {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.diff-arrow {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>

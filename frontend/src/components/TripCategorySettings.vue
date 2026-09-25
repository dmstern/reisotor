<script setup lang="ts">
import { ref, computed, watch, useId } from 'vue';
import { useTripCategoriesStore, type TripCategory } from '../stores/tripCategories';
import {
  CATEGORY_ICON_PALETTE,
  CATEGORY_COLOR_PALETTE,
  findCategoryIcon,
  getCategoryIconDef,
  type CategoryIconOption,
} from '../utils/categoryIcons';
import { KNOWN_EXPENSE_CATEGORIES } from '../utils/expenseCategory';
import { KNOWN_CATEGORIES as KNOWN_SPOT_CATEGORIES } from '../utils/spotCategory';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import Input from './primitives/Input.vue';
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import IconButton from './primitives/IconButton.vue';
import Modal from './Modal.vue';
import CategoryChip from './CategoryChip.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

const props = defineProps<{
  tripId: number;
}>();

const tripCategoriesStore = useTripCategoriesStore();

const activeType = ref<'expense' | 'spot'>('expense');
const searchQuery = ref('');
const showCreateForm = ref(false);
const editingCategoryId = ref<number | null>(null);
const categoryToDelete = ref<{ id: number; name: string; count: number } | null>(null);
const showIconPicker = ref(false);
const iconPickerTarget = ref<'create' | 'edit'>('create');

// Form-State für Neuanlage
const createForm = ref({
  name: '',
  icon: 'category',
  emoji: '🏷️',
  color: CATEGORY_COLOR_PALETTE[0],
});

// Form-State für Inline-Bearbeitung
const editForm = ref({
  id: 0,
  name: '',
  icon: 'category',
  emoji: '🏷️',
  color: CATEGORY_COLOR_PALETTE[0],
  usage_count: 0,
});

const createNameId = useId();
const createEmojiId = useId();
const editNameId = useId();
const editEmojiId = useId();

// Bei Wechsel von tripId oder activeType Store synchronisieren
watch(
  () => props.tripId,
  (id) => {
    if (id && typeof window !== 'undefined') tripCategoriesStore.load(id, true);
  },
  { immediate: true }
);

function selectIcon(target: 'create' | 'edit', option: CategoryIconOption) {
  if (target === 'create') {
    createForm.value.icon = option.id;
    createForm.value.emoji = option.defaultEmoji;
  } else {
    editForm.value.icon = option.id;
    editForm.value.emoji = option.defaultEmoji;
  }
  showIconPicker.value = false;
}

function openIconPicker(target: 'create' | 'edit') {
  iconPickerTarget.value = target;
  showIconPicker.value = true;
}

// Liste der Standardkategorien des aktiven Typs
const defaultSuggestions = computed<{ label: string; icon?: string; color?: string }[]>(() => {
  return activeType.value === 'expense'
    ? KNOWN_EXPENSE_CATEGORIES
    : KNOWN_SPOT_CATEGORIES.map((s) => ({ label: s.label || '', icon: s.icon, color: s.color }));
});

// Kategorien aus dem Store für den aktuellen Typ
const storedCategories = computed(() => {
  return tripCategoriesStore.categories.filter((c) => c.type === activeType.value);
});

// Kombinierte Liste aller Kategorien (Custom + Standard)
interface DisplayCategory {
  id?: number;
  name: string;
  isCustom: boolean;
  isHidden: boolean;
  icon?: string | null;
  emoji?: string | null;
  color?: string | null;
  usageCount: number;
}

const allDisplayCategories = computed<DisplayCategory[]>(() => {
  const list: DisplayCategory[] = [];
  const storedByName = new Map<string, TripCategory>();

  for (const c of storedCategories.value) {
    storedByName.set(c.name.trim().toLowerCase(), c);
  }

  // 1. Gespeicherte Custom Categories
  for (const c of storedCategories.value) {
    const isStandard = defaultSuggestions.value.some(
      (s) => s.label.trim().toLowerCase() === c.name.trim().toLowerCase()
    );
    if (!isStandard) {
      list.push({
        id: c.id,
        name: c.name,
        isCustom: true,
        isHidden: Boolean(c.is_hidden),
        icon: c.icon,
        emoji: c.emoji,
        color: c.color,
        usageCount: c.usage_count ?? 0,
      });
    }
  }

  // 2. Standard-Kategorien
  for (const s of defaultSuggestions.value) {
    const stored = storedByName.get(s.label.trim().toLowerCase());
    list.push({
      id: stored?.id,
      name: s.label,
      isCustom: false,
      isHidden: Boolean(stored?.is_hidden),
      icon: stored?.icon ?? null,
      emoji: stored?.emoji ?? s.icon,
      color: stored?.color ?? s.color,
      usageCount: stored?.usage_count ?? 0,
    });
  }

  // Sortierung: Aktive Kategorien zuerst (alphabetisch), ausgeblendete ans Ende
  return list.sort((a, b) => {
    if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1;
    return a.name.localeCompare(b.name, 'de');
  });
});

const filteredCategories = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return allDisplayCategories.value;
  return allDisplayCategories.value.filter((c) => c.name.toLowerCase().includes(q));
});

function startEdit(cat: DisplayCategory) {
  editForm.value = {
    id: cat.id ?? 0,
    name: cat.name,
    icon: cat.icon ?? 'category',
    emoji: cat.emoji ?? '🏷️',
    color: cat.color ?? CATEGORY_COLOR_PALETTE[0],
    usage_count: cat.usageCount,
  };
  editingCategoryId.value = cat.id ?? -1;
}

function cancelEdit() {
  editingCategoryId.value = null;
}

async function saveEdit() {
  if (!editForm.value.name.trim()) return;

  if (editForm.value.id > 0) {
    await tripCategoriesStore.updateCategory(props.tripId, editForm.value.id, {
      name: editForm.value.name.trim(),
      icon: editForm.value.icon,
      emoji: editForm.value.emoji,
      color: editForm.value.color,
    });
  } else {
    // Falls Standard-Kategorie erstmalig angepasst wird: als Eintrag anlegen
    await tripCategoriesStore.createCategory(props.tripId, {
      type: activeType.value,
      name: editForm.value.name.trim(),
      icon: editForm.value.icon,
      emoji: editForm.value.emoji,
      color: editForm.value.color,
    });
  }
  editingCategoryId.value = null;
}

async function handleCreate() {
  if (!createForm.value.name.trim()) return;

  await tripCategoriesStore.createCategory(props.tripId, {
    type: activeType.value,
    name: createForm.value.name.trim(),
    icon: createForm.value.icon,
    emoji: createForm.value.emoji,
    color: createForm.value.color,
  });

  createForm.value = {
    name: '',
    icon: 'category',
    emoji: '🏷️',
    color: CATEGORY_COLOR_PALETTE[0],
  };
  showCreateForm.value = false;
}

function confirmDelete(cat: DisplayCategory) {
  if (!cat.id) return;
  categoryToDelete.value = {
    id: cat.id,
    name: cat.name,
    count: cat.usageCount,
  };
}

async function executeDelete() {
  if (!categoryToDelete.value) return;
  await tripCategoriesStore.deleteCategory(props.tripId, categoryToDelete.value.id);
  categoryToDelete.value = null;
}

async function toggleHideStandard(cat: DisplayCategory) {
  await tripCategoriesStore.setHidden(props.tripId, activeType.value, cat.name, !cat.isHidden);
}
</script>

<template>
  <div class="trip-category-settings">
    <!-- 1. Bereichs-Umschalter: Ausgaben vs. Spots -->
    <div class="scope-nav">
      <div class="pill-group" role="tablist">
        <button
          type="button"
          role="tab"
          class="pill-btn"
          :class="{ active: activeType === 'expense' }"
          :aria-selected="activeType === 'expense'"
          @click="activeType = 'expense'"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.amount" :size="16" group="formFields" />
          Ausgaben
        </button>
        <button
          type="button"
          role="tab"
          class="pill-btn"
          :class="{ active: activeType === 'spot' }"
          :aria-selected="activeType === 'spot'"
          @click="activeType = 'spot'"
        >
          <AppIcon :icon="FORM_FIELD_ICONS.location" :size="16" group="formFields" />
          Spots
        </button>
      </div>

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

    <!-- 2. Formular: Neue Kategorie erstellen (aufklappbar wie bei GitHub) -->
    <Card v-if="showCreateForm" class="create-card animate-cascade">
      <div class="card-header">
        <span class="card-title"
          >Neue {{ activeType === 'expense' ? 'Ausgabenkategorie' : 'Spot-Kategorie' }}</span
        >
        <div class="spacer"></div>
        <IconButton
          variant="ghost"
          size="sm"
          :icon="ACTION_ICONS.close"
          title="Schließen"
          aria-label="Schließen"
          @click="showCreateForm = false"
        />
      </div>

      <div class="preview-row">
        <span class="preview-label">Vorschau:</span>
        <CategoryChip
          :category="createForm.name || 'Kategorie-Name'"
          :type="activeType"
          :custom-meta="{
            label: createForm.name || 'Kategorie-Name',
            icon: createForm.emoji,
            color: createForm.color,
            tabler: getCategoryIconDef(createForm.icon, createForm.emoji),
          }"
        />
      </div>

      <div class="form-grid">
        <label :for="createNameId" class="field-label">
          Name
          <Input
            :id="createNameId"
            v-model="createForm.name"
            type="text"
            placeholder="z. B. Souvenirs oder Bootsverleih"
            required
            @keydown.enter.prevent="handleCreate"
          />
        </label>

        <div class="picker-row">
          <div class="icon-picker-field">
            <span class="field-label">Icon</span>
            <button
              type="button"
              class="icon-selector-btn"
              title="Icon auswählen"
              @click="openIconPicker('create')"
            >
              <AppIcon
                :icon="getCategoryIconDef(createForm.icon, createForm.emoji)"
                group="categories"
                :size="18"
              />
              <span class="icon-name">{{
                findCategoryIcon(createForm.icon)?.label ?? 'Icon'
              }}</span>
            </button>
          </div>

          <label :for="createEmojiId" class="emoji-field">
            <span class="field-label">Emoji</span>
            <Input
              :id="createEmojiId"
              v-model="createForm.emoji"
              type="text"
              class="emoji-input"
              :maxlength="4"
            />
          </label>
        </div>

        <div class="color-palette-field">
          <span class="field-label">Farbe</span>
          <div class="color-swatches">
            <button
              v-for="color in CATEGORY_COLOR_PALETTE"
              :key="color"
              type="button"
              class="swatch-btn"
              :class="{ selected: createForm.color === color }"
              :style="{ backgroundColor: color }"
              :title="color"
              @click="createForm.color = color"
            />
          </div>
        </div>
      </div>

      <div class="form-actions">
        <Button type="button" variant="ghost" size="sm" @click="showCreateForm = false"
          >Abbrechen</Button
        >
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
    <div class="category-list">
      <Card
        v-for="cat in filteredCategories"
        :key="cat.name"
        class="category-row"
        :class="{
          'is-hidden': cat.isHidden,
          'is-editing': editingCategoryId === (cat.id ?? -1),
        }"
      >
        <!-- A. Normale Zeilenansicht -->
        <template v-if="editingCategoryId !== (cat.id ?? -1)">
          <div class="category-main">
            <CategoryChip
              :category="cat.name"
              :type="activeType"
              :custom-meta="{
                label: cat.name,
                icon: cat.emoji ?? '',
                color: cat.color ?? '#3b82f6',
                tabler: getCategoryIconDef(cat.icon, cat.emoji),
              }"
            />

            <Badge v-if="cat.isCustom" variant="primary" class="kind-badge">Urlaub</Badge>
            <Badge v-else variant="default" class="kind-badge">Standard</Badge>

            <span class="usage-count" :class="{ 'has-usage': cat.usageCount > 0 }">
              {{ cat.usageCount }} {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }}
            </span>
          </div>

          <div class="row-actions">
            <!-- Bearbeiten -->
            <IconButton
              size="sm"
              :icon="FORM_FIELD_ICONS.note"
              title="Kategorie bearbeiten"
              aria-label="Kategorie bearbeiten"
              @click="startEdit(cat)"
            />

            <!-- Custom Kategorie löschen -->
            <IconButton
              v-if="cat.isCustom && cat.id"
              size="sm"
              variant="danger"
              :icon="ACTION_ICONS.delete"
              title="Kategorie löschen"
              aria-label="Kategorie löschen"
              @click="confirmDelete(cat)"
            />

            <!-- Standardkategorie ausblenden / einblenden -->
            <Button
              v-else-if="!cat.isCustom"
              type="button"
              variant="ghost"
              size="sm"
              class="hide-btn"
              @click="toggleHideStandard(cat)"
            >
              {{ cat.isHidden ? 'Einblenden' : 'Ausblenden' }}
            </Button>
          </div>
        </template>

        <!-- B. Inline-Bearbeitung (wie GitHub Labels) -->
        <template v-else>
          <div class="inline-edit-form">
            <div class="preview-row">
              <span class="preview-label">Vorschau:</span>
              <CategoryChip
                :category="editForm.name || 'Kategorie-Name'"
                :type="activeType"
                :custom-meta="{
                  label: editForm.name || 'Kategorie-Name',
                  icon: editForm.emoji,
                  color: editForm.color,
                  tabler: getCategoryIconDef(editForm.icon, editForm.emoji),
                }"
              />
            </div>

            <div class="form-grid">
              <label :for="editNameId" class="field-label">
                Name
                <Input
                  :id="editNameId"
                  v-model="editForm.name"
                  type="text"
                  required
                  @keydown.enter.prevent="saveEdit"
                />
              </label>

              <div class="picker-row">
                <div class="icon-picker-field">
                  <span class="field-label">Icon</span>
                  <button
                    type="button"
                    class="icon-selector-btn"
                    title="Icon auswählen"
                    @click="openIconPicker('edit')"
                  >
                    <AppIcon
                      :icon="getCategoryIconDef(editForm.icon, editForm.emoji)"
                      group="categories"
                      :size="18"
                    />
                    <span class="icon-name">{{
                      findCategoryIcon(editForm.icon)?.label ?? 'Icon'
                    }}</span>
                  </button>
                </div>

                <label :for="editEmojiId" class="emoji-field">
                  <span class="field-label">Emoji</span>
                  <Input
                    :id="editEmojiId"
                    v-model="editForm.emoji"
                    type="text"
                    class="emoji-input"
                    :maxlength="4"
                  />
                </label>
              </div>

              <div class="color-palette-field">
                <span class="field-label">Farbe</span>
                <div class="color-swatches">
                  <button
                    v-for="color in CATEGORY_COLOR_PALETTE"
                    :key="color"
                    type="button"
                    class="swatch-btn"
                    :class="{ selected: editForm.color === color }"
                    :style="{ backgroundColor: color }"
                    :title="color"
                    @click="editForm.color = color"
                  />
                </div>
              </div>
            </div>

            <p v-if="editForm.usage_count > 0" class="rename-hint">
              <AppIcon :icon="ACTION_ICONS.warning" :size="14" group="actions" />
              Wird bei {{ editForm.usage_count }} bestehenden
              {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }} automatisch mit umbenannt.
            </p>

            <div class="form-actions">
              <Button type="button" variant="ghost" size="sm" @click="cancelEdit">Abbrechen</Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                :disabled="!editForm.name.trim()"
                @click="saveEdit"
              >
                Änderungen speichern
              </Button>
            </div>
          </div>
        </template>
      </Card>

      <p v-if="filteredCategories.length === 0" class="empty-hint">
        Keine Kategorien für „{{ searchQuery }}“ gefunden.
      </p>
    </div>

    <!-- 5. Icon-Auswahl-Modal -->
    <Modal
      :model-value="showIconPicker"
      title="Kategorie-Icon wählen"
      @update:model-value="(v) => !v && (showIconPicker = false)"
    >
      <div class="icon-grid">
        <button
          v-for="opt in CATEGORY_ICON_PALETTE"
          :key="opt.id"
          type="button"
          class="icon-grid-item"
          :title="opt.label"
          @click="selectIcon(iconPickerTarget, opt)"
        >
          <AppIcon :icon="opt.tabler" group="categories" :size="24" />
          <span class="grid-icon-label">{{ opt.label }}</span>
        </button>
      </div>
    </Modal>

    <!-- 6. Lösch-Bestätigung -->
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

        <p v-if="categoryToDelete && categoryToDelete.count > 0" class="warning-box">
          <AppIcon :icon="ACTION_ICONS.warning" :size="18" group="actions" />
          <span>
            Diese Kategorie wird aktuell von <strong>{{ categoryToDelete.count }}</strong>
            {{ activeType === 'expense' ? 'Ausgaben' : 'Spots' }} verwendet. Beim Löschen wird die
            Kategorie bei diesen Einträgen entfernt (auf „Keine Kategorie“ gesetzt).
          </span>
        </p>

        <div class="actions-row">
          <Button type="button" variant="ghost" @click="categoryToDelete = null">Abbrechen</Button>
          <div class="spacer"></div>
          <Button type="button" variant="danger" @click="executeDelete"
            >Kategorie endgültig löschen</Button
          >
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

.pill-group {
  display: inline-flex;
  background: var(--color-surface-subtle, rgba(0, 0, 0, 0.05));
  border-radius: var(--radius-full, 9999px);
  padding: 3px;
  gap: 2px;
}

.pill-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 6px 14px;
  border-radius: var(--radius-full, 9999px);
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.pill-btn.active {
  background: var(--color-surface, #ffffff);
  color: var(--color-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.create-card {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.card-title {
  font-weight: 700;
  font-size: 0.95rem;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--color-surface-subtle, rgba(0, 0, 0, 0.02));
  border-radius: var(--radius-md);
}

.preview-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.picker-row {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}

.icon-picker-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.icon-selector-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--color-text);
  text-align: left;
}

.icon-selector-btn:hover {
  border-color: var(--color-primary);
}

.emoji-field {
  width: 70px;
}

.emoji-input {
  text-align: center;
  font-size: 1.1rem;
}

.color-palette-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swatch-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.swatch-btn:hover {
  transform: scale(1.15);
}

.swatch-btn.selected {
  border-color: var(--color-text);
  box-shadow: 0 0 0 2px var(--color-surface);
  transform: scale(1.1);
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

.category-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 460px;
  overflow-y: auto;
}

.category-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  gap: var(--space-2);
}

.category-row.is-hidden {
  opacity: 0.55;
  filter: grayscale(0.4);
}

.category-main {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  flex: 1;
}

.kind-badge {
  font-size: 0.68rem;
  padding: 2px 6px;
}

.usage-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.usage-count.has-usage {
  color: var(--color-text);
  font-weight: 500;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.hide-btn {
  font-size: 0.75rem;
  padding: 4px 8px;
}

.inline-edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

.rename-hint {
  font-size: 0.78rem;
  color: var(--color-warning-text, #d97706);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: var(--space-4);
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: var(--space-2);
  max-height: 380px;
  overflow-y: auto;
  padding: var(--space-2);
}

.icon-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.icon-grid-item:hover {
  border-color: var(--color-primary);
  background: var(--color-surface-hover, rgba(0, 0, 0, 0.03));
}

.grid-icon-label {
  font-size: 0.72rem;
  text-align: center;
  color: var(--color-text);
  line-height: 1.2;
}

.delete-dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.warning-box {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  margin: 0;
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

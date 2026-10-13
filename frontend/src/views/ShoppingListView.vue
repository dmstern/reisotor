<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Period, ShoppingItem } from '../api/types';
import { useUiSettingsStore } from '../stores/uiSettings';
import { useToast } from '../composables/useToast';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useShoppingList } from '../composables/useShoppingList';
import {
  useShoppingGrouping,
  UNASSIGNED_SHOP,
  type ShoppingGroup as Group,
} from '../composables/useShoppingGrouping';
import { PERIOD_META } from '../utils/period';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import Combobox from '../components/Combobox.vue';
import FormField from '../components/FormField.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import ListSettingsMenu from '../components/ListSettingsMenu.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import CheckableListItem from '../components/primitives/CheckableListItem.vue';
import Select from '../components/primitives/Select.vue';
import Input from '../components/primitives/Input.vue';
import Accordion from '../components/primitives/Accordion.vue';
import Badge from '../components/primitives/Badge.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

const uiSettings = useUiSettingsStore();
const { showToast } = useToast();

const {
  tripId,
  items,
  users,
  loading,
  highlightedIds,
  progress,
  toggle,
  reassign: reassignItem,
  addItem: submitNewItem,
  quickAddToGroup: submitQuickAdd,
  submitEdit: updateItem,
  remove,
} = useShoppingList();

const {
  groupBy,
  defaultGroupBy,
  groupByOptions,
  groupedItems,
  knownShops,
  userAvatar,
  userName,
  isChecked,
  hasItemMeta,
} = useShoppingGrouping(items, users);

const newLabel = ref('');
const newBuyer = ref('');
const newLink = ref('');
const newNote = ref('');
const newShop = usePersistedRef('reisotor-shopping-last-shop', '');
const newPeriod = usePersistedRef<Period | ''>('reisotor-shopping-last-period', '');

const editingItem = ref<ShoppingItem | null>(null);
const editForm = ref({ label: '', link: '', note: '', shop: '', period: '' as Period | '' });

const newFormBundle = computed<Record<string, unknown>>({
  get: () => ({
    newLabel: newLabel.value,
    newBuyer: newBuyer.value,
    newLink: newLink.value,
    newNote: newNote.value,
    newShop: newShop.value,
    newPeriod: newPeriod.value,
  }),
  set: (v) => {
    newLabel.value = (v.newLabel as string) ?? '';
    newBuyer.value = (v.newBuyer as string) ?? '';
    newLink.value = (v.newLink as string) ?? '';
    newNote.value = (v.newNote as string) ?? '';
    newShop.value = (v.newShop as string) ?? '';
    newPeriod.value = (v.newPeriod as Period | '') ?? '';
  },
});
const newDraft = useDraftAutosave('shopping:new', newFormBundle, ref(true));
const editDraft = useDraftAutosave(
  () => `shopping:edit:${editingItem.value?.id}`,
  editForm,
  computed(() => editingItem.value !== null)
);
const editLabelTouched = ref(false);

const showNewDetails = usePersistedRef('reisotor-shopping-show-details', false);

watch(
  () => newDraft.restored.value,
  (restored) => {
    if (restored && (newLink.value || newNote.value)) {
      showNewDetails.value = true;
    }
  }
);

async function reassign(item: ShoppingItem, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const assigned_to_user_id = value ? Number(value) : null;
  await reassignItem(item, assigned_to_user_id);
}

function startEdit(item: ShoppingItem) {
  editLabelTouched.value = false;
  editForm.value = {
    label: item.label,
    link: item.link ?? '',
    note: item.note ?? '',
    shop: item.shop ?? '',
    period: item.period ?? '',
  };
  editingItem.value = item;
}

async function submitEdit() {
  if (!editForm.value.label.trim()) {
    editLabelTouched.value = true;
    return;
  }
  if (!editingItem.value) return;
  await updateItem(
    editingItem.value.id,
    {
      label: editForm.value.label,
      assigned_to_user_id: editingItem.value.assigned_to_user_id,
      link: editForm.value.link,
      note: editForm.value.note,
      shop: editForm.value.shop,
      period: editForm.value.period,
    },
    !!editingItem.value.checked
  );
  editDraft.clear();
  editingItem.value = null;
}

function closeEditForm() {
  editLabelTouched.value = false;
  editDraft.clear();
  editingItem.value = null;
}

function discardEditDraft() {
  if (!editingItem.value) return;
  startEdit(editingItem.value);
  editDraft.clear();
  showToast({ message: 'Änderungen verworfen.', type: 'info' });
}

async function deleteEditingItem() {
  if (!editingItem.value) return;
  const id = editingItem.value.id;
  closeEditForm();
  await remove(id);
}

async function addItem() {
  if (!newLabel.value.trim()) return;
  await submitNewItem({
    label: newLabel.value,
    assigned_to_user_id: newBuyer.value ? Number(newBuyer.value) : undefined,
    link: newLink.value,
    note: newNote.value,
    shop: newShop.value,
    period: newPeriod.value,
  });
  newLabel.value = '';
  newLink.value = '';
  newNote.value = '';
  newDraft.clear();
}

function discardNewDraft() {
  newLabel.value = '';
  newLink.value = '';
  newNote.value = '';
  showNewDetails.value = false;
  newDraft.clear();
  showToast({ message: 'Entwurf verworfen.', type: 'info' });
}

async function quickAddToGroup(group: Group, label: string) {
  await submitQuickAdd({
    groupKey: group.key,
    groupBy: groupBy.value,
    label,
    fallbackBuyer: newBuyer.value,
    fallbackShop: newShop.value,
    fallbackPeriod: newPeriod.value,
    unassignedShopLabel: UNASSIGNED_SHOP,
  });
}
</script>

<template>
  <div class="page shopping-page" v-if="!loading">
    <div class="page-header-row">
      <div class="page-header-top">
        <div class="page-title-group">
          <div class="title-with-pill">
            <h1>Einkaufsliste</h1>
            <div class="progress-pill-group">
              <Badge
                :variant="
                  progress.checked === progress.total && progress.total > 0 ? 'success' : 'primary'
                "
                size="sm"
              >
                {{ progress.checked }}/{{ progress.total }} gekauft
              </Badge>
              <span v-if="progress.total > 0" class="progress-percentage">
                {{ Math.round((progress.checked / progress.total) * 100) }}%
              </span>
            </div>
          </div>
          <div v-if="progress.total > 0" class="header-progress-track" aria-hidden="true">
            <div
              class="header-progress-bar"
              :style="{ width: `${Math.round((progress.checked / progress.total) * 100)}%` }"
            ></div>
          </div>
        </div>
        <ListSettingsMenu
          v-model:group-by="groupBy"
          :group-by-options="groupByOptions"
          :default-group-by="defaultGroupBy"
          v-model:hide-completed="uiSettings.hideCompletedShopping"
          hide-completed-label="Erledigte ausblenden"
        />
      </div>
    </div>

    <!-- Progressives Schnelleingabe-Formular -->
    <form class="add-form card" @submit.prevent="addItem">
      <div class="quick-input-row">
        <div class="main-input-wrap">
          <FormField icon="title" label="Artikel" required v-slot="{ id }">
            <div class="input-inline-action-wrap">
              <Input :id="id" v-model="newLabel" type="text" placeholder="Neuer Artikel" required />
              <Button
                type="submit"
                class="inline-submit-btn"
                variant="primary"
                size="sm"
                :icon="ACTION_ICONS.send"
                :disabled="!newLabel.trim()"
                aria-label="Hinzufügen"
                title="Hinzufügen"
              />
            </div>
          </FormField>
        </div>

        <div class="quick-input-actions">
          <Button
            type="button"
            variant="ghost"
            class="details-toggle-btn"
            :aria-expanded="showNewDetails"
            @click="showNewDetails = !showNewDetails"
          >
            <AppIcon
              :icon="showNewDetails ? ACTION_ICONS.chevronUp : ACTION_ICONS.chevronDown"
              :size="14"
              group="actions"
            />
            <span>Details</span>
          </Button>
        </div>
      </div>

      <!-- Sanft ausklappbare Detail-Felder -->
      <Accordion :expanded="showNewDetails" :inert-when-closed="false">
        <div class="form-details-grid">
          <FormField icon="shop" label="Shop" v-slot="{ id }">
            <Combobox :id="id" v-model="newShop" :options="knownShops" placeholder="Shop/Laden" />
          </FormField>
          <FormField v-if="users.length > 1" icon="person" label="Einkäufer:in" v-slot="{ id }">
            <Select :id="id" v-model="newBuyer">
              <option value="">Kein:e Einkäufer:in</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">
                {{ u.avatar }} {{ u.username }}
              </option>
            </Select>
          </FormField>
          <FormField icon="period" label="Zeitraum" v-slot="{ id }">
            <Select :id="id" v-model="newPeriod">
              <option value="">Kein Zeitraum</option>
              <option value="before">{{ PERIOD_META.before }}</option>
              <option value="during">{{ PERIOD_META.during }}</option>
            </Select>
          </FormField>
          <FormField icon="link" label="Link" v-slot="{ id }">
            <Input :id="id" v-model="newLink" type="url" placeholder="Link (z. B. Amazon)" />
          </FormField>
          <FormField icon="note" label="Notiz" v-slot="{ id }">
            <Input :id="id" v-model="newNote" type="text" placeholder="Notiz" />
          </FormField>
        </div>
      </Accordion>

      <DraftStatusBar
        :status="newDraft.status.value"
        :restored="newDraft.restored.value"
        :can-discard="true"
        @discard="discardNewDraft"
      />
    </form>

    <div class="groups-grid" :class="{ 'groups-grid--masonry masonry': groupBy === 'shop' }">
      <section
        class="group-section animate-cascade"
        v-for="(group, index) in groupedItems"
        :key="group.key"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
      >
        <h2>
          <AppIcon v-if="group.iconDef" :icon="group.iconDef" :size="18" group="categories" />
          {{ group.label }}
        </h2>
        <div class="card group-card">
          <TransitionGroup tag="ul" name="list" class="list">
            <CheckableListItem
              v-for="item in group.items"
              :key="item.id"
              :done="!!item.checked"
              :highlighted="highlightedIds.has(item.id)"
            >
              <div class="item-main">
                <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                <label :for="'shopping-item-' + item.id" class="check">
                  <Checkbox
                    :id="'shopping-item-' + item.id"
                    :checked="!!item.checked"
                    @change="toggle(item)"
                  />
                  <span
                    class="item-title"
                    :class="{ 'row__text--done': item.checked, 'text-done': item.checked }"
                  >
                    {{ item.label }}
                  </span>
                </label>

                <div v-if="hasItemMeta(item)" class="item-meta">
                  <PendingSyncBadge v-if="item._pending" />
                  <Badge v-if="groupBy !== 'shop' && item.shop" size="sm" class="shop-badge">
                    <AppIcon :icon="FORM_FIELD_ICONS.shop" :size="12" group="formFields" />
                    <span>{{ item.shop }}</span>
                  </Badge>
                  <Badge v-if="groupBy !== 'period' && item.period" size="sm" class="period-badge">
                    <AppIcon :icon="FORM_FIELD_ICONS.period" :size="12" group="formFields" />
                    <span>{{ PERIOD_META[item.period] }}</span>
                  </Badge>
                  <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="link">
                    <AppIcon :icon="FORM_FIELD_ICONS.link" :size="12" group="formFields" /> Link
                  </a>
                  <span v-if="item.note" class="note" :title="item.note">
                    <AppIcon :icon="FORM_FIELD_ICONS.note" :size="12" group="formFields" />
                    <span class="note-text">{{ item.note }}</span>
                  </span>
                </div>
              </div>

              <template #actions>
                <div
                  v-if="
                    users.length > 1 && groupBy !== 'buyer' && userAvatar(item.assigned_to_user_id)
                  "
                  class="buyer-avatar-picker"
                  :title="`Käufer:in: ${userName(item.assigned_to_user_id)}`"
                >
                  <span class="avatar-display" aria-hidden="true">
                    {{ userAvatar(item.assigned_to_user_id) }}
                  </span>
                  <!-- eslint-disable-next-line vuejs-accessibility/no-onchange -->
                  <select
                    class="buyer-native-select"
                    aria-label="Käufer:in"
                    :value="item.assigned_to_user_id ?? ''"
                    @change="reassign(item, $event)"
                  >
                    <option value="">Nicht zugewiesen</option>
                    <option
                      v-if="
                        item.assigned_to_user_id &&
                        !users.some((u) => u.id === item.assigned_to_user_id)
                      "
                      :value="String(item.assigned_to_user_id)"
                      disabled
                    >
                      Ehemaliges Mitglied
                    </option>
                    <option v-for="u in users" :key="u.id" :value="String(u.id)">
                      {{ u.avatar }} {{ u.username }}
                    </option>
                  </select>
                </div>
                <EditButton small @click="startEdit(item)" />
              </template>
            </CheckableListItem>
            <EmptyState v-if="!group.items.length" :key="`${group.key}-empty`" tag="li">
              {{
                uiSettings.hideCompletedShopping
                  ? 'Keine offenen Einträge.'
                  : 'Noch keine Einträge.'
              }}
            </EmptyState>
          </TransitionGroup>

          <QuickAddRow
            class="group-quick-add"
            placeholder="Artikel hinzufügen…"
            @submit="(label) => quickAddToGroup(group, label)"
          >
            <template #extra>
              <Select
                v-if="users.length > 1 && groupBy !== 'buyer'"
                v-model="newBuyer"
                aria-label="Käufer:in"
                size="sm"
              >
                <option value="">Nicht zugewiesen</option>
                <option v-for="u in users" :key="u.id" :value="String(u.id)">
                  {{ u.avatar }} {{ u.username }}
                </option>
              </Select>
              <Combobox
                v-if="groupBy !== 'shop'"
                v-model="newShop"
                :options="knownShops"
                placeholder="Shop"
                size="sm"
              />
              <Select
                v-if="groupBy !== 'period'"
                v-model="newPeriod"
                aria-label="Zeitraum"
                size="sm"
              >
                <option value="">Zeitraum</option>
                <option value="before">{{ PERIOD_META.before }}</option>
                <option value="during">{{ PERIOD_META.during }}</option>
              </Select>
            </template>
          </QuickAddRow>
        </div>
      </section>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Artikel bearbeiten"
      full-height
      :confirm-close="editDraft.isDirty.value"
      confirm-close-entity="Eintrag"
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
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
          <Combobox
            :id="id"
            v-model="editForm.shop"
            :options="knownShops"
            placeholder="Shop/Laden"
          />
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
          @discard="discardEditDraft"
        />
        <div class="actions-row">
          <Button
            type="button"
            variant="danger"
            secondary
            :icon="ACTION_ICONS.delete"
            @click="deleteEditingItem"
          >
            Löschen
          </Button>
          <div class="spacer"></div>
          <Button type="button" variant="secondary" class="btn-cancel" @click="closeEditForm">
            Abbrechen
          </Button>
          <Button
            type="submit"
            :disabled="!editForm.label.trim()"
            :title="
              !editForm.label.trim()
                ? 'Bitte gib zuerst einen Namen für den Artikel ein'
                : undefined
            "
          >
            Speichern
          </Button>
        </div>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.page-header-row {
  margin-bottom: var(--space-3);
}

.page-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.page-title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.title-with-pill {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.progress-pill-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.progress-percentage {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.header-progress-track {
  width: 100%;
  max-width: 320px;
  height: 4px;
  background: var(--color-hover);
  border-radius: var(--radius-pill);
  overflow: hidden;
}

.header-progress-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Progressives Schnelleingabe-Formular */
.add-form {
  position: relative;
  z-index: 1;
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.add-form:focus-within {
  z-index: 5;
}

.quick-input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.main-input-wrap {
  flex: 1;
  min-width: 160px;
}

.main-input-wrap :deep(.form-field) {
  margin-bottom: 0;
}

.input-inline-action-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.input-inline-action-wrap :deep(.input) {
  width: 100%;
  padding-right: 44px;
}

.inline-submit-btn {
  position: absolute;
  right: 6px;
  top: 0;
  bottom: 0;
  margin-block: auto;
  translate: none;
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition:
    background 0.15s ease,
    opacity 0.15s ease,
    scale 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.inline-submit-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.inline-submit-btn:hover:not(:disabled) {
  translate: none;
  scale: 1.05;
}

.inline-submit-btn:active:not(:disabled) {
  translate: none;
  transform: none;
  scale: 0.95;
}

.quick-input-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

.details-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
}

.form-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px dashed var(--color-border);
  margin-top: var(--space-2);
}

@media (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

@container app-main (max-width: 640px) {
  .quick-input-actions {
    margin-left: auto;
  }
}

.groups-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.group-section {
  min-width: 0;
}

.groups-grid--masonry > .group-section {
  margin-bottom: 0;
}

.group-section:focus-within {
  position: relative;
  z-index: 5;
}

.group-section h2 {
  font-size: 0.95rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-2);
}

.group-card {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
}

.group-quick-add,
.group-quick-add.expanded {
  padding: var(--space-3) 0 0 0;
  border-top: 1px solid var(--color-border);
  margin-top: var(--space-2);
  border-radius: 0;
  box-shadow: none;
}

.group-quick-add :deep(select) {
  width: auto;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  cursor: pointer;
  min-width: 0;
  width: 100%;
}

.check :deep(.checkbox) {
  flex-shrink: 0;
  margin-top: 1.5px;
}

.item-title {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  line-height: 1.4;
  color: var(--color-text);
  overflow-wrap: break-word;
  word-break: normal;
  text-wrap: pretty;
  hyphens: auto;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 4px 8px;
  flex-wrap: wrap;
  margin-left: 28px;
  min-width: 0;
}

.shop-badge,
.period-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.shop-badge span,
.period-badge span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  color: var(--color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
  flex-shrink: 0;
}

.link:hover {
  color: var(--color-primary-dark);
}

.note {
  display: inline-flex;
  align-items: flex-start;
  gap: 4px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
  max-width: 100%;
  min-width: 0;
  line-height: 1.35;
}

.note :deep(.app-icon),
.note svg {
  flex-shrink: 0;
  margin-top: 2px;
}

.note-text {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: normal;
}

.buyer-avatar-picker {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-pill);
  background: var(--color-hover);
  border: 1px solid var(--color-border);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.buyer-avatar-picker:hover {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
}

.buyer-avatar-picker .avatar-display {
  font-size: 0.85rem;
  line-height: 1;
  pointer-events: none;
}

.buyer-native-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Desktop: Klassisches Grid für Einkäufer- und Zeitraum-Gruppierungen (nebeneinander aufgeteilt,
   ohne ineinander zu schachteln). Nur bei Shop-Gruppierung wird Masonry (CSS Multi-Column) genutzt,
   um unschöne Höhenlöcher durch viele unterschiedlich lange Shop-Listen zu vermeiden. */
@media (min-width: 900px) {
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }

  .groups-grid--masonry {
    display: block;
    column-width: 360px;
    column-gap: var(--space-4);
  }

  .groups-grid--masonry > .group-section {
    break-inside: avoid;
    margin-bottom: var(--space-4);
  }
}
</style>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { Period, ShoppingItem, User } from '../api/types';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import { PERIOD_META } from '../utils/period';
import Modal from '../components/Modal.vue';
import EditButton from '../components/EditButton.vue';
import DeleteButton from '../components/DeleteButton.vue';
import Combobox from '../components/Combobox.vue';
import FormField from '../components/FormField.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import { useToast } from '../composables/useToast';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { sortWithDoneLast } from '../composables/useCheckedSort';
import { usePersistedRef } from '../composables/usePersistedRef';
import { useUiSettingsStore } from '../stores/uiSettings';
import CompletedToggle from '../components/CompletedToggle.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import Checkbox from '../components/primitives/Checkbox.vue';
import CheckableListItem from '../components/primitives/CheckableListItem.vue';
import Select from '../components/primitives/Select.vue';
import Input from '../components/primitives/Input.vue';
import Accordion from '../components/primitives/Accordion.vue';
import Badge from '../components/primitives/Badge.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import type { IconDef } from '../utils/icon';

const tripStore = useTripStore();
const liveSync = useLiveSyncStore();
const uiSettings = useUiSettingsStore();
const tripId = tripStore.currentTripId as number;
const items = ref<ShoppingItem[]>([]);
const { showToast } = useToast();
const users = ref<User[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

type GroupBy = 'buyer' | 'shop' | 'period';
// Gruppierung sowie zuletzt gewählter Shop/Zeitraum bleiben über localStorage auch nach einem
// Reload/erneuten Besuch erhalten (siehe usePersistedRef.ts) - bewusst NICHT nach jedem addItem()
// zurückgesetzt (anders als Label/Link/Notiz, die je Gegenstand unterschiedlich sind), damit sie beim
// nächsten Öffnen der Einkaufsliste direkt wieder vorausgewählt sind.
const groupBy = usePersistedRef<GroupBy>('reisotor-shopping-group-by', 'buyer');

const newLabel = ref('');
const newBuyer = ref('');
const newLink = ref('');
const newNote = ref('');
const newShop = usePersistedRef('reisotor-shopping-last-shop', '');
const newPeriod = usePersistedRef<Period | ''>('reisotor-shopping-last-period', '');

const editingItem = ref<ShoppingItem | null>(null);
const editForm = ref({ label: '', link: '', note: '', shop: '', period: '' as Period | '' });

// Entwurfs-Zwischenspeicherung (siehe composables/useDraftAutosave.ts): Create-Formular besteht aus
// lauter einzelnen Refs statt eines Objekt-Refs, ein schreibbarer computed() bündelt sie (gleiches
// Muster wie ScheduleView.vue). Immer sichtbares Inline-Formular statt Modal, daher `active`
// konstant true.
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

const showNewDetails = ref(false);

watch(
  () => newDraft.restored.value,
  (restored) => {
    if (restored && (newLink.value || newNote.value)) {
      showNewDetails.value = true;
    }
  }
);

async function load() {
  try {
    const [itemsRes, usersRes] = await Promise.all([
      api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
      api.get<User[]>(`/trips/${tripId}/members`),
    ]);
    items.value = itemsRes;
    users.value = usersRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  highlightedIds.value = liveSync.markSeen('shopping');
  load();
});

watch(() => liveSync.domainVersion.shopping, load);

watch(
  () => users.value.length,
  (len) => {
    if (len <= 1 && groupBy.value === 'buyer') {
      groupBy.value = 'shop';
    }
  },
  { immediate: true }
);

const UNASSIGNED_SHOP = 'Ohne Shop';

function userAvatar(id: number | null | undefined) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? u.avatar : null;
}

function userName(id: number | null | undefined) {
  if (id == null) return null;
  const u = users.value.find((u) => u.id === id);
  return u ? u.username : null;
}

function isChecked(item: ShoppingItem) {
  return !!item.checked;
}

interface Group {
  key: string;
  label: string;
  iconDef?: IconDef;
  items: ShoppingItem[];
}

const groupedItems = computed<Group[]>(() => {
  const visibleItems = uiSettings.hideCompletedShopping
    ? items.value.filter((i) => !isChecked(i))
    : items.value;

  if (groupBy.value === 'shop') {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of visibleItems) {
      const key = item.shop?.trim() || UNASSIGNED_SHOP;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()]
      .sort(([a], [b]) =>
        a === UNASSIGNED_SHOP ? 1 : b === UNASSIGNED_SHOP ? -1 : a.localeCompare(b, 'de')
      )
      .map(([shop, shopItems]) => ({
        key: shop,
        label: shop,
        iconDef: FORM_FIELD_ICONS.shop,
        items: sortWithDoneLast(shopItems, isChecked),
      }));
  }
  if (groupBy.value === 'period') {
    const groups: Group[] = [
      {
        key: 'before',
        label: PERIOD_META.before,
        items: sortWithDoneLast(
          visibleItems.filter((i) => i.period === 'before'),
          isChecked
        ),
      },
      {
        key: 'during',
        label: PERIOD_META.during,
        items: sortWithDoneLast(
          visibleItems.filter((i) => i.period === 'during'),
          isChecked
        ),
      },
      {
        key: 'none',
        label: 'Ohne Zeitraum',
        items: sortWithDoneLast(
          visibleItems.filter((i) => !i.period),
          isChecked
        ),
      },
    ];
    return groups;
  }
  // buyer
  const perUser: Group[] = users.value.map((u) => ({
    key: `user-${u.id}`,
    label: `${u.avatar} ${u.username}`,
    items: sortWithDoneLast(
      visibleItems.filter((i) => i.assigned_to_user_id === u.id),
      isChecked
    ),
  }));
  const unassigned: Group = {
    key: 'unassigned',
    label: 'Nicht zugewiesen',
    items: sortWithDoneLast(
      visibleItems.filter((i) => i.assigned_to_user_id == null),
      isChecked
    ),
  };
  return [...perUser, unassigned];
});

const knownShops = computed(() => {
  const set = new Set<string>();
  items.value.forEach((i) => i.shop && set.add(i.shop));
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
});

const progress = computed(() => {
  const total = items.value.length;
  const checked = items.value.filter((i) => i.checked).length;
  return { total, checked };
});

async function toggle(item: ShoppingItem) {
  const updated = await api.put<ShoppingItem>(`/shopping/${item.id}`, {
    label: item.label,
    assigned_to_user_id: item.assigned_to_user_id,
    checked: !item.checked,
    link: item.link ?? undefined,
    note: item.note ?? undefined,
    shop: item.shop ?? undefined,
    period: item.period ?? undefined,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

async function reassign(item: ShoppingItem, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const assigned_to_user_id = value ? Number(value) : null;
  const updated = await api.put<ShoppingItem>(`/shopping/${item.id}`, {
    label: item.label,
    assigned_to_user_id,
    checked: !!item.checked,
    link: item.link ?? undefined,
    note: item.note ?? undefined,
    shop: item.shop ?? undefined,
    period: item.period ?? undefined,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

function startEdit(item: ShoppingItem) {
  editingItem.value = item;
  editForm.value = {
    label: item.label,
    link: item.link ?? '',
    note: item.note ?? '',
    shop: item.shop ?? '',
    period: item.period ?? '',
  };
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.label.trim()) return;
  const updated = await api.put<ShoppingItem>(`/shopping/${editingItem.value.id}`, {
    label: editForm.value.label.trim(),
    assigned_to_user_id: editingItem.value.assigned_to_user_id,
    checked: !!editingItem.value.checked,
    link: editForm.value.link || undefined,
    note: editForm.value.note || undefined,
    shop: editForm.value.shop || undefined,
    period: editForm.value.period || undefined,
  });
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  editDraft.clear();
  editingItem.value = null;
}

function closeEditForm() {
  editDraft.clear();
  editingItem.value = null;
}

async function remove(id: number) {
  await api.delete(`/shopping/${id}`);
  items.value = items.value.filter((i) => i.id !== id);
  showToast({ message: 'Artikel gelöscht. Er befindet sich nun im Papierkorb.', type: 'info' });
}

async function addItem() {
  if (!newLabel.value.trim()) return;
  const created = await api.post<ShoppingItem>('/shopping', {
    trip_id: tripId,
    label: newLabel.value.trim(),
    assigned_to_user_id: newBuyer.value ? Number(newBuyer.value) : undefined,
    link: newLink.value || undefined,
    note: newNote.value || undefined,
    shop: newShop.value || undefined,
    period: newPeriod.value || undefined,
  });
  items.value.push(created);
  newLabel.value = '';
  newLink.value = '';
  newNote.value = '';
  showNewDetails.value = false;
  // Shop/Zeitraum bleiben bewusst stehen (siehe usePersistedRef oben) - praktisch, wenn mehrere
  // Artikel für denselben Shop/Zeitraum hintereinander erfasst werden, und dient gleichzeitig als
  // Vorbelegung fürs nächste Öffnen der Liste.
  newDraft.clear();
}

// Inline-Quick-Add direkt in einer Gruppen-Kopfzeile (siehe QuickAddRow.vue) - die aktuell
// gruppierte Dimension ergibt sich aus der Gruppe selbst, die jeweils anderen beiden bleiben als
// kompakte Zusatzfelder übrig (gebunden an dieselben newBuyer/newShop/newPeriod-Refs wie das große
// Formular oben, damit es EINE "aktuelle Auswahl" gibt statt mehrerer unabhängiger Kopien).
async function quickAddToGroup(group: Group, label: string) {
  if (!label.trim()) return;
  const assigned_to_user_id =
    groupBy.value === 'buyer'
      ? group.key.startsWith('user-')
        ? Number(group.key.slice(5))
        : undefined
      : newBuyer.value
        ? Number(newBuyer.value)
        : undefined;
  const shop =
    groupBy.value === 'shop'
      ? group.key === UNASSIGNED_SHOP
        ? undefined
        : group.key
      : newShop.value || undefined;
  const period =
    groupBy.value === 'period'
      ? group.key === 'before' || group.key === 'during'
        ? group.key
        : undefined
      : newPeriod.value || undefined;

  const created = await api.post<ShoppingItem>('/shopping', {
    trip_id: tripId,
    label: label.trim(),
    assigned_to_user_id,
    shop,
    period,
  });
  items.value.push(created);
}
</script>

<template>
  <div class="page shopping-page" v-if="!loading">
    <div class="page-header-row">
      <div class="page-title-group">
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

    <!-- Progressives Schnelleingabe-Formular -->
    <form class="add-form card" @submit.prevent="addItem">
      <div class="quick-input-row">
        <div class="main-input-wrap">
          <FormField icon="title" label="Artikel" v-slot="{ id }">
            <Input :id="id" v-model="newLabel" type="text" placeholder="Neuer Artikel" required />
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

          <Button type="submit" variant="primary" :disabled="!newLabel.trim()"> Hinzufügen </Button>
        </div>
      </div>

      <!-- Sanft ausklappbare Detail-Felder -->
      <Accordion :expanded="showNewDetails" :inert-when-closed="false">
        <div class="form-details-grid">
          <FormField icon="shop" label="Shop" v-slot="{ id }">
            <Combobox
              :id="id"
              v-model="newShop"
              :options="knownShops"
              placeholder="Shop/Laden (optional)"
            />
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
            <Input
              :id="id"
              v-model="newLink"
              type="url"
              placeholder="Link (optional, z. B. Amazon)"
            />
          </FormField>
          <FormField icon="note" label="Notiz" v-slot="{ id }">
            <Input :id="id" v-model="newNote" type="text" placeholder="Notiz (optional)" />
          </FormField>
        </div>
      </Accordion>

      <DraftStatusBar :status="newDraft.status.value" :restored="newDraft.restored.value" />
    </form>

    <div class="filter-row">
      <div class="tool-row">
        <span class="tool-label"
          ><AppIcon :icon="ACTION_ICONS.group" :size="14" group="actions" /> Gruppieren</span
        >
        <Select v-model="groupBy" aria-label="Gruppieren">
          <option v-if="users.length > 1" value="buyer">nach Einkäufer:in</option>
          <option value="shop">nach Shop</option>
          <option value="period">nach Zeitraum</option>
        </Select>
      </div>
      <CompletedToggle v-model="uiSettings.hideCompletedShopping" />
    </div>

    <div class="groups-grid">
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
        <QuickAddRow
          class="card group-quick-add"
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
            <Select v-if="groupBy !== 'period'" v-model="newPeriod" aria-label="Zeitraum" size="sm">
              <option value="">Zeitraum</option>
              <option value="before">{{ PERIOD_META.before }}</option>
              <option value="during">{{ PERIOD_META.during }}</option>
            </Select>
          </template>
        </QuickAddRow>
        <div class="card">
          <TransitionGroup tag="ul" name="list" class="list">
            <CheckableListItem
              v-for="item in group.items"
              :key="item.id"
              :done="!!item.checked"
              :highlighted="highlightedIds.has(item.id)"
            >
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

              <div class="item-meta">
                <PendingSyncBadge v-if="item._pending" />
                <Badge v-if="groupBy !== 'shop' && item.shop" size="sm" class="shop-badge">
                  <AppIcon :icon="FORM_FIELD_ICONS.shop" :size="12" group="formFields" />
                  {{ item.shop }}
                </Badge>
                <Badge v-if="groupBy !== 'period' && item.period" size="sm" class="period-badge">
                  <AppIcon :icon="FORM_FIELD_ICONS.period" :size="12" group="formFields" />
                  {{ PERIOD_META[item.period] }}
                </Badge>
                <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="link">
                  <AppIcon :icon="FORM_FIELD_ICONS.link" :size="12" group="formFields" /> Link
                </a>
                <span v-if="item.note" class="note" :title="item.note">
                  <AppIcon :icon="FORM_FIELD_ICONS.note" :size="12" group="formFields" />
                  {{ item.note }}
                </span>
                <div
                  v-if="users.length > 1 && groupBy !== 'buyer'"
                  class="buyer-avatar-picker"
                  :title="
                    item.assigned_to_user_id
                      ? `Käufer:in: ${userName(item.assigned_to_user_id)}`
                      : 'Käufer:in zuweisen'
                  "
                >
                  <span class="avatar-display" aria-hidden="true">
                    {{ userAvatar(item.assigned_to_user_id) || '👤' }}
                  </span>
                  <!-- eslint-disable-next-line vuejs-accessibility/no-onchange -->
                  <select
                    class="buyer-native-select"
                    aria-label="Käufer:in"
                    :value="item.assigned_to_user_id ?? ''"
                    @change="reassign(item, $event)"
                  >
                    <option value="">👤 Nicht zugewiesen</option>
                    <option v-for="u in users" :key="u.id" :value="String(u.id)">
                      {{ u.avatar }} {{ u.username }}
                    </option>
                  </select>
                </div>
              </div>

              <template #actions>
                <EditButton small @click="startEdit(item)" />
                <DeleteButton small @click="remove(item.id)" />
              </template>
            </CheckableListItem>
            <li v-if="!group.items.length" :key="`${group.key}-empty`" class="empty">
              {{
                uiSettings.hideCompletedShopping
                  ? 'Keine offenen Einträge.'
                  : 'Noch keine Einträge.'
              }}
            </li>
          </TransitionGroup>
        </div>
      </section>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Artikel bearbeiten"
      full-height
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField icon="title" label="Artikel" v-slot="{ id }">
          <Input :id="id" v-model="editForm.label" type="text" placeholder="Artikel" required />
        </FormField>
        <FormField icon="shop" label="Shop" v-slot="{ id }">
          <Combobox
            :id="id"
            v-model="editForm.shop"
            :options="knownShops"
            placeholder="Shop/Laden (optional)"
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
          <Input :id="id" v-model="editForm.link" type="url" placeholder="Link (optional)" />
        </FormField>
        <FormField icon="note" label="Notiz" v-slot="{ id }">
          <Input :id="id" v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        </FormField>
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
        <div class="actions-row">
          <div class="spacer"></div>
          <Button type="submit">Speichern</Button>
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

.page-title-group {
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
  margin-top: var(--space-2);
}

.header-progress-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Progressives Schnelleingabe-Formular */
.add-form {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.quick-input-row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.main-input-wrap {
  flex: 1;
  min-width: 220px;
}

.main-input-wrap :deep(.form-field) {
  margin-bottom: 0;
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

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
}

/* Gleiches Muster wie ExcursionsView.vue's Gruppieren/Sortieren/Filtern-Zeile (dort .tool-row/
   .tool-label) - für Konsistenz app-weit hier 1:1 übernommen statt einer eigenen Variante. */
.tool-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.tool-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.groups-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.group-section {
  min-width: 0;
}

.group-section h2 {
  font-size: 0.95rem;
  color: var(--color-primary-dark);
  margin-bottom: var(--space-2);
}

.group-quick-add {
  margin-bottom: var(--space-2);
}

.group-quick-add :deep(select) {
  width: auto;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  flex: 1 1 0;
  min-width: 0;
}

.item-title {
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  margin-left: auto;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.shop-badge,
.period-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
}

.note {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  color: var(--color-text-muted);
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

.empty {
  padding: var(--space-2) 0;
}

/* Desktop: Gruppen nebeneinander statt untereinander, um den vorhandenen Platz besser zu nutzen –
   auto-fit/minmax statt einer festen Spaltenzahl, damit sich die Spaltenzahl der tatsächlichen
   Fensterbreite und Anzahl an Gruppen anpasst. Exakt dasselbe Muster wie PackingListView.vue. */
@media (min-width: 900px) {
  .groups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>

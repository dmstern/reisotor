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
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import DraftStatusBar from '../components/DraftStatusBar.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import PendingSyncBadge from '../components/PendingSyncBadge.vue';
import { useUndoableDelete } from '../composables/useUndoableDelete';
import { useDraftAutosave } from '../composables/useDraftAutosave';
import { sortWithDoneLast } from '../composables/useCheckedSort';
import { usePersistedRef } from '../composables/usePersistedRef';

const tripStore = useTripStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
const items = ref<ShoppingItem[]>([]);
const { isPending, markPendingDelete, clearPending } = useUndoableDelete();
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
  computed(() => editingItem.value !== null),
);

async function load() {
  try {
    const [itemsRes, usersRes] = await Promise.all([
      api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
      api.get<User[]>('/users'),
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

const UNASSIGNED_SHOP = 'Ohne Shop';

function isChecked(item: ShoppingItem) {
  return !!item.checked;
}

interface Group {
  key: string;
  label: string;
  items: ShoppingItem[];
}

const groupedItems = computed<Group[]>(() => {
  if (groupBy.value === 'shop') {
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of items.value) {
      const key = item.shop?.trim() || UNASSIGNED_SHOP;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === UNASSIGNED_SHOP ? 1 : b === UNASSIGNED_SHOP ? -1 : a.localeCompare(b, 'de')))
      .map(([shop, shopItems]) => ({ key: shop, label: `🏬 ${shop}`, items: sortWithDoneLast(shopItems, isChecked) }));
  }
  if (groupBy.value === 'period') {
    const groups: Group[] = [
      { key: 'before', label: PERIOD_META.before, items: sortWithDoneLast(items.value.filter((i) => i.period === 'before'), isChecked) },
      { key: 'during', label: PERIOD_META.during, items: sortWithDoneLast(items.value.filter((i) => i.period === 'during'), isChecked) },
      { key: 'none', label: 'Ohne Zeitraum', items: sortWithDoneLast(items.value.filter((i) => !i.period), isChecked) },
    ];
    return groups;
  }
  // buyer
  const perUser: Group[] = users.value.map((u) => ({
    key: `user-${u.id}`,
    label: `${u.avatar} ${u.username}`,
    items: sortWithDoneLast(items.value.filter((i) => i.assigned_to_user_id === u.id), isChecked),
  }));
  const unassigned: Group = {
    key: 'unassigned',
    label: 'Nicht zugewiesen',
    items: sortWithDoneLast(items.value.filter((i) => i.assigned_to_user_id == null), isChecked),
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

// Weicher Löschvorgang serverseitig (siehe routes/shopping.ts) + 60s Rückgängig-Fenster clientseitig
// (useUndoableDelete.ts).
async function remove(id: number) {
  await api.delete(`/shopping/${id}`);
  markPendingDelete(id, () => {
    items.value = items.value.filter((i) => i.id !== id);
  });
}

async function restore(id: number) {
  clearPending(id);
  await api.post(`/trash/shopping_item/${id}/restore`);
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
  const shop = groupBy.value === 'shop' ? (group.key === UNASSIGNED_SHOP ? undefined : group.key) : newShop.value || undefined;
  const period =
    groupBy.value === 'period' ? (group.key === 'before' || group.key === 'during' ? group.key : undefined) : newPeriod.value || undefined;

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
    <h1>Einkaufsliste</h1>
    <p>{{ progress.checked }}/{{ progress.total }} gekauft</p>

    <form class="add-form card" @submit.prevent="addItem">
      <input v-model="newLabel" type="text" placeholder="Neuer Artikel" required />
      <Combobox v-model="newShop" :options="knownShops" placeholder="Shop/Laden (optional)" />
      <select v-model="newBuyer">
        <option value="">Kein:e Einkäufer:in</option>
        <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
      </select>
      <select v-model="newPeriod">
        <option value="">Kein Zeitraum</option>
        <option value="before">{{ PERIOD_META.before }}</option>
        <option value="during">{{ PERIOD_META.during }}</option>
      </select>
      <input v-model="newLink" type="url" placeholder="Link (optional, z. B. Amazon)" />
      <input v-model="newNote" type="text" placeholder="Notiz (optional)" />
      <button type="submit">Hinzufügen</button>
      <DraftStatusBar :status="newDraft.status.value" :restored="newDraft.restored.value" />
    </form>

    <div class="filter-row">
      <label>
        Gruppieren:
        <select v-model="groupBy">
          <option value="buyer">nach Einkäufer:in</option>
          <option value="shop">nach Shop</option>
          <option value="period">nach Zeitraum</option>
        </select>
      </label>
    </div>

    <div class="groups-grid">
      <section class="group-section" v-for="group in groupedItems" :key="group.key">
        <h2>{{ group.label }}</h2>
        <QuickAddRow class="card group-quick-add" placeholder="Artikel hinzufügen…" @submit="(label) => quickAddToGroup(group, label)">
          <template #extra>
            <select v-if="groupBy !== 'buyer'" v-model="newBuyer">
              <option value="">Nicht zugewiesen</option>
              <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
            </select>
            <Combobox v-if="groupBy !== 'shop'" v-model="newShop" :options="knownShops" placeholder="Shop" />
            <select v-if="groupBy !== 'period'" v-model="newPeriod">
              <option value="">Zeitraum</option>
              <option value="before">{{ PERIOD_META.before }}</option>
              <option value="during">{{ PERIOD_META.during }}</option>
            </select>
          </template>
        </QuickAddRow>
        <div class="card">
          <TransitionGroup tag="ul" name="list" class="list">
            <template v-for="item in group.items" :key="item.id">
              <li v-if="isPending(item.id)" class="row">
                <UndoDeleteRow :label="item.label" @undo="restore(item.id)" />
              </li>
              <li v-else class="row" :class="{ 'row-done': item.checked, 'new-highlight': highlightedIds.has(item.id) }">
                <label class="check">
                  <input type="checkbox" :checked="!!item.checked" @change="toggle(item)" />
                  <span :class="{ 'text-done': item.checked }">{{ item.label }}</span>
                </label>
                <PendingSyncBadge v-if="item._pending" />
                <span v-if="groupBy !== 'shop' && item.shop" class="tag">🏬 {{ item.shop }}</span>
                <span v-if="groupBy !== 'period' && item.period" class="tag">🗓️ {{ PERIOD_META[item.period] }}</span>
                <a v-if="item.link" :href="item.link" target="_blank" rel="noopener" class="link">🔗 Link</a>
                <span v-if="item.note" class="note">{{ item.note }}</span>
                <select
                  v-if="groupBy !== 'buyer'"
                  class="buyer-select"
                  :value="item.assigned_to_user_id ?? ''"
                  @change="reassign(item, $event)"
                >
                  <option value="">Nicht zugewiesen</option>
                  <option v-for="u in users" :key="u.id" :value="String(u.id)">{{ u.avatar }} {{ u.username }}</option>
                </select>
                <div class="row-actions">
                  <EditButton small @click="startEdit(item)" />
                  <DeleteButton small @click="remove(item.id)" />
                </div>
              </li>
            </template>
            <li v-if="!group.items.length" :key="`${group.key}-empty`" class="empty">Noch keine Einträge.</li>
          </TransitionGroup>
        </div>
      </section>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Artikel bearbeiten"
      @update:model-value="(v) => !v && closeEditForm()"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <input v-model="editForm.label" type="text" placeholder="Artikel" required />
        <Combobox v-model="editForm.shop" :options="knownShops" placeholder="Shop/Laden (optional)" />
        <select v-model="editForm.period">
          <option value="">Kein Zeitraum</option>
          <option value="before">{{ PERIOD_META.before }}</option>
          <option value="during">{{ PERIOD_META.during }}</option>
        </select>
        <input v-model="editForm.link" type="url" placeholder="Link (optional)" />
        <input v-model="editForm.note" type="text" placeholder="Notiz (optional)" />
        <DraftStatusBar :status="editDraft.status.value" :restored="editDraft.restored.value" />
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
/* Mehr Breite als der globale .page-Rahmen (960px), damit die Gruppen auf Desktop tatsächlich
   nebeneinander Platz haben (siehe .groups-grid unten) – exakt dasselbe Muster wie
   PackingListView.vue's .packing-page/.lists-grid. */
.shopping-page {
  max-width: 1400px;
}

.add-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.add-form input,
.add-form select {
  flex: 1;
  min-width: 140px;
}

.filter-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  font-size: 0.9rem;
}

.filter-row label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
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
  padding: var(--space-1) var(--space-2);
}

.group-quick-add :deep(select) {
  width: auto;
}

.tag {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  background: var(--color-hover);
  border-radius: 999px;
  padding: 2px 8px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

/* .row selbst hat (anders als .card) keinen border-radius - die globale .new-highlight-Regel
   (style.css) würde hier sonst mit ihrem für Karten gedachten Radius overrulen bzw. eckig
   wirken. Kleinerer, zur schmalen Listen-Zeile passender Wert. */
.row.new-highlight {
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}

.row:last-child {
  border-bottom: none;
}

.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
  flex: 1;
  min-width: 120px;
}

.link {
  font-size: 0.82rem;
}

.note {
  font-size: 0.82rem;
  color: var(--color-text-muted);
}

.buyer-select {
  font-size: 0.82rem;
  padding: 4px 6px;
}

.row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
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

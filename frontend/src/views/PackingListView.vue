<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api/client';
import type { PackingItem, User } from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useLiveSyncStore } from '../stores/liveSync';
import PackingItemRow from '../components/PackingItem.vue';
import Modal from '../components/Modal.vue';
import Combobox from '../components/Combobox.vue';
import QuickAddRow from '../components/QuickAddRow.vue';
import FormField from '../components/FormField.vue';
import UndoDeleteRow from '../components/UndoDeleteRow.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import { useUndoableDelete } from '../composables/useUndoableDelete';
import { sortWithDoneLast } from '../composables/useCheckedSort';
import { isFullyPacked } from '../utils/packing';

const auth = useAuthStore();
const tripStore = useTripStore();
const liveSync = useLiveSyncStore();
const tripId = tripStore.currentTripId as number;
const items = ref<PackingItem[]>([]);
const { isPending, markPendingDelete, clearPending } = useUndoableDelete();
const users = ref<User[]>([]);
const loading = ref(true);
const highlightedIds = ref<Set<number>>(new Set());

// Ein Hinzufügen-Formular direkt über jeder Liste (statt eines einzigen globalen Formulars mit
// Listen-Auswahl) – welche Liste gemeint ist, ergibt sich schon aus der Position, ein Auswahlfeld
// dafür entfällt. Kategorie/Unterkategorie/Anzahl sind gleich mit dabei statt erst nachträglich per
// "Bearbeiten" ergänzbar zu sein. Das Label selbst verwaltet die gemeinsame QuickAddRow-Komponente
// intern; Kategorie/Unterkategorie/Anzahl bleiben hier als Records (ein Eintrag pro Liste, Vue legt
// den Schlüssel beim ersten Tippen reaktiv an), damit sie über einen quickAdd()-Aufruf hinweg
// bewusst stehen bleiben können (siehe Kommentar an quickAdd() unten).
const quickAddCategories = ref<Record<string, string>>({});
const quickAddSubcategories = ref<Record<string, string>>({});
const quickAddQuantities = ref<Record<string, number>>({});

const editingItem = ref<PackingItem | null>(null);
const editForm = ref({ label: '', category: '', subcategory: '', quantity: 1, ownerId: 'shared' });

// Pro-Trip-Einstellung (trips.packing_category_required, siehe TripForm.vue): standardmäßig Pflicht,
// per Trip abschaltbar. Ist eine Kategorie Pflicht, wird "Sonstiges" vorbelegt statt das Feld leer zu
// lassen - wer wirklich keine Kategorie will, muss das explizit auswählen/ändern, statt es aus
// Versehen leer zu lassen (siehe CLAUDE.md-Wunsch dazu).
const categoryRequired = computed(() => tripStore.currentTrip?.packing_category_required !== 0);
const DEFAULT_CATEGORY = 'Sonstiges';

async function load() {
  try {
    const [itemsRes, usersRes] = await Promise.all([
      api.get<PackingItem[]>(`/packing?trip_id=${tripId}`),
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
  highlightedIds.value = liveSync.markSeen('packing');
  load();
});

watch(() => liveSync.domainVersion.packing, load);

const categories = computed(() => {
  const set = new Set(items.value.map((i) => i.category?.trim()).filter((c): c is string => !!c));
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
});

const subcategories = computed(() => {
  const set = new Set(items.value.map((i) => i.subcategory?.trim()).filter((c): c is string => !!c));
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
});

interface ListGroup {
  key: string;
  title: string;
  ownerId: number | null;
  items: PackingItem[];
}

const lists = computed<ListGroup[]>(() => {
  const shared: ListGroup = {
    key: 'shared',
    // 👥 statt gestapelter Einzel-Avatare: passt zur bestehenden Bedeutung des Icons anderswo in der
    // App (Mitglieder-Button in TripSwitcher.vue) und bleibt bei vielen Mitreisenden trotzdem
    // kompakt lesbar, statt mit wachsender Personenzahl immer breiter zu werden.
    title: '👥 Gemeinsame Packliste',
    ownerId: null,
    items: items.value.filter((i) => i.owner_id == null),
  };
  const perUser: ListGroup[] = users.value.map((u) => ({
    key: `user-${u.id}`,
    title: u.id === auth.user?.id ? `${u.avatar} Meine Packliste` : `${u.avatar} Packliste von ${u.username}`,
    ownerId: u.id,
    items: items.value.filter((i) => i.owner_id === u.id),
  }));

  const mine = perUser.filter((l) => l.ownerId === auth.user?.id);
  const others = perUser.filter((l) => l.ownerId !== auth.user?.id);
  return [...mine, shared, ...others];
});

// Belegt das Kategorie-Quick-Add-Feld jeder (neu hinzugekommenen) Liste mit "Sonstiges" vor, sobald
// eine Kategorie Pflicht ist - rein additiv (überschreibt nie einen bereits vom Nutzer getippten
// Wert), läuft deshalb gefahrlos bei jeder Neuberechnung von `lists` mit.
watch(
  lists,
  (ls) => {
    if (!categoryRequired.value) return;
    for (const list of ls) {
      if (quickAddCategories.value[list.key] === undefined) {
        quickAddCategories.value[list.key] = DEFAULT_CATEGORY;
      }
    }
  },
  { immediate: true },
);

interface SubGroup {
  subcategory: string | null;
  items: PackingItem[];
}
interface CategoryGroup {
  category: string;
  subgroups: SubGroup[];
}

// Zweistufige Gruppierung: Kategorie (wie bisher) -> Unterkategorie (neu, z. B. "Outfit Tag 1"
// innerhalb "Kleidung") – Gegenstände ohne Unterkategorie laufen ohne eigene Zwischenüberschrift
// direkt unter der Kategorie mit (leerer subcategory-Schlüssel sortiert alphabetisch zuerst).
function groupByCategory(listItems: PackingItem[]): CategoryGroup[] {
  const catMap = new Map<string, PackingItem[]>();
  for (const item of listItems) {
    const key = item.category?.trim() || 'Sonstiges';
    if (!catMap.has(key)) catMap.set(key, []);
    catMap.get(key)!.push(item);
  }
  return [...catMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
    .map(([category, catItems]) => {
      const subMap = new Map<string, PackingItem[]>();
      for (const item of catItems) {
        const subKey = item.subcategory?.trim() || '';
        if (!subMap.has(subKey)) subMap.set(subKey, []);
        subMap.get(subKey)!.push(item);
      }
      const subgroups = [...subMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'de'))
        .map(([subcategory, subItems]) => ({
          subcategory: subcategory || null,
          items: sortWithDoneLast(subItems, isFullyPacked),
        }));
      return { category, subgroups };
    });
}

// Fortschritt zählt jetzt Exemplare statt Zeilen (ein Gegenstand mit Anzahl 5 zählt für den
// Fortschritt auch als 5, "3/5 eingepackt" statt nur "gepackt/ungepackt" pro Zeile).
function progress(listItems: PackingItem[]) {
  const total = listItems.reduce((sum, i) => sum + i.quantity, 0);
  const packed = listItems.reduce((sum, i) => sum + Math.min(i.packed_count, i.quantity), 0);
  return { total, packed };
}

async function updateCounts(item: PackingItem, laidOutCount: number, packedCount: number) {
  const updated = await api.put<PackingItem>(`/packing/${item.id}`, {
    category: item.category ?? undefined,
    subcategory: item.subcategory ?? undefined,
    label: item.label,
    quantity: item.quantity,
    laid_out_count: laidOutCount,
    packed_count: packedCount,
    owner_id: item.owner_id,
  });
  const idx = items.value.findIndex((i) => i.id === item.id);
  if (idx !== -1) items.value[idx] = updated;
}

function startEdit(item: PackingItem) {
  editingItem.value = item;
  editForm.value = {
    label: item.label,
    category: item.category ?? (categoryRequired.value ? DEFAULT_CATEGORY : ''),
    subcategory: item.subcategory ?? '',
    quantity: item.quantity,
    ownerId: item.owner_id == null ? 'shared' : String(item.owner_id),
  };
}

async function submitEdit() {
  if (!editingItem.value || !editForm.value.label.trim()) return;
  if (categoryRequired.value && !editForm.value.category.trim()) return;
  const owner_id = editForm.value.ownerId === 'shared' ? null : Number(editForm.value.ownerId);
  const updated = await api.put<PackingItem>(`/packing/${editingItem.value.id}`, {
    label: editForm.value.label.trim(),
    category: editForm.value.category.trim() || undefined,
    subcategory: editForm.value.subcategory.trim() || undefined,
    quantity: Math.max(1, Math.round(editForm.value.quantity) || 1),
    laid_out_count: editingItem.value.laid_out_count,
    packed_count: editingItem.value.packed_count,
    owner_id,
  });
  const idx = items.value.findIndex((i) => i.id === updated.id);
  if (idx !== -1) items.value[idx] = updated;
  editingItem.value = null;
}

// Weicher Löschvorgang serverseitig (siehe routes/packing.ts) + 60s Rückgängig-Fenster clientseitig
// (useUndoableDelete.ts).
async function remove(id: number) {
  await api.delete(`/packing/${id}`);
  markPendingDelete(id, () => {
    items.value = items.value.filter((i) => i.id !== id);
  });
}

async function restore(id: number) {
  clearPending(id);
  await api.post(`/trash/packing_item/${id}/restore`);
}

async function quickAdd(list: ListGroup, label: string) {
  if (!label.trim()) return;
  const category = (quickAddCategories.value[list.key] ?? '').trim();
  if (categoryRequired.value && !category) return;
  const subcategory = (quickAddSubcategories.value[list.key] ?? '').trim();
  const quantity = Math.max(1, Math.round(quickAddQuantities.value[list.key] || 1));
  const created = await api.post<PackingItem>('/packing', {
    trip_id: tripId,
    label: label.trim(),
    category: category || undefined,
    subcategory: subcategory || undefined,
    quantity,
    owner_id: list.ownerId,
  });
  items.value.push(created);
  quickAddQuantities.value[list.key] = 1;
  // Kategorie/Unterkategorie bleiben bewusst stehen: praktisch, wenn mehrere Gegenstände derselben
  // Kategorie hintereinander erfasst werden (z. B. mehrere "Kleidung"-Teile).
}
</script>

<template>
  <div class="page packing-page" v-if="!loading">
    <h1>Packliste</h1>

    <div class="lists-grid">
      <section class="list-section" v-for="list in lists" :key="list.key">
        <div class="list-header">
          <h2>{{ list.title }}</h2>
          <span class="progress">{{ progress(list.items).packed }}/{{ progress(list.items).total }} gepackt</span>
        </div>

        <QuickAddRow
          class="card"
          :placeholder="`Neuer Gegenstand für ${list.title}`"
          @submit="(label) => quickAdd(list, label)"
        >
          <template #extra>
            <div class="pack-quick-extra">
              <Combobox
                v-model="quickAddCategories[list.key]"
                :options="categories"
                :placeholder="categoryRequired ? 'Kategorie' : 'Kategorie (optional)'"
              />
              <Combobox v-model="quickAddSubcategories[list.key]" :options="subcategories" placeholder="Unterkategorie (optional)" />
              <label class="qty-field quick-add-qty">
                <input v-model.number="quickAddQuantities[list.key]" type="number" min="1" step="1" placeholder="1" />
              </label>
            </div>
          </template>
        </QuickAddRow>

        <div class="card group" v-for="catGroup in groupByCategory(list.items)" :key="catGroup.category">
          <h3>{{ catGroup.category }}</h3>
          <template v-for="sub in catGroup.subgroups" :key="sub.subcategory ?? '_'">
            <h4 v-if="sub.subcategory" class="subcategory">{{ sub.subcategory }}</h4>
            <TransitionGroup tag="ul" name="list" class="list">
              <template v-for="item in sub.items" :key="item.id">
                <li v-if="isPending(item.id)"><UndoDeleteRow :label="item.label" @undo="restore(item.id)" /></li>
                <PackingItemRow
                  v-else
                  :item="item"
                  :highlighted="highlightedIds.has(item.id)"
                  @update-counts="updateCounts"
                  @remove="remove"
                  @edit="startEdit"
                />
              </template>
            </TransitionGroup>
          </template>
        </div>
        <p v-if="!list.items.length" class="empty">Noch keine Gegenstände auf dieser Liste.</p>
      </section>
    </div>

    <Modal
      :model-value="editingItem !== null"
      title="Gegenstand bearbeiten"
      @update:model-value="(v) => !v && (editingItem = null)"
    >
      <form class="edit-form" @submit.prevent="submitEdit">
        <FormField icon="title" label="Gegenstand">
          <input v-model="editForm.label" type="text" placeholder="Gegenstand" required />
        </FormField>
        <FormField icon="category" label="Kategorie">
          <Combobox v-model="editForm.category" :options="categories" placeholder="Kategorie" />
        </FormField>
        <FormField icon="category" label="Unterkategorie">
          <Combobox v-model="editForm.subcategory" :options="subcategories" placeholder="Unterkategorie (optional, z. B. Outfit Tag 1)" />
        </FormField>
        <label class="qty-field">
          Anzahl
          <input v-model.number="editForm.quantity" type="number" min="1" step="1" />
        </label>
        <FormField icon="person" label="Liste">
          <select v-model="editForm.ownerId">
            <option value="shared">🤝 Gemeinsam</option>
            <option v-for="u in users" :key="u.id" :value="String(u.id)">
              {{ u.avatar }} {{ u.id === auth.user?.id ? 'Meine Liste' : u.username }}
            </option>
          </select>
        </FormField>
        <button type="submit">Speichern</button>
      </form>
    </Modal>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
/* Mehr Breite als der globale .page-Rahmen (960px), damit die Listen auf Desktop tatsächlich
   nebeneinander Platz haben (siehe .lists-grid unten) statt trotz Mehrspaltigkeit schmal
   zusammengequetscht zu wirken. */
.packing-page {
  max-width: 1400px;
}

:deep(.quick-add-row) {
  margin-bottom: var(--space-3);
  padding: var(--space-2) var(--space-3);
}

.pack-quick-extra {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  /* Volle Breite statt nur der eigenen Inhaltsbreite - sonst bricht das umschließende
     .extra-fields (QuickAddRow.vue) diesen einzelnen Kind-Container gar nicht erst um, bevor er
     intern zu wrappen beginnt, was die Felder unnötig eng zusammenquetscht. */
  width: 100%;
}

.pack-quick-extra :deep(.combobox) {
  flex: 1 1 110px;
  min-width: 90px;
}

.quick-add-qty {
  flex: 0 0 auto;
  margin: 0;
}

.quick-add-qty input {
  width: 56px;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.qty-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  font-weight: 600;
}

.qty-field input {
  width: 80px;
}

.lists-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.list-section {
  min-width: 0;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--space-2);
}

.list-header h2 {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
  margin: 0;
}

.progress {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.group {
  margin-bottom: var(--space-3);
  padding: var(--space-3);
}

.group h3 {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 var(--space-2);
}

.subcategory {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  margin: var(--space-2) 0 4px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.empty {
  font-size: 0.9rem;
}

/* Desktop: Listen nebeneinander statt untereinander, um den vorhandenen Platz besser zu nutzen
   (Batch-Anfrage) – auto-fit/minmax statt einer festen Spaltenzahl, damit sich die Spaltenzahl der
   tatsächlichen Fensterbreite und Anzahl an Listen (gemeinsam + je Person) anpasst. */
@media (min-width: 900px) {
  .lists-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    align-items: start;
    gap: var(--space-4);
  }
}
</style>

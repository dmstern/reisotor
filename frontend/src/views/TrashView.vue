<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useTripStore } from '../stores/trip';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
import EmptyState from '../components/primitives/EmptyState.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';

// Eintrag aus GET /trash (routes/trash.ts): `data` trägt die komplette, noch nicht formatierte
// Zeile – jeder Objekttyp braucht eine eigene kleine Extraktionsregel (titleFor unten), da die
// Tabellen unterschiedliche Feldnamen für "den Titel" verwenden (title/name/label/content).
interface TrashEntry {
  type: string;
  id: number;
  label: string;
  deletedAt: string;
  data: Record<string, unknown>;
}

const route = useRoute();
const tripStore = useTripStore();
const tripId = computed(() => Number(route.params.tripId) || (tripStore.currentTripId as number));
const currentTrip = computed(
  () => tripStore.trips.find((t) => t.id === tripId.value) || tripStore.currentTrip
);
const entries = ref<TrashEntry[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const restoringKey = ref<string | null>(null);
const deletingKey = ref<string | null>(null);
const emptyingTrash = ref(false);
const error = ref('');

// Dieselben Icons wie in der NavBar/den jeweiligen Fachsichten (siehe App.vue/NavBar.vue), damit
// ein Objekttyp im Papierkorb auf den ersten Blick genauso aussieht wie überall sonst in der App.
const TYPE_ICON: Record<string, IconDef> = {
  schedule_item: SECTION_ICON_DEFS.calendar,
  excursion: SECTION_ICON_DEFS.excursions,
  spot: SECTION_ICON_DEFS.map,
  travel_item: SECTION_ICON_DEFS.travel,
  budget_item: SECTION_ICON_DEFS.budget,
  budget_transfer: SECTION_ICON_DEFS.budget,
  todo: SECTION_ICON_DEFS.todo,
  packing_item: SECTION_ICON_DEFS.packing,
  shopping_item: SECTION_ICON_DEFS.shopping,
  note: SECTION_ICON_DEFS.notes,
  diary_entry: SECTION_ICON_DEFS.diary,
  location_track: SECTION_ICON_DEFS.map,
};

function userLabel(id: unknown) {
  const user = users.value.find((u) => u.id === id);
  return user ? `${user.avatar} ${user.username}` : '?';
}

function truncate(text: string, max = 80) {
  const plain = text.replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

function titleFor(entry: TrashEntry): string {
  const d = entry.data;
  switch (entry.type) {
    case 'schedule_item':
    case 'excursion':
    case 'spot':
    case 'travel_item':
    case 'budget_item':
    case 'todo':
      return (d.title as string) || '(ohne Titel)';
    case 'location_track':
      return (d.title as string) || 'Standort-Aufzeichnung';
    case 'packing_item':
    case 'shopping_item':
      return (d.label as string) || '(ohne Titel)';
    case 'budget_transfer':
      return `${(d.amount as number).toFixed(2)} € · ${userLabel(d.from_user_id)} → ${userLabel(d.to_user_id)}`;
    case 'note':
    case 'diary_entry':
      return (d.title as string | null) || truncate(d.content as string);
    default:
      return '(ohne Titel)';
  }
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
function formatDeletedAt(iso: string) {
  return dateFormatter.format(new Date(iso));
}

function daysRemaining(iso: string): number {
  const deletedAt = new Date(iso).getTime();
  const expiresAt = deletedAt + 30 * 24 * 60 * 60 * 1000;
  const remainingMs = expiresAt - Date.now();
  return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
}

async function load() {
  if (tripId.value == null) return;
  try {
    const [entriesRes, usersRes] = await Promise.all([
      api.get<TrashEntry[]>(`/trash?trip_id=${tripId.value}`),
      api.get<User[]>(`/trips/${tripId.value}/members`),
    ]);
    entries.value = entriesRes;
    users.value = usersRes;
  } catch {
    // Offline und (noch) kein Cache-Eintrag für mindestens einen der Endpunkte - Seite soll trotzdem
    // rendern (ggf. mit leeren/vorherigen Daten) statt durch das v-if="!loading" unten für immer
    // blank zu bleiben (siehe api/client.ts's Offline-Fallback-Konzept).
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(tripId, () => {
  loading.value = true;
  load();
});

function keyOf(entry: TrashEntry) {
  return `${entry.type}-${entry.id}`;
}

async function restore(entry: TrashEntry) {
  error.value = '';
  const key = keyOf(entry);
  restoringKey.value = key;
  try {
    await api.post(`/trash/${entry.type}/${entry.id}/restore`);
    entries.value = entries.value.filter((e) => keyOf(e) !== key);
  } catch {
    error.value = 'Wiederherstellen fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    restoringKey.value = null;
  }
}

async function permanentlyDelete(entry: TrashEntry) {
  if (
    !confirm(
      'Dieses Element wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.'
    )
  )
    return;

  error.value = '';
  const key = keyOf(entry);
  deletingKey.value = key;
  try {
    await api.delete(`/trash/${entry.type}/${entry.id}`);
    entries.value = entries.value.filter((e) => keyOf(e) !== key);
  } catch {
    error.value = 'Löschen fehlgeschlagen. Bitte erneut versuchen.';
  } finally {
    deletingKey.value = null;
  }
}

async function emptyTrash() {
  if (
    !confirm(
      'Möchtest du den gesamten Papierkorb für diesen Urlaub endgültig leeren? Diese Aktion kann nicht rückgängig gemacht werden.'
    )
  )
    return;

  error.value = '';
  emptyingTrash.value = true;
  try {
    await api.delete(`/trash?trip_id=${tripId.value}`);
    entries.value = [];
  } catch {
    error.value = 'Papierkorb konnte nicht geleert werden.';
  } finally {
    emptyingTrash.value = false;
  }
}
</script>

<template>
  <div class="page" v-if="!loading">
    <div class="header-row">
      <h1><AppIcon :icon="ACTION_ICONS.delete" :size="24" group="navigation" /> Papierkorb</h1>
      <Button
        v-if="entries.length > 0"
        variant="danger"
        :disabled="emptyingTrash"
        @click="emptyTrash"
      >
        <AppIcon :icon="ACTION_ICONS.delete" :size="14" group="actions" /> Leeren
      </Button>
    </div>
    <p class="hint">
      Gelöschte Termine, Ausflüge, Spots und mehr<template v-if="currentTrip?.name">
        aus „{{ currentTrip.name }}“</template
      >
      bleiben hier für <strong>30 Tage</strong> erhalten, bevor sie automatisch endgültig gelöscht
      werden. In dieser Zeit lassen sie sich jederzeit wiederherstellen.
    </p>
    <p v-if="error" class="error">{{ error }}</p>

    <TransitionGroup tag="ul" name="list" class="trash-list">
      <li
        class="card trash-row animate-cascade"
        :class="{ 'is-loading': restoringKey === keyOf(entry) || deletingKey === keyOf(entry) }"
        v-for="(entry, index) in entries"
        :key="keyOf(entry)"
        :style="{ '--stagger-delay': `${index * 60}ms` }"
      >
        <span class="trash-icon"
          ><AppIcon
            :icon="TYPE_ICON[entry.type] ?? ACTION_ICONS.delete"
            :size="18"
            group="categories"
        /></span>
        <div class="trash-info">
          <span class="trash-title">{{ titleFor(entry) }}</span>
          <span class="trash-meta"
            >{{ entry.label }} · Gelöscht am {{ formatDeletedAt(entry.deletedAt) }} (Noch
            {{ daysRemaining(entry.deletedAt) }} Tage)</span
          >
        </div>
        <div class="trash-actions">
          <Button
            variant="ghost"
            class="text-danger"
            :disabled="restoringKey === keyOf(entry) || deletingKey === keyOf(entry)"
            @click="permanentlyDelete(entry)"
            title="Endgültig löschen"
          >
            <AppIcon :icon="ACTION_ICONS.delete" :size="18" group="actions" />
          </Button>
          <Button
            variant="card-action"
            :disabled="restoringKey === keyOf(entry) || deletingKey === keyOf(entry)"
            @click="restore(entry)"
            title="Wiederherstellen"
          >
            <AppIcon :icon="ACTION_ICONS.restore" :size="14" group="actions" />
            <span class="hide-on-mobile">Wiederherstellen</span>
          </Button>
        </div>
      </li>
    </TransitionGroup>
    <EmptyState v-if="!entries.length">
      <AppIcon :icon="ACTION_ICONS.delete" :size="32" group="actions" />
      <p>Der Papierkorb ist leer.</p>
    </EmptyState>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.trash-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: 0;
  list-style: none;
}

.trash-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.trash-row.is-loading {
  opacity: 0.5;
  pointer-events: none;
}

.trash-actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.text-danger {
  color: var(--color-danger);
}

.trash-icon {
  flex-shrink: 0;
  font-size: 1.4rem;
}

.trash-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.trash-title {
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trash-meta {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}

@media (max-width: 600px) {
  .hide-on-mobile {
    display: none;
  }
}
</style>

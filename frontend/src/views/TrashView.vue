<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import type { User } from '../api/types';
import { useTripStore } from '../stores/trip';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import AppIcon from '../components/AppIcon.vue';
import Button from '../components/primitives/Button.vue';
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

const tripStore = useTripStore();
const tripId = tripStore.currentTripId as number;
const entries = ref<TrashEntry[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);
const restoringKey = ref<string | null>(null);
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

async function load() {
  try {
    const [entriesRes, usersRes] = await Promise.all([
      api.get<TrashEntry[]>(`/trash?trip_id=${tripId}`),
      api.get<User[]>(`/trips/${tripId}/members`),
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
</script>

<template>
  <div class="page" v-if="!loading">
    <h1><AppIcon :icon="ACTION_ICONS.delete" :size="24" group="navigation" /> Papierkorb</h1>
    <p class="hint">
      Gelöschte Termine, Ausflüge, Spots und mehr bleiben hier eine Weile erhalten, bevor sie
      endgültig entfernt werden – hier lassen sie sich jederzeit wiederherstellen.
    </p>
    <p v-if="error" class="error">{{ error }}</p>

    <TransitionGroup tag="ul" name="list" class="trash-list">
      <li class="card trash-row" v-for="entry in entries" :key="keyOf(entry)">
        <span class="trash-icon"
          ><AppIcon
            :icon="TYPE_ICON[entry.type] ?? ACTION_ICONS.delete"
            :size="18"
            group="categories"
        /></span>
        <div class="trash-info">
          <span class="trash-title">{{ titleFor(entry) }}</span>
          <span class="trash-meta"
            >{{ entry.label }} · Gelöscht am {{ formatDeletedAt(entry.deletedAt) }}</span
          >
        </div>
        <Button
          variant="card-action"
          :disabled="restoringKey === keyOf(entry)"
          @click="restore(entry)"
        >
          <AppIcon :icon="ACTION_ICONS.restore" :size="14" group="actions" /> Wiederherstellen
        </Button>
      </li>
    </TransitionGroup>
    <p v-if="!entries.length" class="empty">Der Papierkorb ist leer.</p>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.trash-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.trash-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
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
</style>

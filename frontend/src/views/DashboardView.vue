<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import type {
  Accommodation,
  BudgetAllocation,
  BudgetExpense,
  DiaryEntry,
  Note,
  PackingItem,
  ScheduleItem,
  ShoppingItem,
  TodoItem,
  TravelItem,
  User,
} from '../api/types';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useExcursionsStore } from '../stores/excursions';
import { useDrawersStore } from '../stores/drawers';
import { assignCategoryColors } from '../utils/categoryColors';
import { buildAllEntries } from '../utils/calendarEntries';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { SECTION_ICONS } from '../utils/sectionIcons';
import BudgetMeter from '../components/BudgetMeter.vue';

const auth = useAuthStore();
const tripStore = useTripStore();
const excursionsStore = useExcursionsStore();
const drawers = useDrawersStore();
const tripId = tripStore.currentTripId as number;
const trip = computed(() => tripStore.currentTrip);
const schedule = ref<ScheduleItem[]>([]);
const todos = ref<TodoItem[]>([]);
const packing = ref<PackingItem[]>([]);
const expenses = ref<BudgetExpense[]>([]);
const allocations = ref<BudgetAllocation[]>([]);
const shopping = ref<ShoppingItem[]>([]);
const travelItems = ref<TravelItem[]>([]);
const accommodations = ref<Accommodation[]>([]);
const diaryEntries = ref<DiaryEntry[]>([]);
const notes = ref<Note[]>([]);
const users = ref<User[]>([]);
const loading = ref(true);

// Feste, deterministische Farbzuordnung je Widget (dataviz-Skill: kategoriale Identität, fixe
// Reihenfolge statt gewürfelter Farben) – dieselbe validierte Palette wie überall sonst in der App.
const WIDGET_COLORS = assignCategoryColors([
  'accommodation',
  'budget',
  'diary',
  'notes',
  'packing',
  'schedule',
  'shopping',
  'todo',
  'travel',
]);

onMounted(async () => {
  const [scheduleRes, todosRes, packingRes, expensesRes, allocationsRes, shoppingRes, travelRes, accRes, diaryRes, notesRes, usersRes] =
    await Promise.all([
      api.get<ScheduleItem[]>(`/schedule?trip_id=${tripId}`),
      api.get<TodoItem[]>(`/todos?trip_id=${tripId}`),
      api.get<PackingItem[]>(`/packing?trip_id=${tripId}`),
      api.get<BudgetExpense[]>(`/budget?trip_id=${tripId}`),
      api.get<BudgetAllocation[]>(`/budget/allocations?trip_id=${tripId}`),
      api.get<ShoppingItem[]>(`/shopping?trip_id=${tripId}`),
      api.get<TravelItem[]>(`/travel?trip_id=${tripId}`),
      api.get<Accommodation[]>(`/accommodation?trip_id=${tripId}`),
      api.get<DiaryEntry[]>(`/diary?trip_id=${tripId}`),
      api.get<Note[]>(`/notes?trip_id=${tripId}`),
      api.get<User[]>('/users'),
    ]);
  schedule.value = scheduleRes;
  todos.value = todosRes;
  packing.value = packingRes;
  expenses.value = expensesRes;
  allocations.value = allocationsRes;
  shopping.value = shoppingRes;
  travelItems.value = travelRes;
  accommodations.value = accRes;
  diaryEntries.value = diaryRes;
  notes.value = notesRes;
  users.value = usersRes;
  loading.value = false;
});

const todayStr = () => new Date().toISOString().slice(0, 10);

const daysUntilStart = computed(() => {
  if (!trip.value?.start_date) return null;
  const start = new Date(trip.value.start_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
});

// Kalender-Widget: echte Termine + eingebettete synthetische Einträge (Urlaub-Start/-Ende, ToDo
// mit Fälligkeitsdatum), sortiert, die nächsten drei statt nur den einen nächsten (Batch 12).
const upcomingEntries = computed(() =>
  buildAllEntries(schedule.value, trip.value, todos.value, travelItems.value, excursionsStore.excursions)
    .filter((e) => e.endDate >= todayStr())
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
    .slice(0, 3),
);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// Packliste: ein zusammengefasstes Widget (statt drei einzelner Tiles) mit Gesamtfortschritt
// plus kompakter Aufschlüsselung je Teilliste (Batch 12).
function progressOf(listItems: PackingItem[]) {
  const total = listItems.length;
  const checked = listItems.filter((p) => p.checked).length;
  return { total, checked };
}
const packingTotal = computed(() => progressOf(packing.value));
const packingLists = computed(() => {
  const shared = { key: 'shared', title: 'Gemeinsam', avatar: '🤝', ...progressOf(packing.value.filter((p) => p.owner_id == null)) };
  const perUser = users.value.map((u) => ({
    key: `user-${u.id}`,
    title: u.id === auth.user?.id ? 'Meine Liste' : u.username,
    avatar: u.avatar,
    ...progressOf(packing.value.filter((p) => p.owner_id === u.id)),
  }));
  return [...perUser, shared];
});

const budgetSummary = computed(() => {
  const target = allocations.value.reduce((sum, a) => sum + a.amount, 0);
  const spent = expenses.value.reduce((sum, e) => sum + e.amount, 0);
  return { target, spent };
});

const shoppingProgress = computed(() => {
  const total = shopping.value.length;
  const checked = shopping.value.filter((s) => s.checked).length;
  return { total, checked };
});

const todoProgress = computed(() => {
  const total = todos.value.length;
  const done = todos.value.filter((t) => t.done).length;
  return { total, done };
});

const nextTravelItem = computed(() =>
  [...travelItems.value].filter((t) => t.date && t.date >= todayStr()).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0],
);

const currentOrNextAccommodation = computed(() => {
  const today = todayStr();
  const current = accommodations.value.find((a) => a.start_date && a.end_date && a.start_date <= today && today <= a.end_date);
  if (current) return current;
  return [...accommodations.value]
    .filter((a) => a.start_date && a.start_date >= today)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))[0];
});

const latestDiaryEntry = computed(() =>
  [...diaryEntries.value].sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
);

function jumpToTrip() {
  tripStore.requestEditTrip();
}
</script>

<template>
  <div class="page" v-if="!loading">
    <header
      class="hero card"
      :style="trip?.image_url ? { backgroundImage: `linear-gradient(135deg, rgba(0,0,0,.35), rgba(0,0,0,.15)), url(${trip.image_url})` } : {}"
      :class="{ 'has-image': trip?.image_url }"
    >
      <button type="button" class="secondary banner-edit-btn" title="Urlaub bearbeiten" @click="jumpToTrip">✎ Bearbeiten</button>
      <h1>{{ trip?.name || 'Euer Urlaub' }}</h1>
      <p v-if="trip?.destination">📍 {{ trip.destination }}</p>
      <p v-if="trip">{{ formatDate(trip.start_date) }} – {{ formatDate(trip.end_date) }}</p>
      <p v-if="daysUntilStart !== null && daysUntilStart >= 0" class="countdown">
        Noch {{ daysUntilStart }} {{ daysUntilStart === 1 ? 'Tag' : 'Tage' }} bis zur Abreise 🎒
      </p>
      <p v-else-if="daysUntilStart !== null" class="countdown">Gute Reise! ✈️</p>
    </header>

    <div class="grid cards">
      <!-- Kalender: keine eigene Route mehr (jetzt Kalender-Schublade), Kachel öffnet die Schublade -->
      <button
        type="button"
        class="card tile tile-btn"
        :style="{ background: `${WIDGET_COLORS.get('schedule')}0d` }"
        @click="drawers.calendarOpen = true"
      >
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('schedule')}26`, borderColor: WIDGET_COLORS.get('schedule') }">{{ SECTION_ICONS.calendar }}</span>
        <h3>Kalender</h3>
        <ul v-if="upcomingEntries.length" class="mini-list">
          <li v-for="entry in upcomingEntries" :key="entry.key">
            <span class="mini-dot" :style="{ background: SCHEDULE_CATEGORY_META[entry.category].color }"></span>
            <span class="entry-text"
              >{{ formatDate(entry.date) }}<span v-if="entry.time"> · {{ entry.time }}</span> — {{ entry.title }}</span
            >
          </li>
        </ul>
        <p v-else>Noch nichts geplant</p>
      </button>

      <!-- Packliste (zusammengefasst) -->
      <router-link to="/packing" class="card tile" :style="{ background: `${WIDGET_COLORS.get('packing')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('packing')}26`, borderColor: WIDGET_COLORS.get('packing') }">{{ SECTION_ICONS.packing }}</span>
        <h3>Packliste</h3>
        <BudgetMeter
          label="Gepackt"
          format="count"
          :spent="packingTotal.checked"
          :target="packingTotal.total"
          :color="WIDGET_COLORS.get('packing')!"
        />
        <ul class="mini-list breakdown">
          <li v-for="list in packingLists" :key="list.key">{{ list.avatar }} {{ list.title }}: {{ list.checked }}/{{ list.total }}</li>
        </ul>
      </router-link>

      <!-- Budget -->
      <router-link to="/budget" class="card tile" :style="{ background: `${WIDGET_COLORS.get('budget')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('budget')}26`, borderColor: WIDGET_COLORS.get('budget') }">{{ SECTION_ICONS.budget }}</span>
        <h3>Budget</h3>
        <BudgetMeter
          label="Ausgegeben"
          :spent="budgetSummary.spent"
          :target="budgetSummary.target"
          :color="WIDGET_COLORS.get('budget')!"
        />
      </router-link>

      <!-- Einkaufsliste -->
      <router-link to="/shopping" class="card tile" :style="{ background: `${WIDGET_COLORS.get('shopping')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('shopping')}26`, borderColor: WIDGET_COLORS.get('shopping') }">{{ SECTION_ICONS.shopping }}</span>
        <h3>Einkaufsliste</h3>
        <BudgetMeter
          label="Gekauft"
          format="count"
          :spent="shoppingProgress.checked"
          :target="shoppingProgress.total"
          :color="WIDGET_COLORS.get('shopping')!"
        />
      </router-link>

      <!-- ToDo -->
      <router-link to="/todo" class="card tile" :style="{ background: `${WIDGET_COLORS.get('todo')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('todo')}26`, borderColor: WIDGET_COLORS.get('todo') }">{{ SECTION_ICONS.todo }}</span>
        <h3>ToDo</h3>
        <BudgetMeter
          label="Erledigt"
          format="count"
          :spent="todoProgress.done"
          :target="todoProgress.total"
          :color="WIDGET_COLORS.get('todo')!"
        />
      </router-link>

      <!-- Reise (Fahrten/Flüge) -->
      <router-link to="/travel" class="card tile" :style="{ background: `${WIDGET_COLORS.get('travel')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('travel')}26`, borderColor: WIDGET_COLORS.get('travel') }">{{ SECTION_ICONS.travel }}</span>
        <h3>Reise</h3>
        <p v-if="nextTravelItem">{{ formatDate(nextTravelItem.date!) }} — {{ nextTravelItem.title }}</p>
        <p v-else-if="travelItems.length">{{ travelItems.length }} Einträge</p>
        <p v-else>Noch nichts eingetragen</p>
      </router-link>

      <!-- Unterkunft -->
      <router-link to="/accommodation" class="card tile" :style="{ background: `${WIDGET_COLORS.get('accommodation')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('accommodation')}26`, borderColor: WIDGET_COLORS.get('accommodation') }">{{ SECTION_ICONS.accommodation }}</span>
        <h3>Unterkunft</h3>
        <p v-if="currentOrNextAccommodation">
          {{ currentOrNextAccommodation.name }}<span v-if="currentOrNextAccommodation.start_date">
            · {{ formatDate(currentOrNextAccommodation.start_date) }}</span
          >
        </p>
        <p v-else>Noch nichts eingetragen</p>
      </router-link>

      <!-- Tagebuch -->
      <router-link to="/diary" class="card tile" :style="{ background: `${WIDGET_COLORS.get('diary')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('diary')}26`, borderColor: WIDGET_COLORS.get('diary') }">{{ SECTION_ICONS.diary }}</span>
        <h3>Tagebuch</h3>
        <p v-if="diaryEntries.length">{{ diaryEntries.length }} {{ diaryEntries.length === 1 ? 'Eintrag' : 'Einträge' }}<span v-if="latestDiaryEntry"> · zuletzt {{ formatDate(latestDiaryEntry.created_at) }}</span></p>
        <p v-else>Noch nichts geschrieben</p>
      </router-link>

      <!-- Notizen -->
      <router-link to="/notes" class="card tile" :style="{ background: `${WIDGET_COLORS.get('notes')}0d` }">
        <span class="tile-icon" :style="{ background: `${WIDGET_COLORS.get('notes')}26`, borderColor: WIDGET_COLORS.get('notes') }">{{ SECTION_ICONS.notes }}</span>
        <h3>Notizen</h3>
        <p v-if="notes.length">{{ notes.length }} {{ notes.length === 1 ? 'Notiz' : 'Notizen' }}</p>
        <p v-else>Noch nichts notiert</p>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  margin-bottom: var(--space-4);
  background: linear-gradient(135deg, var(--color-primary-tint), var(--color-surface));
  background-size: cover;
  background-position: center;
}

.hero.has-image {
  color: #fff;
}

.hero.has-image h1,
.hero.has-image .countdown {
  color: #fff;
}

.banner-edit-btn {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  font-size: 0.8rem;
  padding: 4px 10px;
}

.hero h1 {
  color: var(--color-primary-dark);
}

.countdown {
  color: var(--color-accent);
  font-weight: 600;
}

.cards {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  padding-top: 22px;
}

.tile {
  position: relative;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.tile-btn {
  width: 100%;
}

.tile-icon {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.tile h3 {
  color: var(--color-primary-dark);
  font-size: 1rem;
  margin-top: var(--space-2);
  text-align: center;
}

.tile > p {
  text-align: center;
  font-size: 0.88rem;
}

.mini-list {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  font-size: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 4px;
  /* Block als Ganzes bleibt mittig in der Kachel (wie h3/p daneben), schrumpft dabei aber auf
     die tatsächlich benötigte Breite – sonst würde .entry-text (flex:1, s.u.) über die volle
     Kachelbreite gestreckt und sein Text (per :left ausdrücklich statt vom <button>-Element der
     Kalender-Kachel geerbtem text-align:center) inhaltsabhängig unterschiedlich weit eingerückt
     wirken statt sauber untereinander auf einer Fluchtlinie zu stehen. */
  align-self: center;
  width: fit-content;
  max-width: 100%;
  text-align: left;
}

.mini-list li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.entry-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mini-list.breakdown {
  color: var(--color-text-muted);
  flex-wrap: wrap;
  flex-direction: row;
  gap: 4px 10px;
  /* Diese Variante (Zeilen-Umbruch statt vertikaler Liste) soll weiterhin die volle Kachelbreite
     nutzen können, nicht auf den engeren Fluchtlinien-Look der Kalender-Liste schrumpfen. */
  align-self: stretch;
  width: auto;
  max-width: none;
}

.mini-list.breakdown li {
  gap: 0;
}
</style>

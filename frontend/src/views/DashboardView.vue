<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useBudgetStore } from '../stores/budget';
import { useDrawersStore } from '../stores/drawers';
import { useUiSettingsStore } from '../stores/uiSettings';
import { useDashboardConfigStore } from '../stores/dashboardConfig';
import { WIDGET_COLORS, SECURITY_TILE_COLOR, TRASH_TILE_COLOR } from '../utils/widgetColors';
import { SCHEDULE_CATEGORY_META } from '../utils/scheduleCategory';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { ACCOMMODATION_ICON, SECURITY_CHECK_ICON } from '../utils/dashboardTiles';
import BudgetMeter from '../components/BudgetMeter.vue';
import ViewLoadingState from '../components/ViewLoadingState.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import DashboardHero from '../components/dashboard/DashboardHero.vue';
import DashboardWeatherCard from '../components/dashboard/DashboardWeatherCard.vue';
import DashboardTile from '../components/dashboard/DashboardTile.vue';
import DashboardNotesPreview from '../components/dashboard/DashboardNotesPreview.vue';
import DashboardTrashPreview from '../components/dashboard/DashboardTrashPreview.vue';
import DashboardAccommodationPreview from '../components/dashboard/DashboardAccommodationPreview.vue';
import DashboardDiaryPreview from '../components/dashboard/DashboardDiaryPreview.vue';
import DashboardSuitcasePreview from '../components/dashboard/DashboardSuitcasePreview.vue';
import DashboardShoppingPreview from '../components/dashboard/DashboardShoppingPreview.vue';
import DashboardTodoPreview from '../components/dashboard/DashboardTodoPreview.vue';
import DashboardBudgetPreview from '../components/dashboard/DashboardBudgetPreview.vue';
import DashboardTravelPreview from '../components/dashboard/DashboardTravelPreview.vue';
import DashboardCalendarPreview from '../components/dashboard/DashboardCalendarPreview.vue';
import DashboardSecurityPreview from '../components/dashboard/DashboardSecurityPreview.vue';

import { useTripCountdown } from '../composables/useTripCountdown';
import { useDashboardData } from '../composables/useDashboardData';
import { useDashboardTileSummaries } from '../composables/useDashboardTileSummaries';

const auth = useAuthStore();
const tripStore = useTripStore();
const budgetStore = useBudgetStore();
const drawers = useDrawersStore();
const uiSettings = useUiSettingsStore();
const dashboardConfig = useDashboardConfigStore();

const visibleTileKeys = computed(() =>
  dashboardConfig.entries.filter((e) => e.visible).map((e) => e.key)
);

const {
  trip,
  tripId,
  schedule,
  todos,
  packing,
  shopping,
  diaryEntries,
  notes,
  users,
  trashCount,
  travelItems,
  accommodations,
  loading,
  loadDashboardData,
} = useDashboardData();

const { departureCountdown, vacationPhase, isTripOver } = useTripCountdown(trip);

const {
  upcomingEntries,
  packingTotal,
  packingLists,
  shoppingProgress,
  todoProgress,
  nextTravelItem,
  currentOrNextAccommodation,
  latestDiaryEntry,
  formatDate,
} = useDashboardTileSummaries({
  trip,
  schedule,
  todos,
  packing,
  shopping,
  diaryEntries,
  travelItems,
  accommodations,
  users,
  currentUserId: computed(() => auth.user?.id),
});

function jumpToTrip() {
  tripStore.requestEditTrip();
}

onMounted(async () => {
  await loadDashboardData();
});
</script>

<template>
  <div class="page" v-if="!loading">
    <DashboardHero
      :trip="trip"
      :departure-countdown="departureCountdown"
      :vacation-phase="vacationPhase"
      :is-trip-over="isTripOver"
      :show-vacation-countdown="uiSettings.showVacationCountdown"
      @edit="jumpToTrip"
    />

    <DashboardWeatherCard v-if="trip" :trip="trip" :is-trip-over="isTripOver" />

    <div class="grid cards animate-cascade-children">
      <template v-for="key in visibleTileKeys" :key="key">
        <!-- Kalender: Desktop-Schublade bzw. Mobil-Seite /calendar (siehe drawers.openCalendar()),
             kein eigener router-link nötig, da die Kachel je nach Breite unterschiedlich navigieren muss -->
        <DashboardTile
          v-if="key === 'calendar'"
          :color="WIDGET_COLORS.get('schedule')!"
          :icon="SECTION_ICON_DEFS.calendar"
          title="Kalender"
          @click="drawers.openCalendar()"
        >
          <DashboardCalendarPreview :upcoming="upcomingEntries" />
          <ul v-if="upcomingEntries.length" class="mini-list">
            <li v-for="entry in upcomingEntries" :key="entry.key">
              <span
                class="mini-dot"
                :style="{ background: SCHEDULE_CATEGORY_META[entry.category].color }"
              ></span>
              <span class="entry-text"
                >{{ formatDate(entry.date) }}<span v-if="entry.time"> · {{ entry.time }}</span> —
                {{ entry.title }}</span
              >
            </li>
          </ul>
          <p v-else>Noch nichts geplant</p>
        </DashboardTile>

        <!-- Packliste (zusammengefasst) -->
        <DashboardTile
          v-else-if="key === 'packing'"
          :to="`/trip/${tripId}/listen?tab=packing`"
          :color="WIDGET_COLORS.get('packing')!"
          :icon="SECTION_ICON_DEFS.packing"
          title="Packliste"
        >
          <DashboardSuitcasePreview :packed="packingTotal.checked" :total="packingTotal.total" />
          <BudgetMeter
            label="Gepackt"
            format="count"
            :spent="packingTotal.checked"
            :target="packingTotal.total"
            :color="WIDGET_COLORS.get('packing')!"
          />
          <ul class="mini-list breakdown">
            <li v-for="list in packingLists" :key="list.key">
              {{ list.avatar }} {{ list.title }}: {{ list.checked }}/{{ list.total }}
            </li>
          </ul>
        </DashboardTile>

        <!-- Budget -->
        <DashboardTile
          v-else-if="key === 'budget'"
          :to="`/trip/${tripId}/budget`"
          :color="WIDGET_COLORS.get('budget')!"
          :icon="SECTION_ICON_DEFS.budget"
          title="Budget"
        >
          <DashboardBudgetPreview
            :spent="budgetStore.totalSpent"
            :target="budgetStore.grandTotal"
          />
          <BudgetMeter
            label="Ausgegeben"
            :spent="budgetStore.totalSpent"
            :target="budgetStore.grandTotal"
            :color="WIDGET_COLORS.get('budget')!"
          />
        </DashboardTile>

        <!-- Einkaufsliste -->
        <DashboardTile
          v-else-if="key === 'shopping'"
          :to="`/trip/${tripId}/listen?tab=shopping`"
          :color="WIDGET_COLORS.get('shopping')!"
          :icon="SECTION_ICON_DEFS.shopping"
          title="Einkaufsliste"
        >
          <DashboardShoppingPreview
            :checked="shoppingProgress.checked"
            :total="shoppingProgress.total"
          />
          <BudgetMeter
            label="Gekauft"
            format="count"
            :spent="shoppingProgress.checked"
            :target="shoppingProgress.total"
            :color="WIDGET_COLORS.get('shopping')!"
          />
        </DashboardTile>

        <!-- ToDo -->
        <DashboardTile
          v-else-if="key === 'todo'"
          :to="`/trip/${tripId}/listen?tab=todo`"
          :color="WIDGET_COLORS.get('todo')!"
          :icon="SECTION_ICON_DEFS.todo"
          title="ToDo"
        >
          <DashboardTodoPreview
            :todos="todos"
            :done="todoProgress.done"
            :total="todoProgress.total"
          />
          <BudgetMeter
            label="Erledigt"
            format="count"
            :spent="todoProgress.done"
            :target="todoProgress.total"
            :color="WIDGET_COLORS.get('todo')!"
          />
        </DashboardTile>

        <!-- Reise (Fahrten/Flüge) -->
        <DashboardTile
          v-else-if="key === 'travel'"
          :to="`/trip/${tripId}/excursions?group=tours&tourRole=arrival,departure,onward`"
          :color="WIDGET_COLORS.get('travel')!"
          :icon="SECTION_ICON_DEFS.travel"
          title="Reise"
        >
          <DashboardTravelPreview :next-item="nextTravelItem" :count="travelItems.length" />
          <p v-if="nextTravelItem">
            {{ formatDate(nextTravelItem.date!) }} — {{ nextTravelItem.title }}
          </p>
          <p v-else-if="travelItems.length">{{ travelItems.length }} Einträge</p>
          <p v-else>Noch nichts eingetragen</p>
        </DashboardTile>

        <!-- Unterkunft -->
        <DashboardTile
          v-else-if="key === 'accommodation'"
          :to="{
            path: `/trip/${tripId}/excursions`,
            query: { category: 'Unterkunft' },
            hash: currentOrNextAccommodation ? `#spot-${currentOrNextAccommodation.id}` : undefined,
          }"
          :color="WIDGET_COLORS.get('accommodation')!"
          :icon="ACCOMMODATION_ICON"
          title="Unterkunft"
        >
          <DashboardAccommodationPreview :accommodation="currentOrNextAccommodation" />
          <p v-if="currentOrNextAccommodation">
            {{ currentOrNextAccommodation.title
            }}<span v-if="currentOrNextAccommodation.start_date">
              · {{ formatDate(currentOrNextAccommodation.start_date) }}</span
            >
          </p>
          <p v-else-if="accommodations.length">{{ accommodations.length }} Einträge</p>
          <p v-else>Noch nichts eingetragen</p>
        </DashboardTile>

        <!-- Tagebuch -->
        <DashboardTile
          v-else-if="key === 'diary'"
          :to="`/trip/${tripId}/diary`"
          :color="WIDGET_COLORS.get('diary')!"
          :icon="SECTION_ICON_DEFS.diary"
          title="Tagebuch"
        >
          <DashboardDiaryPreview :entries="diaryEntries" :latest-entry="latestDiaryEntry" />
          <p v-if="diaryEntries.length">
            {{ diaryEntries.length }} {{ diaryEntries.length === 1 ? 'Eintrag' : 'Einträge'
            }}<span v-if="latestDiaryEntry">
              · zuletzt {{ formatDate(latestDiaryEntry.date) }}</span
            >
          </p>
          <p v-else>Noch nichts geschrieben</p>
        </DashboardTile>

        <!-- Notizen -->
        <DashboardTile
          v-else-if="key === 'notes'"
          :to="`/trip/${tripId}/notes`"
          :color="WIDGET_COLORS.get('notes')!"
          :icon="SECTION_ICON_DEFS.notes"
          title="Notizen"
        >
          <DashboardNotesPreview :notes="notes" />
          <p v-if="notes.length">
            {{ notes.length }} {{ notes.length === 1 ? 'Notiz' : 'Notizen' }}
          </p>
          <p v-else>Noch nichts notiert</p>
        </DashboardTile>

        <!-- Sicherheits-Check -->
        <DashboardTile
          v-else-if="key === 'securityCheck'"
          to="/security-check"
          :color="SECURITY_TILE_COLOR"
          :icon="SECURITY_CHECK_ICON"
          title="Sicherheits-Check"
        >
          <DashboardSecurityPreview :destination="trip?.destination" />
          <p>Der Reisotor scannt eure Reiseregion 🤖🔍</p>
        </DashboardTile>

        <!-- Papierkorb -->
        <DashboardTile
          v-else-if="key === 'trash'"
          :to="`/trip/${tripId}/trash`"
          :color="TRASH_TILE_COLOR"
          :icon="ACTION_ICONS.delete"
          title="Papierkorb"
        >
          <DashboardTrashPreview :count="trashCount" />
          <p v-if="trashCount > 0">
            {{ trashCount }} gelöschte{{ trashCount === 1 ? 's Objekt' : ' Objekte' }}
          </p>
          <p v-else>Der Papierkorb ist leer</p>
        </DashboardTile>
      </template>
    </div>
  </div>
  <ViewLoadingState v-else />
</template>

<style scoped>
.cards {
  grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr));
  padding-top: 22px;
  /* Zeilenabstand größer als der globale .grid-Standard (--space-3, 16px): .tile-icon ragt
     über den oberen Rand seiner eigenen Kachel hinaus (44px Kreis-Icon, 22px halb über die Kachel)
     - bei nur 16px Zeilenabstand überdeckt es damit die Kachel der Zeile darüber.
     --space-5 lässt dafür ausreichend Luft; Spaltenabstand bleibt beim Standardwert --space-3. */
  row-gap: var(--space-5);
  column-gap: var(--space-3);
}

.mini-list {
  list-style: none;
  margin: var(--space-1) 0 0;
  padding: 0;
  font-size: var(--font-size-xs);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
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
  gap: var(--space-1);
}

.entry-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.mini-list.breakdown {
  color: var(--color-text-muted);
  flex-wrap: wrap;
  flex-direction: row;
  gap: var(--space-1) var(--space-2);
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

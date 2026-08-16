<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PackingListView from './PackingListView.vue';
import ShoppingListView from './ShoppingListView.vue';
import TodoView from './TodoView.vue';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import { useLiveSyncStore, type LiveDomain } from '../stores/liveSync';
import TabBar, { type TabBarItem } from '../components/TabBar.vue';

// Zusammengeführte Ansicht für Packliste/Einkauf/ToDo (bisher drei eigene NavBar-Einträge/Routen) -
// spart NavBar-Platz, ohne die drei Views selbst anzufassen: sie werden unverändert je nach aktivem
// Tab gemountet (v-if statt v-show, damit beim Tab-Wechsel derselbe frische onMounted()-Ablauf wie
// bisher beim Routenwechsel läuft, u. a. liveSync.markSeen()). Aktiver Tab steckt im Query-Param
// statt im Pfad (router.replace statt push, damit Tab-Klicks nicht einzeln in die Browser-History
// wandern) - /packing, /shopping, /todo redirecten hierher (siehe router/index.ts).
type Tab = 'packing' | 'shopping' | 'todo';
// domain: LiveDomain-Key des Tabs - 'todo' (Tab) vs. 'todos' (Domäne) heißen bewusst
// unterschiedlich, siehe stores/liveSync.ts's LIVE_DOMAINS.
const TABS: { key: Tab; label: string; domain: LiveDomain }[] = [
  { key: 'packing', label: 'Packliste', domain: 'packing' },
  { key: 'shopping', label: 'Einkauf', domain: 'shopping' },
  { key: 'todo', label: 'ToDo', domain: 'todos' },
];

const liveSync = useLiveSyncStore();

const route = useRoute();
const router = useRouter();

const activeTab = computed<Tab>(() => {
  const tab = route.query.tab;
  return tab === 'shopping' || tab === 'todo' ? tab : 'packing';
});

// Icon/unseen-Status für die gemeinsame TabBar-Komponente aufgelöst statt roher SECTION_ICON_DEFS -
// diese Komponente (statt der bisherigen, lokal duplizierten Gleit-Unterstreichungs-Logik) wird
// jetzt auch von ProfileView.vue genutzt (siehe dortiger Kommentar zur Redundanz, Issue #71).
const tabBarItems = computed<TabBarItem[]>(() =>
  TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    icon: SECTION_ICON_DEFS[tab.key],
    unseen: liveSync.hasUnseen(tab.domain),
  })),
);

function selectTab(tab: string) {
  router.replace({ query: { ...route.query, tab: tab as Tab } });
}
</script>

<template>
  <div class="listen-view">
    <div class="tab-bar-wrap">
      <TabBar :tabs="tabBarItems" :active-key="activeTab" @select="selectTab" />
    </div>

    <PackingListView v-if="activeTab === 'packing'" />
    <ShoppingListView v-else-if="activeTab === 'shopping'" />
    <TodoView v-else-if="activeTab === 'todo'" />
  </div>
</template>

<style scoped>
.tab-bar-wrap {
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4) 0;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PackingListView from './PackingListView.vue';
import ShoppingListView from './ShoppingListView.vue';
import TodoView from './TodoView.vue';
import { SECTION_ICONS } from '../utils/sectionIcons';
import { useLiveSyncStore, type LiveDomain } from '../stores/liveSync';

// Zusammengeführte Ansicht für Packliste/Einkauf/ToDo (bisher drei eigene NavBar-Einträge/Routen) -
// spart NavBar-Platz, ohne die drei Views selbst anzufassen: sie werden unverändert je nach aktivem
// Tab gemountet (v-if statt v-show, damit beim Tab-Wechsel derselbe frische onMounted()-Ablauf wie
// bisher beim Routenwechsel läuft, u. a. liveSync.markSeen()). Aktiver Tab steckt im Query-Param
// statt im Pfad (router.replace statt push, damit Tab-Klicks nicht einzeln in die Browser-History
// wandern) - /packing, /shopping, /todo redirecten hierher (siehe router/index.ts).
type Tab = 'packing' | 'shopping' | 'todo';
// domain: LiveDomain-Key des Tabs - 'todo' (Tab) vs. 'todos' (Domäne) heißen bewusst
// unterschiedlich, siehe stores/liveSync.ts's LIVE_DOMAINS.
const TABS: { key: Tab; label: string; icon: string; domain: LiveDomain }[] = [
  { key: 'packing', label: 'Packliste', icon: SECTION_ICONS.packing, domain: 'packing' },
  { key: 'shopping', label: 'Einkauf', icon: SECTION_ICONS.shopping, domain: 'shopping' },
  { key: 'todo', label: 'ToDo', icon: SECTION_ICONS.todo, domain: 'todos' },
];

const liveSync = useLiveSyncStore();

const route = useRoute();
const router = useRouter();

const activeTab = computed<Tab>(() => {
  const tab = route.query.tab;
  return tab === 'shopping' || tab === 'todo' ? tab : 'packing';
});

function selectTab(tab: Tab) {
  router.replace({ query: { ...route.query, tab } });
}
</script>

<template>
  <div class="listen-view">
    <div class="tab-bar" role="tablist">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        type="button"
        class="tab"
        role="tab"
        :class="{ active: activeTab === tab.key }"
        :aria-selected="activeTab === tab.key"
        @click="selectTab(tab.key)"
      >
        <span class="icon-wrap">
          <span class="icon">{{ tab.icon }}</span>
          <span v-if="liveSync.hasUnseen(tab.domain)" class="unseen-dot" aria-label="Neue Änderungen" />
        </span>
        {{ tab.label }}
      </button>
    </div>

    <PackingListView v-if="activeTab === 'packing'" />
    <ShoppingListView v-else-if="activeTab === 'shopping'" />
    <TodoView v-else-if="activeTab === 'todo'" />
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: var(--space-2);
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-3) var(--space-4) 0;
  border-bottom: 1px solid var(--color-border);
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  cursor: pointer;
}

.tab.active {
  color: var(--color-primary-dark);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.tab .icon {
  font-size: 1.1rem;
}

.icon-wrap {
  position: relative;
  display: inline-flex;
}

/* Gleiches Aussehen wie NavBar.vue's .unseen-dot (eigener scoped Style, da Vue-Styles nicht
   komponentenübergreifend gelten). */
.unseen-dot {
  position: absolute;
  top: -2px;
  right: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 1.5px solid var(--color-surface);
}
</style>

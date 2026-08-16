<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import type { IconDef } from '../utils/icon';

// Gemeinsame Tab-Leiste mit gleitender Unterstreichung (JS-gemessene offsetLeft/offsetWidth des
// aktiven .tab statt eines starren CSS-Grids, da Tab-Label unterschiedlich breit sind) - vorher an
// mindestens zwei Stellen (ListenView.vue, ProfileView.vue) unabhängig voneinander implementiert.
// Genau diese Redundanz führte dazu, dass ProfileView's Kopie beim Bau nie die Gleit-Animation
// bekam (nur ein hart umschaltender border-bottom, siehe Issue #71) - ListenView.vue's Fassung war
// die einzige, die die Animation tatsächlich hatte. Ein einzelner gemeinsamer Ort für dieses Muster
// macht ein "geht hier, geht dort nicht" wie dieses strukturell unmöglich.
export interface TabBarItem {
  key: string;
  label: string;
  icon: IconDef;
  // Roter Punkt für "seit dem letzten Besuch geändert" (liveSync.ts) - vom aufrufenden View bereits
  // aufgelöst übergeben, damit diese Komponente selbst keine Kenntnis von liveSync/Domains braucht.
  unseen?: boolean;
}

const props = defineProps<{ tabs: TabBarItem[]; activeKey: string }>();
const emit = defineEmits<{ select: [key: string] }>();

const tabBarEl = ref<HTMLElement | null>(null);
const underlineLeft = ref(0);
const underlineWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;

function updateUnderline() {
  const activeEl = tabBarEl.value?.querySelector<HTMLElement>('.tab.active');
  if (!activeEl) return;
  underlineLeft.value = activeEl.offsetLeft;
  underlineWidth.value = activeEl.offsetWidth;
}

onMounted(() => {
  nextTick(updateUnderline);
  resizeObserver = new ResizeObserver(updateUnderline);
  if (tabBarEl.value) resizeObserver.observe(tabBarEl.value);
});

onUnmounted(() => resizeObserver?.disconnect());

watch(() => props.activeKey, () => nextTick(updateUnderline));
watch(() => props.tabs, () => nextTick(updateUnderline));

// Scrollt einen angeklickten, teils außerhalb der (bei vielen Tabs horizontal scrollenden) Leiste
// liegenden Tab vollständig in Sicht - gleiches Muster wie NavBar.vue's onLinkClick().
function onTabClick(key: string, event: MouseEvent) {
  emit('select', key);
  (event.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}
</script>

<template>
  <div class="tab-bar" role="tablist" ref="tabBarEl">
    <button
      v-for="tab in tabs"
      :key="tab.key"
      type="button"
      class="tab"
      role="tab"
      :class="{ active: activeKey === tab.key }"
      :aria-selected="activeKey === tab.key"
      @click="onTabClick(tab.key, $event)"
    >
      <span class="icon-wrap">
        <AppIcon class="icon" :icon="tab.icon" :size="16" group="navigation" />
        <span v-if="tab.unseen" class="unseen-dot" aria-label="Neue Änderungen" />
      </span>
      {{ tab.label }}
    </button>
    <span
      class="tab-underline"
      :style="{ transform: `translateX(${underlineLeft}px)`, width: `${underlineWidth}px` }"
      aria-hidden="true"
    ></span>
  </div>
</template>

<style scoped>
.tab-bar {
  position: relative;
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  /* Scrollbar statt umbrechend, wenn zu viele/zu lange Tab-Label für die verfügbare Breite reichen
     (z. B. ProfileView.vue's 6 Tabs) - gleiches Muster wie NavBar.vue's mobile Scroll-Leiste, statt
     die Tabs auf mehrere Zeilen umbrechen zu lassen. */
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
  padding: var(--space-2) var(--space-3);
  border: none;
  /* Bleibt als reiner Platzhalter (Farbe kommt von .tab-underline) - ohne das würde der Tab beim
     Wechsel 2px in der Höhe springen. */
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  white-space: nowrap;
  cursor: pointer;
}

.tab.active {
  color: var(--color-primary-dark);
  font-weight: 600;
}

/* Gleitet per transform/width zum jeweils aktiven Tab statt die Farbe hart umzuschalten - gleiches
   Prinzip wie NavBar.vue's .nav-highlight (dortiger Kommentar für die Begründung, warum JS-gemessene
   Positionen statt eines starren CSS-Grids nötig sind: unterschiedlich breite Tab-Label). */
.tab-underline {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--color-primary);
  border-radius: 2px 2px 0 0;
  transition: transform 0.2s ease, width 0.2s ease;
  pointer-events: none;
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

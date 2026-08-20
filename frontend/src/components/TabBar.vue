<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
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

// Klick-Pfeile statt sichtbarem nativen Scrollbalken, wenn mehr Tabs da sind als Platz (#144 -
// zunächst nur in ExcursionsView.vue's separat implementierter .category-nav behoben, dabei aber
// die hier gemeinsam genutzte TabBar.vue vergessen, siehe Issue-Kommentar: genau diese Inkonsistenz
// soll durch EINEN gemeinsamen Ort für das Muster nicht mehr passieren können). 1px Toleranz statt
// exaktem Vergleich - scrollWidth/scrollLeft/clientWidth landen bei fraktionaler Geräte-Pixel-
// Skalierung nicht immer exakt auf demselben Wert, obwohl visuell schon ganz durchgescrollt.
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
function updateScrollArrows() {
  const el = tabBarEl.value;
  if (!el) return;
  canScrollLeft.value = el.scrollLeft > 1;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
}
function scrollBy(direction: 1 | -1) {
  const el = tabBarEl.value;
  if (!el) return;
  el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.7), behavior: 'smooth' });
}

onMounted(() => {
  nextTick(() => {
    updateUnderline();
    updateScrollArrows();
  });
  resizeObserver = new ResizeObserver(() => {
    updateUnderline();
    updateScrollArrows();
  });
  if (tabBarEl.value) resizeObserver.observe(tabBarEl.value);
});

onUnmounted(() => resizeObserver?.disconnect());

watch(() => props.activeKey, () => nextTick(updateUnderline));
watch(
  () => props.tabs,
  () => nextTick(() => {
    updateUnderline();
    updateScrollArrows();
  }),
);

// Scrollt einen angeklickten, teils außerhalb der (bei vielen Tabs horizontal scrollenden) Leiste
// liegenden Tab vollständig in Sicht - gleiches Muster wie NavBar.vue's onLinkClick().
function onTabClick(key: string, event: MouseEvent) {
  emit('select', key);
  (event.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
}
</script>

<template>
  <div class="tab-bar-scroller">
    <div class="tab-bar" role="tablist" ref="tabBarEl" @scroll="updateScrollArrows">
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
    <!-- Dezente Klick-Flächen mit Verlauf statt eines vollflächigen, hart abgesetzten Buttons (#144)
         - nur sichtbar, wenn in die jeweilige Richtung tatsächlich noch etwas zu scrollen ist. -->
    <button
      v-if="canScrollLeft"
      type="button"
      class="tab-bar-arrow left"
      aria-label="Tabs nach links scrollen"
      @click="scrollBy(-1)"
    >
      <AppIcon :icon="ACTION_ICONS.scrollLeft" :size="16" group="actions" />
    </button>
    <button
      v-if="canScrollRight"
      type="button"
      class="tab-bar-arrow right"
      aria-label="Tabs nach rechts scrollen"
      @click="scrollBy(1)"
    >
      <AppIcon :icon="ACTION_ICONS.scrollRight" :size="16" group="actions" />
    </button>
  </div>
</template>

<style scoped>
.tab-bar-scroller {
  position: relative;
}

.tab-bar {
  position: relative;
  display: flex;
  gap: var(--space-2);
  border-bottom: 1px solid var(--color-border);
  /* Scrollbar statt umbrechend, wenn zu viele/zu lange Tab-Label für die verfügbare Breite reichen
     (z. B. ProfileView.vue's 6 Tabs) - gleiches Muster wie NavBar.vue's mobile Scroll-Leiste, statt
     die Tabs auf mehrere Zeilen umbrechen zu lassen. */
  overflow-x: auto;
  overflow-y: hidden;
  /* Nativer Scrollbalken wirkte zusammen mit der gleitenden Unterstreichung (.tab-underline unten)
     unruhig/doppelt gemoppelt (#144) - die beiden Klick-Pfeile (Template) übernehmen die
     Scrollbarkeit stattdessen sichtbar/bedienbar, ohne den permanent sichtbaren Balken.
     scrollbar-width für Firefox, ::-webkit-scrollbar für Chrome/Safari - kein Standard-CSS für
     beide zugleich. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

/* Dezente Klick-Fläche mit Verlauf statt eines vollflächigen, hart abgesetzten Buttons (#144) - der
   Farbverlauf zum jeweiligen Rand hin lässt das letzte teils sichtbare Tab-Label unter dem Pfeil
   sanft ausblenden statt hart abzuschneiden. Volle Höhe des Scrollers (top/bottom:0) statt nur
   Icon-Größe, damit die Klickfläche nicht winzig ausfällt. Feste --color-bg (statt einer am
   Stuck-Zustand hängenden Variable wie ExcursionsView.vue's --category-nav-bg) reicht hier, da
   TabBar.vue anders als die dortige Kategorie-Nav nirgends sticky eingesetzt wird. */
.tab-bar-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  width: 32px;
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
}

.tab-bar-arrow:hover {
  color: var(--color-primary-dark);
}

.tab-bar-arrow.left {
  left: 0;
  justify-content: flex-start;
  padding-left: 4px;
  background: linear-gradient(to right, var(--color-bg) 45%, transparent);
}

.tab-bar-arrow.right {
  right: 0;
  justify-content: flex-end;
  padding-right: 4px;
  background: linear-gradient(to left, var(--color-bg) 45%, transparent);
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
  /* Explizit zurückgesetzt statt sich auf style.css's globale button-Regel zu verlassen (#95 gab
     jedem <button> per Default einen Schatten) - ein flaches Tab-Item einer
     Tab-Unterstreichungs-Leiste braucht keinen, sonst wirkt jedes Item wie eine eigene erhobene
     Karte statt Teil einer gemeinsamen Leiste. */
  box-shadow: none;
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

<script setup lang="ts">
import { ref } from 'vue';
import { MAX_DRAWER_WIDTH, MIN_DRAWER_WIDTH } from '../stores/drawers';

const props = defineProps<{ side: 'left' | 'right'; open: boolean; label: string; icon: string; width: number }>();
const emit = defineEmits<{ (e: 'update:open', value: boolean): void; (e: 'update:width', value: number): void }>();

function toggle() {
  emit('update:open', !props.open);
}

// Anfasser zum Grösser-/Kleinerziehen der Schublade (Pointer Events statt separater Maus-/Touch-
// Handler, damit derselbe Code auch auf Tablets funktioniert).
const resizing = ref(false);
let startX = 0;
let startWidth = 0;

function onResizeStart(event: PointerEvent) {
  resizing.value = true;
  startX = event.clientX;
  startWidth = props.width;
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeEnd);
  event.preventDefault();
}

function onResizeMove(event: PointerEvent) {
  if (!resizing.value) return;
  const delta = event.clientX - startX;
  // Linke Schublade: nach rechts ziehen vergrößert. Rechte Schublade: nach links ziehen vergrößert.
  const signedDelta = props.side === 'left' ? delta : -delta;
  const next = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, startWidth + signedDelta));
  emit('update:width', next);
}

function onResizeEnd() {
  resizing.value = false;
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeEnd);
}
</script>

<template>
  <div class="drawer" :class="[side, { open }]" :style="{ '--drawer-width': `${width}px` }">
    <div class="drawer-backdrop" v-if="open" @click="emit('update:open', false)"></div>
    <div class="drawer-panel">
      <div
        v-if="open"
        class="resize-handle"
        role="separator"
        aria-orientation="vertical"
        :aria-label="`${label}-Schublade in der Breite anpassen`"
        @pointerdown="onResizeStart"
      ></div>
      <div class="drawer-content"><slot /></div>
    </div>
    <button
      type="button"
      class="drawer-tab"
      :aria-expanded="open"
      :aria-label="(open ? 'Schließen: ' : 'Öffnen: ') + label"
      @click="toggle"
    >
      <span class="tab-icon">{{ icon }}</span>
      <span class="tab-label">{{ label }}</span>
    </button>
  </div>
</template>

<style scoped>
/* Mobil (Default): Panel als fixed Overlay, Tab bleibt als touch-tauglicher Griff permanent am
   Bildschirmrand sichtbar. Wächst zusätzlich bei Hover (Desktop-Maus) für präziseres Klicken,
   ohne die Grundgröße dauerhaft so groß zu machen, dass sie Inhalte am Rand überlagert. */
.drawer-tab {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  z-index: 13;
  min-height: 72px;
  width: 32px;
  padding: 8px 3px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: left 0.25s ease, right 0.25s ease, width 0.15s ease, min-height 0.15s ease, transform 0.15s ease;
}

.drawer-tab:hover {
  width: 46px;
  min-height: 84px;
  color: var(--color-primary-dark);
}

.drawer.left .drawer-tab {
  left: 0;
  border-left: none;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.drawer.right .drawer-tab {
  right: 0;
  border-right: none;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
}

.drawer.left.open .drawer-tab {
  left: min(85vw, var(--drawer-width));
}

.drawer.right.open .drawer-tab {
  right: min(85vw, var(--drawer-width));
}

.tab-icon {
  font-size: 1.1rem;
  line-height: 1;
}

.tab-label {
  font-size: 0.62rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  white-space: nowrap;
}

.drawer-backdrop {
  position: fixed;
  top: 56px;
  bottom: 60px;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 11;
}

.drawer-panel {
  position: fixed;
  top: 56px;
  bottom: 60px;
  width: min(85vw, var(--drawer-width));
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
  z-index: 12;
  overflow-y: auto;
  transition: transform 0.25s ease;
}

.drawer.left .drawer-panel {
  left: 0;
  transform: translateX(-100%);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
}

.drawer.right .drawer-panel {
  right: 0;
  transform: translateX(100%);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.drawer.open .drawer-panel {
  transform: translateX(0);
}

.drawer-content {
  min-height: 100%;
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  z-index: 14;
  cursor: col-resize;
  touch-action: none;
}

.resize-handle::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 4px;
  width: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background 0.15s ease;
}

.resize-handle:hover::after {
  background: var(--color-primary);
}

.drawer.left .resize-handle {
  right: -5px;
}

.drawer.right .resize-handle {
  left: -5px;
}

/* Desktop: Panel wird echtes Flex-Geschwisterelement (schiebt den Arbeitsbereich zur Seite),
   kein Overlay/Backdrop mehr. App.vue setzt display:flex auf den umgebenden .app-shell-Container;
   die Reihenfolge der Flex-Kinder (Tab vs. Panel) steuert `order` statt DOM-Reihenfolge. */
@media (min-width: 800px) {
  .drawer {
    display: flex;
    align-items: stretch;
  }

  .drawer-backdrop {
    display: none;
  }

  .drawer-tab {
    position: static;
    top: auto;
    transform: none;
    min-height: auto;
    align-self: center;
  }

  /* Auf Desktop ist der Tab ein echtes Flex-Geschwisterelement neben dem Hauptinhalt – eine
     Breitenänderung bei Hover (wie mobil) würde den Arbeitsbereich seitlich verschieben. Der
     Vergrößerungseffekt läuft hier stattdessen rein visuell über transform:scale(), das nimmt
     keinen Platz im Flex-Layout ein und schiebt daher nichts. */
  .drawer-tab:hover {
    width: 32px;
    min-height: auto;
    transform: scale(1.4);
  }

  .drawer.left .drawer-tab:hover {
    transform-origin: left center;
  }

  .drawer.right .drawer-tab:hover {
    transform-origin: right center;
  }

  .drawer.left .drawer-tab {
    order: 2;
  }
  .drawer.right .drawer-tab {
    order: 1;
  }

  .drawer-panel {
    position: relative;
    top: auto;
    bottom: auto;
    transform: none;
    box-shadow: none;
    border-radius: 0;
    width: var(--drawer-width);
    transition: width 0.25s ease, opacity 0.2s ease;
  }
  .drawer.left .drawer-panel {
    order: 1;
    border-right: 1px solid var(--color-border);
  }
  .drawer.right .drawer-panel {
    order: 2;
    border-left: 1px solid var(--color-border);
  }

  .drawer:not(.open) .drawer-panel {
    width: 0;
    opacity: 0;
    overflow: hidden;
    pointer-events: none;
    border: none;
  }
}
</style>

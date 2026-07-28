<script setup lang="ts">
import { computed } from 'vue';
import type { DerivedLocation } from '../utils/derivedLocation';

const props = defineProps<{ location: DerivedLocation }>();

// Kein eigener Edit-/Löschen-/Like-/Kommentar-Button: der Ort selbst gehört nicht dieser Sicht
// (bearbeitet wird er in der Unterkunft-/Reise-Sicht), daher nur ein Sprung-Button dorthin.
const jumpTarget = computed(() =>
  props.location.category === 'Unterkunft' ? { to: '/accommodation', label: 'Zur Unterkunft' } : { to: '/travel', label: 'Zur Reise' },
);

// Weiterhin per Drag&Drop einer Tour als Station hinzufügbar (ExcursionCard.vue ist die
// Drop-Zone) – dasselbe Format wie zuvor im ausgeklappten Panel. Startet über einen dedizierten
// Anfasser (.excursion-drag-handle, siehe Template), analog zu SpotCard.vue.
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/derived-location', JSON.stringify(props.location));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <div class="card derived-card">
    <div class="image">
      <span class="placeholder">{{ location.icon }}</span>
    </div>
    <div class="body">
      <h3>{{ location.title }}</h3>
      <div class="links">
        <router-link :to="jumpTarget.to" class="card-action-btn">{{ jumpTarget.label }}</router-link>
      </div>
      <button
        type="button"
        class="excursion-drag-handle"
        draggable="true"
        aria-label="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        title="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        @dragstart="onDragStart"
      >
        🎒 Auf Tour ziehen
      </button>
    </div>
  </div>
</template>

<style scoped>
.derived-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.image {
  height: 120px;
  background: var(--color-primary-tint);
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder {
  font-size: 2.2rem;
}

.body {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.body h3 {
  margin: 0;
  font-size: 1rem;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

/* Eigener Anfasser statt der ganzen Karte als Drag-Quelle (identisches Muster wie
   SpotCard.vue) – das ::before-Punkte-Raster macht ihn auf einen Blick als Zieh-Griff statt als
   normalen Button erkennbar. */
.excursion-drag-handle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  background: var(--color-hover);
  border: none;
  border-radius: 999px;
  padding: 3px 10px 3px 8px;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
  cursor: grab;
  -webkit-user-select: none;
  user-select: none;
}

.excursion-drag-handle::before {
  content: '';
  flex-shrink: 0;
  width: 6px;
  height: 12px;
  background-image: radial-gradient(circle, currentColor 1px, transparent 1.3px),
    radial-gradient(circle, currentColor 1px, transparent 1.3px);
  background-size: 3px 4px, 3px 4px;
  background-position: 0 0, 3px 0;
  background-repeat: repeat-y, repeat-y;
  opacity: 0.6;
}

.excursion-drag-handle:active {
  cursor: grabbing;
}

/* Kompakte Listen-Zeile statt Miniatur-Card auf schmalen Bildschirmen (Bottom-Sheet auf Mobil,
   siehe ExcursionsView.vue) – gleiches Prinzip wie SpotCard.vue, hier einfacher da ohne
   Aufklapp-Zustand: der Anfasser (seltener gebraucht als der Sprung-Link) entfällt kompakt,
   Titel/Sprung-Link bleiben sichtbar. */
@media (max-width: 899px) {
  .derived-card {
    flex-direction: row;
    align-items: stretch;
  }

  .image {
    width: 64px;
    height: auto;
    flex-shrink: 0;
  }

  .body {
    padding: var(--space-2);
    gap: 2px;
  }

  .excursion-drag-handle {
    display: none;
  }
}
</style>

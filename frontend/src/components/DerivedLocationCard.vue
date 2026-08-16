<script setup lang="ts">
import { computed } from 'vue';
import type { DerivedLocation } from '../utils/derivedLocation';
import { useDrawersStore } from '../stores/drawers';
import { SECTION_ICON_DEFS } from '../utils/sectionIcons';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ location: DerivedLocation }>();
const drawers = useDrawersStore();

// Kein eigener Edit-/Löschen-/Like-/Kommentar-Button: der Ort selbst gehört nicht dieser Sicht
// (bearbeitet wird er in der Reise-Sicht), daher nur ein Sprung-Button dorthin. Unterkunft ist seit
// der Verschmelzung in Spots (siehe Migrationskommentar in db/index.ts) ein echter Spot statt eines
// abgeleiteten Orts, daher erzeugt travelDerivedLocations.ts nur noch die Kategorie 'Reise'.
const jumpTarget = computed(() => ({ to: '/travel', label: 'Zur Reise' }));

// Klick auf die Karte öffnet den Ort auf der Karte, genau wie bei einem "echten" Spot (SpotCard.vue)
// – location.key ist bereits derselbe generische Schlüssel, den drawers.openMapAt/TripMap.vue für
// Reise-Punkte erwarten (travel-from-<id>/travel-to-<id>).
function showOnMap() {
  drawers.openMapAt(props.location.key);
}

// Weiterhin per Drag&Drop einer Tour als Station hinzufügbar (ExcursionCard.vue ist die
// Drop-Zone) – dasselbe Format wie zuvor im ausgeklappten Panel. Startet über einen dedizierten
// Anfasser (.excursion-drag-handle, siehe Template), analog zu SpotCard.vue.
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/derived-location', JSON.stringify(props.location));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <div class="card derived-card" @click="showOnMap">
    <div class="image">
      <AppIcon class="placeholder" :size="35" :icon="location.tabler" group="categories" />
    </div>
    <div class="body">
      <h3>{{ location.title }}</h3>
      <div class="links">
        <router-link :to="jumpTarget.to" class="card-action-btn" @click.stop>{{ jumpTarget.label }}</router-link>
      </div>
      <button
        type="button"
        class="excursion-drag-handle"
        draggable="true"
        aria-label="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        title="Auf eine Tour ziehen, um sie dort als Station hinzuzufügen"
        @dragstart="onDragStart"
        @click.stop
      >
        <AppIcon :icon="SECTION_ICON_DEFS.excursions" :size="14" group="navigation" /> Auf Tour ziehen
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
  cursor: pointer;
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
  corner-shape: round;
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

/* Kompakte Listen-Zeile statt Miniatur-Card auf schmalen .spots-col-Breiten – gleiches Prinzip wie
   SpotCard.vue (dort auch die Begründung für Container-Query statt @media und den Schwellenwert,
   muss mit dort übereinstimmen), hier einfacher da ohne Aufklapp-Zustand: der Anfasser (seltener
   gebraucht als der Sprung-Link) entfällt kompakt, Titel/Sprung-Link bleiben sichtbar. */
@container spots-col (max-width: 480px) {
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
    /* Gleicher Fix wie SpotCard.vue's identisches .body in derselben Kompakt-Zeile: ohne
       min-width:0 bleibt .body (jetzt Flex-Item in der Zeile statt in der Spalte) auf seiner
       automatischen, vom langen Titel bestimmten Mindestbreite stehen und ragt seitlich über den
       Bildschirmrand hinaus, statt der h3-Ellipsis das Kürzen zu erlauben. */
    min-width: 0;
  }

  .excursion-drag-handle {
    display: none;
  }
}
</style>

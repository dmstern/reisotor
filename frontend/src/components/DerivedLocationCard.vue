<script setup lang="ts">
import { computed } from 'vue';
import type { DerivedLocation } from '../utils/derivedLocation';

const props = defineProps<{ location: DerivedLocation }>();

// Kein eigener Edit-/Löschen-/Like-/Kommentar-Button: der Ort selbst gehört nicht dieser Sicht
// (bearbeitet wird er in der Unterkunft-/Reise-Sicht), daher nur ein Sprung-Button dorthin.
const jumpTarget = computed(() =>
  props.location.category === 'Unterkunft' ? { to: '/accommodation', label: 'Zur Unterkunft' } : { to: '/travel', label: 'Zur Reise' },
);

// Weiterhin per Drag&Drop einem Ausflug als Station hinzufügbar (ExcursionCard.vue ist die
// Drop-Zone) – dasselbe Format wie zuvor im ausgeklappten Panel.
function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData('text/derived-location', JSON.stringify(props.location));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
}
</script>

<template>
  <div class="card derived-card" draggable="true" @dragstart="onDragStart">
    <div class="image">
      <span class="placeholder">{{ location.icon }}</span>
    </div>
    <div class="body">
      <h3>{{ location.title }}</h3>
      <div class="links">
        <router-link :to="jumpTarget.to" class="card-action-btn">{{ jumpTarget.label }}</router-link>
      </div>
      <span class="drag-hint">↕ auf einen Ausflug ziehen, um ihn dort als Station hinzuzufügen</span>
    </div>
  </div>
</template>

<style scoped>
.derived-card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: grab;
}

.derived-card:active {
  cursor: grabbing;
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

.drag-hint {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  margin-top: var(--space-1);
}
</style>

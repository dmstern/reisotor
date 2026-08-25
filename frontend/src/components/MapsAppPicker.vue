<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';

// Eigenständige Komponente (Spot/Unterkunft/Reise): zeigt ein Auswahl-Menü der gängigen Karten-Apps.
// Nutzt saubere CSS-Relative-Positionierung statt Teleport/JS-Koordinatenberechnung (#285).
const props = defineProps<{ lat: number; lng: number; title: string; mapsLink?: string | null }>();
const open = ref(false);
</script>

<template>
  <div class="maps-picker" @click.stop>
    <button type="button" class="card-action-btn" @click="open = !open">
      <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> In Karten-App öffnen ↗
    </button>
    <div v-if="open" class="picker-backdrop" @click="open = false"></div>
    <div v-if="open" class="picker-menu">
      <a
        :href="`https://maps.apple.com/?ll=${props.lat},${props.lng}&q=${encodeURIComponent(props.title)}`"
        target="_blank"
        rel="noopener"
        @click="open = false"
      >
        <AppIcon :icon="ACTION_ICONS.apple" :size="14" group="actions" /> Apple Maps
      </a>
      <a
        :href="`https://www.google.com/maps/search/?api=1&query=${props.lat},${props.lng}`"
        target="_blank"
        rel="noopener"
        @click="open = false"
      >
        <AppIcon :icon="ACTION_ICONS.googleMaps" :size="14" group="actions" /> Google Maps
      </a>
      <a
        v-if="props.mapsLink"
        :href="props.mapsLink"
        target="_blank"
        rel="noopener"
        @click="open = false"
      >
        <AppIcon :icon="FORM_FIELD_ICONS.link" :size="14" group="formFields" /> Ursprünglichen Link
        öffnen
      </a>
    </div>
  </div>
</template>

<style scoped>
.maps-picker {
  position: relative;
  display: inline-flex;
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

.picker-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 100;
  min-width: 200px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu a {
  padding: 6px 8px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.picker-menu a:hover {
  background: var(--color-hover);
}
</style>

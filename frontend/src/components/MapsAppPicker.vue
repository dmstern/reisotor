<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
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
    <PickerMenu v-if="open" position="absolute" @close="open = false">
      <DropdownItem
        :href="`https://maps.apple.com/?ll=${props.lat},${props.lng}&q=${encodeURIComponent(props.title)}`"
        target="_blank"
        rel="noopener"
        :icon="ACTION_ICONS.apple"
        label="Apple Maps"
        @click="open = false"
      />
      <DropdownItem
        :href="`https://www.google.com/maps/search/?api=1&query=${props.lat},${props.lng}`"
        target="_blank"
        rel="noopener"
        :icon="ACTION_ICONS.googleMaps"
        label="Google Maps"
        @click="open = false"
      />
      <DropdownItem
        v-if="props.mapsLink"
        :href="props.mapsLink"
        target="_blank"
        rel="noopener"
        :icon="FORM_FIELD_ICONS.link"
        icon-group="formFields"
        label="Ursprünglichen Link öffnen"
        @click="open = false"
      />
    </PickerMenu>
  </div>
</template>

<style scoped>
.maps-picker {
  position: relative;
  display: inline-flex;
}
</style>

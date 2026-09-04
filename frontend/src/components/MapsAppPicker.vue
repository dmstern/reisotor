<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import AppIcon from './AppIcon.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import { computePopoverPosition } from '../utils/popoverPosition';

// Eigenständige Komponente (Spot/Unterkunft/Reise): zeigt ein Auswahl-Menü der gängigen Karten-Apps.
// Nutzt Teleport nach <body> und feste Positionierung (DESIGN.md, Z-Index-Stapelung), damit
// das Menü weder von Modal.vue's overflow-y:auto noch von Card-/Akkordeon-overflow:hidden abgeschnitten wird.
const props = defineProps<{ lat: number; lng: number; title: string; mapsLink?: string | null }>();
const open = ref(false);
const buttonRef = ref<HTMLButtonElement | null>(null);
const menuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

async function toggle(event?: MouseEvent) {
  if (open.value) {
    open.value = false;
    return;
  }
  const triggerEl = (event?.currentTarget as HTMLElement) || buttonRef.value;
  if (!triggerEl) return;

  // Erste synchrone Berechnung mit geschätzter Menühöhe
  menuStyle.value = computePopoverPosition(triggerEl, { menuWidth: 216, menuHeight: 120 });
  open.value = true;

  // Nach dem Rendern mit den tatsächlichen DOM-Dimensionen nachjustieren
  await nextTick();
  const menuEl = document.querySelector('.maps-picker-menu') as HTMLElement | null;
  if (menuEl && triggerEl) {
    const rect = menuEl.getBoundingClientRect();
    menuStyle.value = computePopoverPosition(triggerEl, {
      menuWidth: rect.width,
      menuHeight: rect.height,
    });
  }
}

function close() {
  open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) {
    window.addEventListener('resize', close, { passive: true });
  } else {
    window.removeEventListener('resize', close);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', close);
});
</script>

<template>
  <div class="maps-picker" @click.stop>
    <button ref="buttonRef" type="button" class="card-action-btn" @click="toggle($event)">
      <AppIcon :icon="FORM_FIELD_ICONS.maps" :size="14" group="formFields" /> In Karten-App öffnen ↗
    </button>
    <Teleport to="body">
      <PickerMenu v-if="open" class="maps-picker-menu" :style="menuStyle" @close="close">
        <DropdownItem
          :href="`https://maps.apple.com/?ll=${props.lat},${props.lng}&q=${encodeURIComponent(props.title)}`"
          target="_blank"
          rel="noopener"
          :icon="ACTION_ICONS.apple"
          label="Apple Maps"
          @click="close"
        />
        <DropdownItem
          :href="`https://www.google.com/maps/search/?api=1&query=${props.lat},${props.lng}`"
          target="_blank"
          rel="noopener"
          :icon="ACTION_ICONS.googleMaps"
          label="Google Maps"
          @click="close"
        />
        <DropdownItem
          v-if="props.mapsLink"
          :href="props.mapsLink"
          target="_blank"
          rel="noopener"
          :icon="FORM_FIELD_ICONS.link"
          icon-group="formFields"
          label="Ursprünglichen Link öffnen"
          @click="close"
        />
      </PickerMenu>
    </Teleport>
  </div>
</template>

<style scoped>
.maps-picker {
  display: inline-flex;
}
</style>

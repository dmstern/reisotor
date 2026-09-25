<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { FORM_FIELD_ICONS } from '../utils/formFieldIcons';
import {
  buildAppleMapsLink,
  buildGenericMapsLink,
  buildGoogleMapsLink,
  buildOsmLink,
} from '../utils/googleMaps';
import { computePopoverPosition } from '../utils/popoverPosition';

// Eigenständige Komponente (Spot/Unterkunft/Reise): zeigt ein Auswahl-Menü der gängigen Karten-Apps.
// Nutzt Teleport nach <body> und feste Positionierung (DESIGN.md, Z-Index-Stapelung), damit
// das Menü weder von Modal.vue's overflow-y:auto noch von Card-/Akkordeon-overflow:hidden abgeschnitten wird.
const props = withDefaults(
  defineProps<{
    lat: number;
    lng: number;
    title: string;
    mapsLink?: string | null;
    variant?: 'primary' | 'secondary' | 'danger' | 'card-action' | 'ghost' | 'floating';
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    mapsLink: null,
    variant: 'card-action',
    size: 'sm',
  }
);
const open = ref(false);
const buttonRef = ref<InstanceType<typeof Button> | null>(null);
const menuStyle = ref<{ top: string; left: string }>({ top: '0px', left: '0px' });

const genericMapsUrl = computed(() => buildGenericMapsLink(props.lat, props.lng, props.title));
const googleMapsUrl = computed(() => buildGoogleMapsLink(props.lat, props.lng));
const appleMapsUrl = computed(() => buildAppleMapsLink(props.lat, props.lng, props.title));
const osmUrl = computed(() => buildOsmLink(props.lat, props.lng, 16));

async function toggle(event?: MouseEvent) {
  if (open.value) {
    open.value = false;
    return;
  }
  const triggerEl =
    (event?.currentTarget as HTMLElement) ||
    ((buttonRef.value?.$el as HTMLElement | undefined) ?? null);
  if (!triggerEl) return;

  // Erste synchrone Berechnung mit geschätzter Menühöhe
  menuStyle.value = computePopoverPosition(triggerEl, { menuWidth: 216, menuHeight: 190 });
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
    <Button
      ref="buttonRef"
      :variant="props.variant"
      :size="props.size"
      aria-label="In Maps-App öffnen"
      title="In Maps-App öffnen"
      @click="toggle($event)"
    >
      <AppIcon :icon="ACTION_ICONS.mapsApp" :size="props.size === 'sm' ? 14 : 16" group="actions" />
      In Maps-App öffnen
    </Button>
    <Teleport to="body">
      <PickerMenu v-if="open" class="maps-picker-menu" :style="menuStyle" @close="close">
        <DropdownItem
          :href="genericMapsUrl"
          :icon="ACTION_ICONS.deviceMobile"
          label="Standard-Karten-App"
          @click="close"
        />
        <DropdownItem
          :href="googleMapsUrl"
          target="_blank"
          rel="noopener"
          :icon="ACTION_ICONS.googleMaps"
          label="Google Maps"
          @click="close"
        />
        <DropdownItem
          :href="appleMapsUrl"
          target="_blank"
          rel="noopener"
          :icon="ACTION_ICONS.apple"
          label="Apple Maps"
          @click="close"
        />
        <DropdownItem
          :href="osmUrl"
          target="_blank"
          rel="noopener"
          :icon="ACTION_ICONS.openStreetMap"
          label="OpenStreetMap"
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

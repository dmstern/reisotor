<script setup lang="ts">
import { nextTick, ref } from 'vue';

// Eigenständige Komponente statt Duplikat in jedem Detail-Dialog (Spot/Unterkunft/Reise): zeigt
// ein kleines Auswahlmenü der gängigen Karten-Apps als offizielle Universal-Links (öffnet die App,
// falls installiert, sonst die Web-Vorschau) – kein User-Agent-Sniffing nötig. Ursprünglich Teil
// von TripMap.vue's Info-Panel, das mit der direkten Pin-Klick→Detail-Dialog-Kopplung entfallen
// ist (siehe TripMap.vue) – hier wiederverwendbar in jedem Detail-Dialog, der Koordinaten besitzt.
const props = defineProps<{ lat: number; lng: number; title: string; mapsLink?: string | null }>();
const open = ref(false);
const buttonRef = ref<HTMLButtonElement | null>(null);
// Menü wird per Teleport außerhalb des Detail-Dialogs gerendert und per position:fixed anhand der
// Button-Position platziert, statt relativ zum Button zu hängen – sonst schneidet Modal.vue's
// overflow-y:auto (nötig für lange Detail-Inhalte) das absolut positionierte Menü am Dialogrand ab.
const menuStyle = ref({ top: '0px', left: '0px' });

async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  await nextTick();
  const rect = buttonRef.value?.getBoundingClientRect();
  if (!rect) return;
  menuStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 216))}px`,
  };
}
</script>

<template>
  <div class="maps-picker">
    <button ref="buttonRef" type="button" class="card-action-btn" @click="toggle">🗺️ In Karten-App öffnen ↗</button>
    <Teleport to="body">
      <template v-if="open">
        <div class="picker-backdrop" @click="open = false"></div>
        <div class="picker-menu" :style="menuStyle">
          <a
            :href="`https://maps.apple.com/?ll=${props.lat},${props.lng}&q=${encodeURIComponent(props.title)}`"
            target="_blank"
            rel="noopener"
            @click="open = false"
          >
            🍎 Apple Maps
          </a>
          <a
            :href="`https://www.google.com/maps/search/?api=1&query=${props.lat},${props.lng}`"
            target="_blank"
            rel="noopener"
            @click="open = false"
          >
            🗺️ Google Maps
          </a>
          <a v-if="props.mapsLink" :href="props.mapsLink" target="_blank" rel="noopener" @click="open = false">
            🔗 Ursprünglichen Link öffnen
          </a>
        </div>
      </template>
    </Teleport>
  </div>
</template>

<style scoped>
.picker-backdrop {
  position: fixed;
  inset: 0;
  /* Höher als Modal.vue's Overlay (z-index: 100) – das Menü wird per Teleport neben, nicht
     innerhalb des Modal-Overlays gerendert und muss auch bei geöffnetem Detail-Dialog obenauf liegen. */
  z-index: 110;
}

.picker-menu {
  position: fixed;
  min-width: 200px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  padding: var(--space-2);
  z-index: 111;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.picker-menu a {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.picker-menu a:hover {
  background: var(--color-hover);
}
</style>

<script setup lang="ts">
import { computed } from 'vue';

// Fallback-Bild für Ausflüge ohne eigenes Bild, aber mit mehreren bebilderten Stationen: statt nur
// das erste Spot-Bild zu zeigen (sieht dann wie ein normaler Spot aus), eine kleine Foto-Collage
// aus bis zu 4 Stationsbildern – macht auf einen Blick erkennbar "das ist ein Ausflug mit mehreren
// Orten", nicht ein einzelner Spot.
const props = defineProps<{ images: string[] }>();
const shown = computed(() => props.images.slice(0, 4));
const extraCount = computed(() => Math.max(0, props.images.length - 4));
</script>

<template>
  <div class="collage" :class="`count-${shown.length}`">
    <div v-for="(img, i) in shown" :key="img + i" class="tile" :style="{ backgroundImage: `url(${img})` }">
      <span v-if="i === shown.length - 1 && extraCount > 0" class="more">+{{ extraCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.collage {
  position: absolute;
  inset: 0;
  display: grid;
  gap: 2px;
}

.collage.count-1 {
  grid-template-columns: 1fr;
}

.collage.count-2 {
  grid-template-columns: 1fr 1fr;
}

.collage.count-3,
.collage.count-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

/* Bei genau 3 Bildern: erstes links über die volle Höhe, die anderen beiden rechts gestapelt –
   klassisches Foto-Mosaik statt einer leeren vierten Zelle. */
.collage.count-3 .tile:first-child {
  grid-row: 1 / span 2;
}

.tile {
  background: var(--color-primary-tint) center/cover no-repeat;
  position: relative;
}

.more {
  position: absolute;
  inset: 0;
  /* token-aware overlay color with a safe hex/rgba fallback */
  background: var(--color-collage-overlay, rgba(0,0,0,0.45));
  color: var(--color-on-primary, #fff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}
</style>

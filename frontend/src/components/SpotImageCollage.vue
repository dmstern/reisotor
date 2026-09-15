<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ images: string[] }>();
const shown = computed(() => props.images.slice(0, 4));
const extraCount = computed(() => Math.max(0, props.images.length - 4));
</script>

<template>
  <div class="collage" :class="`count-${shown.length}`">
    <div
      v-for="(img, i) in shown"
      :key="img + i"
      class="tile"
      :style="{ backgroundImage: `url(${img})` }"
    >
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
  grid-template-rows: 1fr;
}

.collage.count-3,
.collage.count-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}

/* Bei genau 3 Bildern auf Desktop: erstes links über die volle Höhe, die anderen beiden rechts gestapelt */
.collage.count-3 .tile:first-child {
  grid-row: 1 / span 2;
}

@container spots-col (max-width: 480px) {
  /* Bei knapper Breite (Mobile/schmaler Drawer) ist das Tour-Thumbnail sehr hochkant. 
     Damit bei 2 Bildern keine extrem schmalen Streifen entstehen, stapeln wir sie vertikal. */
  .collage.count-2 {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }

  /* Bei 3 Bildern drehen wir das Mosaik um: Erstes Bild über die volle Breite oben, 
     die anderen beiden unten nebeneinander. Sonst wäre das linke Bild ein winziger Streifen. */
  .collage.count-3 .tile:first-child {
    grid-row: 1;
    grid-column: 1 / span 2;
  }
}

.tile {
  background: var(--color-primary-tint) center/cover no-repeat;
  position: relative;
}

.more {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}
</style>

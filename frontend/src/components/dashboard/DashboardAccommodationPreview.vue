<script setup lang="ts">
import { computed } from 'vue';
import type { Spot } from '../../api/types';
import AppIcon from '../AppIcon.vue';
import { ACCOMMODATION_ICON } from '../../utils/dashboardTiles';

const props = defineProps<{
  accommodation: Spot | null;
}>();

const title = computed(() => {
  if (!props.accommodation) return 'Unterkunft planen';
  return props.accommodation.title;
});
</script>

<template>
  <div class="polaroid-preview-stage" aria-hidden="true">
    <div class="polaroid-card" :class="{ 'is-empty': !accommodation }">
      <!-- Washi-Tape oben an der Ecke -->
      <div class="washi-tape" />

      <!-- Fotobereich -->
      <div class="photo-window">
        <!-- Echtes Foto vorhanden -->
        <img
          v-if="accommodation?.image_url"
          :src="accommodation.image_url"
          class="photo-img"
          alt=""
          loading="lazy"
        />

        <!-- Kein Foto: Illustrativer Sonnenuntergang mit Bett-Icon -->
        <div v-else-if="accommodation" class="photo-illustration">
          <div class="sun-glow" />
          <AppIcon :icon="ACCOMMODATION_ICON" :size="24" group="navigation" class="hotel-icon" />
        </div>

        <!-- Noch keine Unterkunft eingetragen: Skizzen-/Blueprint-Look -->
        <div v-else class="photo-empty">
          <AppIcon :icon="ACCOMMODATION_ICON" :size="20" group="navigation" class="empty-icon" />
          <span class="empty-label">Freie Wahl 🏖️</span>
        </div>
      </div>

      <!-- Polaroid-Kinn (Chin) mit Beschriftung -->
      <div class="polaroid-chin">
        <span class="polaroid-title" :title="title">{{ title }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.polaroid-preview-stage {
  position: relative;
  width: 90px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.polaroid-card {
  position: relative;
  width: 72px;
  height: 74px;
  background: #ffffff;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  padding: 4px 4px 6px 4px;
  box-sizing: border-box;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.16),
    0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  transform: rotate(-2.5deg);
  transform-origin: center bottom;
  transition:
    transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.22s ease;
}

:root[data-theme='dark'] .polaroid-card {
  background: #2a2825;
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.45),
    0 1px 4px rgba(0, 0, 0, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-card {
    background: #2a2825;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.45),
      0 1px 4px rgba(0, 0, 0, 0.25);
  }
}

.polaroid-card.is-empty {
  border-style: dashed;
  border-color: rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.8);
}

:root[data-theme='dark'] .polaroid-card.is-empty {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(42, 40, 37, 0.8);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-card.is-empty {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(42, 40, 37, 0.8);
  }
}

/* Washi-Tape oben rechts */
.washi-tape {
  position: absolute;
  top: -6px;
  right: 12px;
  width: 24px;
  height: 10px;
  background: rgba(245, 158, 11, 0.55);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  transform: rotate(3deg);
  z-index: 5;
  border-left: 1px dashed rgba(0, 0, 0, 0.15);
  border-right: 1px dashed rgba(0, 0, 0, 0.15);
}

:root[data-theme='dark'] .washi-tape {
  background: rgba(245, 158, 11, 0.4);
}

.photo-window {
  width: 100%;
  height: 48px;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
  background: #f1f5f9;
}

.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-illustration {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #fb923c 0%, #f43f5e 60%, #8b5cf6 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.sun-glow {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fef08a;
  box-shadow: 0 0 10px #fef08a;
  opacity: 0.85;
}

.hotel-icon {
  color: #ffffff;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
  z-index: 2;
}

.photo-empty {
  width: 100%;
  height: 100%;
  background: var(--color-surface-sunken, rgba(0, 0, 0, 0.04));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.empty-icon {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.empty-label {
  font-size: 0.46rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

.polaroid-chin {
  margin-top: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.polaroid-title {
  font-size: 0.54rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1;
}

:root[data-theme='dark'] .polaroid-title {
  color: #f2efe9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .polaroid-title {
    color: #f2efe9;
  }
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .polaroid-card,
.polaroid-preview-stage:hover .polaroid-card {
  transform: translateY(-3px) rotate(0deg) scale(1.04);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.2),
    0 2px 5px rgba(0, 0, 0, 0.12);
}
</style>

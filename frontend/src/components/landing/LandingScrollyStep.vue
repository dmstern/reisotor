<script setup lang="ts">
import { IconCheck } from '@tabler/icons-vue';
import Kicker from '../primitives/Kicker.vue';
import type { ScrollyFeature } from '../../composables/useLandingFeatures';

defineProps<{
  feature: ScrollyFeature;
  index: number;
  isActive: boolean;
}>();
</script>

<template>
  <div class="scrolly-step" :data-index="index" :class="{ 'is-active': isActive }">
    <div class="step-card">
      <Kicker class="step-kicker">{{ feature.kicker }}</Kicker>
      <div class="step-header">
        <div
          class="step-icon"
          :style="{
            color: feature.color,
            background: feature.iconBg,
          }"
        >
          <component :is="feature.icon" :size="28" />
        </div>
        <h3 class="step-title">{{ feature.title }}</h3>
      </div>
      <p class="step-desc">{{ feature.description }}</p>
      <ul class="step-highlights">
        <li v-for="point in feature.highlights" :key="point">
          <IconCheck :size="18" class="check-icon" :style="{ color: feature.color }" />
          <span>{{ point }}</span>
        </li>
      </ul>

      <!-- Mobile inline screenshot preview (visible < 768px) -->
      <div class="mobile-screenshot-preview">
        <div class="mobile-device-mockup inline">
          <div class="mockup-screen mobile-screen">
            <picture>
              <source :srcset="feature.screenshotMobileDark" media="(prefers-color-scheme: dark)" />
              <img
                :src="feature.screenshotMobileLight"
                :alt="feature.alt"
                loading="lazy"
                class="screenshot-img"
              />
            </picture>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrolly-step {
  min-height: 45vh;
  display: flex;
  align-items: center;
}

.step-card {
  width: 100%;
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  border: 1px solid var(--color-surface-glass-border);
  border-radius: var(--radius-xl-squircle);
  corner-shape: squircle;
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
  transition:
    opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0.4;
  transform: scale(0.97);
}

.scrolly-step.is-active .step-card {
  opacity: 1;
  transform: scale(1);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-lg);
}

.step-kicker {
  letter-spacing: 0.05em;
  margin-bottom: var(--space-2);
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.step-icon {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-lg-squircle);
  corner-shape: squircle;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-title {
  font-size: clamp(1.4rem, 2.2vw, 1.8rem);
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.step-desc {
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}

.step-highlights {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.step-highlights li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.95rem;
  color: var(--color-text);
  font-weight: 500;
}

.check-icon {
  flex-shrink: 0;
}

.mobile-screenshot-preview {
  display: none;
}

.mobile-device-mockup.inline {
  position: relative;
  width: 100%;
  max-width: 260px;
  margin: 0 auto;
  aspect-ratio: 390 / 844;
  background: var(--color-surface);
  border-radius: calc(var(--radius-xl-squircle) * 0.8);
  corner-shape: squircle;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  padding: 4px;
}

.mobile-device-mockup.inline .mockup-screen {
  width: 100%;
  height: 100%;
  border-radius: calc(var(--radius-xl-squircle) * 0.7);
  corner-shape: squircle;
  overflow: hidden;
  position: relative;
}

.mobile-device-mockup.inline img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

@media (max-width: 767px) {
  .scrolly-step {
    min-height: auto;
  }
  .step-card {
    opacity: 1;
    transform: none;
    padding: var(--space-4);
  }
  .mobile-screenshot-preview {
    display: block;
    margin-top: var(--space-4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .step-card {
    transition: none !important;
  }
}
</style>

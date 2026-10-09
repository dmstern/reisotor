<script setup lang="ts">
import { IconSparkles } from '@tabler/icons-vue';
import Badge from '../primitives/Badge.vue';
import LandingScrollyShowcase from './LandingScrollyShowcase.vue';
import LandingScrollyStep from './LandingScrollyStep.vue';
import type { ScrollyFeature } from '../../composables/useLandingFeatures';

defineProps<{
  features: readonly ScrollyFeature[];
  activeIndex: number;
  glowOpacities: number[];
}>();
</script>

<template>
  <section class="scrollytelling-section">
    <div class="scrolly-header scroll-animate">
      <Badge variant="primary" class="scrolly-badge">
        <IconSparkles :size="16" />
        <span>ALLES AN EINEM ORT</span>
      </Badge>
      <h2 class="section-title">Reiseplanung neu gedacht</h2>
      <p class="section-subtitle">
        Vom ersten Gedanken bis zum Kofferpacken: Reisotor begleitet jeden Schritt eures Urlaubs.
      </p>
    </div>

    <div class="scrolly-layout">
      <!-- Sticky Showcase (Desktop / Tablet >= 768px) -->
      <LandingScrollyShowcase
        :features="features"
        :active-index="activeIndex"
        :glow-opacities="glowOpacities"
      />

      <!-- Scrolling Narrative Steps -->
      <div class="scrolly-steps">
        <LandingScrollyStep
          v-for="(feature, idx) in features"
          :key="feature.id"
          :feature="feature"
          :index="idx"
          :is-active="activeIndex === idx"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.scrollytelling-section {
  position: relative;
  max-width: min(var(--page-max-width, 1400px), 1600px);
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
}

.scrolly-header {
  text-align: center;
  max-width: 700px;
  margin: 0 auto var(--space-6) auto;
}

.scrolly-badge {
  letter-spacing: 0.04em;
  margin-bottom: var(--space-2);
}

.section-title {
  text-align: center;
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin-bottom: var(--space-2);
  color: var(--color-primary-dark);
}
:root[data-theme='dark'] .section-title {
  color: #f0abfc;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .section-title {
    color: #f0abfc;
  }
}

.section-subtitle {
  font-size: clamp(1.05rem, 1.8vw, 1.25rem);
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0 auto;
}

.scrolly-layout {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--space-6);
  position: relative;
}

.scrolly-steps {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 35vh;
  padding: 15vh 0 35vh 0;
  min-width: 0;
}

@media (min-width: 1920px) {
  .scrollytelling-section {
    max-width: 1800px;
  }
}

@media (max-width: 1023px) and (min-width: 768px) {
  .scrolly-steps {
    gap: 25vh;
  }
}

@media (max-width: 767px) {
  .scrolly-layout {
    flex-direction: column;
  }
  .scrolly-steps {
    padding: 0;
    gap: var(--space-5);
  }
}
</style>

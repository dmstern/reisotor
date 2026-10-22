<script setup lang="ts">
import { computed } from 'vue';
import { IconSparkles } from '@tabler/icons-vue';
import Badge from '../primitives/Badge.vue';
import LandingScrollyShowcase from './LandingScrollyShowcase.vue';
import LandingScrollyStep from './LandingScrollyStep.vue';
import type { ScrollyFeature } from '../../composables/useLandingFeatures';

const props = withDefaults(
  defineProps<{
    features: readonly ScrollyFeature[];
    activeIndex?: number;
    activeStepIndex?: number;
    activeHighlightIndex?: number;
    glowOpacities: number[];
  }>(),
  {
    activeIndex: 0,
    activeStepIndex: undefined,
    activeHighlightIndex: 0,
  }
);

const emit = defineEmits<{
  (e: 'selectHighlight', stepIndex: number, highlightIndex: number): void;
}>();

const effectiveStepIndex = computed(() => props.activeStepIndex ?? props.activeIndex ?? 0);
const effectiveHighlightIndex = computed(() => props.activeHighlightIndex ?? 0);

function onSelectHighlight(stepIdx: number, hIdx: number) {
  emit('selectHighlight', stepIdx, hIdx);
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const trigger = document.querySelector(
      `.highlight-trigger[data-step="${stepIdx}"][data-highlight="${hIdx}"]`
    );
    if (trigger && (trigger as HTMLElement).offsetParent !== null) {
      const rect = trigger.getBoundingClientRect();
      const targetY = window.scrollY + rect.top - window.innerHeight * 0.45 + 5;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }
}
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
        :active-step-index="effectiveStepIndex"
        :active-highlight-index="effectiveHighlightIndex"
        :glow-opacities="glowOpacities"
      />

      <!-- Scrolling Narrative Steps with Tracks and Triggers -->
      <div class="scrolly-steps">
        <div
          v-for="(feature, stepIdx) in features"
          :key="feature.id"
          class="scrolly-step-track"
          :data-index="stepIdx"
          :style="{ '--highlight-count': feature.highlights.length }"
        >
          <!-- Trigger markers positioned along the track for granular highlight reveals -->
          <div class="track-triggers" aria-hidden="true">
            <div
              v-for="(_, hIdx) in feature.highlights"
              :key="'trig-' + hIdx"
              class="highlight-trigger"
              :data-step="stepIdx"
              :data-highlight="hIdx"
              :style="{ top: `${hIdx * 45}vh` }"
            />
          </div>

          <LandingScrollyStep
            :feature="feature"
            :index="stepIdx"
            :is-active="effectiveStepIndex === stepIdx"
            :active-highlight-index="
              effectiveStepIndex === stepIdx
                ? effectiveHighlightIndex
                : effectiveStepIndex > stepIdx
                  ? feature.highlights.length - 1
                  : 0
            "
            @select-highlight="(hIdx) => onSelectHighlight(stepIdx, hIdx)"
          />
        </div>
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
  padding: 0 0 25vh 0;
  min-width: 0;
}

.scrolly-step-track {
  position: relative;
  /* Extra scroll height for each highlight point */
  min-height: calc(85vh + (var(--highlight-count, 1) - 1) * 45vh);
}

.track-triggers {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.highlight-trigger {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  pointer-events: none;
  opacity: 0;
}

@container landing (min-width: 1920px) {
  .scrollytelling-section {
    max-width: 1800px;
  }
}

@container landing (max-width: 1023px) and (min-width: 768px) {
  .scrolly-step-track {
    min-height: calc(75vh + (var(--highlight-count, 1) - 1) * 35vh);
  }
}

@container landing (max-width: 767px) {
  .scrolly-layout {
    flex-direction: column;
  }
  .scrolly-steps {
    padding: 0;
    gap: var(--space-5);
  }
  .scrolly-step-track {
    min-height: auto;
  }
  .track-triggers {
    display: none;
  }
}
</style>

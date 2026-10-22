<script setup lang="ts">
import { IconCheck } from '@tabler/icons-vue';
import Kicker from '../primitives/Kicker.vue';
import {
  getHighlightText,
  getHighlightScreenshot,
  type ScrollyFeature,
} from '../../composables/useLandingFeatures';

const props = withDefaults(
  defineProps<{
    feature: ScrollyFeature;
    index: number;
    isActive: boolean;
    activeHighlightIndex?: number;
  }>(),
  {
    activeHighlightIndex: 0,
  }
);

const emit = defineEmits<{
  (e: 'selectHighlight', index: number): void;
}>();

function isRevealed(hIdx: number): boolean {
  if (props.isActive) {
    return hIdx <= props.activeHighlightIndex;
  }
  // Falls die Kachel bereits passiert wurde, bleiben alle Punkte sichtbar
  if (props.activeHighlightIndex >= props.feature.highlights.length - 1) {
    return true;
  }
  // Wenn noch nicht erreicht, zeigen wir mindestens den ersten Punkt als Einstieg
  return hIdx === 0;
}
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
        <li
          v-for="(point, hIdx) in feature.highlights"
          :key="hIdx"
          class="step-highlight-item"
          :class="{
            'is-revealed': isRevealed(hIdx),
            'is-current': isActive && activeHighlightIndex === hIdx,
          }"
          role="button"
          tabindex="0"
          @click="emit('selectHighlight', hIdx)"
          @keydown.enter="emit('selectHighlight', hIdx)"
        >
          <div
            class="check-icon-wrapper"
            :style="{
              color: feature.color,
              background:
                isActive && activeHighlightIndex === hIdx ? feature.iconBg : 'transparent',
            }"
          >
            <IconCheck :size="18" class="check-icon" />
          </div>
          <span class="highlight-text">{{ getHighlightText(point) }}</span>
        </li>
      </ul>

      <!-- Mobile inline screenshot preview (visible < 768px) -->
      <div class="mobile-screenshot-preview">
        <div class="mobile-device-mockup inline">
          <div class="mockup-screen mobile-screen">
            <div
              v-for="(_, hIdx) in feature.highlights"
              :key="'m-frame-' + hIdx"
              class="screenshot-frame"
              :class="{
                'is-active': (activeHighlightIndex ?? 0) === hIdx,
              }"
            >
              <picture>
                <source
                  :srcset="getHighlightScreenshot(feature, hIdx).screenshotMobileDark"
                  media="(prefers-color-scheme: dark)"
                />
                <img
                  :src="getHighlightScreenshot(feature, hIdx).screenshotMobileLight"
                  :alt="getHighlightScreenshot(feature, hIdx).alt"
                  loading="lazy"
                  class="screenshot-img"
                />
              </picture>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrolly-step {
  position: sticky;
  top: 14vh;
  min-height: auto;
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
  width: var(--space-6);
  height: var(--space-6);
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
  gap: var(--space-1);
}

.step-highlight-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.95rem;
  color: var(--color-text-muted);
  font-weight: 500;
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  margin: 0 calc(-1 * var(--space-2));
  cursor: pointer;
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transform: translateY(12px);
  pointer-events: none;
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    max-height 0.35s ease,
    background-color 0.25s ease,
    color 0.25s ease;
}

.step-highlight-item:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.step-highlight-item.is-revealed {
  opacity: 0.85;
  max-height: 80px;
  transform: translateY(0);
  pointer-events: auto;
  color: var(--color-text);
}

.step-highlight-item.is-current {
  opacity: 1;
  font-weight: 600;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface-hover, currentColor) 10%, transparent);
}

.check-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full);
  transition:
    transform 0.25s ease,
    background-color 0.25s ease;
  flex-shrink: 0;
}

.step-highlight-item.is-current .check-icon-wrapper {
  transform: scale(1.08);
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
  padding: var(--space-1);
}

.mobile-device-mockup.inline .mockup-screen {
  width: 100%;
  height: 100%;
  border-radius: calc(var(--radius-xl-squircle) * 0.7);
  corner-shape: squircle;
  overflow: hidden;
  position: relative;
}

.mobile-device-mockup.inline .screenshot-frame {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: scale(0.97);
  transition:
    opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.mobile-device-mockup.inline .screenshot-frame.is-active {
  opacity: 1;
  transform: scale(1);
  pointer-events: auto;
}

.mobile-device-mockup.inline img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

@container landing (max-width: 767px) {
  .scrolly-step {
    position: static;
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
    transition: none;
  }
  .step-highlight-item {
    opacity: 1 !important;
    max-height: none !important;
    transform: none !important;
    transition: none !important;
  }
  .mobile-device-mockup.inline .screenshot-frame {
    transition: none !important;
  }
}
</style>

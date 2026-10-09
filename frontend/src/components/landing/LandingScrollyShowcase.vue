<script setup lang="ts">
import type { ScrollyFeature } from '../../composables/useLandingFeatures';

defineProps<{
  features: readonly ScrollyFeature[];
  activeIndex: number;
  glowOpacities: number[];
}>();
</script>

<template>
  <div class="scrolly-visual-wrapper" aria-hidden="true">
    <div class="scrolly-stage">
      <div class="device-mockup">
        <div class="mockup-chrome">
          <div class="chrome-controls">
            <span class="control-dot dot-close"></span>
            <span class="control-dot dot-minimize"></span>
            <span class="control-dot dot-expand"></span>
          </div>
          <div class="chrome-address-bar">
            <span class="address-lock">🔒</span>
            <span class="address-domain">reisotor.app/{{ features[activeIndex]?.id }}</span>
          </div>
          <div class="chrome-tag">
            {{ features[activeIndex]?.routePill }}
          </div>
        </div>
        <div class="mockup-screen">
          <div
            v-for="(feature, idx) in features"
            :key="feature.id"
            class="screenshot-frame"
            :class="{
              'is-active': activeIndex === idx,
              'is-prev': activeIndex > idx,
              'is-next': activeIndex < idx,
            }"
          >
            <picture>
              <source :srcset="feature.screenshotDark" media="(prefers-color-scheme: dark)" />
              <img
                :src="feature.screenshotLight"
                :alt="feature.alt"
                loading="lazy"
                class="screenshot-img"
              />
            </picture>
          </div>
        </div>
      </div>

      <!-- Mobile Device Mockup Overlay -->
      <div class="mobile-device-mockup">
        <div class="mockup-screen mobile-screen">
          <div
            v-for="(feature, idx) in features"
            :key="'mobile-' + feature.id"
            class="screenshot-frame"
            :class="{
              'is-active': activeIndex === idx,
              'is-prev': activeIndex > idx,
              'is-next': activeIndex < idx,
            }"
          >
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

      <!-- Dynamic Ambient Glows (Crossfading) -->
      <div
        v-for="(feature, idx) in features"
        :key="'glow-' + feature.id"
        class="stage-glow"
        :style="{
          background: `radial-gradient(circle, ${feature.color} 0%, transparent 70%)`,
          '--glow-mix': glowOpacities[idx],
        }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.scrolly-visual-wrapper {
  position: sticky;
  top: 14vh;
  flex: 1.3;
  height: calc(100vh - 28vh);
  max-height: 750px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.scrolly-stage {
  position: relative;
  width: 100%;
}

.device-mockup {
  position: relative;
  z-index: 2;
  background: var(--color-surface);
  border-radius: var(--radius-xl-squircle);
  corner-shape: squircle;
  border: 1px solid var(--color-border);
  box-shadow:
    var(--shadow-lg),
    0 20px 40px -15px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.mockup-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--color-hover);
  border-bottom: 1px solid var(--color-border);
}

.chrome-controls {
  display: flex;
  gap: 6px;
}

.control-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
}

.dot-close {
  background: #ff5f56;
}

.dot-minimize {
  background: #ffbd2e;
}

.dot-expand {
  background: #27c93f;
}

.chrome-address-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-surface);
  padding: 3px 12px;
  border-radius: var(--radius-pill);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.chrome-tag {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-primary);
}

.mockup-screen {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--color-surface);
  overflow: hidden;
}

.screenshot-frame {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateY(24px) scale(0.97);
  transition:
    opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
  will-change: opacity, transform;
}

.screenshot-frame.is-active {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  z-index: 2;
}

.screenshot-frame.is-prev {
  opacity: 0;
  transform: translateY(-24px) scale(0.97);
  z-index: 1;
}

.screenshot-frame.is-next {
  opacity: 0;
  transform: translateY(24px) scale(0.97);
  z-index: 1;
}

.screenshot-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
}

.stage-glow {
  position: absolute;
  inset: -20%;
  filter: blur(80px);
  opacity: calc(0.25 * var(--glow-mix, 0));
  z-index: 1;
  pointer-events: none;
}
:root[data-theme='dark'] .stage-glow {
  opacity: calc(0.35 * var(--glow-mix, 0));
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .stage-glow {
    opacity: calc(0.35 * var(--glow-mix, 0));
  }
}

.mobile-device-mockup {
  position: absolute;
  z-index: 4;
  bottom: -40px;
  right: -30px;
  width: 25%;
  min-width: 140px;
  max-width: 220px;
  aspect-ratio: 390 / 844;
  background: var(--color-surface);
  border-radius: calc(var(--radius-xl-squircle) * 0.8);
  corner-shape: squircle;
  border: 1px solid var(--color-border);
  box-shadow:
    var(--shadow-lg),
    -10px 20px 40px -10px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  padding: 4px; /* Simulate bezel */
}

.mobile-device-mockup .mockup-screen {
  width: 100%;
  height: 100%;
  border-radius: calc(var(--radius-xl-squircle) * 0.7);
  corner-shape: squircle;
  overflow: hidden;
  position: relative;
}

@media (min-width: 1920px) {
  .scrolly-visual-wrapper {
    max-height: 850px;
  }
}

@media (max-width: 1023px) and (min-width: 768px) {
  .scrolly-visual-wrapper {
    top: 10vh;
    height: calc(100vh - 20vh);
    max-height: 600px;
    flex: 1.1;
  }
  .chrome-address-bar {
    display: none;
  }
}

@media (max-width: 767px) {
  .scrolly-visual-wrapper {
    display: none;
  }
  .mobile-device-mockup:not(.inline) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .screenshot-frame {
    transition: none !important;
  }
  .stage-glow {
    transition: none !important;
  }
}
</style>

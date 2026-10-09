<script setup lang="ts">
import LandingHero from '../components/landing/LandingHero.vue';
import LandingScrollySection from '../components/landing/LandingScrollySection.vue';
import LandingCtaBand from '../components/landing/LandingCtaBand.vue';
import LandingSelfHosting from '../components/landing/LandingSelfHosting.vue';
import LandingFooter from '../components/landing/LandingFooter.vue';
import { useLandingFeatures } from '../composables/useLandingFeatures';
import { useLandingScrollytelling } from '../composables/useLandingScrollytelling';

const { scrollyFeatures, repoUrl, demoUrl, storybookUrl } = useLandingFeatures();
const { activeIndex, glowOpacities } = useLandingScrollytelling({
  stepCount: scrollyFeatures.length,
});
</script>

<template>
  <div class="landing">
    <!-- Blurry glowing backgrounds -->
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>
    <div class="glow-orb orb-3"></div>

    <LandingHero :demo-url="demoUrl" :repo-url="repoUrl" />

    <LandingScrollySection
      :features="scrollyFeatures"
      :active-index="activeIndex"
      :glow-opacities="glowOpacities"
    />

    <LandingCtaBand :demo-url="demoUrl" class="scroll-animate" />

    <LandingSelfHosting :repo-url="repoUrl" class="scroll-animate" />

    <LandingFooter :demo-url="demoUrl" :storybook-url="storybookUrl" :repo-url="repoUrl" />
  </div>
</template>

<style scoped>
@keyframes scrolly-fade-up {
  from {
    opacity: 0;
    transform: translateY(60px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@supports ((animation-timeline: view()) and (animation-range: entry)) {
  .scroll-animate,
  :deep(.scroll-animate) {
    animation: scrolly-fade-up linear both;
    animation-timeline: view();
    animation-range: entry 5% cover 25%;
  }
}

.scroll-animate,
:deep(.scroll-animate) {
  opacity: 0;
  transform: translateY(60px) scale(0.95);
  transition:
    opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.scroll-animate.fallback-visible,
:deep(.scroll-animate.fallback-visible) {
  opacity: 1;
  transform: translateY(0) scale(1);
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .scroll-animate,
  :deep(.scroll-animate) {
    opacity: 1;
    transform: translateY(0) scale(1);
    animation: none;
  }
}

.landing {
  position: relative;
  overflow-x: clip;
  width: 100%;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 80px;
  min-height: 100vh;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  z-index: -1;
  pointer-events: none;
  mix-blend-mode: multiply;
}
.orb-1 {
  top: -100px;
  left: -100px;
  width: 50vw;
  height: 50vw;
  background: var(--color-primary-tint);
}
.orb-2 {
  top: 400px;
  right: -200px;
  width: 60vw;
  height: 60vw;
  background: color-mix(in srgb, var(--color-accent) 20%, transparent);
}
.orb-3 {
  bottom: 200px;
  left: -10vw;
  width: 70vw;
  height: 70vw;
  background: color-mix(in srgb, var(--color-like) 15%, transparent);
}
:root[data-theme='dark'] .glow-orb {
  mix-blend-mode: screen;
  opacity: 0.4;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .glow-orb {
    mix-blend-mode: screen;
    opacity: 0.4;
  }
}
</style>

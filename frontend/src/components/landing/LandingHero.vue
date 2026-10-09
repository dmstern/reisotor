<script setup lang="ts">
import { IconPlayerPlayFilled, IconBrandGithub } from '@tabler/icons-vue';
import ReisotorRobot from '../ReisotorRobot.vue';
import { useLandingRobot } from '../../composables/useLandingRobot';

defineProps<{
  demoUrl: string;
  repoUrl: string;
}>();

const { robotPhase } = useLandingRobot();
</script>

<template>
  <header class="hero">
    <div class="hero-robot">
      <ReisotorRobot
        size="240px"
        :phase="robotPhase"
        interactive
        @packing-done="robotPhase = 'idle'"
      />
    </div>
    <h1 class="title">Reisotor</h1>
    <p class="tagline">
      Euren Urlaub gemeinsam planen – Kalender, Budget, Packlisten und Ausflüge an einem Ort.
    </p>

    <div class="floating-island">
      <a :href="demoUrl" class="island-btn primary">
        <IconPlayerPlayFilled :size="20" />
        <span>Demo ausprobieren</span>
      </a>
      <div class="island-divider"></div>
      <a :href="repoUrl" target="_blank" rel="noopener" class="island-btn secondary">
        <IconBrandGithub :size="20" />
        <span>GitHub</span>
      </a>
    </div>
  </header>
</template>

<style scoped>
.hero {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-3);
  margin-top: var(--space-3);
}

.hero-robot {
  animation: float 4s ease-in-out infinite;
  margin-bottom: var(--space-2);
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.title {
  font-size: clamp(3rem, 6vw, 4.5rem);
  font-weight: 800;
  color: var(--color-primary-dark);
  margin: 0;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, var(--color-primary), var(--color-like));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
:root[data-theme='dark'] .title {
  background: linear-gradient(135deg, #f0abfc, #e879f9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .title {
    background: linear-gradient(135deg, #f0abfc, #e879f9);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}

.tagline {
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  max-width: 50ch;
  color: var(--color-text-muted);
  line-height: 1.5;
}

.floating-island {
  display: inline-flex;
  align-items: center;
  margin-top: var(--space-4);
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  border: 1px solid var(--color-surface-glass-border);
  padding: var(--space-2);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-floating-island);
}

.island-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 12px var(--space-4);
  min-height: var(--input-default-height, 44px);
  box-sizing: border-box;
  border-radius: var(--radius-pill);
  font-weight: 600;
  font-size: 1.05rem;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.island-btn.primary {
  background: var(--color-primary);
  color: var(--color-primary-contrast, white);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 40%, transparent);
}
.island-btn.primary:hover {
  transform: scale(1.03);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--color-primary) 60%, transparent);
}
.island-btn.secondary {
  background: transparent;
  color: var(--color-text);
}
.island-btn.secondary:hover {
  background: var(--color-hover);
}

.island-divider {
  width: 1px;
  height: var(--space-4);
  background: var(--color-border);
  margin: 0 var(--space-2);
}

@container landing (max-width: 480px) {
  .floating-island {
    flex-direction: column;
    width: calc(100% - 2 * var(--space-3));
    max-width: 320px;
    border-radius: var(--radius-xl-squircle);
    corner-shape: squircle;
    gap: var(--space-1);
  }
  .island-btn {
    width: 100%;
  }
  .island-divider {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-robot {
    animation: none;
  }
  .island-btn {
    transition: none;
  }
}
</style>

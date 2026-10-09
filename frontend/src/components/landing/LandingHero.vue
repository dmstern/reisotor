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
  padding: 8px;
  border-radius: var(--radius-pill);
  box-shadow:
    var(--shadow-lg),
    inset 0 1px 1px rgba(255, 255, 255, 0.2);
}

.island-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  font-weight: 600;
  font-size: 1.05rem;
  text-decoration: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.island-btn.primary {
  background: var(--color-primary);
  color: white;
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
  height: 24px;
  background: var(--color-border);
  margin: 0 8px;
}
</style>

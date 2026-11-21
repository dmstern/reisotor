<script setup lang="ts">
import { IconPlayerPlayFilled, IconBrandGithub } from '@tabler/icons-vue';
import ReisotorRobot from '../ReisotorRobot.vue';
import { useLandingRobot } from '../../composables/useLandingRobot';

defineProps<{
  demoUrl: string;
  repoUrl: string;
}>();

const { robotPhase, onPackingDone } = useLandingRobot();
</script>

<template>
  <header class="hero">
    <div class="hero-robot">
      <ReisotorRobot size="240px" :phase="robotPhase" interactive @packing-done="onPackingDone" />
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

<style lang="scss" scoped>
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
  background-clip: text;
  color: transparent;
}
:root[data-theme='dark'] .title {
  background: linear-gradient(135deg, var(--color-like), var(--color-like-border));
  background-clip: text;
  color: transparent;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .title {
    background: linear-gradient(135deg, var(--color-like), var(--color-like-border));
    background-clip: text;
    color: transparent;
  }
}

.tagline {
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  max-width: 50ch;
  color: var(--color-text-muted);
  line-height: var(--line-height-normal);
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
  min-height: var(--control-height-md);
  box-sizing: border-box;
  border-radius: var(--radius-pill);
  font-weight: 600;
  font-size: var(--font-size-md);
  text-decoration: none;
  transition: var(--transition-control);

  &:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-ring-offset);
    box-shadow: var(--focus-ring-halo);
  }
}

.island-btn.primary {
  background-color: var(--color-primary);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.14) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  background-origin: border-box;
  color: var(--color-primary-contrast, #ffffff);
  border: 1px solid transparent;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.28),
    0 4px 12px color-mix(in srgb, var(--color-primary) 38%, transparent);

  @include can-hover {
    &:hover {
      transform: translateY(-1px) scale(1.02);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.35),
        0 6px 16px color-mix(in srgb, var(--color-primary) 52%, transparent);
    }
  }

  &:active {
    transform: translateY(1px) scale(0.985);
    box-shadow: inset 0 1.5px 3px rgba(0, 0, 0, 0.25);
  }
}

.island-btn.secondary {
  color: var(--color-text);
  @include control-glass-interactive('embedded');
}

.island-divider {
  width: 1px;
  height: var(--space-4);
  background: var(--color-divider-groove-glass);
  box-shadow: 1px 0 0 var(--color-divider-highlight-glass);
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

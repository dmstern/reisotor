<script setup lang="ts">
import { IconPlayerPlayFilled } from '@tabler/icons-vue';

defineProps<{
  demoUrl: string;
}>();
</script>

<template>
  <section class="cta-band">
    <div class="cta-content">
      <h2>Neugierig geworden?</h2>
      <p>Probiert Reisotor direkt im Browser aus – mit Beispieldaten und ohne Anmeldung.</p>
      <a :href="demoUrl" class="cta-btn">
        <IconPlayerPlayFilled :size="20" />
        <span>Jetzt Demo starten</span>
      </a>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.cta-band {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl-squircle);
  corner-shape: squircle;
  color: white;
  margin: var(--space-6) auto;
  width: calc(100% - 2 * var(--space-4));
  max-width: var(--page-max-width);
  box-shadow: var(--shadow-lg);
}

.cta-band::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--color-primary), var(--color-like));
  z-index: 1;
}
.cta-band::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.22) 0%, transparent 60%);
  border-radius: inherit;
  corner-shape: inherit;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.32),
    inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  pointer-events: none;
  z-index: 2;
}
:root[data-theme='dark'] .cta-band::before {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-primary) 72%, #1a0522),
    color-mix(in srgb, var(--color-like) 35%, #120018)
  );
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .cta-band::before {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-primary) 72%, #1a0522),
      color-mix(in srgb, var(--color-like) 35%, #120018)
    );
  }
}

.cta-content {
  position: relative;
  z-index: 3;
  padding: var(--space-6) var(--space-4);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.cta-band h2 {
  color: white;
  font-size: clamp(2rem, 4vw, 2.6rem);
  margin: 0;
}
.cta-band p {
  color: rgba(255, 255, 255, 0.9);
  font-size: var(--font-size-lg);
  margin: 0 0 var(--space-3) 0;
  max-width: 50ch;
}
.cta-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  background-color: #ffffff;
  background-image: linear-gradient(180deg, #ffffff 0%, #f4eff8 100%);
  color: var(--color-primary-dark);
  padding: var(--space-3) var(--space-5);
  min-height: var(--control-height-lg);
  box-sizing: border-box;
  border-radius: var(--radius-pill);
  font-weight: 700;
  font-size: var(--font-size-lg);
  text-decoration: none;
  box-shadow:
    inset 0 1px 0 #ffffff,
    inset 0 -1.5px 0 rgba(123, 55, 147, 0.14),
    var(--shadow-md);
  transition: var(--transition-control);

  @include can-hover {
    &:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow:
        inset 0 1px 0 #ffffff,
        inset 0 -1.5px 0 rgba(123, 55, 147, 0.18),
        var(--shadow-lg);
    }
  }

  &:active {
    transform: translateY(1px) scale(0.985);
    box-shadow: var(--shadow-control-active);
  }

  &:focus-visible {
    outline: var(--focus-ring-width) solid #ffffff;
    outline-offset: var(--focus-ring-offset);
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.35);
  }
}

:root[data-theme='dark'] .cta-btn {
  color: color-mix(in srgb, var(--color-primary-dark) 45%, #2b1136);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .cta-btn {
    color: color-mix(in srgb, var(--color-primary-dark) 45%, #2b1136);
  }
}

@container landing (max-width: 480px) {
  .cta-band {
    width: calc(100% - 2 * var(--space-3));
  }
  .cta-content {
    padding: var(--space-5) var(--space-3);
  }
  .cta-btn {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cta-btn {
    transition: none;
  }
}
</style>

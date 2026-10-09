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

<style scoped>
.cta-band {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl-squircle);
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
  background: radial-gradient(circle at top right, rgba(255, 255, 255, 0.2) 0%, transparent 60%);
  z-index: 2;
}
:root[data-theme='dark'] .cta-band::before {
  background: linear-gradient(135deg, #9336af, #35003f);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .cta-band::before {
    background: linear-gradient(135deg, #9336af, #35003f);
  }
}

.cta-content {
  position: relative;
  z-index: 3;
  padding: 60px 24px;
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
  font-size: 1.2rem;
  margin: 0 0 var(--space-3) 0;
  max-width: 50ch;
}
.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  background: white;
  color: var(--color-primary);
  padding: 16px 32px;
  border-radius: var(--radius-pill);
  font-weight: 700;
  font-size: 1.1rem;
  text-decoration: none;
  box-shadow: var(--shadow-md);
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.2s ease;
}
.cta-btn:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: var(--shadow-lg);
}
</style>

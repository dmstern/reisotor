<script setup lang="ts">
import { onMounted } from 'vue';
import {
  IconCalendarEvent,
  IconCoin,
  IconListCheck,
  IconMapPin,
  IconWifiOff,
  IconUsers,
  IconPlayerPlayFilled,
  IconBrandGithub,
} from '@tabler/icons-vue';
import ReisotorRobot from '../components/ReisotorRobot.vue';

const repoUrl = __REPO_URL__;
const demoUrl = './demo/';
const storybookUrl = './storybook/';

const features = [
  {
    icon: IconCalendarEvent,
    title: 'Gemeinsamer Kalender',
    text: 'Termine, Ausflüge und Reise-Etappen auf einen Blick – live synchron für alle Mitreisenden.',
    color: 'var(--color-primary)',
  },
  {
    icon: IconCoin,
    title: 'Budget & Kasse',
    text: 'Wer hat was bezahlt? Gemeinsame und persönliche Töpfe, Ausgaben und Überweisungen im Griff.',
    color: 'var(--color-success)',
  },
  {
    icon: IconListCheck,
    title: 'Packlisten & Einkauf',
    text: 'Nichts vergessen – gemeinsame Listen mit Mengen, Zuständigkeiten und Fortschritt.',
    color: 'var(--color-warning)',
  },
  {
    icon: IconMapPin,
    title: 'Spots & Touren',
    text: 'Unterkünfte, Sehenswürdigkeiten und Ausflüge sammeln, auf der Karte verorten, einplanen.',
    color: 'var(--color-tour)',
  },
  {
    icon: IconWifiOff,
    title: 'Offline-first',
    text: 'Als App installierbar, funktioniert auch ohne Netz – Änderungen synchronisieren sich später.',
    color: 'var(--color-text-muted)',
  },
  {
    icon: IconUsers,
    title: 'Gemeinsam statt einsam',
    text: 'Ein Urlaub, mehrere Mitglieder – jede:r sieht denselben aktuellen Stand.',
    color: 'var(--color-like)',
  },
];

onMounted(() => {
  if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fallback-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.scroll-animate').forEach((el) => observer.observe(el));
  }
});
</script>

<template>
  <div class="landing">
    <!-- Blurry glowing backgrounds -->
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>
    <div class="glow-orb orb-3"></div>

    <header class="hero scroll-animate">
      <div class="hero-robot">
        <ReisotorRobot size="240px" phase="idle" variant="circle" />
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

    <section class="screenshots-parallax parallax-wrapper">
      <div class="screenshots-container">
        <!-- Desktop layer in background (Dashboard) -->
        <picture class="screenshot-desktop layer layer-1">
          <source
            srcset="/landing/screenshot-dashboard-dark.png"
            media="(prefers-color-scheme: dark)"
          />
          <img
            src="/landing/screenshot-dashboard-light.png"
            alt="Reisotor-Dashboard"
            loading="lazy"
          />
        </picture>

        <!-- Desktop layer in middle (Spots Map) -->
        <picture class="screenshot-spots layer layer-2">
          <source
            srcset="/landing/screenshot-spots-dark.png"
            media="(prefers-color-scheme: dark)"
          />
          <img src="/landing/screenshot-spots-light.png" alt="Reisotor Map" loading="lazy" />
        </picture>

        <!-- Mobile layer in foreground -->
        <picture class="screenshot-mobile layer layer-3">
          <source
            srcset="/landing/screenshot-mobile-dark.png"
            media="(prefers-color-scheme: dark)"
          />
          <img
            src="/landing/screenshot-mobile-light.png"
            alt="Reisotor auf dem Smartphone"
            loading="lazy"
          />
        </picture>

        <!-- Fake polaroids floating on the side -->
        <div class="polaroid-decor layer layer-4" aria-hidden="true">
          <div class="fake-polaroid p-1">
            <div class="fp-img"><IconMapPin :size="36" color="var(--color-tour)" /></div>
            <div class="fp-chin"></div>
          </div>
          <div class="fake-polaroid p-2">
            <div class="fp-img"><IconListCheck :size="36" color="var(--color-warning)" /></div>
            <div class="fp-chin"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="features">
      <h2 class="section-title scroll-animate">Alles für die gemeinsame Reiseplanung</h2>
      <div class="feature-grid">
        <div
          v-for="(feature, idx) in features"
          :key="feature.title"
          class="feature-card scroll-animate"
          :style="{ '--stagger': idx }"
        >
          <div
            class="feature-icon"
            :style="{
              color: feature.color,
              '--icon-bg': `color-mix(in srgb, ${feature.color} 15%, transparent)`,
            }"
          >
            <component :is="feature.icon" :size="32" />
          </div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.text }}</p>
        </div>
      </div>
    </section>

    <section class="cta-band scroll-animate">
      <div class="cta-content">
        <h2>Neugierig geworden?</h2>
        <p>Probiert Reisotor direkt im Browser aus – mit Beispieldaten und ohne Anmeldung.</p>
        <a :href="demoUrl" class="cta-btn">
          <IconPlayerPlayFilled :size="20" />
          <span>Jetzt Demo starten</span>
        </a>
      </div>
    </section>

    <section class="self-hosting scroll-animate">
      <h2>Wie kommt man an Reisotor?</h2>
      <p>
        Reisotor ist Open Source und aktuell nur per Self-Hosting verfügbar. Die
        <a :href="`${repoUrl}#readme`" target="_blank" rel="noopener">README</a> beschreibt lokale
        Entwicklung und Deployment auf einem eigenen Server.
      </p>
    </section>

    <footer class="landing-footer">
      <div class="hint-links">
        <a :href="demoUrl">Live Demo</a>
        <span class="dot">·</span>
        <a :href="storybookUrl" target="_blank" rel="noopener">Storybook</a>
        <span class="dot">·</span>
        <a :href="repoUrl" target="_blank" rel="noopener">GitHub</a>
      </div>
      <p class="hint">
        © {{ new Date().getFullYear() }}
        <a href="https://github.com/dmstern" target="_blank" rel="noopener">Daniel Morgenstern</a>
        · agentic-coded
      </p>
    </footer>
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
  .scroll-animate {
    animation: scrolly-fade-up linear both;
    animation-timeline: view();
    animation-range: entry 5% cover 25%;
  }

  .feature-card {
    animation-range: entry calc(5% + var(--stagger) * 2%) cover calc(25% + var(--stagger) * 2%);
  }
}

.scroll-animate {
  opacity: 0;
  transform: translateY(60px) scale(0.95);
  transition:
    opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.scroll-animate.fallback-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .scroll-animate {
    opacity: 1;
    transform: translateY(0) scale(1);
    animation: none;
  }
}

.landing {
  position: relative;
  overflow: hidden;
  max-width: var(--page-max-width, 1400px);
  margin: 0 auto;
  padding: var(--space-4);
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

.hero {
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

/* Parallax Screenshots */
.parallax-wrapper {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  view-timeline: --screenshots;
}

.screenshots-container {
  position: relative;
  width: 100%;
  height: 60vw;
  max-height: 800px;
  min-height: 400px;
  display: flex;
  justify-content: center;
}

.layer {
  position: absolute;
  border-radius: var(--radius-xl-squircle);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
}
.layer img {
  display: block;
  width: 100%;
  height: auto;
}

.screenshot-desktop {
  width: 85%;
  top: 5%;
  left: 5%;
  z-index: 1;
}

.screenshot-spots {
  width: 75%;
  top: 15%;
  right: 5%;
  z-index: 2;
  border-radius: 12px;
  box-shadow:
    var(--shadow-xl),
    -10px 10px 30px rgba(0, 0, 0, 0.2);
}

.screenshot-mobile {
  width: 25%;
  bottom: 0;
  right: 2%;
  z-index: 3;
  border-radius: 36px;
  box-shadow:
    var(--shadow-lg),
    -15px 15px 40px rgba(0, 0, 0, 0.15);
}

.polaroid-decor {
  width: auto;
  top: 40%;
  left: -2%;
  z-index: 4;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border: none;
  box-shadow: none;
  overflow: visible;
}

.fake-polaroid {
  width: 120px;
  height: 140px;
  background: #ffffff;
  padding: 8px 8px 24px 8px;
  border-radius: var(--radius-sm-squircle, 6px);
  corner-shape: squircle;
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}
.fp-img {
  flex: 1;
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.p-1 {
  transform: rotate(-10deg);
}
.p-2 {
  transform: rotate(14deg) translateX(40px) translateY(-10px);
}
:root[data-theme='dark'] .fake-polaroid {
  background: #2a2825;
  border-color: rgba(255, 255, 255, 0.1);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .fake-polaroid {
    background: #2a2825;
    border-color: rgba(255, 255, 255, 0.1);
  }
}

@keyframes parallax {
  from {
    transform: translateY(calc(80px * var(--parallax-dir)));
  }
  to {
    transform: translateY(calc(-80px * var(--parallax-dir)));
  }
}
@supports ((animation-timeline: view()) and (animation-range: entry)) {
  .layer-1 {
    --parallax-dir: -0.2;
    animation: parallax linear both;
    animation-timeline: --screenshots;
    animation-range: entry 0% cover 100%;
  }
  .layer-2 {
    --parallax-dir: 0.6;
    animation: parallax linear both;
    animation-timeline: --screenshots;
    animation-range: entry 0% cover 100%;
  }
  .layer-3 {
    --parallax-dir: 1.2;
    animation: parallax linear both;
    animation-timeline: --screenshots;
    animation-range: entry 0% cover 100%;
  }
}

@media (max-width: 768px) {
  .screenshots-container {
    height: 350px;
  }
  .screenshot-spots {
    width: 85%;
    top: 20%;
    right: 5%;
  }
  .screenshot-mobile {
    width: 35%;
    right: -10px;
  }
  .polaroid-decor {
    display: none;
  }
  .layer-1 {
    width: 95%;
    left: 2.5%;
  }
}

.features {
  padding: var(--space-4) 0;
}
.section-title {
  text-align: center;
  font-size: clamp(2rem, 4vw, 2.8rem);
  margin-bottom: var(--space-6);
  color: var(--color-primary-dark);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
}

.feature-card {
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  border: 1px solid var(--color-surface-glass-border);
  padding: var(--space-5);
  border-radius: var(--radius-xl-squircle);
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}
.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
}

.feature-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-lg-squircle);
  background: var(--icon-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.feature-card h3 {
  font-size: 1.4rem;
  margin-bottom: var(--space-2);
  color: var(--color-text);
}
.feature-card p {
  font-size: 1.05rem;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

.cta-band {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-xl-squircle);
  color: white;
  margin: var(--space-5) 0;
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

.self-hosting {
  text-align: center;
  max-width: 800px;
  margin: 0 auto;
  padding: var(--space-5);
  background: var(--color-surface-glass);
  backdrop-filter: var(--backdrop-blur-md);
  border-radius: var(--radius-xl-squircle);
  border: 1px dashed var(--color-border-strong);
}

.landing-footer {
  text-align: center;
  padding: var(--space-5) 0 var(--space-4) 0;
  border-top: 1px solid var(--color-border);
  margin-top: auto;
}
.hint-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.hint-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 500;
}
.hint-links a:hover {
  color: var(--color-primary);
}
.dot {
  color: var(--color-border-strong);
}
.hint {
  font-size: 0.95rem;
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, type Component } from 'vue';
import {
  IconCalendarEvent,
  IconCoin,
  IconListCheck,
  IconMapPin,
  IconBook,
  IconPlayerPlayFilled,
  IconBrandGithub,
  IconCheck,
  IconSparkles,
} from '@tabler/icons-vue';
import ReisotorRobot from '../components/ReisotorRobot.vue';

const repoUrl = __REPO_URL__;
const demoUrl = './demo/';
const storybookUrl = './storybook/';

const robotPhase = ref<'pack' | 'idle'>('pack');

const baseUrl = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

interface ScrollyFeature {
  id: string;
  kicker: string;
  title: string;
  description: string;
  highlights: string[];
  icon: Component;
  color: string;
  iconBg: string;
  screenshotLight: string;
  screenshotDark: string;
  screenshotMobileLight: string;
  screenshotMobileDark: string;
  alt: string;
  routePill: string;
}

const scrollyFeatures: ScrollyFeature[] = [
  {
    id: 'dashboard',
    kicker: 'ZENTRALE REISEÜBERSICHT',
    title: 'Alles an einem Ort: Euer Urlaubs-Dashboard',
    description:
      'Der gemeinsame Startpunkt für euren Urlaub: Termine, Etappen, Countdown und 14-Tage-Wettervorhersage auf einen Blick. Der integrierte Kalender hält alle Mitreisenden live synchron.',
    highlights: [
      'Gemeinsamer Kalender mit Live-Synchronisation',
      '14-Tage Wettervorhersage für das Reiseziel',
      'Flug- & Unterkunfts-Countdown auf einen Blick',
      'Schnellzugriffs-Kacheln für Status-Überblick (Budgets, Packliste & Co.)',
    ],
    icon: IconCalendarEvent,
    color: 'var(--color-primary)',
    iconBg: 'color-mix(in srgb, var(--color-primary) 15%, transparent)',
    screenshotLight: `${baseUrl}landing/screenshot-dashboard-light.png`,
    screenshotMobileLight: `${baseUrl}landing/screenshot-dashboard-mobile-light.png`,
    screenshotMobileDark: `${baseUrl}landing/screenshot-dashboard-mobile-dark.png`,
    screenshotDark: `${baseUrl}landing/screenshot-dashboard-dark.png`,
    alt: 'Reisotor Dashboard mit Kalender und Wetter',
    routePill: 'Dashboard & Kalender',
  },
  {
    id: 'spots',
    kicker: 'INTERAKTIVE KARTE & ROUTEN',
    title: 'Spots & Touren mit dynamischem Routen-Verlauf',
    description:
      'Unterkünfte, Sehenswürdigkeiten und Ausflugsziele auf der Karte markieren. Die neue Tour-Ansicht verbindet besuchte Stationen mit eleganten Farbverläufen und gestrichelten Linien.',
    highlights: [
      'Visuelle Tour-Pfade mit geschwungenen Verlaufslinien',
      'Kategorisierte Spots mit Notizen & Bewertungen',
      'Offline-fähige Navigation auf der Karte',
      'An- und Abreise mit Tickets und Umsteigezeiten tracken',
    ],
    icon: IconMapPin,
    color: 'var(--color-tour)',
    iconBg: 'color-mix(in srgb, var(--color-tour) 15%, transparent)',
    screenshotLight: `${baseUrl}landing/screenshot-tour-light.png`,
    screenshotMobileLight: `${baseUrl}landing/screenshot-tour-mobile-light.png`,
    screenshotMobileDark: `${baseUrl}landing/screenshot-tour-mobile-dark.png`,
    screenshotDark: `${baseUrl}landing/screenshot-tour-dark.png`,
    alt: 'Reisotor Spots und Tourenansicht mit Routenverlauf',
    routePill: 'Spots & Touren',
  },
  {
    id: 'budget',
    kicker: 'TRANSPARENTE FINANZEN',
    title: 'Budget & Ausgaben ohne Tabellen-Chaos',
    description:
      'Wer hat was bezahlt? Erfasst Ausgaben in gemeinsamen oder persönlichen Töpfen. Reisotor berechnet den automatischen Schuldenausgleich transparent und ohne Kopfzerbrechen.',
    highlights: [
      'Gemeinsame & persönliche Budget-Töpfe',
      'Automatischer Verrechnungs- und Ausgleichsrechner',
      'Kategoriestatistiken & Ausgabenverlauf',
    ],
    icon: IconCoin,
    color: 'var(--color-success)',
    iconBg: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
    screenshotLight: `${baseUrl}landing/screenshot-budget-light.png`,
    screenshotMobileLight: `${baseUrl}landing/screenshot-budget-mobile-light.png`,
    screenshotMobileDark: `${baseUrl}landing/screenshot-budget-mobile-dark.png`,
    screenshotDark: `${baseUrl}landing/screenshot-budget-dark.png`,
    alt: 'Reisotor Budget und Ausgabenübersicht',
    routePill: 'Budget & Kasse',
  },
  {
    id: 'packing',
    kicker: 'PERFEKT VORBEREITET',
    title: 'Packlisten & Vorräte gemeinsam abhaken',
    description:
      'Nichts vergessen – strukturierte Listen für Kleidung, Dokumente, Reiseapotheke und Vorräte. Weist Gegenstände Personen zu und verfolgt den Packfortschritt in Echtzeit.',
    highlights: [
      'Kategorisierte Listen mit Packfortschrittsbalken',
      'Zuweisung von Gegenständen an Mitreisende',
      '100% offline nutzbar im Flugzeug und unterwegs',
    ],
    icon: IconListCheck,
    color: 'var(--color-warning)',
    iconBg: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
    screenshotLight: `${baseUrl}landing/screenshot-packing-light.png`,
    screenshotMobileLight: `${baseUrl}landing/screenshot-packing-mobile-light.png`,
    screenshotMobileDark: `${baseUrl}landing/screenshot-packing-mobile-dark.png`,
    screenshotDark: `${baseUrl}landing/screenshot-packing-dark.png`,
    alt: 'Reisotor Packlisten und Einkäufe',
    routePill: 'Packlisten & Einkauf',
  },
  {
    id: 'diary',
    kicker: 'REISE-TAGEBUCH',
    title: 'Erinnerungen festhalten und teilen',
    description:
      'Dokumentiert eure schönsten Momente. Verknüpft Tagebucheinträge automatisch mit Ausflügen und teilt eure Notizen und Bilder mit der ganzen Gruppe.',
    highlights: [
      'Gemeinsames Tagebuch für die Reisegruppe',
      'Direkte Verknüpfung mit Spots und Touren',
      'Offline-verfügbar für das Schreiben unterwegs',
    ],
    icon: IconBook,
    color: 'var(--color-accent-secondary)',
    iconBg: 'color-mix(in srgb, var(--color-accent-secondary) 15%, transparent)',
    screenshotLight: `${baseUrl}landing/screenshot-diary-light.png`,
    screenshotMobileLight: `${baseUrl}landing/screenshot-diary-mobile-light.png`,
    screenshotMobileDark: `${baseUrl}landing/screenshot-diary-mobile-dark.png`,
    screenshotDark: `${baseUrl}landing/screenshot-diary-dark.png`,
    alt: 'Reisotor Tagebuch mit Einträgen und Fotos',
    routePill: 'Tagebuch & Fotos',
  },
];

const activeIndex = ref(0);
const glowOpacities = ref<number[]>(scrollyFeatures.map(() => 0));

const onScrollGlow = () => {
  const steps = document.querySelectorAll('.scrolly-step');
  if (!steps.length) return;
  const viewportCenter = window.innerHeight / 2;

  const opacities = Array.from(steps).map((step) => {
    const rect = step.getBoundingClientRect();
    const stepCenter = rect.top + rect.height / 2;
    const distance = Math.abs(stepCenter - viewportCenter);
    const maxDist = window.innerHeight * 0.6;
    return Math.max(0, 1 - distance / maxDist);
  });

  glowOpacities.value = opacities;
};

let stepObserver: IntersectionObserver | null = null;
let scrollObserver: IntersectionObserver | null = null;

onMounted(() => {
  window.addEventListener('scroll', onScrollGlow, { passive: true });
  // Init opacities on mount
  onScrollGlow();

  stepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const indexAttr = entry.target.getAttribute('data-index');
          if (indexAttr !== null) {
            activeIndex.value = parseInt(indexAttr, 10);
          }
        }
      });
    },
    {
      rootMargin: '-25% 0px -35% 0px',
      threshold: [0.2, 0.5],
    }
  );

  document.querySelectorAll('.scrolly-step').forEach((el) => {
    stepObserver?.observe(el);
  });

  if (!CSS.supports('(animation-timeline: view()) and (animation-range: 0% 100%)')) {
    scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fallback-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('.scroll-animate').forEach((el) => {
      scrollObserver?.observe(el);
      el.classList.add('fallback-mode');
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScrollGlow);
  stepObserver?.disconnect();
  scrollObserver?.disconnect();
});
</script>

<template>
  <div class="landing">
    <!-- Blurry glowing backgrounds -->
    <div class="glow-orb orb-1"></div>
    <div class="glow-orb orb-2"></div>
    <div class="glow-orb orb-3"></div>

    <header class="hero">
      <div class="hero-robot">
        <ReisotorRobot size="240px" :phase="robotPhase" interactive @packing-done="robotPhase = 'idle'" />
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

    <!-- 2. SEQUENTIAL SCROLLYTELLING SECTION (Apple-Style) -->
    <section class="scrollytelling-section">
      <div class="scrolly-header scroll-animate">
        <div class="scrolly-badge">
          <IconSparkles :size="16" />
          <span>ALLES AN EINEM ORT</span>
        </div>
        <h2 class="section-title">Reiseplanung neu gedacht</h2>
        <p class="section-subtitle">
          Vom ersten Gedanken bis zum Kofferpacken: Reisotor begleitet jeden Schritt eures Urlaubs.
        </p>
      </div>

      <div class="scrolly-layout">
        <!-- Sticky Showcase (Desktop / Tablet >= 768px) -->
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
                  <span class="address-domain"
                    >reisotor.app/{{ scrollyFeatures[activeIndex]?.id }}</span
                  >
                </div>
                <div class="chrome-tag">
                  {{ scrollyFeatures[activeIndex]?.routePill }}
                </div>
              </div>
              <div class="mockup-screen">
                <div
                  v-for="(feature, idx) in scrollyFeatures"
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
                  v-for="(feature, idx) in scrollyFeatures"
                  :key="'mobile-' + feature.id"
                  class="screenshot-frame"
                  :class="{
                    'is-active': activeIndex === idx,
                    'is-prev': activeIndex > idx,
                    'is-next': activeIndex < idx,
                  }"
                >
                  <picture>
                    <source
                      :srcset="feature.screenshotMobileDark"
                      media="(prefers-color-scheme: dark)"
                    />
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
              v-for="(feature, idx) in scrollyFeatures"
              :key="'glow-' + feature.id"
              class="stage-glow"
              :style="{
                background: `radial-gradient(circle, ${feature.color} 0%, transparent 70%)`,
                '--glow-mix': glowOpacities[idx],
              }"
            ></div>
          </div>
        </div>

        <!-- Scrolling Narrative Steps -->
        <div class="scrolly-steps">
          <div
            v-for="(feature, idx) in scrollyFeatures"
            :key="feature.id"
            class="scrolly-step"
            :data-index="idx"
            :class="{ 'is-active': activeIndex === idx }"
          >
            <div class="step-card">
              <div class="step-kicker">{{ feature.kicker }}</div>
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
                <li v-for="point in feature.highlights" :key="point">
                  <IconCheck :size="18" class="check-icon" :style="{ color: feature.color }" />
                  <span>{{ point }}</span>
                </li>
              </ul>

              <!-- Mobile inline screenshot preview (visible < 768px) -->
              <div class="mobile-screenshot-preview">
                <div class="mobile-device-mockup inline">
                  <div class="mockup-screen mobile-screen">
                    <picture>
                      <source
                        :srcset="feature.screenshotMobileDark"
                        media="(prefers-color-scheme: dark)"
                      />
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
            </div>
          </div>
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

/* --- SCROLLYTELLING SECTION (Sequential Apple-Style) --- */
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
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs, 0.75rem);
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--color-primary-tint);
  color: var(--color-primary);
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

/* Two-column layout */
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
  gap: 35vh;
  padding: 15vh 0 35vh 0;
  min-width: 0;
}

.scrolly-step {
  min-height: 45vh;
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
  font-size: var(--font-size-xs, 0.75rem);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-bottom: var(--space-2);
}

.step-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.step-icon {
  width: 52px;
  height: 52px;
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
  gap: var(--space-2);
}

.step-highlights li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.95rem;
  color: var(--color-text);
  font-weight: 500;
}

.check-icon {
  flex-shrink: 0;
}

/* Sticky Showcase Stage (Desktop/Tablet) */
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
    var(--shadow-xl),
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

.mobile-screenshot-preview {
  display: none;
}

/* Responsiveness */
@media (min-width: 1920px) {
  .scrollytelling-section {
    max-width: 1800px;
  }
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
  .scrolly-steps {
    gap: 25vh;
  }
  .chrome-address-bar {
    display: none;
  }
}

@media (max-width: 767px) {
  .scrolly-layout {
    flex-direction: column;
  }
  .scrolly-visual-wrapper {
    display: none;
  }
  .scrolly-steps {
    padding: 0;
    gap: var(--space-5);
  }
  .scrolly-step {
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
  .mobile-device-mockup.inline {
    position: relative;
    bottom: auto;
    right: auto;
    width: 100%;
    max-width: 260px;
    margin: 0 auto;
    box-shadow: var(--shadow-md);
  }
  .mobile-device-mockup.inline img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top;
  }
}

@media (prefers-reduced-motion: reduce) {
  .screenshot-frame {
    transition: none !important;
  }
  .step-card {
    transition: none !important;
  }
  .stage-glow {
    transition: none !important;
  }
}

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
    var(--shadow-xl),
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

@media (max-width: 767px) {
  .mobile-device-mockup:not(.inline) {
    display: none;
  }
}
</style>

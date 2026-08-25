<script setup lang="ts">
// Statische Marketing-Landingpage (Issue #172) - auth-unabhängig, kein Pinia/Router (siehe
// landing-main.ts). Wird zusammen mit dem Demo-Build (VITE_DEMO_MODE=true) über GitHub Pages
// veröffentlicht (.github/workflows/pages-deploy.yml).
const repoUrl = __REPO_URL__;
const demoUrl = './demo/';
const storybookUrl = './storybook/';

const features = [
  {
    icon: '📅',
    title: 'Gemeinsamer Kalender',
    text: 'Termine, Ausflüge und Reise-Etappen auf einen Blick – live synchron für alle Mitreisenden.',
  },
  {
    icon: '💶',
    title: 'Budget & Kasse',
    text: 'Wer hat was bezahlt? Gemeinsame und persönliche Töpfe, Ausgaben und Überweisungen im Griff.',
  },
  {
    icon: '🧳',
    title: 'Packlisten & Einkauf',
    text: 'Nichts vergessen – gemeinsame Listen mit Mengen, Zuständigkeiten und Fortschritt.',
  },
  {
    icon: '🎒',
    title: 'Spots & Touren',
    text: 'Unterkünfte, Sehenswürdigkeiten und Ausflüge sammeln, auf der Karte verorten, einplanen.',
  },
  {
    icon: '📴',
    title: 'Offline-first',
    text: 'Als App installierbar, funktioniert auch ohne Netz – Änderungen synchronisieren sich später.',
  },
  {
    icon: '🤝',
    title: 'Gemeinsam statt einsam',
    text: 'Ein Urlaub, mehrere Mitglieder – jede:r sieht denselben aktuellen Stand.',
  },
];
</script>

<template>
  <div class="landing">
    <header class="hero">
      <img src="/reisotor_logo.svg" alt="" width="120" height="120" class="hero-logo" />
      <h1>Reisotor</h1>
      <p class="tagline">
        Euren Urlaub gemeinsam planen – Kalender, Budget, Packlisten und Ausflüge an einem Ort.
      </p>
      <div class="hero-actions">
        <a :href="demoUrl" class="cta-primary">Demo ausprobieren</a>
        <a :href="storybookUrl" target="_blank" rel="noopener" class="cta-secondary"
          >🎨 Storybook (Design System)</a
        >
        <a :href="repoUrl" target="_blank" rel="noopener" class="cta-secondary"
          >Auf GitHub ansehen</a
        >
      </div>
    </header>

    <section class="screenshots">
      <div class="screenshot-frame">
        <!-- Landingpage hat keinen Theme-Umschalter (siehe landing-main.ts) - Dark/Light ergibt sich
             rein aus der Systemeinstellung, genau wie im Rest der App per prefers-color-scheme
             (stores/theme.ts's 'system'-Default). <picture> statt JS, damit der Browser nur die
             passende Variante überhaupt lädt. -->
        <picture>
          <source
            srcset="/landing/screenshot-dashboard-dark.png"
            media="(prefers-color-scheme: dark)"
          />
          <img
            src="/landing/screenshot-dashboard-light.png"
            alt="Reisotor-Dashboard mit Übersicht über einen Urlaub"
            loading="lazy"
          />
        </picture>
      </div>
      <div class="screenshot-frame screenshot-frame-mobile">
        <picture>
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
      </div>
    </section>

    <section class="features">
      <h2>Alles für die gemeinsame Reiseplanung</h2>
      <div class="feature-grid">
        <div v-for="feature in features" :key="feature.title" class="feature-card">
          <span class="feature-icon" aria-hidden="true">{{ feature.icon }}</span>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.text }}</p>
        </div>
      </div>
    </section>

    <section class="cta-band">
      <h2>Neugierig?</h2>
      <p>Probiert Reisotor direkt im Browser aus – mit Beispieldaten, ohne Anmeldung.</p>
      <a :href="demoUrl" class="cta-primary">Demo ausprobieren</a>
    </section>

    <section class="self-hosting">
      <h2>Wie kommt man an Reisotor?</h2>
      <p>
        Reisotor ist Open Source und aktuell nur per Self-Hosting verfügbar. Die
        <a :href="`${repoUrl}#readme`" target="_blank" rel="noopener">README</a> beschreibt lokale
        Entwicklung und
        <a :href="`${repoUrl}/blob/main/README.md#deployment`" target="_blank" rel="noopener"
          >Deployment</a
        >
        auf einem eigenen Server.
      </p>
    </section>

    <footer class="landing-footer">
      <p class="hint">
        <a :href="demoUrl">Live Demo</a> ·
        <a :href="storybookUrl" target="_blank" rel="noopener">Storybook Showcase</a> ·
        <a :href="repoUrl" target="_blank" rel="noopener">Reisotor auf GitHub</a>
      </p>
      <p class="hint">
        © {{ new Date().getFullYear() }}
        <a href="https://github.com/dmstern" target="_blank" rel="noopener">Daniel Morgenstern</a> ·
        gebaut mit Claude Code
      </p>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-3);
  background: linear-gradient(160deg, var(--color-primary-tint), var(--color-bg) 70%);
  border-radius: var(--radius-xl-squircle);
  animation: hero-fade-in 0.6s ease-out;
}

@keyframes hero-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.hero-logo {
  animation: hero-bob 3.2s ease-in-out infinite;
}

@keyframes hero-bob {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

.hero h1 {
  margin: 0;
  color: var(--color-primary-dark);
  font-size: 2.4rem;
}

.tagline {
  margin: 0;
  max-width: 40ch;
  color: var(--color-text-muted);
  font-size: 1.1rem;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.cta-primary,
.cta-secondary {
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-lg-squircle);
  font-weight: 600;
  text-decoration: none;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.cta-primary {
  background: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-sm);
}

.cta-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.cta-secondary {
  background: var(--color-bg);
  color: var(--color-primary-dark);
  border: 1px solid var(--color-primary);
}

.cta-secondary:hover {
  transform: translateY(-2px);
}

.screenshots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-end;
  gap: var(--space-4);
}

.screenshot-frame {
  border-radius: var(--radius-lg-squircle);
  overflow: hidden;
  box-shadow: var(--shadow-md);
  max-width: 100%;
}

.screenshot-frame img {
  display: block;
  max-width: 100%;
  height: auto;
}

.screenshot-frame-mobile {
  max-width: 260px;
}

.features h2,
.cta-band h2,
.self-hosting h2 {
  text-align: center;
  color: var(--color-primary-dark);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.feature-card {
  padding: var(--space-4);
  background: var(--color-bg);
  border-radius: var(--radius-md-squircle);
  box-shadow: var(--shadow-sm);
  text-align: center;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-md);
}

.feature-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: var(--space-2);
}

.feature-card h3 {
  margin: 0 0 var(--space-1);
}

.feature-card p {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.cta-band {
  text-align: center;
  padding: var(--space-5) var(--space-3);
  background: var(--color-primary-tint);
  border-radius: var(--radius-xl-squircle);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.self-hosting {
  text-align: center;
  max-width: 60ch;
  margin: 0 auto;
}

.landing-footer {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.hint {
  color: var(--color-text-muted);
  margin: 0;
  font-size: 0.85rem;
}

@media (prefers-reduced-motion: reduce) {
  .hero,
  .hero-logo {
    animation: none;
  }
}
</style>

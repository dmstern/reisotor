<script setup lang="ts">
// Reiner Spaß-Gimmick ohne echte Funktion (auf Wunsch): der Reisotor (dasselbe Roboter-Motiv wie im
// App-Logo, siehe public/reisotor_logo.svg – hier als animiertes Inline-SVG statt statischem Bild,
// damit einzelne Teile per CSS animiert werden können) "scannt" die Urlaubsregion und erklärt am
// Ende immer alles für total sicher. Ergebnisse/Meldungen sind rein zufällig ausgewählte Spaßtexte,
// keine echte Datenquelle/Bewertung.
import { computed, onUnmounted, ref } from 'vue';
import { useTripStore } from '../stores/trip';
import ReisotorRobot from '../components/ReisotorRobot.vue';

const tripStore = useTripStore();
const destinationLabel = computed(
  () => tripStore.currentTrip?.destination || tripStore.currentTrip?.name || 'eure Reiseregion',
);

type Phase = 'idle' | 'scanning' | 'done';
const phase = ref<Phase>('idle');

const SCAN_MESSAGES = [
  'Kontinentalplatten werden befragt … 🌍',
  'Flugzeug-Kaffeequalität wird verkostet … ☕✈️',
  'Erdbebensensoren durchgekitzelt … 📈',
  'Wolken auf Flugtauglichkeit geprüft … ☁️',
  'Sandburgen auf Standfestigkeit getestet … 🏖️',
  'Vulkane freundlich gefragt, ob heute Ruhetag ist … 🌋',
  'Wettervorhersage doppelt gegengecheckt … ⛅',
  'Sicherheitsgurte auf Kuscheligkeit geprüft … 🪢',
  'Reisotor-Antenne auf Empfang gestellt … 📡',
  'Möwen nach bösen Absichten befragt … 🕊️',
  'Zeitzone auf Plausibilität geprüft … 🕐',
  'Reisepass-Foto auf Sympathie-Faktor gescannt … 📷',
];

const CATEGORIES = [
  { icon: '✈️', label: 'Flugzeugsicherheit' },
  { icon: '🌍', label: 'Erdbebenrisiko' },
  { icon: '🌋', label: 'Vulkanaktivität' },
  { icon: '🦈', label: 'Strandabschnitt' },
  { icon: '👽', label: 'Außerirdische Aktivität' },
  { icon: '☔', label: 'Wetterchaos' },
  { icon: '🧳', label: 'Gepäck-Verschwörungen' },
  { icon: '🐍', label: 'Wildtier-Begegnungen' },
  { icon: '🛗', label: 'Hotel-Aufzüge' },
  { icon: '🧭', label: 'Verlaufens-Wahrscheinlichkeit' },
  { icon: '🦟', label: 'Mücken-Aufkommen' },
];

const VERDICTS = [
  'Alles im grünen Bereich!',
  'Total unbedenklich.',
  'Sicherer geht’s kaum.',
  'Keine Auffälligkeiten.',
  '100 % entspannt.',
  'Reisotor-approved.',
];

const QUOTES = [
  'Kein Grund zur Sorge – ich hab hier alles im Blick! 🤖✨',
  'Sicherer als die Keksdose zuhause.',
  'Selbst die Möwen wurden überprüft.',
  'Ich würde es euch sagen, wenn nicht. Aber es ist alles gut!',
  'Zertifiziert vom Reisotor-Sicherheitsbüro (gegründet: gerade eben).',
  'Mein Sensor für Sorgen zeigt: keine.',
];

const visibleMessages = ref<string[]>([]);
const results = ref<{ icon: string; label: string; verdict: string }[]>([]);
const quote = ref('');

let timers: number[] = [];
function clearTimers() {
  timers.forEach((t) => window.clearTimeout(t));
  timers = [];
}
onUnmounted(clearTimers);

function pickRandom<T>(pool: T[], count: number): T[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function startCheck() {
  clearTimers();
  phase.value = 'scanning';
  visibleMessages.value = [];
  results.value = [];
  quote.value = '';

  // Deutlich langsamer als ein technischer Ladebalken: die "Behörden" im Hintergrund brauchen
  // spürbar Zeit, jede Meldung soll in Ruhe lesbar sein, bevor die nächste erscheint.
  const MESSAGE_INTERVAL_MS = 1500;
  const messages = pickRandom(SCAN_MESSAGES, 5);
  messages.forEach((msg, i) => {
    timers.push(
      window.setTimeout(() => {
        visibleMessages.value.push(msg);
      }, MESSAGE_INTERVAL_MS * i + 400),
    );
  });

  timers.push(
    window.setTimeout(() => {
      results.value = pickRandom(CATEGORIES, 5).map((c) => ({
        ...c,
        verdict: VERDICTS[Math.floor(Math.random() * VERDICTS.length)],
      }));
      quote.value = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      phase.value = 'done';
    }, MESSAGE_INTERVAL_MS * messages.length + 1600),
  );
}
</script>

<template>
  <div class="page security-page">
    <h1>🛡️ Sicherheits-Check</h1>
    <p class="subtitle">
      Der Reisotor nimmt diese Mission über alle Maßen ernst – inklusive eigens entwickelter
      Sensorik, die kein Fachbuch kennt.
    </p>

    <div class="card robot-card">
      <ReisotorRobot :phase="phase" />

      <p v-if="phase === 'idle'" class="status-line">
        Bereit, {{ destinationLabel }} unter die Lupe zu nehmen. 🔍
      </p>

      <div v-if="phase === 'scanning'" class="scan-log">
        <TransitionGroup name="list" tag="ul">
          <li v-for="(msg, i) in visibleMessages" :key="msg + i">{{ msg }}</li>
        </TransitionGroup>
      </div>

      <Transition name="fade">
        <div v-if="phase === 'done'" class="result">
          <p class="score">✅ Sicherheits-Score: 100&nbsp;%</p>
          <p class="result-intro">Der Reisotor hat {{ destinationLabel }} gescannt:</p>
          <TransitionGroup name="list" tag="ul" class="result-list">
            <li v-for="r in results" :key="r.label">
              <span class="result-icon">{{ r.icon }}</span>
              <span class="result-label">{{ r.label }}</span>
              <span class="result-verdict">✔️ {{ r.verdict }}</span>
            </li>
          </TransitionGroup>
          <p class="quote">„{{ quote }}“</p>
        </div>
      </Transition>

      <button type="button" :disabled="phase === 'scanning'" @click="startCheck">
        {{ phase === 'done' ? '🔁 Nochmal prüfen' : phase === 'scanning' ? 'Scanne …' : '🔍 Sicherheit prüfen' }}
      </button>
    </div>

    <p class="disclaimer">
      Für Sicherheitsfragen jenseits der Reisotor-Zertifizierung hilft auch das Auswärtige Amt weiter.
    </p>
  </div>
</template>

<style scoped>
.subtitle {
  margin-top: -8px;
}

.robot-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
}

.status-line {
  margin: 0;
}

.scan-log {
  width: 100%;
  max-width: 360px;
  min-height: 90px;
}

.scan-log ul,
.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scan-log li {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
}

.score {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-success);
}

.result-intro {
  margin: 0;
  font-size: 0.9rem;
}

.result-list {
  width: 100%;
  max-width: 420px;
  text-align: left;
}

.result-list li {
  display: flex;
  align-items: center;
  /* flex-wrap zusammen mit dem festen flex-basis:100% am Verdict (siehe dort): das Verdict
     bekommt IMMER eine eigene volle Zeile unter Icon+Label, statt sich (fragil, je nach
     Textlänge/Breite unterschiedlich) eine Reihe mit dem Label zu teilen – das war der
     eigentliche Grund für das Überlappen/Herausragen auf schmalen Mobile-Breiten. */
  flex-wrap: wrap;
  gap: 2px var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-primary-tint);
}

.result-icon {
  font-size: 1.1rem;
}

.result-label {
  flex: 1;
  /* min-width:0 statt des Flexbox-Defaults auto: sonst verhindert die intrinsische Textbreite das
     Schrumpfen/Umbrechen und lange Kategorienamen ragen auf schmalen Breiten über die Box hinaus. */
  min-width: 0;
  font-weight: 600;
  font-size: 0.88rem;
}

.result-verdict {
  /* Erzwingt den Umbruch in eine eigene Zeile (siehe Kommentar an .result-list li) – flex-basis:100%
     beansprucht die volle Zeilenbreite, wodurch für Icon+Label garantiert kein Platz mehr auf
     derselben Zeile bleibt. */
  flex-basis: 100%;
  padding-left: calc(1.1rem + var(--space-2));
  font-size: 0.82rem;
  color: var(--color-success);
}

.quote {
  margin: var(--space-2) 0 0;
  font-style: italic;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.disclaimer {
  margin-top: var(--space-3);
  font-size: 0.8rem;
  text-align: center;
}
</style>

<script setup lang="ts">
// Reiner Spaß-Gimmick ohne echte Funktion (auf Wunsch): der Reisotor (dasselbe Roboter-Motiv wie im
// App-Logo, siehe public/reisotor_logo.svg – hier als animiertes Inline-SVG statt statischem Bild,
// damit einzelne Teile per CSS animiert werden können) "scannt" die Urlaubsregion und erklärt am
// Ende immer alles für total sicher. Ergebnisse/Meldungen sind rein zufällig ausgewählte Spaßtexte,
// keine echte Datenquelle/Bewertung.
import { computed, onUnmounted, ref } from 'vue';
import { useTripStore } from '../stores/trip';

const tripStore = useTripStore();
const destinationLabel = computed(
  () => tripStore.currentTrip?.destination || tripStore.currentTrip?.name || 'eure Reiseregion',
);

type Phase = 'idle' | 'scanning' | 'done';
const phase = ref<Phase>('idle');

const mouthPath = computed(() =>
  phase.value === 'done' ? 'M110 150 Q145 188 180 150' : 'M117 155 Q145 170 173 155',
);

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
      Rein zur Belustigung, ohne echte Funktion – der Reisotor nimmt seinen Job trotzdem sehr ernst.
    </p>

    <div class="card robot-card">
      <div class="robot-stage">
        <span v-if="phase === 'done'" class="sparkle sparkle-1">✨</span>
        <span v-if="phase === 'done'" class="sparkle sparkle-2">✨</span>
        <span v-if="phase === 'done'" class="sparkle sparkle-3">⭐</span>

        <svg viewBox="0 0 300 304" class="robot" :class="phase" aria-hidden="true">
          <!-- Antenne -->
          <line x1="145" y1="70" x2="145" y2="32" stroke="#2F8F86" stroke-width="5" stroke-linecap="round" />
          <g class="antenna-tip" transform="translate(145,18)">
            <polygon points="0,-16 6,-4 18,0 6,4 0,16 -6,4 -18,0 -6,-4" fill="#F4A261" />
            <circle r="5" fill="#FDF6EC" />
          </g>

          <!-- Radar-Pings während des Scans -->
          <circle class="ping ping-1" cx="145" cy="191" r="18" fill="none" stroke="#4FB3A9" stroke-width="4" />
          <circle class="ping ping-2" cx="145" cy="191" r="18" fill="none" stroke="#4FB3A9" stroke-width="4" />

          <!-- Kopf -->
          <rect class="head" x="71" y="66" width="148" height="126" rx="32" fill="#4FB3A9" />

          <!-- Augen: Pupille+Lichtreflex in eigener Gruppe, damit sie beim "Nachdenken" (idle)
               unabhängig von der Augenweiß-Blinzel-Animation hin- und herwackeln können. -->
          <g class="eye eye-left">
            <circle cx="113" cy="122" r="20" fill="#FDF6EC" />
            <g class="pupil-group">
              <circle cx="116" cy="127" r="8" fill="#1F3A3D" />
              <circle cx="113" cy="120" r="4" fill="#FFFFFF" opacity="0.9" />
            </g>
          </g>
          <g class="eye eye-right">
            <circle cx="177" cy="122" r="20" fill="#FDF6EC" />
            <g class="pupil-group">
              <circle cx="180" cy="127" r="8" fill="#1F3A3D" />
              <circle cx="177" cy="120" r="4" fill="#FFFFFF" opacity="0.9" />
            </g>
          </g>

          <path class="mouth" :d="mouthPath" fill="none" stroke="#1F3A3D" stroke-width="4" stroke-linecap="round" />

          <circle cx="85" cy="110" r="7" fill="#F4A261" />
          <circle cx="205" cy="110" r="7" fill="#F4A261" />

          <!-- Arme: Rumpf-Rect ist x=89..201, Schulterhöhe knapp unter dem Kopf. Runde Linienenden
               (stroke-linecap) + Handkreis ergeben dieselbe weiche Formsprache wie der Rest des
               Roboters, statt eckiger Gliedmaßen. -->
          <line x1="93" y1="208" x2="55" y2="240" stroke="#4FB3A9" stroke-width="14" stroke-linecap="round" />
          <circle cx="55" cy="240" r="12" fill="#FDF6EC" />
          <line x1="197" y1="208" x2="235" y2="240" stroke="#4FB3A9" stroke-width="14" stroke-linecap="round" />
          <circle cx="235" cy="240" r="12" fill="#FDF6EC" />

          <!-- Rumpf -->
          <rect x="89" y="194" width="112" height="80" rx="18" fill="#F4A261" />
          <rect class="badge" x="121" y="182" width="48" height="18" rx="9" fill="#E76F51" />
          <rect x="89" y="194" width="112" height="80" rx="18" fill="none" stroke="#E76F51" stroke-width="3" />
          <line x1="145" y1="208" x2="145" y2="260" stroke="#E76F51" stroke-width="3" />

          <!-- Füße -->
          <circle cx="115" cy="282" r="12" fill="#2F3E46" />
          <circle cx="175" cy="282" r="12" fill="#2F3E46" />
          <circle cx="115" cy="282" r="4" fill="#84A9AC" />
          <circle cx="175" cy="282" r="4" fill="#84A9AC" />
        </svg>
      </div>

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
      Kleiner Spaß zwischendurch, keine echte Risikoeinschätzung – für verlässliche Reisehinweise
      empfiehlt sich das Auswärtige Amt. 😉
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

.robot-stage {
  position: relative;
  width: 200px;
  max-width: 60vw;
}

.robot {
  width: 100%;
  height: auto;
  /* Sanftes Schweben im Ruhezustand, in allen Phasen aktiv – wirkt lebendiger als ein starres Bild. */
  animation: bob 3.2s ease-in-out infinite;
}

@keyframes bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

.robot.scanning {
  animation: bob 3.2s ease-in-out infinite, tilt 1.1s ease-in-out infinite;
}

@keyframes tilt {
  0%, 100% { rotate: -4deg; }
  50% { rotate: 4deg; }
}

.robot.done {
  animation: bob 3.2s ease-in-out infinite, cheer 0.6s ease-in-out 1;
}

@keyframes cheer {
  0% { transform: scale(1); }
  40% { transform: scale(1.08) translateY(-10px); }
  100% { transform: scale(1); }
}

/* Blinzeln: beide Augen zusammen, selten und kurz (98 % der Zeit offen). */
.eye {
  transform-origin: center;
  transform-box: fill-box;
  animation: blink 4.5s ease-in-out infinite;
}

@keyframes blink {
  0%, 94%, 100% { transform: scaleY(1); }
  96% { transform: scaleY(0.1); }
}

.robot.scanning .eye {
  animation: none;
  transform: scaleY(1.1);
}

/* Nachdenklich wirkendes Hin-und-Her der Pupillen (nicht der ganzen Augen), solange der Reisotor
   noch auf eine Anweisung wartet – pausiert automatisch, sobald phase auf "scanning"/"done"
   wechselt (kein .pupil-group-Animation-Selektor außerhalb von .robot.idle). */
.pupil-group {
  transform-box: fill-box;
  transform-origin: center;
}

.robot.idle .pupil-group {
  animation: look-wiggle 3.6s ease-in-out infinite;
}

@keyframes look-wiggle {
  0%, 100% { transform: translateX(0); }
  20%, 40% { transform: translateX(-3px); }
  60%, 80% { transform: translateX(3px); }
}

.mouth {
  transition: d 0.3s ease;
}

.antenna-tip {
  transform-origin: 145px 18px;
}

.robot.scanning .antenna-tip,
.robot.done .antenna-tip {
  animation: glow 0.9s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.ping {
  opacity: 0;
  transform-origin: 145px 191px;
  transform-box: fill-box;
}

.robot.scanning .ping-1 {
  animation: ping 1.4s ease-out infinite;
}

.robot.scanning .ping-2 {
  animation: ping 1.4s ease-out infinite 0.7s;
}

@keyframes ping {
  0% { transform: scale(0.6); opacity: 0.7; }
  100% { transform: scale(2.2); opacity: 0; }
}

.badge {
  transform-origin: center;
  transform-box: fill-box;
}

.robot.scanning .badge {
  animation: pulse 0.9s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.sparkle {
  position: absolute;
  font-size: 1.3rem;
  animation: float-up 1.6s ease-out infinite;
  pointer-events: none;
}

.sparkle-1 { top: 10%; left: 5%; animation-delay: 0s; }
.sparkle-2 { top: 15%; right: 0; animation-delay: 0.4s; }
.sparkle-3 { bottom: 25%; left: -5%; animation-delay: 0.8s; }

@keyframes float-up {
  0% { transform: translateY(0) scale(0.7); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateY(-40px) scale(1.1); opacity: 0; }
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
  gap: var(--space-2);
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-primary-tint);
}

.result-icon {
  font-size: 1.1rem;
}

.result-label {
  flex: 1;
  font-weight: 600;
  font-size: 0.88rem;
}

.result-verdict {
  font-size: 0.82rem;
  color: var(--color-success);
  white-space: nowrap;
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

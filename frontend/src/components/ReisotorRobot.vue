<script setup lang="ts">
// Animiertes Inline-SVG des Reisotor-Roboters (dasselbe Motiv wie public/reisotor_logo.svg), als
// Inline-SVG statt statischem Bild, damit einzelne Teile per CSS animiert werden können. Ursprünglich
// nur in SecurityCheckView.vue (Scan-Animation), jetzt auch auf der Login-Seite (Augen-zuhalten beim
// Passwort-Anzeigen) – deshalb als eigene, wiederverwendbare Komponente statt dupliziertem Markup.
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** idle: schwebt/blinzelt normal. scanning/done: siehe SecurityCheckView.vue. */
    phase?: 'idle' | 'scanning' | 'done';
    /** Hält sich mit beiden Armen die Augen zu (z. B. während ein Passwort sichtbar ist). */
    coveringEyes?: boolean;
    /** CSS-Breite; Höhe ergibt sich aus dem SVG-Seitenverhältnis. */
    size?: string;
  }>(),
  {
    phase: 'idle',
    coveringEyes: false,
    size: '200px',
  },
);

const mouthPath = computed(() =>
  props.phase === 'done' ? 'M110 150 Q145 188 180 150' : 'M117 155 Q145 170 173 155',
);
</script>

<template>
  <div class="robot-stage" :style="{ width: size }">
    <span v-if="phase === 'done'" class="sparkle sparkle-1">✨</span>
    <span v-if="phase === 'done'" class="sparkle sparkle-2">✨</span>
    <span v-if="phase === 'done'" class="sparkle sparkle-3">⭐</span>

    <svg
      viewBox="0 0 300 304"
      class="robot"
      :class="[phase, { 'covering-eyes': coveringEyes }]"
      aria-hidden="true"
    >
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

      <!-- Augen: Pupille+Lichtreflex in eigener Gruppe, damit sie unabhängig von der
           Augenweiß-Blinzel-Animation hin- und herrollen können. -->
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

      <!-- Arme (Ruhepose): Rumpf-Rect ist x=89..201, Schulterhöhe knapp unter dem Kopf. Runde
           Linienenden (stroke-linecap) + Handkreis ergeben dieselbe weiche Formsprache wie der Rest
           des Roboters. Eigene Gruppe mit transform-origin am Schulterpunkt, damit sie während des
           Scans ums Schultergelenk schwingen können statt sich um ihren Mittelpunkt zu drehen.
           Dunkle Outline-Linie zuerst (breiter, gleiche Koordinaten) darunter, dann die eigentliche
           Armfarbe darüber – sonst verschwimmt der Arm (ursprünglich dieselbe Kopf-Teal-Farbe) beim
           Überlappen mit Kopf/Rumpf sichtbar mit deren Flächen. Eigene, dunklere Teal-Farbe
           (#2F8F86, schon von der Antenne bekannt) statt der Kopf-Farbe #4FB3A9 sorgt zusätzlich für
           Kontrast. Handkreis bekommt denselben dunklen Rand, damit die helle Hand auch vor dem
           ebenfalls hellen Augenweiß erkennbar bleibt (siehe Augen-zuhalten-Pose unten). -->
      <g class="arm arm-left">
        <line x1="93" y1="208" x2="55" y2="240" stroke="#1F3A3D" stroke-width="18" stroke-linecap="round" />
        <line x1="93" y1="208" x2="55" y2="240" stroke="#2F8F86" stroke-width="14" stroke-linecap="round" />
        <circle cx="55" cy="240" r="12" fill="#FDF6EC" stroke="#1F3A3D" stroke-width="2" />
      </g>
      <g class="arm arm-right">
        <line x1="197" y1="208" x2="235" y2="240" stroke="#1F3A3D" stroke-width="18" stroke-linecap="round" />
        <line x1="197" y1="208" x2="235" y2="240" stroke="#2F8F86" stroke-width="14" stroke-linecap="round" />
        <circle cx="235" cy="240" r="12" fill="#FDF6EC" stroke="#1F3A3D" stroke-width="2" />
      </g>

      <!-- Arme (Augen-zuhalten-Pose): eigene gebogene Form statt einer Drehung der Ruhepose – der
           Abstand Schulter→Auge ist größer als die kurze Ruhe-Armlänge, eine reine Rotation könnte
           die Hand also nie bis zum Auge bringen. Blendet per Opacity-Crossfade mit der Ruhepose um
           (siehe .arm/.arm-cover unten). Dieselbe Outline-Technik wie oben, aus demselben Grund. -->
      <g class="arm-cover arm-cover-left">
        <path d="M93,208 Q90,160 113,122" stroke="#1F3A3D" stroke-width="18" stroke-linecap="round" fill="none" />
        <path d="M93,208 Q90,160 113,122" stroke="#2F8F86" stroke-width="14" stroke-linecap="round" fill="none" />
        <circle cx="113" cy="122" r="13" fill="#FDF6EC" stroke="#1F3A3D" stroke-width="2" />
      </g>
      <g class="arm-cover arm-cover-right">
        <path d="M197,208 Q200,160 177,122" stroke="#1F3A3D" stroke-width="18" stroke-linecap="round" fill="none" />
        <path d="M197,208 Q200,160 177,122" stroke="#2F8F86" stroke-width="14" stroke-linecap="round" fill="none" />
        <circle cx="177" cy="122" r="13" fill="#FDF6EC" stroke="#1F3A3D" stroke-width="2" />
      </g>

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
</template>

<style scoped>
.robot-stage {
  position: relative;
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

/* Pupillen (nicht die ganzen Augen) rollen in allen Zuständen immer mal wieder sanft hin und her –
   ein durchgehender kleiner Lebendigkeits-Tick. Kombiniert konfliktfrei mit der Blinzel-Animation
   der Eltern-.eye (unterschiedliche Elemente) bzw. mit deren scaleY-Fixierung während des Scans. */
.pupil-group {
  transform-box: fill-box;
  transform-origin: center;
  animation: look-roll 4.2s ease-in-out infinite;
}

@keyframes look-roll {
  0%, 100% { transform: translate(0, 0); }
  15% { transform: translate(-3px, -1px); }
  30% { transform: translate(-3px, 1px); }
  50% { transform: translate(0, 0); }
  65% { transform: translate(3px, -1px); }
  80% { transform: translate(3px, 1px); }
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

/* Arme schwingen nur während des Scans etwas – sieht aus, als würde der Reisotor dabei
   "arbeiten". transform-box: view-box statt fill-box: der Drehpunkt soll der feste Schulterpunkt
   im SVG-Koordinatensystem sein, nicht die (durch Linie+Handkreis unregelmäßige) eigene
   Bounding-Box der Gruppe. Rechter Arm mit halber Periode versetzt, damit beide gegenläufig statt
   synchron schwingen. */
.arm-left {
  transform-box: view-box;
  transform-origin: 93px 208px;
}

.arm-right {
  transform-box: view-box;
  transform-origin: 197px 208px;
}

.robot.scanning .arm-left,
.robot.scanning .arm-right {
  animation: armswing 1s ease-in-out infinite;
}

.robot.scanning .arm-right {
  animation-delay: 0.5s;
}

@keyframes armswing {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(10deg); }
}

/* Ruhepose <-> Augen-zuhalten-Pose per Opacity-Crossfade statt Pfad-Morphing (die beiden Formen
   haben unterschiedliche Pfad-Kommandos, "d" lässt sich zwischen ihnen nicht sauber animieren). */
.arm,
.arm-cover {
  transition: opacity 0.35s ease;
}

.arm-cover {
  opacity: 0;
}

.robot.covering-eyes .arm {
  opacity: 0;
}

.robot.covering-eyes .arm-cover {
  opacity: 1;
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
</style>

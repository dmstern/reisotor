<script setup lang="ts">
// Animiertes Inline-SVG des Reisotor-Roboters im neuen Logo-Design (EVE + Wall-E Vibe, basierend auf
// reisotor-icon-blank.svg / reisotor-icon-circle.svg / reisotor-icon-full.svg).
// Eingesetzt in:
// - SecurityCheckView.vue: 'idle' (lebendiges Schweben/Linsen-Fokus), 'scanning' (Autofokus-Scan nach unten,
//   holografischer Scanner-Kegel & Radar-Pings), 'done' (freudiger Sprung, Linsenglanz, Glitzer).
// - LoginView.vue: 'coveringEyes' (Passwort sichtbar -> magnetische Schwebe-Arme gleiten hoch und verdecken
//   die Linsen, mechanische Shutter-Lider schließen sich Wall-E-typisch leicht schräg).
// - SplashScreen.vue: 'packing' (Roboter fokussiert Reisegepäck, saugt Flugticket & Reisekamera elastisch ein,
//   Rucksack dockt an Rücken an, stolzer Blick, feuert packingDone).
import { useId } from 'vue';

withDefaults(
  defineProps<{
    /** idle: schwebt/blinzelt normal. scanning/done: siehe SecurityCheckView.vue. packing: packt
     *  einmalig Reiseutensilien in den Rucksack und dockt ihn an, siehe SplashScreen.vue. */
    phase?: 'idle' | 'scanning' | 'done' | 'packing';
    /** Hält sich mit beiden Armen die Augen zu (z. B. während ein Passwort sichtbar ist). */
    coveringEyes?: boolean;
    /** CSS-Breite; Höhe ergibt sich aus dem quadratischen 500x500 SVG-Seitenverhältnis. */
    size?: string;
    /** Hintergrund-Variante des Logos: blank (transparent), circle (runder Farbverlauf), full (Squircle) */
    variant?: 'blank' | 'circle' | 'full';
  }>(),
  {
    phase: 'idle',
    coveringEyes: false,
    size: '200px',
    variant: 'blank',
  }
);

const uid = useId();

// Signalisiert das Ende der Rucksack-Pack-Sequenz für SplashScreen.vue
const emit = defineEmits<{ packingDone: [] }>();

function onAnimationEnd(event: AnimationEvent) {
  if (event.animationName === 'pack-backpack-anim') {
    emit('packingDone');
  }
}
</script>

<template>
  <div
    class="robot-stage"
    :style="{ width: size }"
    :class="[`variant-${variant}`]"
    @animationend="onAnimationEnd"
  >
    <!-- Glitzer & Sterne im Erfolgszustand -->
    <span v-if="phase === 'done'" class="sparkle sparkle-1" aria-hidden="true">✨</span>
    <span v-if="phase === 'done'" class="sparkle sparkle-2" aria-hidden="true">✨</span>
    <span v-if="phase === 'done'" class="sparkle sparkle-3" aria-hidden="true">⭐</span>

    <svg
      viewBox="0 0 500 500"
      class="robot"
      :class="[phase, { 'covering-eyes': coveringEyes }]"
      aria-hidden="true"
    >
      <defs>
        <!-- Master Farbverlauf Pink -> Orange -->
        <linearGradient :id="`${uid}-mainGrad`" x1="0.1" y1="1" x2="0.9" y2="0">
          <stop offset="0%" stop-color="#d81b60" />
          <stop offset="45%" stop-color="#e91e63" />
          <stop offset="100%" stop-color="#ff9800" />
        </linearGradient>

        <!-- Pin Farbverlauf -->
        <linearGradient
          :id="`${uid}-linearGradient15`"
          x1="130"
          y1="256.25"
          x2="370"
          y2="256.25"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(2.1628,0.9144)"
        >
          <stop offset="0%" stop-color="#d81b60" />
          <stop offset="45%" stop-color="#e91e63" />
          <stop offset="100%" stop-color="#ff9800" />
        </linearGradient>

        <!-- Glow Farbverlauf -->
        <linearGradient
          :id="`${uid}-linearGradient77`"
          x1="142.56"
          y1="402.68"
          x2="426.76"
          y2="47.43"
          gradientTransform="matrix(0.87825,0,0,1.13863,7.4818,-8.7331)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stop-color="#d81b60" />
          <stop offset="45%" stop-color="#e91e63" />
          <stop offset="100%" stop-color="#ff9800" />
        </linearGradient>

        <!-- Kopf Kapsel-Farbverlauf -->
        <linearGradient
          :id="`${uid}-linearGradient80`"
          x1="66.1"
          y1="463.03"
          x2="245.7"
          y2="238.53"
          gradientTransform="scale(1.60357,0.62361)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stop-color="#d81b60" />
          <stop offset="45%" stop-color="#e91e63" />
          <stop offset="100%" stop-color="#ff9800" />
        </linearGradient>

        <!-- Antenne Stab & Kugel -->
        <linearGradient
          :id="`${uid}-linearGradient78`"
          x1="361.94"
          y1="125.78"
          x2="383.41"
          y2="98.95"
          gradientTransform="matrix(0.67082,0,0,1.49071,-0.2,-84.7517)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stop-color="#d81b60" />
          <stop offset="45%" stop-color="#e91e63" />
          <stop offset="100%" stop-color="#ff9800" />
        </linearGradient>

        <linearGradient
          :id="`${uid}-linearGradient79`"
          x1="188.45"
          y1="205.76"
          x2="219.8"
          y2="166.57"
          gradientTransform="matrix(1.22474,0,0,0.8165,-0.2,-84.7517)"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stop-color="#d81b60" />
          <stop offset="45%" stop-color="#e91e63" />
          <stop offset="100%" stop-color="#ff9800" />
        </linearGradient>

        <!-- Hintergrund-Farbverläufe (Circle & Full) -->
        <linearGradient
          :id="`${uid}-linearGradient10`"
          x1="261.94"
          y1="22.09"
          x2="238.06"
          y2="477.91"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(1.09541,0,0,1.14687,-23.8528,-36.7184)"
        >
          <stop offset="0%" stop-color="#9336af" />
          <stop offset="100%" stop-color="#35003f" />
        </linearGradient>

        <linearGradient
          :id="`${uid}-linearGradient82`"
          x1="134.74"
          y1="4.5"
          x2="253.97"
          y2="371.44"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(1.29766,0,0,1.33217,-0.7718,0.8293)"
        >
          <stop offset="0%" stop-color="#9336af" />
          <stop offset="100%" stop-color="#35003f" />
        </linearGradient>

        <!-- Linsen-Gradients (Lokale Linsenkoordinaten) -->
        <linearGradient
          :id="`${uid}-rimGrad`"
          x1="43"
          y1="5"
          x2="157"
          y2="195"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(2.5,0,0,2.5,-120.5,417.5)"
        >
          <stop offset="0%" stop-color="#4a4a4a" />
          <stop offset="20%" stop-color="#2a2a2a" />
          <stop offset="80%" stop-color="#1a1a1a" />
          <stop offset="100%" stop-color="#0a0a0a" />
        </linearGradient>

        <linearGradient
          :id="`${uid}-rimInnerGrad`"
          x1="21"
          y1="179"
          x2="179"
          y2="21"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(2.5,0,0,2.5,-120.5,417.5)"
        >
          <stop offset="0%" stop-color="#050505" />
          <stop offset="100%" stop-color="#2a2a2a" />
        </linearGradient>

        <radialGradient
          :id="`${uid}-glassBase`"
          cx="92.6"
          cy="92.6"
          r="81.4"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(2.5,0,0,2.5,-120.5,417.5)"
        >
          <stop offset="0%" stop-color="#020815" />
          <stop offset="50%" stop-color="#051225" />
          <stop offset="80%" stop-color="#0a2540" />
          <stop offset="100%" stop-color="#051525" />
        </radialGradient>

        <radialGradient
          :id="`${uid}-tealHighlight`"
          cx="70.4"
          cy="137"
          r="66.6"
          fx="55.6"
          fy="151.8"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(2.5,0,0,2.5,-120.5,417.5)"
        >
          <stop offset="0%" stop-color="rgb(0, 180, 160)" stop-opacity="0.6" />
          <stop offset="40%" stop-color="rgb(0, 80, 100)" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>

        <radialGradient
          :id="`${uid}-blueHighlight`"
          cx="129.6"
          cy="100"
          r="74"
          fx="144.4"
          fy="92.6"
          gradientUnits="userSpaceOnUse"
          gradientTransform="matrix(2.5,0,0,2.5,-120.5,417.5)"
        >
          <stop offset="0%" stop-color="rgb(40, 120, 220)" stop-opacity="0.8" />
          <stop offset="30%" stop-color="rgb(20, 70, 160)" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0" />
        </radialGradient>

        <!-- Scanner Hologramm-Kegel Gradient -->
        <linearGradient :id="`${uid}-scanBeamGrad`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00e5ff" stop-opacity="0.38" />
          <stop offset="50%" stop-color="#e91e63" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ff9800" stop-opacity="0" />
        </linearGradient>

        <!-- Filter: Map Pin Glow -->
        <filter :id="`${uid}-glow`" x="-0.16" y="-0.12" width="1.32" height="1.24">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4" />
          </feComponentTransfer>
        </filter>

        <!-- Filter: Velvet Bumps für Pin Body -->
        <filter
          :id="`${uid}-filter55`"
          x="-0.11"
          y="-0.08"
          width="1.22"
          height="1.16"
          style="color-interpolation-filters: sRGB"
        >
          <feGaussianBlur result="result6" stdDeviation="3" in="SourceGraphic" />
          <feColorMatrix
            values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0"
            result="result7"
            in="SourceGraphic"
          />
          <feComposite operator="in" in="result6" in2="result7" result="fbSourceGraphic" />
          <feColorMatrix
            result="fbSourceGraphicAlpha"
            in="fbSourceGraphic"
            values="0 0 0 -1 0 0 0 0 -1 0 0 0 0 -1 0 0 0 0 1 0"
          />
          <feFlood result="flood" in="fbSourceGraphic" flood-opacity="0.45" flood-color="#890092" />
          <feGaussianBlur result="blur" in="fbSourceGraphic" stdDeviation="5.3" />
          <feOffset result="offset" in="blur" dx="0" dy="3.3" />
          <feComposite result="comp1" operator="in" in="flood" in2="offset" />
          <feComposite result="fbSourceGraphic" operator="over" in="fbSourceGraphic" in2="comp1" />
          <feColorMatrix
            result="fbSourceGraphicAlpha"
            in="fbSourceGraphic"
            values="0 0 0 -1 0 0 0 0 -1 0 0 0 0 -1 0 0 0 0 1 0"
          />
          <feGaussianBlur stdDeviation="1" result="result3" in="fbSourceGraphic" />
          <feBlend in2="result3" result="result5" mode="screen" in="fbSourceGraphic" />
          <feGaussianBlur stdDeviation="1" result="result7" />
          <feConvolveMatrix
            order="3 3"
            kernelMatrix="2 0 0 1 1 -1 0 0 -2"
            targetX="1"
            targetY="1"
            result="result8"
          />
          <feBlend mode="darken" in="result7" result="result6" in2="result8" />
        </filter>

        <!-- Filter: Velvet Bumps für Visier -->
        <filter
          :id="`${uid}-filter88`"
          x="-0.04"
          y="-0.07"
          width="1.08"
          height="1.14"
          style="color-interpolation-filters: sRGB"
        >
          <feGaussianBlur stdDeviation="1" result="result3" />
          <feBlend in2="result3" result="result5" mode="screen" in="SourceGraphic" />
          <feGaussianBlur stdDeviation="1" result="result7" />
          <feConvolveMatrix
            order="3 3"
            kernelMatrix="2 0 0 1 1 -1 0 0 -2"
            targetX="1"
            targetY="1"
            result="result8"
          />
          <feBlend mode="darken" in="result7" result="result6" in2="result8" />
        </filter>

        <!-- Filter: Drop Shadow für Robot Group -->
        <filter
          :id="`${uid}-filter71`"
          x="-0.15"
          y="-0.25"
          width="1.3"
          height="1.55"
          style="color-interpolation-filters: sRGB"
        >
          <feFlood result="flood" in="SourceGraphic" flood-opacity="0.35" flood-color="#890092" />
          <feGaussianBlur result="blur" in="SourceGraphic" stdDeviation="5.3" />
          <feOffset result="offset" in="blur" dx="0" dy="3.3" />
          <feComposite result="comp1" operator="in" in="flood" in2="offset" />
          <feComposite result="comp2" operator="over" in="SourceGraphic" in2="comp1" />
        </filter>

        <!-- Clip-Path für die Linsen-Shutter (innerhalb des r=185 Glases) -->
        <clipPath :id="`${uid}-lens-clip`">
          <circle cx="129.5" cy="667.5" r="185" />
        </clipPath>
      </defs>

      <!-- Hintergrundvarianten (falls angefordert) -->
      <rect
        v-if="variant === 'full'"
        class="bg-full"
        width="500"
        height="500"
        rx="100"
        :fill="`url(#${uid}-linearGradient82)`"
      />
      <circle
        v-else-if="variant === 'circle'"
        class="bg-circle"
        cx="250"
        cy="250"
        r="250"
        :fill="`url(#${uid}-linearGradient10)`"
      />

      <!-- Holografischer Scanner & Radar-Pings (SecurityCheck 'scanning') -->
      <g class="scanner-group">
        <polygon
          class="scan-cone"
          points="230,410 270,410 380,490 120,490"
          :fill="`url(#${uid}-scanBeamGrad)`"
        />
        <line class="scan-line" x1="120" y1="465" x2="380" y2="465" />
        <circle class="ping ping-1" cx="250" cy="415" r="12" fill="none" />
        <circle class="ping ping-2" cx="250" cy="415" r="12" fill="none" />
        <circle class="ping ping-3" cx="250" cy="415" r="12" fill="none" />
      </g>

      <!-- Reisegepäck & Gegenstände (Loading / 'packing') -->
      <!-- VOR dem Roboter-Hauptkörper im DOM, damit der Rucksack in seiner Endpose
           hinter dem Pin-Körper liegt und magnetisch angedockt wirkt -->
      <g class="backpack-group">
        <rect class="backpack-body" width="56" height="68" rx="16" />
        <rect class="backpack-pocket" x="10" y="34" width="36" height="24" rx="8" />
        <line class="backpack-zip" x1="16" y1="42" x2="40" y2="42" />
        <path class="backpack-strap" d="M 12,4 C 8,20 8,50 12,64" />
        <path class="backpack-strap" d="M 44,4 C 48,20 48,50 44,64" />
        <circle cx="28" cy="18" r="6" fill="#fdf6ec" />
      </g>

      <!-- Pack-Gegenstand 1: Reisepass / Flugticket -->
      <g class="pack-item pack-item-1">
        <rect
          x="-14"
          y="-18"
          width="28"
          height="36"
          rx="4"
          fill="#fdf6ec"
          stroke="#1f3a3d"
          stroke-width="2"
        />
        <rect x="-10" y="-12" width="20" height="6" rx="2" fill="#e91e63" />
        <line x1="-10" y1="2" x2="10" y2="2" stroke="#ff9800" stroke-width="2" />
        <line x1="-10" y1="8" x2="4" y2="8" stroke="#ff9800" stroke-width="2" />
      </g>

      <!-- Pack-Gegenstand 2: Mini-Reisekamera -->
      <g class="pack-item pack-item-2">
        <rect
          x="-15"
          y="-11"
          width="30"
          height="22"
          rx="5"
          fill="#e91e63"
          stroke="#1f3a3d"
          stroke-width="2"
        />
        <rect x="-6" y="-15" width="12" height="4" rx="2" fill="#1f3a3d" />
        <circle cx="0" cy="0" r="7" fill="#1f3a3d" />
        <circle cx="0" cy="0" r="5" fill="#fdf6ec" />
        <circle cx="1" cy="-1" r="2" fill="#00e5ff" />
      </g>

      <!-- Roboter-Hauptfigur (Pin, Visier, Linsen, Antenne, Schwebe-Arme) -->
      <g class="robot-character">
        <!-- Glow-Aura hinter dem Pin -->
        <path
          d="m 137.48175,201.26687 a 120,120 0 1 1 240,0 c 0,110 -90,190 -105,205 q -15,15 -30,0 c -15,-15 -105,-95 -105,-205 z"
          :fill="`url(#${uid}-linearGradient77)`"
          :filter="`url(#${uid}-glow)`"
          class="pin-glow"
        />

        <!-- Pin Hauptkörper (mit rundem Ausschnitt in der Mitte) -->
        <path
          class="pin-body"
          :fill="`url(#${uid}-linearGradient15)`"
          :filter="`url(#${uid}-filter55)`"
          d="M 243.97335,91.193652 A 120,120 0 0 0 132.1628,210.91435 c 0,110 90,190 105,205 10,10 20,10 30,0 15,-15 105,-95 105,-205 A 120,120 0 0 0 243.97335,91.193652 Z m 8.18945,41.720698 a 78,78 0 0 1 78,78 78,78 0 0 1 -78,78 78,78 0 0 1 -78,-78 78,78 0 0 1 78,-78 z"
        />

        <!-- Antenne -->
        <g class="antenna" transform="translate(1.0972,2.5602)">
          <rect
            x="246.8"
            y="70.25"
            width="6"
            height="20"
            rx="3"
            :fill="`url(#${uid}-linearGradient78)`"
          />
          <circle
            class="antenna-tip"
            cx="249.8"
            cy="65.25"
            r="8"
            :fill="`url(#${uid}-linearGradient79)`"
          />
        </g>

        <!-- Roboter-Kopf mit Visier und Kamera-Linsen -->
        <g
          class="robot-head"
          :filter="`url(#${uid}-filter71)`"
          transform="translate(2.1628,-3.2236)"
        >
          <!-- Kapsel-Visier -->
          <rect
            x="190"
            y="175"
            width="120"
            height="70"
            rx="35"
            :fill="`url(#${uid}-linearGradient80)`"
            :filter="`url(#${uid}-filter88)`"
            class="head-visor"
          />

          <!-- Schüchterne Roboter-Wangen (Blush bei verdeckten Augen) -->
          <g class="visor-blush">
            <ellipse cx="214" cy="228" rx="8" ry="4" fill="#ff4081" class="blush-cheek" />
            <ellipse cx="270" cy="228" rx="8" ry="4" fill="#ff4081" class="blush-cheek" />
          </g>

          <!-- Rechtes Auge (vom Betrachter aus rechts, x=261) -->
          <!-- Äußere Gruppe hält feste Position & Matrix-Skalierung -->
          <g class="eye-anchor" transform="matrix(0.057006,0,0,0.057006,253.6094,171.922)">
            <!-- Innere Gruppe für CSS-Linsenanimationen (Autofokus-Zoom, Tilt, Blinzeln) -->
            <g class="eye-lens eye-lens-right">
              <circle
                cx="129.5"
                cy="667.5"
                r="237.5"
                :fill="`url(#${uid}-rimGrad)`"
                stroke-width="2.5"
              />
              <circle
                cx="129.5"
                cy="667.5"
                r="197.5"
                :fill="`url(#${uid}-rimInnerGrad)`"
                stroke-width="2.5"
              />
              <circle
                cx="129.5"
                cy="667.5"
                r="185"
                :fill="`url(#${uid}-glassBase)`"
                stroke-width="2.5"
              />

              <!-- Pupille & Kern (eigenständig animierbar) -->
              <g class="pupil-group">
                <circle cx="129.5" cy="667.5" r="105" fill="#01040a" stroke-width="2.5" />
                <circle cx="122" cy="662.5" r="105" fill="#030814" stroke-width="2.5" />
              </g>

              <!-- Licht- und Reflexionsschichten -->
              <circle
                cx="129.5"
                cy="667.5"
                r="185"
                :fill="`url(#${uid}-tealHighlight)`"
                stroke-width="2.5"
                class="lens-reflection"
              />
              <circle
                cx="129.5"
                cy="667.5"
                r="185"
                :fill="`url(#${uid}-blueHighlight)`"
                stroke-width="2.5"
                class="lens-reflection"
              />
              <path
                d="m 154.5,497.5 a 162.5,162.5 0 0 1 145,120 185,185 0 0 0 -170,-135 z"
                fill="#ffffff"
                fill-opacity="0.08"
                stroke-width="2.5"
              />

              <!-- Mechanisches Shutter-Lid (für kurzes Idle-Blinzeln) -->
              <g :clip-path="`url(#${uid}-lens-clip)`">
                <path
                  class="shutter-lid shutter-right"
                  d="M -70,450 L 330,495 L 330,820 L -70,820 Z"
                />
              </g>
            </g>
          </g>

          <!-- Linkes Auge (vom Betrachter aus links, x=223.6, asymmetrisch versetzt) -->
          <g class="eye-anchor" transform="matrix(0.057006,0,0,0.057006,216.2655,171.698)">
            <g class="eye-lens eye-lens-left">
              <circle
                cx="129.5"
                cy="667.5"
                r="237.5"
                :fill="`url(#${uid}-rimGrad)`"
                stroke-width="2.5"
              />
              <circle
                cx="129.5"
                cy="667.5"
                r="197.5"
                :fill="`url(#${uid}-rimInnerGrad)`"
                stroke-width="2.5"
              />
              <circle
                cx="129.5"
                cy="667.5"
                r="185"
                :fill="`url(#${uid}-glassBase)`"
                stroke-width="2.5"
              />

              <!-- Pupille & Kern -->
              <g class="pupil-group">
                <circle cx="129.5" cy="667.5" r="105" fill="#01040a" stroke-width="2.5" />
                <circle cx="122" cy="662.5" r="105" fill="#030814" stroke-width="2.5" />
              </g>

              <!-- Licht- und Reflexionsschichten -->
              <circle
                cx="129.5"
                cy="667.5"
                r="185"
                :fill="`url(#${uid}-tealHighlight)`"
                stroke-width="2.5"
                class="lens-reflection"
              />
              <circle
                cx="129.5"
                cy="667.5"
                r="185"
                :fill="`url(#${uid}-blueHighlight)`"
                stroke-width="2.5"
                class="lens-reflection"
              />
              <path
                d="m 154.5,497.5 a 162.5,162.5 0 0 1 145,120 185,185 0 0 0 -170,-135 z"
                fill="#ffffff"
                fill-opacity="0.08"
                stroke-width="2.5"
              />

              <!-- Mechanisches Shutter-Lid (Wall-E typisch gegengleich geneigt für Idle-Blink) -->
              <g :clip-path="`url(#${uid}-lens-clip)`">
                <path
                  class="shutter-lid shutter-left"
                  d="M -70,495 L 330,450 L 330,820 L -70,820 Z"
                />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.robot-stage {
  position: relative;
  display: inline-flex;
  justify-content: center;
  align-items: center;
  max-width: 60vw;
}

.robot {
  width: 100%;
  height: auto;
  overflow: visible;
  /* EVE-artiges, sanftes Schweben in allen Phasen */
  animation: hover-bob 3.2s ease-in-out infinite;
  transform-origin: 250px 250px;
}

@keyframes hover-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-8px) rotate(0.6deg);
  }
}

/* ==========================================================================
   1. SecurityCheck Phasen (scanning & done)
   ========================================================================== */
.robot.scanning {
  animation:
    hover-bob 3.2s ease-in-out infinite,
    scanning-wobble 1.8s ease-in-out infinite;
}

@keyframes scanning-wobble {
  0%,
  100% {
    transform: translateY(2px) rotate(-2.5deg);
  }
  50% {
    transform: translateY(2px) rotate(2.5deg);
  }
}

.robot.scanning .robot-head {
  animation: scan-head-down 1.8s ease-in-out infinite;
}

@keyframes scan-head-down {
  0%,
  100% {
    transform: translate(2px, -3px);
  }
  50% {
    transform: translate(2px, 5px);
  }
}

/* Kamera-Linsen fokussieren aktiv (Autofokus-Zoom auf der inneren .eye-lens Gruppe) */
.eye-lens {
  transform-origin: 129.5px 667.5px;
}

.robot.scanning .eye-lens {
  animation: scan-autofocus 1.3s ease-in-out infinite alternate;
}

@keyframes scan-autofocus {
  0% {
    transform: scale(0.96);
  }
  100% {
    transform: scale(1.08);
  }
}

.robot.scanning .pupil-group {
  animation: scan-sweep 1.6s ease-in-out infinite alternate !important;
}

@keyframes scan-sweep {
  0% {
    transform: translate(-30px, 25px);
  }
  100% {
    transform: translate(30px, 25px);
  }
}

/* Antennenspitze pulsiert rhythmisch bei Signalübertragung */
.antenna-tip {
  transform-origin: 249.8px 65.25px;
}

.robot.scanning .antenna-tip {
  animation: antenna-pulse 0.6s ease-in-out infinite alternate;
}

.robot.done .antenna-tip {
  animation: antenna-glow 1s ease-in-out infinite alternate;
}

@keyframes antenna-pulse {
  0% {
    opacity: 0.45;
    filter: drop-shadow(0 0 2px #ff9800);
  }
  100% {
    opacity: 1;
    filter: drop-shadow(0 0 10px #00e5ff);
  }
}

@keyframes antenna-glow {
  0% {
    opacity: 0.7;
    filter: drop-shadow(0 0 4px #ff9800);
  }
  100% {
    opacity: 1;
    filter: drop-shadow(0 0 12px #ffb703);
  }
}

/* Holografischer Scanner & Radar-Pings */
.scanner-group {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
}

.robot.scanning .scanner-group {
  opacity: 1;
}

.scan-cone {
  animation: cone-flicker 2.2s ease-in-out infinite alternate;
}

@keyframes cone-flicker {
  0% {
    opacity: 0.6;
  }
  100% {
    opacity: 0.95;
  }
}

.scan-line {
  stroke: #00e5ff;
  stroke-width: 3.5;
  stroke-linecap: round;
  filter: drop-shadow(0 0 6px #00e5ff);
  animation: scan-line-sweep 1.5s ease-in-out infinite alternate;
}

@keyframes scan-line-sweep {
  0% {
    transform: translateY(-40px);
    opacity: 0.4;
  }
  100% {
    transform: translateY(15px);
    opacity: 1;
  }
}

.ping {
  opacity: 0;
  transform-origin: 250px 415px;
  stroke-width: 3.5;
}

.ping-1 {
  stroke: #ff9800;
}
.ping-2 {
  stroke: #e91e63;
}
.ping-3 {
  stroke: #00e5ff;
}

.robot.scanning .ping-1 {
  animation: radar-ping 1.8s ease-out infinite;
}
.robot.scanning .ping-2 {
  animation: radar-ping 1.8s ease-out infinite 0.6s;
}
.robot.scanning .ping-3 {
  animation: radar-ping 1.8s ease-out infinite 1.2s;
}

@keyframes radar-ping {
  0% {
    transform: scale(0.6);
    opacity: 0.9;
  }
  100% {
    transform: scale(3.5);
    opacity: 0;
  }
}

/* Done / Jubel-Animation */
.robot.done {
  animation:
    hover-bob 3.2s ease-in-out infinite,
    cheer-hop 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
}

@keyframes cheer-hop {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.08) translateY(-14px);
  }
  100% {
    transform: scale(1);
  }
}

.robot.done .eye-lens {
  animation: eyes-gleam 0.7s ease-in-out 1;
}

@keyframes eyes-gleam {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.12);
  }
}

/* ==========================================================================
   2. Pupillen- und Linsen-Lebendigkeit (Wall-E Vibe)
   ========================================================================== */
.pupil-group {
  transform-box: fill-box;
  transform-origin: center;
  animation: pupil-look-wander 5.5s ease-in-out infinite;
}

@keyframes pupil-look-wander {
  0%,
  100% {
    transform: translate(0, 0);
  }
  15% {
    transform: translate(-20px, -6px);
  }
  30% {
    transform: translate(-20px, 8px);
  }
  48% {
    transform: translate(0, 0);
  }
  65% {
    transform: translate(22px, -6px);
  }
  80% {
    transform: translate(22px, 8px);
  }
}

/* ==========================================================================
   3. Login: Privacy-Modus / Kameralinsen-Abdeckung (coveringEyes)
   ========================================================================== */

/* Schüchterne Wangen-Röte auf dem Visier */
.blush-cheek {
  opacity: 0;
  filter: blur(1.5px);
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.robot.covering-eyes .blush-cheek {
  opacity: 0.65;
}

/* Kopf schüchtern ducken & leicht wegdrehen ("Ich guck nicht!") */
.robot.covering-eyes .robot-character {
  transform: translateY(2px);
  transition: transform 0.4s ease;
}

.robot.covering-eyes .robot-head {
  transform: translate(0px, 3px) rotate(-4deg);
  transform-origin: 250px 210px;
  transition: transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.robot.covering-eyes .antenna {
  transform: translate(-3px, 3px) rotate(-12deg);
  transform-origin: 250px 85px;
  transition: transform 0.45s ease;
}

/* Wall-E Augenzukneifen: Linsen neigen sich verlegen (/ \) und kneifen sich mechanisch zusammen */
.robot.covering-eyes .eye-lens-right {
  transform: rotate(-14deg) scaleY(0.16) scaleX(1.05);
  transition: transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Linkes Auge kneift zu, linst aber alle ~3.6s neugierig hervor (Wall-E Peek) */
.robot.covering-eyes .eye-lens-left {
  animation: wall-e-squint-peek-left 3.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
}

@keyframes wall-e-squint-peek-left {
  0% {
    transform: rotate(0deg) scale(1);
  }
  8%,
  44% {
    /* Fest zugekniffen */
    transform: rotate(14deg) scaleY(0.16) scaleX(1.05);
  }
  52%,
  68% {
    /* Neugieriges Blinzeln: Auge öffnet sich zu 85% */
    transform: rotate(4deg) scaleY(0.85) scaleX(1);
  }
  76%,
  100% {
    /* Ertappt! Schnell wieder feste zukneifen */
    transform: rotate(14deg) scaleY(0.16) scaleX(1.05);
  }
}

/* Linke Pupille schielt während des Peek-Spalts neugierig nach unten-rechts zum Passwortfeld */
.robot.covering-eyes .eye-lens-left .pupil-group {
  animation: wall-e-peek-pupil 3.6s ease-in-out infinite;
}

@keyframes wall-e-peek-pupil {
  0%,
  44% {
    transform: translate(0, 0);
  }
  52%,
  68% {
    transform: translate(24px, 20px) scale(0.9);
  }
  76%,
  100% {
    transform: translate(0, 0);
  }
}

/* Mechanische Shutter-Lider (für kurzes Idle-Blinzeln) */
.shutter-lid {
  fill: #141922;
  stroke: #ff9800;
  stroke-width: 6;
  opacity: 0.96;
  transform-box: fill-box;
  transform: translateY(-360px);
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* Gelegentliches kurzes Roboter-Blinzeln im Idle-Zustand */
.robot.idle:not(.covering-eyes) .shutter-lid {
  animation: mechanical-blink 4.8s ease-in-out infinite;
}

@keyframes mechanical-blink {
  0%,
  94%,
  100% {
    transform: translateY(-360px);
  }
  96% {
    transform: translateY(0);
  }
}

/* ==========================================================================
   4. Loading / Packing (SplashScreen.vue)
   ========================================================================== */
.backpack-group,
.pack-item {
  transform-box: view-box;
  transform-origin: 0px 0px;
  opacity: 0;
}

.backpack-body {
  fill: #1f3a3d;
  stroke: #2f8f86;
  stroke-width: 3;
}

.backpack-pocket {
  fill: #e91e63;
}

.backpack-zip {
  stroke: #ff9800;
  stroke-width: 2.5;
  stroke-linecap: round;
}

.backpack-strap {
  stroke: #ff9800;
  stroke-width: 4;
  stroke-linecap: round;
  fill: none;
}

.robot.packing .backpack-group {
  opacity: 1;
  animation: pack-backpack-anim 2.1s ease-in-out 1 forwards;
}

.robot.packing .pack-item-1 {
  opacity: 1;
  animation: pack-item-1-anim 0.6s ease-in 0.25s 1 both;
}

.robot.packing .pack-item-2 {
  opacity: 1;
  animation: pack-item-2-anim 0.6s ease-in 0.75s 1 both;
}

.robot.packing .robot-head {
  animation: pack-look-down 2.1s ease-in-out 1;
}

.robot.packing .pupil-group {
  animation: pack-pupils-down 2.1s ease-in-out 1 !important;
}

@keyframes pack-look-down {
  0% {
    transform: translate(2px, -3px);
  }
  15%,
  70% {
    transform: translate(2px, 8px) rotate(3deg);
  }
  88% {
    transform: translate(2px, -6px) rotate(-2deg);
  }
  100% {
    transform: translate(2px, -3px) rotate(0deg);
  }
}

@keyframes pack-pupils-down {
  0% {
    transform: translate(0, 0);
  }
  15%,
  65% {
    transform: translate(0, 45px);
  }
  85%,
  100% {
    transform: translate(0, 0);
  }
}

/* Rucksack-Choreografie: Am Boden neben dem Pin -> elastische Wipper bei Item-Einschlag ->
   Schwungvoller Bogen auf den Rücken/Pin (dockt links hinten an) -> Ende markiert packingDone */
@keyframes pack-backpack-anim {
  0% {
    opacity: 0;
    transform: translate(320px, 340px) scale(0.6);
  }
  10% {
    opacity: 1;
    transform: translate(320px, 330px) scale(1);
  }
  38% {
    transform: translate(320px, 330px) scale(1);
  }
  42% {
    transform: translate(320px, 322px) rotate(-5deg) scale(1.12);
  }
  46% {
    transform: translate(320px, 330px) scale(1);
  }
  62% {
    transform: translate(320px, 330px) scale(1);
  }
  66% {
    transform: translate(320px, 322px) rotate(5deg) scale(1.12);
  }
  70% {
    transform: translate(320px, 330px) scale(1);
  }
  85% {
    transform: translate(200px, 210px) rotate(-22deg) scale(1.05);
  }
  100% {
    opacity: 1;
    transform: translate(110px, 220px) rotate(-10deg) scale(0.92);
  }
}

/* Gegenstand 1 (Ticket) fliegt in den Rucksack */
@keyframes pack-item-1-anim {
  0% {
    transform: translate(180px, 370px) scale(0.9);
    opacity: 0;
  }
  20% {
    transform: translate(180px, 350px) scale(1.1);
    opacity: 1;
  }
  75% {
    transform: translate(290px, 320px) scale(0.85);
    opacity: 1;
  }
  100% {
    transform: translate(348px, 360px) scale(0);
    opacity: 0;
  }
}

/* Gegenstand 2 (Kamera) fliegt zeitversetzt hinterher */
@keyframes pack-item-2-anim {
  0% {
    transform: translate(150px, 320px) scale(0.9);
    opacity: 0;
  }
  20% {
    transform: translate(150px, 290px) scale(1.15);
    opacity: 1;
  }
  75% {
    transform: translate(280px, 300px) scale(0.85);
    opacity: 1;
  }
  100% {
    transform: translate(348px, 360px) scale(0);
    opacity: 0;
  }
}

/* ==========================================================================
   5. Sparkles & Glitzer
   ========================================================================== */
.sparkle {
  position: absolute;
  font-size: 1.3rem;
  animation: float-sparkle 1.6s ease-out infinite;
  pointer-events: none;
}

.sparkle-1 {
  top: 10%;
  left: 8%;
  animation-delay: 0s;
}
.sparkle-2 {
  top: 15%;
  right: 5%;
  animation-delay: 0.4s;
}
.sparkle-3 {
  bottom: 25%;
  left: 2%;
  animation-delay: 0.8s;
}

@keyframes float-sparkle {
  0% {
    transform: translateY(0) scale(0.7);
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    transform: translateY(-38px) scale(1.15);
    opacity: 0;
  }
}

/* ==========================================================================
   6. Reduzierte Bewegung (Barrierefreiheit)
   ========================================================================== */
@media (prefers-reduced-motion: reduce) {
  .robot,
  .robot.scanning,
  .robot.done,
  .robot.packing,
  .robot-character,
  .robot-head,
  .antenna-tip,
  .scanner-group,
  .scan-cone,
  .scan-line,
  .ping,
  .eye-lens,
  .pupil-group,
  .shutter-lid,
  .blush-cheek,
  .backpack-group,
  .pack-item,
  .sparkle {
    animation-duration: 0.01s !important;
    animation-delay: 0s !important;
    transition-duration: 0.01s !important;
  }
}
</style>

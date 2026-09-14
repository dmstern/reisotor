<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  count: number;
}>();

// Stufen für Papierknäuel im Korb:
// 0: Leer
// 1: 1 Knäuel am Boden
// 2-3: 3 Knäuel
// 4+: Voller Korb (5 Knäuel, einer lugt oben heraus)
const ballTier = computed(() => {
  if (props.count <= 0) return 0;
  if (props.count === 1) return 1;
  if (props.count <= 3) return 2;
  return 3;
});
</script>

<template>
  <div class="trash-preview-stage" aria-hidden="true" :class="`tier-${ballTier}`">
    <svg viewBox="0 0 100 88" class="trash-svg" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Schatten unter dem Papierkorb -->
        <radialGradient id="trash-floor-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="rgba(0,0,0,0.28)" />
          <stop offset="60%" stop-color="rgba(0,0,0,0.12)" />
          <stop offset="100%" stop-color="rgba(0,0,0,0)" />
        </radialGradient>

        <!-- Metall-Farbverlauf für die Ränder -->
        <linearGradient id="trash-metal-rim" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#94a3b8" />
          <stop offset="30%" stop-color="#cbd5e1" />
          <stop offset="50%" stop-color="#f8fafc" />
          <stop offset="70%" stop-color="#cbd5e1" />
          <stop offset="100%" stop-color="#64748b" />
        </linearGradient>

        <!-- Korb-Innenraum Schattenverlauf -->
        <linearGradient id="trash-inner-shadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(15, 23, 42, 0.22)" />
          <stop offset="100%" stop-color="rgba(15, 23, 42, 0.08)" />
        </linearGradient>
      </defs>

      <!-- 1. Kontaktschatten auf dem Boden -->
      <ellipse cx="50" cy="81" rx="30" ry="5.5" fill="url(#trash-floor-shadow)" />

      <!-- 2. Hinterwand des Korbs (Innenraum) -->
      <path
        d="M 16 16 L 26 74 A 24 6 0 0 0 74 74 L 84 16 A 34 8 0 0 1 16 16 Z"
        fill="url(#trash-inner-shadow)"
      />

      <!-- 3. Hinterer oberer Rand -->
      <path
        d="M 16 16 A 34 8 0 0 1 84 16"
        stroke="#64748b"
        stroke-width="1.6"
        stroke-linecap="round"
        opacity="0.4"
      />

      <!-- ============================================== -->
      <!-- PAPIERKNÄUEL (je nach Anzahl unterschiedlich voll) -->
      <!-- ============================================== -->
      <g class="paper-balls">
        <!-- Knäuel 1: Mitte unten (sichtbar ab 1 Objekt) -->
        <g v-if="ballTier >= 1" class="paper-ball ball-bottom-center">
          <!-- Facetten des zerknüllten Papiers -->
          <polygon
            points="46,56 56,53 62,62 55,71 44,69 39,61"
            fill="#f8fafc"
            stroke="#cbd5e1"
            stroke-width="0.75"
          />
          <polygon points="46,56 56,53 52,62" fill="#ffffff" />
          <polygon points="56,53 62,62 54,65" fill="#e2e8f0" />
          <polygon points="62,62 55,71 50,65" fill="#cbd5e1" />
          <polygon points="55,71 44,69 49,63" fill="#94a3b8" />
          <polygon points="44,69 39,61 46,62" fill="#e2e8f0" />
          <polygon points="39,61 46,56 47,63" fill="#f1f5f9" />
          <!-- Geknickte Kantenlinie -->
          <polyline points="46,56 52,62 55,71" stroke="rgba(0,0,0,0.15)" stroke-width="0.8" />
        </g>

        <!-- Knäuel 2: Links unten (sichtbar ab 2 Objekten) -->
        <g v-if="ballTier >= 2" class="paper-ball ball-bottom-left">
          <polygon
            points="28,51 38,47 44,57 37,66 26,63 22,55"
            fill="#fef08a"
            stroke="#fde047"
            stroke-width="0.75"
          />
          <polygon points="28,51 38,47 34,56" fill="#fef9c3" />
          <polygon points="38,47 44,57 36,60" fill="#fef08a" />
          <polygon points="44,57 37,66 32,59" fill="#fde047" />
          <polygon points="37,66 26,63 31,57" fill="#eab308" />
          <polygon points="26,63 22,55 29,56" fill="#fef08a" />
          <polyline points="28,51 34,56 37,66" stroke="rgba(161,98,7,0.2)" stroke-width="0.8" />
        </g>

        <!-- Knäuel 3: Rechts unten (sichtbar ab 2 Objekten) -->
        <g v-if="ballTier >= 2" class="paper-ball ball-bottom-right">
          <polygon
            points="58,49 68,46 75,54 69,64 57,61 53,53"
            fill="#e0f2fe"
            stroke="#bae6fd"
            stroke-width="0.75"
          />
          <polygon points="58,49 68,46 64,54" fill="#f0f9ff" />
          <polygon points="68,46 75,54 67,57" fill="#e0f2fe" />
          <polygon points="75,54 69,64 63,57" fill="#bae6fd" />
          <polygon points="69,64 57,61 63,55" fill="#7dd3fc" />
          <polyline points="58,49 64,54 69,64" stroke="rgba(3,105,161,0.2)" stroke-width="0.8" />
        </g>

        <!-- Knäuel 4: Mitte oben (sichtbar ab 4 Objekten) -->
        <g v-if="ballTier >= 3" class="paper-ball ball-mid">
          <polygon
            points="36,36 49,32 58,41 51,52 38,48 31,41"
            fill="#f1f5f9"
            stroke="#cbd5e1"
            stroke-width="0.75"
          />
          <polygon points="36,36 49,32 44,42" fill="#ffffff" />
          <polygon points="49,32 58,41 49,44" fill="#e2e8f0" />
          <polygon points="58,41 51,52 45,44" fill="#cbd5e1" />
          <polygon points="51,52 38,48 43,43" fill="#94a3b8" />
          <polyline points="36,36 44,42 51,52" stroke="rgba(0,0,0,0.18)" stroke-width="0.8" />
        </g>

        <!-- Knäuel 5: Über den Rand ragendes Knäuel (sichtbar ab 4 Objekten) -->
        <g v-if="ballTier >= 3" class="paper-ball ball-top-overflow">
          <polygon
            points="52,21 65,17 73,26 66,37 53,34 47,26"
            fill="#fed7aa"
            stroke="#fdba74"
            stroke-width="0.8"
          />
          <polygon points="52,21 65,17 60,27" fill="#ffedd5" />
          <polygon points="65,17 73,26 64,29" fill="#fed7aa" />
          <polygon points="73,26 66,37 59,30" fill="#fdba74" />
          <polygon points="66,37 53,34 58,28" fill="#fb923c" />
          <polygon points="53,34 47,26 54,27" fill="#ffedd5" />
          <polyline points="52,21 60,27 66,37" stroke="rgba(194,65,12,0.25)" stroke-width="0.85" />
        </g>
      </g>

      <!-- 4. Gitter-Drahtstreben des Korbs (Vorderseite) -->
      <!-- Vertikale Drahtstreben -->
      <g stroke="rgba(148, 163, 184, 0.45)" stroke-width="1.4" stroke-linecap="round">
        <line x1="23" y1="23" x2="31" y2="76" />
        <line x1="33" y1="24" x2="39" y2="78" />
        <line x1="44" y1="24.5" x2="46" y2="79" />
        <line x1="56" y1="24.5" x2="54" y2="79" />
        <line x1="67" y1="24" x2="61" y2="78" />
        <line x1="77" y1="23" x2="69" y2="76" />
      </g>

      <!-- Horizontale Drahtringe / Verstärkungsreifen -->
      <path
        d="M 19 36 A 31 7 0 0 0 81 36"
        stroke="rgba(148, 163, 184, 0.55)"
        stroke-width="1.3"
        fill="none"
      />
      <path
        d="M 22 55 A 28 6 0 0 0 78 55"
        stroke="rgba(148, 163, 184, 0.55)"
        stroke-width="1.3"
        fill="none"
      />

      <!-- 5. Korb-Bodenring (Vorderseite) -->
      <path
        d="M 26 74 A 24 6 0 0 0 74 74"
        stroke="url(#trash-metal-rim)"
        stroke-width="3"
        stroke-linecap="round"
      />

      <!-- 6. Oberer massiver Metall-Rand (Vorderseite) -->
      <path
        d="M 16 16 A 34 8 0 0 0 84 16"
        stroke="url(#trash-metal-rim)"
        stroke-width="3.2"
        stroke-linecap="round"
      />

      <!-- Glanz-Highlight auf dem oberen Rand -->
      <path
        d="M 32 20 A 24 5 0 0 0 68 20"
        stroke="rgba(255, 255, 255, 0.85)"
        stroke-width="1"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  </div>
</template>

<style scoped>
.trash-preview-stage {
  position: relative;
  width: 90px;
  height: 80px;
  margin: 4px auto 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.trash-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
  transition: transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.paper-ball {
  transform-origin: center;
  transition:
    transform 0.3s cubic-bezier(0.34, 1.4, 0.64, 1),
    opacity 0.2s ease;
}

/* Hover-Wackeleffekt über Elternelement */
:deep(.tile:hover) .trash-svg,
.trash-preview-stage:hover .trash-svg {
  animation: trash-wiggle 0.5s ease-in-out;
}

:deep(.tile:hover) .ball-top-overflow,
.trash-preview-stage:hover .ball-top-overflow {
  transform: translateY(-2px) rotate(4deg);
}

@keyframes trash-wiggle {
  0% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-3deg) translateY(-2px);
  }
  40% {
    transform: rotate(3deg) translateY(-2px);
  }
  60% {
    transform: rotate(-1.5deg) translateY(-1px);
  }
  80% {
    transform: rotate(1deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

:root[data-theme='dark'] .trash-svg {
  filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.4));
}
</style>

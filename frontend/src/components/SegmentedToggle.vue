<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import type { IconGroup, IconStyle, IconVariant } from '../stores/iconStyle';
import type { IconDef } from '../utils/icon';

// Echter schiebender Segmented-Control (statt zweier unabhängig hervorgehobener Buttons wie
// bisher, siehe ExcursionsView.vue's Gruppieren/Sortieren-Umschalter): eine per CSS transform
// animierte Hintergrund-Pille gleitet zwischen den Optionen statt nur die Farbe hart umzuschalten -
// näher an nativen iOS-Segmented-Controls, ohne eine neue Interaktion (weiterhin ein einzelner
// Klick pro Option) einzuführen. Generisch für beliebig viele Optionen, aktuell überall mit genau
// zwei genutzt.
const props = defineProps<{
  modelValue: string;
  // dot: optionaler roter "neu"-Punkt je Option (z. B. Spots/Touren-Umschalter in
  // ExcursionsView.vue), gleiches Aussehen wie NavBar.vue's .unseen-dot. Optional, bestehende
  // Verwendungsstellen ohne dot bleiben unverändert.
  // icon/iconGroup: optionales Icon vor dem Label (siehe utils/icon.ts) statt eines ins Label
  // eingebackenen Emoji-Zeichens - iconGroup default 'actions', da die meisten Verwendungsstellen
  // Toggle-/Filter-Buttons sind (siehe stores/iconStyle.ts's ICON_GROUP_OPTIONS).
  // forceStyle/forceVariant: optional, an das AppIcon durchgereicht (siehe dortige Props) - nötig
  // für Optionen, die IMMER eine bestimmte Darstellung zeigen sollen (z. B. IconStyleSettings.vue's
  // Emoji/Symbole- bzw. Outline/Gefüllt-Beispiel-Icons), unabhängig vom aktuell aktiven Store-Wert.
  options: {
    value: string;
    label: string;
    dot?: boolean;
    icon?: IconDef;
    iconGroup?: IconGroup;
    forceStyle?: IconStyle;
    forceVariant?: IconVariant;
  }[];
}>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

// -1 (kein Match) statt auf 0 zu klammern, wenn modelValue keiner der options entspricht (z. B.
// "individuell angepasst" bei den Push-Leveln in ProfileView.vue) - die Pille wird dann komplett
// ausgeblendet statt fälschlich unter der ersten Option zu kleben.
const activeIndex = computed(() => props.options.findIndex((o) => o.value === props.modelValue));
</script>

<template>
  <div class="segmented-toggle" :style="{ '--count': options.length, '--active-index': Math.max(0, activeIndex) }">
    <span v-if="activeIndex !== -1" class="segmented-thumb" aria-hidden="true"></span>
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="segmented-option"
      :class="{ active: option.value === modelValue }"
      :aria-pressed="option.value === modelValue"
      @click="emit('update:modelValue', option.value)"
    >
      <AppIcon
        v-if="option.icon"
        :icon="option.icon"
        :group="option.iconGroup ?? 'actions'"
        :force-style="option.forceStyle"
        :force-variant="option.forceVariant"
        :size="14"
      />
      <span class="segmented-option-label">{{ option.label }}</span>
      <span v-if="option.dot" class="segmented-dot" aria-label="Neue Änderungen" />
    </button>
  </div>
</template>

<style scoped>
/* Voll rund (border-radius:999px) statt Squircle - ein Segmented-Control ist konzeptionell näher an
   den anderen "vollständig runden" Pillen/Chips (siehe DESIGN.md, Abschnitt "Eckenrundung") als an
   einer Card/einem Button. --shadow-inset + --texture-grain (siehe DESIGN.md, Abschnitt "Weiches
   Material") lassen den Track wie eine leicht eingelassene Rinne wirken, in der die Pille unten
   sichtbar "liegt", statt nur eine flache zweite Fläche zu sein. */
.segmented-toggle {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--count), 1fr);
  background-color: var(--color-hover);
  background-image: var(--texture-grain);
  background-blend-mode: overlay;
  border-radius: 999px;
  padding: 4px;
  gap: 2px;
  box-shadow: var(--shadow-inset);
}

/* Gleitet per transform statt left/width-Änderungen - eine Eigenschaft zu animieren reicht,
   läuft dadurch auf dem Compositor statt bei jedem Frame Layout neu zu berechnen.
   --shadow-pill-raised (Glanzrand oben, Gewichts-Schatten unten, sanfte Abhebung vom Track) gibt der
   Pille ein weiches, aufgepolstertes/gummi-haftiges statt rein flaches Erscheinungsbild. */
.segmented-thumb {
  position: absolute;
  inset: 4px;
  width: calc((100% - 8px) / var(--count));
  background: var(--color-surface);
  border-radius: 999px;
  box-shadow: var(--shadow-pill-raised);
  transform: translateX(calc(var(--active-index) * 100%));
  transition: transform 0.2s ease;
}

.segmented-option {
  position: relative;
  z-index: 1;
  padding: 5px 10px;
  border: none;
  /* Explizit zurückgesetzt statt sich auf style.css's globale button-Regel zu verlassen (#95 gab
     jedem <button> per Default einen Schatten) - hier trägt bereits .segmented-thumb den einzigen
     gewollten Schatten (--shadow-pill-raised) für die aktive Option; ein zusätzlicher Schatten auf
     JEDER Option (auch den inaktiven, gegen den flachen Track sichtbar) sah wie ein Rendering-Fehler
     aus statt einer bewusst erhobenen Pille. */
  box-shadow: none;
  background: none;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s ease;
}

.segmented-option.active {
  color: var(--color-primary-dark);
}

.segmented-dot {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 1.5px solid var(--color-surface);
}
</style>

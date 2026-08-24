<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from './primitives/Button.vue';

// Wiederverwendbare "Papierlisten"-Inline-Add-Zeile: im Ruhezustand nur ein dezentes "+" und eine
// dünne Linie statt eines vollen Formularfelds, damit gruppierte Listen (Einkauf, ToDo, Packliste)
// nicht durch ein Eingabefeld pro Gruppe überfrachtet wirken. Bei Fokus/Eingabe expandiert die Zeile
// zu einem normal bedienbaren Eingabefeld inkl. optionaler Zusatzfelder (Slot "extra", z. B. Shop/
// Zeitraum bei Einkauf) - eine zentrale Stelle für dieses Interaktionsmuster statt einer Ad-hoc-
// Umsetzung pro Liste (siehe CLAUDE.md "Konsistenz-Check").
const props = withDefaults(defineProps<{ placeholder?: string; disabled?: boolean }>(), {
  placeholder: 'Hinzufügen…',
  disabled: false,
});
const emit = defineEmits<{ (e: 'submit', label: string): void }>();

const label = ref('');
const focused = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const formRef = ref<HTMLFormElement | null>(null);

const expanded = computed(() => focused.value || label.value.trim().length > 0);

function submit() {
  const trimmed = label.value.trim();
  if (!trimmed) return;
  emit('submit', trimmed);
  label.value = '';
  inputRef.value?.focus();
}

function onBlur(event: FocusEvent) {
  // Springt der Fokus direkt auf ein Zusatzfeld im "extra"-Slot (z. B. Kategorie/Unterkategorie),
  // trägt relatedTarget das bereits - dann sofort nicht einklappen. Ohne diese Prüfung riss ein
  // Klick/Tab direkt in ein noch-leeres Zusatzfeld (Label selbst noch nie befüllt) die Zeile wieder
  // ein, noch bevor der Timeout unten greifen konnte, und das gerade fokussierte Feld verschwand samt
  // Fokus mitten in der Eingabe (siehe Bug 126).
  const next = event.relatedTarget as Node | null;
  if (next && formRef.value?.contains(next)) return;
  // Leichte Verzögerung: ein Klick auf ein Zusatzfeld im "extra"-Slot (z. B. ein <select>) löst vorher
  // ein blur auf diesem Eingabefeld aus - ohne Verzögerung würde die Zeile schon einklappen, bevor
  // die Auswahl im Zusatzfeld ankommt.
  window.setTimeout(() => {
    if (!label.value.trim() && !formRef.value?.contains(document.activeElement)) focused.value = false;
  }, 150);
}
</script>

<template>
  <form ref="formRef" class="quick-add-row" :class="{ expanded }" @submit.prevent="submit">
    <div class="main-row">
      <span class="plus" aria-hidden="true">+</span>
      <input
        ref="inputRef"
        v-model="label"
        type="text"
        class="label-input"
        :placeholder="props.placeholder"
        :disabled="props.disabled"
        @focus="focused = true"
        @blur="onBlur"
      />
      <Button
        v-if="expanded"
        type="submit"
        class="submit-btn"
        :disabled="!label.trim()"
        aria-label="Hinzufügen"
        title="Hinzufügen"
      >
        +
      </Button>
    </div>
    <!-- Eigene, volle Zeile statt Teil von .main-row: die Zusatzfelder (Kategorie/Shop/Zeitraum/…)
         sollen bei wenig Platz (Mobil, offene Tastatur) sauber untereinander umbrechen statt sich
         mit Eingabefeld/Absenden-Button eine einzige Flex-Zeile zu teilen und dabei unvorhersehbar
         mittendrin umzubrechen. -->
    <div class="extra-fields" v-if="expanded">
      <slot name="extra" />
    </div>
  </form>
</template>

<style scoped>
.quick-add-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 4px 2px;
}

.main-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plus {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: 0.95rem;
  opacity: 0.55;
}

.quick-add-row.expanded .plus {
  opacity: 1;
}

.label-input {
  flex: 1;
  min-width: 80px;
  border: none;
  background: transparent;
  padding: 4px 2px;
  /* Mindestens 16px (1rem, siehe style.css's globale input-Regel) - iOS Safari zoomt beim
     Fokussieren eines Eingabefelds automatisch rein, sobald dessen font-size darunter liegt. */
  font-size: 1rem;
  border-bottom: 1px solid var(--color-border);
  border-radius: 0;
  /* Überschreibt style.css's globale min-height (44px, für normale Formularfelder gedacht) -
     diese Zeile bleibt bewusst kompakt/papierlisten-artig statt jedes Feld auf Touch-Target-Höhe
     aufzublasen (siehe Kommentar oben zum Interaktionsmuster). */
  min-height: 0;
}

.label-input::placeholder {
  color: var(--color-text-muted);
  opacity: 0.55;
}

.label-input:focus {
  outline: none;
  border-bottom-color: var(--color-primary);
}

/* Bewusst KEIN eigener Rahmen/Hintergrund/Radius mehr im expandierten Zustand (frühere Version
   "boxte" das Feld hier komplett ein) - diese Zeile lebt praktisch immer innerhalb einer bereits
   umrahmten Gruppen-/Listen-Karte, ein zusätzlicher Kasten darin sah wie "Kasten im Kasten" aus statt
   elegant. Die dünne Linie bleibt durchgehend das einzige Stil-Element, nur ihre Farbe zeigt "aktiv/
   hat Inhalt" an (bleibt auch nach einem nativen blur mit noch ungespeichertem Text bestehen, siehe
   :focus unten, das dasselbe nur bei echtem Fokus liefert). */
.quick-add-row.expanded .label-input {
  border-bottom-color: var(--color-primary);
}

.extra-fields {
  display: flex;
  align-items: center;
  column-gap: var(--space-2);
  row-gap: 6px;
  flex-wrap: wrap;
  /* Leichter Einzug statt bündig mit dem Rand, damit die Zusatzfelder optisch weiter unter dem
     Eingabefeld (statt unter dem "+"-Icon davor) beginnen. */
  margin-left: 22px;
}

.extra-fields :deep(select) {
  font-size: 0.78rem;
  padding: 3px 6px;
  min-width: 0;
  width: auto;
  min-height: 0;
}

/* Getrennt von select oben: ein <select> öffnet auf iOS ein natives Auswahlrad statt der
   Tastatur (kein Zoom-Risiko), ein <input> würde bei derselben kleinen font-size wie oben aber
   denselben Auto-Zoom-Bug wie .label-input auslösen (siehe dort) - deshalb hier mindestens 16px,
   auch wenn aktuell keine Verwendungsstelle einen Text-Input in diesen Slot steckt. */
.extra-fields :deep(input) {
  font-size: 1rem;
  padding: 3px 6px;
  min-width: 0;
  width: auto;
  min-height: 0;
}

.submit-btn {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

<script setup lang="ts">
defineProps<{ small?: boolean; floating?: boolean }>();
defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <!-- .stop hier (statt an den Verwendungsstellen mit @click.stop="handler"): dort wäre der
       emittierte Payload undefined (click hat keine Nutzlast), Vues .stop-Modifier ruft aber
       stopPropagation() auf genau diesem Payload auf – würde also crashen. Hier ist $event der
       echte native Klick, .stop ist deshalb sicher und schützt jede Karte, die diesen Button in
       einen jetzt klickbaren Card-Root einbettet (z. B. ExcursionCard.vue). -->
  <button
    type="button"
    class="secondary edit-btn"
    :class="{ small, floating }"
    title="Bearbeiten"
    aria-label="Bearbeiten"
    @click.stop="$emit('click')"
  >
    ✎
  </button>
</template>

<style scoped>
.edit-btn {
  padding: 6px 10px;
  font-size: 0.9rem;
  line-height: 1;
  flex-shrink: 0;
}

.edit-btn.small {
  padding: 4px 8px;
  font-size: 0.8rem;
}

/* Schwebender runder Button, z. B. über einem Vorschaubild – Positionierung
   erfolgt relativ zum nächsten `position: relative`-Elternelement. Hintergrund bleibt
   bewusst immer hell (auch im Dark Mode, das Bild darunter ist theme-unabhängig) –
   die Icon-Farbe ist deshalb fest dunkel statt an --color-text gekoppelt, sonst wird
   sie im Dark Mode hell auf hell und damit unsichtbar. */
.edit-btn.floating {
  position: absolute;
  top: 8px;
  left: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 50%;
  /* Setzt das globale corner-shape:squircle (style.css, gilt für <button> generell) für diesen
     echten Kreis-Button zurück – bei border-radius:50% verzerrt squircle einen Kreis sichtbar zu
     einer "Blob"-Form statt eines sauberen Kreises. */
  corner-shape: round;
  background: rgba(255, 255, 255, 0.9);
  color: #2b2a28;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Ohne eigenes Vorschaubild (Platzhalter-Fläche in --color-primary-tint, dunkel im Dark Mode)
   wirkt der immer-helle Kreis dort zu grell. Dunkler, halbtransparenter Kreis + heller Icon statt
   fest hell+dunkel – bleibt trotzdem über echten Fotos in beiden Modi gut lesbar. */
:root[data-theme='dark'] .edit-btn.floating {
  background: rgba(35, 34, 32, 0.85);
  color: #f2efe9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .edit-btn.floating {
    background: rgba(35, 34, 32, 0.85);
    color: #f2efe9;
  }
}
</style>

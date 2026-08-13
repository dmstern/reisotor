<script setup lang="ts">
// Einheitlicher Feld-Wrapper für Anlege-/Bearbeiten-Formulare: Icon + kleines Label bleiben auch
// dann sichtbar, wenn das Feld schon einen Wert trägt (reine Beschriftung per placeholder
// verschwindet dann, siehe CLAUDE.md-Feedback dazu) – Icon/Label sind rein zusätzlich, das
// Eingabefeld selbst behält wie bisher sein placeholder als Beispiel-/Hinweistext.
defineProps<{ icon?: string; label: string }>();
</script>

<template>
  <!-- div statt label: der Slot-Inhalt ist mal ein einzelnes natives Eingabefeld, mal eine
       zusammengesetzte Komponente mit mehreren eigenen Controls (ImageUrlInput's verstecktes
       Datei-Input, Combobox). Ein umschließendes <label> würde bei mehreren Controls nur eines
       davon (das erste) aktivieren - uneindeutig und potenziell überraschend beim Antippen des
       Labeltexts. -->
  <div class="form-field">
    <span class="form-field-label">
      <span v-if="icon" class="form-field-icon" aria-hidden="true">{{ icon }}</span>
      {{ label }}
    </span>
    <slot />
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.form-field-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.form-field-icon {
  font-size: 0.95rem;
  line-height: 1;
}
</style>

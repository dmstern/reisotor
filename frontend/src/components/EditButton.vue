<script setup lang="ts">
defineProps<{ small?: boolean; floating?: boolean }>();
defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <button
    type="button"
    class="secondary edit-btn"
    :class="{ small, floating }"
    title="Bearbeiten"
    aria-label="Bearbeiten"
    @click="$emit('click')"
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
  background: rgba(255, 255, 255, 0.9);
  color: #2b2a28;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

<script setup lang="ts">
// Surface-Primitive für alle Karten (SpotCard, ExcursionCard, BudgetPotCard,
// BudgetSettlementCard, TripMap-Fokus-Panels, …) – siehe Issue #239. Rendert bewusst nur die
// bestehende .card-Basisklasse aus style.css statt eigene Styles zu duplizieren: konkurrierende
// scoped-Styles hier würden dank Vue's Attribut-Selektor-Scoping eine höhere Spezifität als .card
// bekommen und damit unbeabsichtigt Squircle-Radius/Rahmen/Schatten überschreiben.
defineProps<{
  /** BEM-Variante, z. B. "muted" → zusätzlich .card--muted (Styles unten, scoped in dieser Datei). */
  variant?: 'muted';
}>();
</script>

<template>
  <div class="card" :class="variant ? `card--${variant}` : undefined">
    <slot />
  </div>
</template>

<style scoped>
/* Varianten-Styles leben bewusst hier (scoped) statt in der globalen style.css - Card.vue bleibt
   damit die einzige Quelle, die kennen muss, welche Varianten es gibt und wie sie aussehen. */
.card--muted {
  background: var(--color-hover);
}
</style>

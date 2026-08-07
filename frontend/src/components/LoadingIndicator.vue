<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRequestActivityStore, type RequestKind } from '../stores/requestActivity';

// Zentrale Lade-Anzeige für JEDEN Server-Request (View laden, Objekt speichern/anlegen/löschen) -
// siehe stores/requestActivity.ts, das api/client.ts's get()/mutate() bei jedem tatsächlichen
// Netzversuch hoch-/runterzählt. Vorher gab es dafür keine sichtbare Rückmeldung; bei einem
// hängenden Request (z. B. Server unter instabilem Netz erreichbar, antwortet aber nie, siehe
// REQUEST_TIMEOUT_MS in api/client.ts) wirkte die App bis zu 8s wie eingefroren.
const activity = useRequestActivityStore();

const ICONS: Record<RequestKind, string> = { read: '🔄', create: '➕', update: '💾', delete: '🗑️' };
const LABELS: Record<RequestKind, string> = {
  read: 'Lädt…',
  create: 'Legt an…',
  update: 'Speichert…',
  delete: 'Löscht…',
};

// Absichtlich erst mit kurzer Verzögerung einblenden statt sofort bei jedem noch so kurzen Request
// (die meisten lokalen/schnellen Requests dauern <100ms) - ein bei jedem Klick aufblitzender Pill
// wäre unruhiger als hilfreich. Beim Verschwinden dagegen keine Verzögerung, ein fertiger Request
// soll sofort als fertig erkennbar sein.
const SHOW_DELAY_MS = 200;

const visibleKind = ref<RequestKind | null>(null);
let showTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => activity.activeKind,
  (kind) => {
    if (showTimer != null) {
      clearTimeout(showTimer);
      showTimer = null;
    }
    if (kind == null) {
      visibleKind.value = null;
      return;
    }
    showTimer = setTimeout(() => {
      visibleKind.value = kind;
      showTimer = null;
    }, SHOW_DELAY_MS);
  },
);

const icon = computed(() => (visibleKind.value ? ICONS[visibleKind.value] : ''));
const label = computed(() => (visibleKind.value ? LABELS[visibleKind.value] : ''));
</script>

<template>
  <span v-if="visibleKind" class="loading-pill" :class="visibleKind" :title="label">
    <span class="spinner" />
    <span class="icon">{{ icon }}</span>
    <span class="label">{{ label }}</span>
  </span>
</template>

<style scoped>
/* Bewusst dieselbe Pill-Optik wie OfflineIndicator.vue's .offline-pill (Größe, Radius, Abstände) -
   beide teilen sich dieselbe Statuszeile im Header (AppHeader.vue) und sollen als zusammengehörige
   Statusanzeigen wirken, nicht als zwei unterschiedliche UI-Sprachen. */
.loading-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  background: var(--color-primary);
  padding: 4px 10px;
  border-radius: 999px;
  line-height: 1.3;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Eigene, gedämpftere Farbe für löschende Operationen - kein Rot (das bleibt echten Fehlern
   vorbehalten, siehe OfflineIndicator.vue), aber ein Hauch Warnfarbe, damit sich "hier wird gerade
   etwas entfernt" leicht von "hier wird gerade geladen/gespeichert" absetzt. */
.loading-pill.delete {
  background: var(--color-accent-secondary, var(--color-primary));
}

/* Klassischer rotierender Ring statt eines rotierenden Emojis - Emoji-Glyphen werden je nach
   Schriftart/Plattform beim Rotieren leicht verzerrt dargestellt. Der Ring ist bewusst die einzige
   Stelle, die sich unabhängig von der CRUD-Art immer gleich verhält; icon/label unterscheiden die
   Operation (siehe Kommentar oben in LoadingIndicator.vue) - hier ließe sich später pro Art auch der
   Ring durch eine kleine Roboter-Animation ersetzen (siehe ReisotorRobot.vue). */
.spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>

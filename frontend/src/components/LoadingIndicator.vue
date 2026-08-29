<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRequestActivityStore, type RequestKind } from '../stores/requestActivity';
import { useUiSettingsStore } from '../stores/uiSettings';
import AppIcon from './AppIcon.vue';
import LoadingSpinner from './primitives/LoadingSpinner.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import type { IconDef } from '../utils/icon';

// Zentrale Lade-Anzeige für JEDEN Server-Request (View laden, Objekt speichern/anlegen/löschen) -
// siehe stores/requestActivity.ts, das api/client.ts's get()/mutate() bei jedem tatsächlichen
// Netzversuch hoch-/runterzählt. Vorher gab es dafür keine sichtbare Rückmeldung; bei einem
// hängenden Request (z. B. Server unter instabilem Netz erreichbar, antwortet aber nie, siehe
// REQUEST_TIMEOUT_MS in api/client.ts) wirkte die App bis zu 8s wie eingefroren.
//
// Bewusst ein eigener, freischwebender Toast (position:fixed, siehe .toast-pill) statt eines
// Header-Pills wie bei OfflineIndicator.vue/PwaUpdatePrompt.vue: Letztere sind dauerhafte Zustände,
// die als Teil der Statuszeile zum Layout gehören dürfen. Dieser Indikator blinkt dagegen bei JEDEM
// noch so kurzen Request auf/ab - als Flex-Kind der Statuszeile ließ das den Header spürbar
// "wackeln" (Zeilenhöhe sprang ständig). Ein fixed-positionierter Toast nimmt am Layout gar nicht
// teil, kann also beliebig oft erscheinen/verschwinden, ohne irgendetwas zu verschieben.
const activity = useRequestActivityStore();
const uiSettings = useUiSettingsStore();

const ICONS: Record<RequestKind, IconDef> = {
  read: ACTION_ICONS.refresh,
  create: ACTION_ICONS.add,
  update: ACTION_ICONS.save,
  delete: ACTION_ICONS.delete,
};
const LABELS: Record<RequestKind, string> = {
  read: 'Lädt…',
  create: 'Legt an…',
  update: 'Speichert…',
  delete: 'Löscht…',
};

// Absichtlich erst mit kurzer Verzögerung einblenden statt sofort bei jedem noch so kurzen Request
// (die meisten lokalen/schnellen Requests dauern <100ms) - ein bei jedem Klick aufblitzender Toast
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
  }
);

const icon = computed(() => (visibleKind.value ? ICONS[visibleKind.value] : null));
const label = computed(() => (visibleKind.value ? LABELS[visibleKind.value] : ''));
</script>

<template>
  <Transition name="toast">
    <div
      v-if="visibleKind && uiSettings.showActivityToasts"
      class="toast-pill"
      :class="visibleKind"
      :title="label"
    >
      <LoadingSpinner size="sm" class="toast-spinner" />
      <AppIcon v-if="icon" class="icon" :size="13" :icon="icon" group="actions" />
      <span class="label">{{ label }}</span>
    </div>
  </Transition>
</template>

<style scoped>
/* position:fixed statt Flex-Kind der Statuszeile - siehe Kommentar oben im Script, das ist der
   eigentliche Grund für den Umbau. Am unteren statt oberen Rand verankert, damit sich der Toast
   nicht mit Header/NavBar überlagern kann - --navbar-bottom-offset (von NavBar.vue live gepflegt)
   berücksichtigt dabei sowohl eine evtl. unten positionierte mobile NavBar als auch deren Fehlen. */
.toast-pill {
  position: fixed;
  bottom: calc(var(--navbar-bottom-offset, 0px) + 16px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 30;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.toast-spinner {
  border-color: rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
}

/* Eigene, gedämpftere Farbe für löschende Operationen - kein Rot (das bleibt echten Fehlern
   vorbehalten, siehe OfflineIndicator.vue), aber ein Hauch Warnfarbe, damit sich "hier wird gerade
   etwas entfernt" leicht von "hier wird gerade geladen/gespeichert" absetzt. */
.toast-pill.delete {
  background: var(--color-accent-secondary, var(--color-primary));
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>

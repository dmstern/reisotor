import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';

// Zentrale Gegenstelle zur Lade-Animation (siehe components/LoadingIndicator.vue): api/client.ts's
// get()/mutate() zählen hier bei jedem tatsächlichen Serverzugriff hoch/runter - eine einzige Stelle
// statt einer lokalen "saving"/"loading"-Ref pro View/Formular, die sonst überall neu erfunden würde.
export type RequestKind = 'read' | 'create' | 'update' | 'delete';

export const useRequestActivityStore = defineStore('requestActivity', () => {
  const counts = reactive<Record<RequestKind, number>>({ read: 0, create: 0, update: 0, delete: 0 });

  function start(kind: RequestKind) {
    counts[kind]++;
  }
  function finish(kind: RequestKind) {
    if (counts[kind] > 0) counts[kind]--;
  }

  // Priorität bei mehreren gleichzeitig laufenden Arten: eine von der Nutzerin gerade ausgelöste
  // schreibende Aktion (löschen/ändern/anlegen) ist wichtiger anzuzeigen als ein im Hintergrund
  // laufender Lese-Request (z. B. der Offline-Prefetch), sonst würde die Lade-Animation ständig
  // zwischen Arten hin- und herspringen, ohne dass die Nutzerin eine Aktion ausgelöst hat.
  const activeKind = computed<RequestKind | null>(() => {
    if (counts.delete > 0) return 'delete';
    if (counts.update > 0) return 'update';
    if (counts.create > 0) return 'create';
    if (counts.read > 0) return 'read';
    return null;
  });

  return { counts, start, finish, activeKind };
});

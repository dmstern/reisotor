<script setup lang="ts">
import { computed } from 'vue';
import Modal from './Modal.vue';
import AppIcon from './AppIcon.vue';
import Button from './primitives/Button.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { usePwaInstallStore } from '../stores/pwaInstall';

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const install = usePwaInstallStore();

interface InstallGuide {
  heading: string;
  note?: string;
  steps: string[];
}

// Eine Anleitung pro Plattform/Browser-Kombination statt einer generischen "je nach Gerät"-Liste -
// direkt beim Öffnen ist per Browser-Erkennung (stores/pwaInstall.ts) schon klar, welche einzige
// Kombination gerade zutrifft (siehe Issue #186: "am besten mit jeweiliger Browser Erkennung sodass
// nur die aktuell relevante angezeigt wird"). canPromptInstall (Chrome/Edge, sobald der Browser das
// beforeinstallprompt-Event geliefert hat) ersetzt die Klick-Anleitung durch einen direkten Button.
const guide = computed<InstallGuide>(() => {
  if (install.canPromptInstall) {
    return {
      heading: 'Installieren',
      steps: ['Tippe unten auf "Jetzt installieren" und bestätige den Dialog deines Browsers.'],
    };
  }

  if (install.platform === 'ios') {
    return {
      heading: 'Installation auf iPhone/iPad',
      note:
        install.browser === 'safari'
          ? undefined
          : 'Auf iPhone/iPad funktioniert die Installation nur über Safari - öffne diese Seite dafür ggf. dort.',
      steps: [
        'Tippe unten in der Leiste auf das Teilen-Symbol (Quadrat mit Pfeil nach oben).',
        'Wähle im aufklappenden Menü "Zum Home-Bildschirm".',
        'Bestätige oben rechts mit "Hinzufügen".',
      ],
    };
  }

  if (install.platform === 'android') {
    return {
      heading: 'Installation auf Android',
      steps: [
        'Tippe oben rechts im Browser auf das Menü (⋮).',
        'Wähle "App installieren" bzw. "Zum Startbildschirm hinzufügen".',
        'Bestätige den folgenden Dialog.',
      ],
    };
  }

  if (install.platform === 'mac' && install.browser === 'safari') {
    return {
      heading: 'Installation auf dem Mac',
      steps: ['Öffne im Menü "Ablage" den Eintrag "Zum Dock hinzufügen…" und bestätige.'],
      note: 'Verfügbar ab macOS Sonoma. Alternativ funktioniert die Installation auch über Chrome oder Edge (siehe unten).',
    };
  }

  if (install.browser === 'firefox') {
    return {
      heading: 'Installation unter Firefox',
      steps: [],
      note: 'Firefox unterstützt die Installation von Web-Apps auf dem Desktop derzeit nicht. Nutze dafür Chrome, Edge oder (auf dem Mac) Safari.',
    };
  }

  // Desktop-Fallback (Windows/Linux/Mac) mit Chrome/Edge/unbekanntem Browser.
  return {
    heading: 'Installation am Desktop',
    steps: [
      'Klicke in der Adressleiste auf das Installieren-Symbol (Bildschirm mit Pfeil bzw. ⊕), falls vorhanden.',
      'Alternativ: Öffne das Menü (⋮) oben rechts und wähle "App installieren" bzw. "Reisotor installieren".',
    ],
  };
});

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Reisotor als App installieren"
    @update:model-value="close"
  >
    <div class="pwa-install-dialog">
      <div class="benefits">
        <h3>Das bringt dir die Installation</h3>
        <ul>
          <li>Eigenes App-Icon auf dem Start-/Home-Bildschirm - kein Adresse-Tippen mehr nötig.</li>
          <li>
            Läuft in einem eigenen Fenster ohne Adressleiste/Tabs, fühlt sich wie eine native App
            an.
          </li>
          <li>Zuletzt geladene Inhalte bleiben auch ohne Internetverbindung sichtbar.</li>
          <li>
            Aktualisiert sich beim Öffnen automatisch im Hintergrund - kein App-Store-Download
            nötig.
          </li>
        </ul>
      </div>

      <div class="guide">
        <h3>{{ guide.heading }}</h3>
        <p v-if="guide.note" class="hint">
          <AppIcon :icon="ACTION_ICONS.info" :size="14" group="actions" /> {{ guide.note }}
        </p>
        <ol v-if="guide.steps.length" class="steps">
          <li v-for="step in guide.steps" :key="step">{{ step }}</li>
        </ol>
        <Button v-if="install.canPromptInstall" @click="install.promptInstall()">
          <AppIcon :icon="ACTION_ICONS.installApp" :size="16" group="actions" /> Jetzt installieren
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.pwa-install-dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

h3 {
  margin: 0 0 var(--space-2);
  font-size: 0.95rem;
  color: var(--color-primary-dark);
}

.benefits ul {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.9rem;
}

.steps {
  margin: 0;
  padding-left: 1.2em;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: 0.9rem;
}

.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 var(--space-2);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
</style>

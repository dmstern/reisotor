<script setup lang="ts">
import { computed, ref } from 'vue';
import Modal from './Modal.vue';
import Alert from './primitives/Alert.vue';
import Button from './primitives/Button.vue';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';
import FeedbackDialog from './FeedbackDialog.vue';
import {
  useErrorNotifier,
  formatDiagnosticMarkdown,
  type CapturedError,
} from '../composables/useErrorNotifier';
import { useToast } from '../composables/useToast';

const { activeError, isErrorModalOpen, closeErrorModal } = useErrorNotifier();
const { showToast } = useToast();

const showFeedbackDialog = ref(false);
const copied = ref(false);

const errorTypeLabel = computed(() => {
  const err = activeError.value;
  if (!err) return '';
  if (err.kind === 'api') {
    return `API-Fehler${err.status ? ` (HTTP ${err.status})` : ''}`;
  }
  if (err.kind === 'sync') {
    return `Offline-Sync-Konflikt${err.status ? ` (HTTP ${err.status})` : ''}`;
  }
  return `Laufzeitfehler (${err.errorName})`;
});

const contextLabel = computed(() => {
  const err = activeError.value;
  if (!err) return '—';
  const parts: string[] = [];
  if (err.method || err.path) {
    parts.push([err.method, err.path].filter(Boolean).join(' '));
  }
  if (err.componentInfo) {
    parts.push(err.componentInfo);
  }
  if (err.route) {
    parts.push(`Route: ${err.route}`);
  }
  return parts.length > 0 ? parts.join(' · ') : '—';
});

const formattedTimeAndVersion = computed(() => {
  const err = activeError.value;
  if (!err) return '—';
  let timeStr = err.timestamp;
  try {
    const d = new Date(err.timestamp);
    if (!Number.isNaN(d.getTime())) {
      timeStr = d.toLocaleString('de-DE', {
        dateStyle: 'short',
        timeStyle: 'medium',
      });
    }
  } catch {
    // fallback to ISO string
  }
  return err.appVersion ? `${timeStr} · ${err.appVersion}` : timeStr;
});

const technicalDetailsText = computed(() => {
  const err = activeError.value;
  if (!err) return '';
  const lines: string[] = [`${err.errorName}: ${err.rawMessage}`];
  if (err.method || err.path) {
    lines.push(`Endpoint: ${[err.method, err.path].filter(Boolean).join(' ')}`);
  }
  if (err.status != null) {
    lines.push(`Status: HTTP ${err.status}`);
  }
  if (err.route) {
    lines.push(`Route: ${err.route}`);
  }
  if (err.componentInfo) {
    lines.push(`Component/Hook: ${err.componentInfo}`);
  }
  lines.push(`Online: ${err.online ? 'Ja' : 'Nein'}`);
  if (err.stack) {
    lines.push('', err.stack.trim());
  }
  return lines.join('\n');
});

const feedbackInitialTitle = computed(() => {
  const err = activeError.value;
  if (!err) return '';
  return err.summary.slice(0, 200);
});

const feedbackInitialDescription = computed(() => {
  const err = activeError.value;
  if (!err) return '';
  const diag = formatDiagnosticMarkdown(err as CapturedError);
  return [
    '**Was hast du gerade gemacht, als der Fehler auftrat?**',
    '',
    '',
    '<details>',
    '<summary>Technische Fehlerdiagnose</summary>',
    '',
    diag,
    '</details>',
  ].join('\n');
});

async function copyDiagnostics() {
  const err = activeError.value;
  if (!err) return;
  const text = formatDiagnosticMarkdown(err as CapturedError);
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    showToast({ message: 'Diagnose in die Zwischenablage kopiert.', type: 'success' });
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    showToast({ message: 'Kopieren in die Zwischenablage fehlgeschlagen.', type: 'warning' });
  }
}

function openBugReport() {
  closeErrorModal();
  showFeedbackDialog.value = true;
}
</script>

<template>
  <Modal
    :model-value="isErrorModalOpen"
    title="Fehlerdetails"
    size="md"
    @update:model-value="closeErrorModal"
  >
    <div v-if="activeError" class="error-detail-modal">
      <Alert variant="danger" :title="activeError.summary" />

      <dl class="meta-grid">
        <div class="meta-row">
          <dt>Fehlertyp</dt>
          <dd>{{ errorTypeLabel }}</dd>
        </div>
        <div class="meta-row">
          <dt>Kontext / Ort</dt>
          <dd class="mono-inline">{{ contextLabel }}</dd>
        </div>
        <div class="meta-row">
          <dt>Zeitpunkt &amp; Version</dt>
          <dd>{{ formattedTimeAndVersion }}</dd>
        </div>
      </dl>

      <CollapsibleFieldset label="Technische Details & Stacktrace">
        <pre class="stacktrace-box"><code>{{ technicalDetailsText }}</code></pre>
      </CollapsibleFieldset>

      <div class="actions-row">
        <Button type="button" variant="secondary" @click="copyDiagnostics">
          {{ copied ? '✓ Kopiert' : '📋 Diagnose kopieren' }}
        </Button>
        <Button type="button" variant="secondary" @click="openBugReport">
          🐛 Als Bug melden
        </Button>
        <div class="spacer"></div>
        <Button type="button" @click="closeErrorModal">Schließen</Button>
      </div>
    </div>
  </Modal>

  <FeedbackDialog
    v-model="showFeedbackDialog"
    initial-type="bug"
    :initial-title="feedbackInitialTitle"
    :initial-description="feedbackInitialDescription"
  />
</template>

<style scoped>
.error-detail-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.meta-grid {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  font-size: 0.85rem;
}

.meta-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-row dt {
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.meta-row dd {
  margin: 0;
  color: var(--color-text);
  word-break: break-word;
}

.mono-inline {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.8rem;
}

.stacktrace-box {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
  color: var(--color-text);
  overflow-x: auto;
  max-height: 240px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

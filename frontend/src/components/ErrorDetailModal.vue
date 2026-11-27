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
  buildFeedbackPrefill,
  type CapturedError,
} from '../composables/useErrorNotifier';
import { useToast } from '../composables/useToast';
import { ACTION_ICONS } from '../utils/actionIcons';

const { activeError, isErrorModalOpen, isFeedbackModalOpen, closeErrorModal, openErrorFeedback } =
  useErrorNotifier();
const { showToast } = useToast();

const copied = ref(false);

const errorTypeLabel = computed(() => {
  const err = activeError.value;

  if (!err) {
    return '';
  }

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

  if (!err) {
    return '—';
  }

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

  if (!err) {
    return '—';
  }

  let timeStr = err.timestamp;

  try {
    const date = new Date(err.timestamp);

    if (!Number.isNaN(date.getTime())) {
      timeStr = date.toLocaleString('de-DE', {
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

  if (!err) {
    return '';
  }

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

const feedbackPrefill = computed(() => {
  const err = activeError.value;

  if (!err) {
    return { title: '', description: '' };
  }

  return buildFeedbackPrefill(err as CapturedError);
});

const feedbackInitialTitle = computed(() => feedbackPrefill.value.title);

const feedbackInitialDescription = computed(() => feedbackPrefill.value.description);

async function copyDiagnostics() {
  const err = activeError.value;

  if (!err) {
    return;
  }

  const text = formatDiagnosticMarkdown(err as CapturedError);

  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    showToast({ message: 'Diagnose in die Zwischenablage kopiert.', type: 'success' });
    const COPY_FEEDBACK_MS = 2000;
    setTimeout(() => {
      copied.value = false;
    }, COPY_FEEDBACK_MS);
  } catch {
    showToast({ message: 'Kopieren in die Zwischenablage fehlgeschlagen.', type: 'warning' });
  }
}

function openBugReport() {
  openErrorFeedback(activeError.value ?? undefined);
}
</script>

<template>
  <Modal
    :model-value="isErrorModalOpen"
    title="Fehlerdetails"
    size="lg"
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
        <Button
          type="button"
          variant="secondary"
          :icon="copied ? ACTION_ICONS.done : ACTION_ICONS.copy"
          @click="copyDiagnostics"
        >
          {{ copied ? 'Kopiert' : 'Diagnose kopieren' }}
        </Button>
        <Button
          type="button"
          variant="secondary"
          :icon="ACTION_ICONS.comment"
          @click="openBugReport"
        >
          Als Bug melden
        </Button>
        <div class="spacer"></div>
        <Button type="button" @click="closeErrorModal">Schließen</Button>
      </div>
    </div>
  </Modal>

  <FeedbackDialog
    v-model="isFeedbackModalOpen"
    initial-type="bug"
    :initial-title="feedbackInitialTitle"
    :initial-description="feedbackInitialDescription"
  />
</template>

<style scoped lang="scss">
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
  @include surface-sunken-box;
  font-size: var(--font-size-sm);
}

.meta-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
}

.meta-row dt {
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.meta-row dd {
  margin: 0;
  color: var(--color-text);
  word-break: break-word;
}

.mono-inline {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-sm);
}

.stacktrace-box {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  @include surface-sunken-box(var(--radius-sm-squircle));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: var(--font-size-xs);
  line-height: var(--line-height-normal);
  color: var(--color-text);
  overflow-x: auto;
  max-height: 240px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

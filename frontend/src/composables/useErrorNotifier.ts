import { ref, readonly } from 'vue';
import { ApiError } from '../api/client';
import type { OutboxEntry } from '../api/offline';
import { useToast } from './useToast';
import { useBuildInfoStore } from '../stores/buildInfo';

export interface CapturedError {
  id: number;
  summary: string;
  kind: 'api' | 'runtime' | 'sync';
  errorName: string;
  rawMessage: string;
  status?: number;
  method?: string;
  path?: string;
  route?: string;
  componentInfo?: string;
  stack?: string;
  timestamp: string;
  appVersion?: string;
  online: boolean;
}

export interface NotifyErrorOptions {
  context?: string;
  silent?: boolean;
  kind?: 'api' | 'runtime' | 'sync';
  method?: string;
  path?: string;
  componentInfo?: string;
}

const MAX_RECENT_ERRORS = 10;
const DEDUPE_WINDOW_MS = 2000;

const recentErrors = ref<CapturedError[]>([]);
const activeError = ref<CapturedError | null>(null);
const isErrorModalOpen = ref(false);

let nextErrorId = 1;
const dedupeMap = new Map<string, number>();

export function markErrorHandled(err: unknown): void {
  if (err && typeof err === 'object') {
    try {
      Object.defineProperty(err, '_reisotorNotified', {
        value: true,
        configurable: true,
        enumerable: false,
      });
    } catch {
      // Frozen object or similar - ignore
    }
  }
}

export function isErrorMarkedHandled(err: unknown): boolean {
  return Boolean(
    err &&
    typeof err === 'object' &&
    '_reisotorNotified' in err &&
    (err as { _reisotorNotified?: boolean })._reisotorNotified
  );
}

export function shouldIgnoreError(err: unknown): boolean {
  if (!err) return true;
  if (isErrorMarkedHandled(err)) return true;

  // Gewollte Request-/Upload-Abbrüche per AbortController
  if (
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  ) {
    return true;
  }

  // ApiError mit Status 401 (Session abgelaufen -> reisotor:session-expired) oder Status 0 (Offline-Cache-Miss beim initialen Laden)
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 0) {
      return true;
    }
  } else if (typeof err === 'object' && err !== null && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (status === 401 || status === 0) {
      return true;
    }
  }

  return false;
}

function getAppVersionString(): string | undefined {
  try {
    const buildInfoStore = useBuildInfoStore();
    const info = buildInfoStore.buildInfo;
    if (!info) return undefined;
    const parts: string[] = [];
    if (info.version) parts.push(`v${info.version}`);
    if (info.ref) parts.push(`(${info.ref.slice(0, 7)})`);
    return parts.length > 0 ? parts.join(' ') : undefined;
  } catch {
    return undefined;
  }
}

function buildSummary(
  kind: 'api' | 'runtime' | 'sync',
  rawMessage: string,
  context?: string,
  status?: number
): string {
  const cleanMsg = rawMessage.trim() || 'Unbekannter Fehler';
  if (context) {
    if (status) {
      return `${context}: ${cleanMsg} (HTTP ${status})`;
    }
    return `${context}: ${cleanMsg}`;
  }
  if (kind === 'sync') {
    return status
      ? `Offline-Änderung vom Server abgelehnt: ${cleanMsg} (HTTP ${status})`
      : `Offline-Änderung vom Server abgelehnt: ${cleanMsg}`;
  }
  if (kind === 'api') {
    return status
      ? `Anfrage fehlgeschlagen: ${cleanMsg} (HTTP ${status})`
      : `Anfrage fehlgeschlagen: ${cleanMsg}`;
  }
  return `Unerwarteter Anwendungsfehler: ${cleanMsg}`;
}

export function formatDiagnosticMarkdown(err: CapturedError): string {
  const typeLabel =
    err.kind === 'api'
      ? `API-Fehler${err.status ? ` (HTTP ${err.status})` : ''}`
      : err.kind === 'sync'
        ? `Offline-Sync-Konflikt${err.status ? ` (HTTP ${err.status})` : ''}`
        : `Laufzeitfehler (${err.errorName})`;

  const lines: string[] = [
    `### Fehlerdiagnose`,
    `- **Zusammenfassung:** ${err.summary}`,
    `- **Typ:** ${typeLabel}`,
    `- **Fehlermeldung:** \`${err.errorName}: ${err.rawMessage}\``,
  ];

  if (err.method || err.path) {
    lines.push(`- **Endpunkt:** \`${[err.method, err.path].filter(Boolean).join(' ')}\``);
  }
  if (err.route) {
    lines.push(`- **Route:** \`${err.route}\``);
  }
  if (err.componentInfo) {
    lines.push(`- **Komponente / Hook:** \`${err.componentInfo}\``);
  }
  lines.push(`- **Zeitpunkt:** ${err.timestamp}`);
  if (err.appVersion) {
    lines.push(`- **Version:** ${err.appVersion}`);
  }
  lines.push(`- **Online-Status:** ${err.online ? 'Online' : 'Offline'}`);

  if (err.stack) {
    lines.push('', '```text', err.stack.trim(), '```');
  }

  return lines.join('\n');
}

export function useErrorNotifier() {
  const { showToast } = useToast();

  function openErrorModal(error?: CapturedError) {
    if (error) {
      activeError.value = error;
    } else if (!activeError.value && recentErrors.value.length > 0) {
      activeError.value = recentErrors.value[0];
    }
    if (activeError.value) {
      isErrorModalOpen.value = true;
    }
  }

  function closeErrorModal() {
    isErrorModalOpen.value = false;
  }

  function notifyError(
    err: unknown,
    contextOrOptions?: string | NotifyErrorOptions
  ): CapturedError | null {
    if (shouldIgnoreError(err)) {
      return null;
    }

    markErrorHandled(err);

    const opts: NotifyErrorOptions =
      typeof contextOrOptions === 'string'
        ? { context: contextOrOptions }
        : (contextOrOptions ?? {});

    const isApi =
      err instanceof ApiError ||
      (typeof err === 'object' &&
        err !== null &&
        'status' in err &&
        typeof (err as { status: unknown }).status === 'number');

    const status = isApi ? (err as { status: number }).status : undefined;
    const method =
      opts.method ??
      (isApi && 'method' in (err as object) ? (err as { method?: string }).method : undefined);
    const path =
      opts.path ??
      (isApi && 'path' in (err as object) ? (err as { path?: string }).path : undefined);

    const kind: 'api' | 'runtime' | 'sync' = opts.kind ?? (isApi ? 'api' : 'runtime');

    const errorName =
      err instanceof Error
        ? err.name || (isApi ? 'ApiError' : 'Error')
        : isApi
          ? 'ApiError'
          : typeof err === 'object' && err !== null && 'name' in err
            ? String((err as { name: unknown }).name)
            : 'Error';

    const rawMessage =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : JSON.stringify(err) || 'Unbekannter Fehler';

    const stack = err instanceof Error ? err.stack : undefined;

    // Deduplizierung (Flood-Schutz innerhalb von 2000ms)
    const dedupeKey = `${errorName}|${rawMessage}|${path ?? ''}`;
    const now = Date.now();
    const lastSeen = dedupeMap.get(dedupeKey);
    if (lastSeen !== undefined && now - lastSeen < DEDUPE_WINDOW_MS) {
      return null;
    }
    dedupeMap.set(dedupeKey, now);

    const summary = buildSummary(kind, rawMessage, opts.context, status);
    const route =
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined;
    const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

    const captured: CapturedError = {
      id: nextErrorId++,
      summary,
      kind,
      errorName,
      rawMessage,
      status,
      method,
      path,
      route,
      componentInfo: opts.componentInfo,
      stack,
      timestamp: new Date().toISOString(),
      appVersion: getAppVersionString(),
      online,
    };

    recentErrors.value = [captured, ...recentErrors.value].slice(0, MAX_RECENT_ERRORS);

    if (!opts.silent) {
      showToast({
        message: summary,
        type: 'error',
        duration: 8000,
        action: {
          label: 'Details anzeigen',
          onClick: () => openErrorModal(captured),
        },
      });
    }

    return captured;
  }

  function notifyOutboxRejected(entry: OutboxEntry, error: unknown): CapturedError | null {
    return notifyError(error, {
      kind: 'sync',
      method: entry.method,
      path: entry.path,
    });
  }

  function notifyOutboxFailed(entry: OutboxEntry, error: unknown): CapturedError | null {
    return notifyError(error, {
      kind: 'sync',
      method: entry.method,
      path: entry.path,
      context: 'Synchronisierung fehlgeschlagen',
    });
  }

  function clearErrors() {
    recentErrors.value = [];
    activeError.value = null;
    isErrorModalOpen.value = false;
    dedupeMap.clear();
  }

  return {
    recentErrors: readonly(recentErrors),
    activeError: readonly(activeError),
    isErrorModalOpen,
    notifyError,
    notifyOutboxRejected,
    notifyOutboxFailed,
    openErrorModal,
    closeErrorModal,
    clearErrors,
    formatDiagnosticMarkdown,
  };
}

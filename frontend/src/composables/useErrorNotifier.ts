import { ref, readonly } from 'vue';
import { clearLastApiError, getLastApiError } from '../utils/apiErrorTracker';
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
  status?: number;
  method?: string;
  path?: string;
  componentInfo?: string;
  summaryOverride?: string;
}

const MAX_RECENT_ERRORS = 10;
const DEDUPE_WINDOW_MS = 2000;
const RECENT_ERROR_MATCH_WINDOW_MS = 60_000;
const MIN_MATCH_SUBSTRING_LENGTH = 4;
const MAX_FEEDBACK_TITLE_LENGTH = 200;
const TOAST_ERROR_DURATION_MS = 8000;
const GIT_SHA_PREVIEW_LENGTH = 7;

const recentErrors = ref<CapturedError[]>([]);
const activeError = ref<CapturedError | null>(null);
const isErrorModalOpen = ref(false);
const isFeedbackModalOpen = ref(false);

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
  if (!err) {
    return true;
  }

  if (isErrorMarkedHandled(err)) {
    return true;
  }

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
  if (typeof err === 'object' && err !== null && 'status' in err) {
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

    if (!info) {
      return undefined;
    }

    const parts: string[] = [];

    if (info.version) {
      parts.push(`v${info.version}`);
    }

    if (info.ref) {
      parts.push(`(${info.ref.slice(0, GIT_SHA_PREVIEW_LENGTH)})`);
    }

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
  let typeLabel = `Laufzeitfehler (${err.errorName})`;

  if (err.kind === 'api') {
    typeLabel = `API-Fehler${err.status ? ` (HTTP ${err.status})` : ''}`;
  } else if (err.kind === 'sync') {
    typeLabel = `Offline-Sync-Konflikt${err.status ? ` (HTTP ${err.status})` : ''}`;
  }

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

export function buildFeedbackPrefill(err: CapturedError): { title: string; description: string } {
  const diag = formatDiagnosticMarkdown(err);
  return {
    title: err.summary.slice(0, MAX_FEEDBACK_TITLE_LENGTH),
    description: [
      '**Was hast du gerade gemacht, als der Fehler auftrat?**',
      '',
      '',
      '<details>',
      '<summary>Technische Fehlerdiagnose</summary>',
      '',
      diag,
      '</details>',
    ].join('\n'),
  };
}

function extractApiDataDetails(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('data' in err)) {
    return undefined;
  }

  const data = (err as { data?: unknown }).data;

  if (data == null) {
    return undefined;
  }

  if (typeof data === 'string') {
    return data.trim() || undefined;
  }

  if (typeof data === 'object' && 'details' in data) {
    const detailsVal = (data as { details?: unknown }).details;

    if (typeof detailsVal === 'string' && detailsVal.trim()) {
      return detailsVal.trim();
    }
  }

  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return undefined;
  }
}

function extractErrorName(err: unknown, isApi: boolean): string {
  if (err instanceof Error) {
    return err.name || (isApi ? 'ApiError' : 'Error');
  }

  if (isApi) {
    return 'ApiError';
  }

  if (typeof err === 'object' && err !== null && 'name' in err) {
    return String((err as { name: unknown }).name);
  }

  return 'Error';
}

function extractRawMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === 'string') {
    return err;
  }

  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message);
  }

  return JSON.stringify(err) || 'Unbekannter Fehler';
}

function isApiErrorLike(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status: unknown }).status === 'number'
  );
}

function resolveErrorDetails(
  err: unknown,
  opts: NotifyErrorOptions
): {
  status?: number;
  method?: string;
  path?: string;
  kind: 'api' | 'runtime' | 'sync';
  errorName: string;
  rawMessage: string;
  stack?: string;
} {
  const isApi = isApiErrorLike(err);
  const errObj = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : null;
  const status = opts.status ?? (isApi ? (errObj?.status as number) : undefined);
  const method =
    opts.method ?? (isApi && typeof errObj?.method === 'string' ? errObj.method : undefined);
  const path = opts.path ?? (isApi && typeof errObj?.path === 'string' ? errObj.path : undefined);
  const kind: 'api' | 'runtime' | 'sync' =
    opts.kind ?? (isApi || status !== undefined ? 'api' : 'runtime');

  let stack = err instanceof Error ? err.stack : undefined;
  const dataDetails = extractApiDataDetails(err);

  if (dataDetails && (!stack || !stack.includes(dataDetails))) {
    stack = stack
      ? `${stack}\n\nResponse Details:\n${dataDetails}`
      : `Response Details:\n${dataDetails}`;
  }

  return {
    status,
    method,
    path,
    kind,
    errorName: extractErrorName(err, isApi),
    rawMessage: extractRawMessage(err),
    stack,
  };
}

export function isCapturedError(val: unknown): val is CapturedError {
  if (typeof val !== 'object' || val === null) {
    return false;
  }

  const candidate = val as Partial<CapturedError>;

  return (
    typeof candidate.id === 'number' &&
    typeof candidate.summary === 'string' &&
    typeof candidate.rawMessage === 'string' &&
    typeof candidate.timestamp === 'string'
  );
}

function normalizeOptions(contextOrOptions?: string | NotifyErrorOptions): NotifyErrorOptions {
  return typeof contextOrOptions === 'string'
    ? { context: contextOrOptions }
    : (contextOrOptions ?? {});
}

function buildSummaryWithStatus(message: string, context?: string, status?: number): string {
  const base = context ? `${context}: ${message}` : message;

  if (status && !base.includes(String(status))) {
    return `${base} (HTTP ${status})`;
  }

  return base;
}

function findMatchingRecentError(message: string, opts: NotifyErrorOptions): CapturedError | null {
  const now = Date.now();

  for (const entry of recentErrors.value) {
    const ageMs = now - Date.parse(entry.timestamp);

    if (Number.isNaN(ageMs) || ageMs > RECENT_ERROR_MATCH_WINDOW_MS) {
      continue;
    }

    if (opts.context && entry.summary.startsWith(opts.context)) {
      return entry;
    }

    if (
      entry.summary === message ||
      entry.rawMessage === message ||
      (entry.rawMessage.length >= MIN_MATCH_SUBSTRING_LENGTH && message.includes(entry.rawMessage))
    ) {
      return entry;
    }
  }

  return null;
}

function resolveFromStringMessage(message: string, opts: NotifyErrorOptions): CapturedError | null {
  const trimmed = message.trim();

  if (!trimmed) {
    return activeError.value ?? recentErrors.value[0] ?? null;
  }

  const matchedRecent = findMatchingRecentError(trimmed, opts);

  if (matchedRecent) {
    return matchedRecent;
  }

  const lastApi = typeof getLastApiError === 'function' ? getLastApiError() : null;
  const isFreshApiError =
    lastApi !== null && Date.now() - lastApi.timestamp <= RECENT_ERROR_MATCH_WINDOW_MS;

  if (isFreshApiError && opts.kind !== 'runtime') {
    const apiErr = lastApi.error;

    return createCapturedError(apiErr, {
      ...opts,
      summaryOverride:
        opts.summaryOverride ?? buildSummaryWithStatus(trimmed, opts.context, apiErr.status),
    });
  }

  return createCapturedError(new Error(trimmed), {
    ...opts,
    summaryOverride:
      opts.summaryOverride ?? buildSummaryWithStatus(trimmed, opts.context, opts.status),
  });
}

export function resolveOrCreateCapturedError(
  errorOrMessage?: CapturedError | unknown,
  contextOrOptions?: string | NotifyErrorOptions
): CapturedError | null {
  if (errorOrMessage === undefined || errorOrMessage === null) {
    return activeError.value ?? recentErrors.value[0] ?? null;
  }

  if (isCapturedError(errorOrMessage)) {
    return errorOrMessage;
  }

  const opts = normalizeOptions(contextOrOptions);

  if (typeof errorOrMessage === 'string') {
    return resolveFromStringMessage(errorOrMessage, opts);
  }

  return createCapturedError(errorOrMessage, opts);
}

export function createCapturedError(
  err: unknown,
  contextOrOptions?: string | NotifyErrorOptions
): CapturedError {
  const opts = normalizeOptions(contextOrOptions);
  const { status, method, path, kind, errorName, rawMessage, stack } = resolveErrorDetails(
    err,
    opts
  );
  const summary =
    opts.summaryOverride?.trim() || buildSummary(kind, rawMessage, opts.context, status);
  const route =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined;
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  return {
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
}

export function useErrorNotifier() {
  const { showToast } = useToast();

  function openErrorModal(
    errorOrMessage?: CapturedError | unknown,
    contextOrOptions?: string | NotifyErrorOptions
  ) {
    const resolved = resolveOrCreateCapturedError(errorOrMessage, contextOrOptions);

    if (!resolved) {
      return;
    }

    activeError.value = resolved;
    isFeedbackModalOpen.value = false;
    isErrorModalOpen.value = true;
  }

  function closeErrorModal() {
    isErrorModalOpen.value = false;
  }

  function openErrorFeedback(
    errorOrMessage?: CapturedError | unknown,
    contextOrOptions?: string | NotifyErrorOptions
  ) {
    const resolved = resolveOrCreateCapturedError(errorOrMessage, contextOrOptions);

    if (!resolved) {
      return;
    }

    activeError.value = resolved;
    isErrorModalOpen.value = false;
    isFeedbackModalOpen.value = true;
  }

  function closeFeedbackModal() {
    isFeedbackModalOpen.value = false;
  }

  function notifyError(
    err: unknown,
    contextOrOptions?: string | NotifyErrorOptions
  ): CapturedError | null {
    if (shouldIgnoreError(err)) {
      return null;
    }

    markErrorHandled(err);

    const opts = normalizeOptions(contextOrOptions);
    const captured = createCapturedError(err, opts);

    // Deduplizierung (Flood-Schutz innerhalb von 2000ms)
    const dedupeKey = `${captured.errorName}|${captured.rawMessage}|${captured.path ?? ''}`;
    const now = Date.now();
    const lastSeen = dedupeMap.get(dedupeKey);

    if (lastSeen !== undefined && now - lastSeen < DEDUPE_WINDOW_MS) {
      return null;
    }

    dedupeMap.set(dedupeKey, now);

    recentErrors.value = [captured, ...recentErrors.value].slice(0, MAX_RECENT_ERRORS);

    if (!opts.silent) {
      showToast({
        message: captured.summary,
        type: 'error',
        duration: TOAST_ERROR_DURATION_MS,
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
    isFeedbackModalOpen.value = false;
    dedupeMap.clear();

    if (typeof clearLastApiError === 'function') {
      clearLastApiError();
    }
  }

  return {
    recentErrors: readonly(recentErrors),
    activeError: readonly(activeError),
    isErrorModalOpen,
    isFeedbackModalOpen,
    notifyError,
    notifyOutboxRejected,
    notifyOutboxFailed,
    openErrorModal,
    closeErrorModal,
    openErrorFeedback,
    closeFeedbackModal,
    resolveOrCreateCapturedError,
    clearErrors,
    formatDiagnosticMarkdown,
  };
}

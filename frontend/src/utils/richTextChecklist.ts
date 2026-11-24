import DOMPurify from 'dompurify';

const ALLOWED_DATA_ATTRS = new Set(['data-type', 'data-checked']);
const VALID_SPAN_PATTERN = /^[1-9]\d?$/;
const ALLOWED_TABLE_SCOPES = new Set(['col', 'row', 'colgroup', 'rowgroup']);

/**
 * Sanitizes Rich-Text HTML while preserving Tiptap TaskList/TaskItem structures
 * (`data-type`, `data-checked`, `<label>`, `<input type="checkbox">`, `<span>`, `<div>`)
 * and table structures (`<table>`, `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<th>`, `<td>`).
 * Non-checkbox `<input>` elements, inline `style` attributes, invalid table spans/scopes,
 * and arbitrary `data-*` attributes are stripped.
 */
export function sanitizeRichTextHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ADD_TAGS: ['label', 'input', 'span', 'div'],
    ADD_ATTR: [
      'data-type',
      'data-checked',
      'type',
      'checked',
      'disabled',
      'colspan',
      'rowspan',
      'scope',
    ],
    FORBID_ATTR: ['style'],
  });

  if (typeof DOMParser === 'undefined') {
    return sanitized;
  }

  const doc = new DOMParser().parseFromString(sanitized, 'text/html');

  for (const input of Array.from(doc.querySelectorAll('input'))) {
    if (input.getAttribute('type') !== 'checkbox') {
      input.remove();
    }
  }

  for (const element of Array.from(doc.querySelectorAll('[data-type], [data-checked]'))) {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-') && !ALLOWED_DATA_ATTRS.has(attr.name)) {
        element.removeAttribute(attr.name);
      }
    }
  }

  for (const cell of Array.from(doc.querySelectorAll('td, th'))) {
    for (const attr of ['colspan', 'rowspan'] as const) {
      const value = cell.getAttribute(attr);

      if (value !== null && !VALID_SPAN_PATTERN.test(value)) {
        cell.removeAttribute(attr);
      }
    }

    if (cell.tagName === 'TH') {
      const scope = cell.getAttribute('scope');

      if (scope !== null && !ALLOWED_TABLE_SCOPES.has(scope)) {
        cell.removeAttribute('scope');
      }
    }
  }

  return doc.body.innerHTML;
}

/**
 * Extracts a concise label from a Tiptap task item for checkbox accessibility.
 */
function getTaskItemLabel(item: Element): string {
  const directParagraph = item.querySelector(':scope > div > p');
  const rawText = directParagraph?.textContent ?? '';
  const trimmed = rawText.trim();

  if (trimmed.length > 0) {
    return trimmed;
  }

  return 'Checklisten-Eintrag';
}

/**
 * Synchronizes `<input type="checkbox">` state, `aria-label`, and `disabled`/`tabindex`
 * attributes for read-only vs. interactive `RichTextDisplay` rendering, and optionally wraps
 * `<table>` elements in a keyboard-scrollable region wrapper.
 */
export function prepareChecklistHtmlForDisplay(
  html: string,
  interactive: boolean,
  options?: { wrapTables?: boolean }
): string {
  if (typeof DOMParser === 'undefined') {
    return html;
  }

  const wrapTables = options?.wrapTables ?? true;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const taskItems = doc.querySelectorAll('li[data-type="taskItem"]');

  for (const item of Array.from(taskItems)) {
    const checkbox = item.querySelector(':scope > label > input[type="checkbox"]');

    if (!checkbox) {
      continue;
    }

    const isChecked = item.getAttribute('data-checked') === 'true';

    if (isChecked) {
      checkbox.setAttribute('checked', 'checked');
    } else {
      checkbox.removeAttribute('checked');
    }

    if (!checkbox.getAttribute('aria-label')) {
      checkbox.setAttribute('aria-label', getTaskItemLabel(item));
    }

    if (interactive) {
      checkbox.removeAttribute('disabled');
      checkbox.removeAttribute('tabindex');
    } else {
      checkbox.setAttribute('disabled', 'disabled');
      checkbox.setAttribute('tabindex', '-1');
    }
  }

  if (wrapTables) {
    for (const table of Array.from(doc.querySelectorAll('table'))) {
      if (table.parentElement?.classList.contains('richtext-table-wrapper')) {
        continue;
      }

      const wrapper = doc.createElement('div');
      wrapper.className = 'richtext-table-wrapper';
      wrapper.setAttribute('tabindex', '0');
      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', 'Tabelle');
      table.parentNode?.insertBefore(wrapper, table);
      wrapper.appendChild(table);
    }
  }

  return doc.body.innerHTML;
}

/**
 * Toggles the `taskIndex`-th `li[data-type="taskItem"]` in the given HTML string
 * and returns the sanitized updated HTML.
 */
export function toggleTaskItemInHtml(
  html: string,
  taskIndex: number,
  nextChecked?: boolean
): string {
  if (typeof DOMParser === 'undefined') {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const taskItems = doc.querySelectorAll('li[data-type="taskItem"]');

  if (taskIndex < 0 || taskIndex >= taskItems.length) {
    return html;
  }

  const item = taskItems[taskIndex];
  const resolvedChecked = nextChecked ?? item.getAttribute('data-checked') !== 'true';
  item.setAttribute('data-checked', String(resolvedChecked));

  const checkbox = item.querySelector(':scope > label > input[type="checkbox"]');

  if (checkbox) {
    if (resolvedChecked) {
      checkbox.setAttribute('checked', 'checked');
    } else {
      checkbox.removeAttribute('checked');
    }
  }

  return sanitizeRichTextHtml(doc.body.innerHTML);
}

export interface LatestWinsSaveTask<TEntity> {
  captureSnapshot: () => TEntity;
  persist: () => Promise<TEntity>;
  onCommitted: (result: TEntity) => void;
  onRollback: (snapshot: TEntity) => void;
}

interface ActiveBatchState<TEntity> {
  lastConfirmed: TEntity;
  pending: LatestWinsSaveTask<TEntity> | null;
  promise: Promise<void>;
}

/**
 * Serializes and coalesces rapid optimistic updates per entity key ("latest wins").
 * At most one `persist()` call runs at a time per key; intermediate clicks overwrite `pending`,
 * stale intermediate responses update the rollback baseline without overwriting newer optimistic UI,
 * and errors roll back to the last server-confirmed snapshot.
 */
export function createLatestWinsSaveQueue<TEntity>() {
  const activeBatches = new Map<string, ActiveBatchState<TEntity>>();

  async function flush(
    key: string,
    initialTask: LatestWinsSaveTask<TEntity>,
    state: ActiveBatchState<TEntity>
  ): Promise<void> {
    let currentTask: LatestWinsSaveTask<TEntity> | null = initialTask;

    while (currentTask) {
      const taskToRun = currentTask;

      try {
        const result = await taskToRun.persist();

        if (state.pending) {
          state.lastConfirmed = result;
          currentTask = state.pending;
          state.pending = null;
        } else {
          activeBatches.delete(key);
          taskToRun.onCommitted(result);
          currentTask = null;
        }
      } catch {
        state.pending = null;
        activeBatches.delete(key);
        taskToRun.onRollback(state.lastConfirmed);
        currentTask = null;
      }
    }
  }

  function enqueue(key: string, task: LatestWinsSaveTask<TEntity>): Promise<void> {
    const existing = activeBatches.get(key);

    if (existing) {
      existing.pending = task;
      return existing.promise;
    }

    const state: ActiveBatchState<TEntity> = {
      lastConfirmed: task.captureSnapshot(),
      pending: null,
      promise: Promise.resolve(),
    };

    state.promise = flush(key, task, state);
    activeBatches.set(key, state);
    return state.promise;
  }

  return { enqueue };
}

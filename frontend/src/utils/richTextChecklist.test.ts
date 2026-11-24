// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import {
  createLatestWinsSaveQueue,
  prepareChecklistHtmlForDisplay,
  sanitizeRichTextHtml,
  toggleTaskItemInHtml,
} from './richTextChecklist';

const SAMPLE_TASK_LIST =
  '<ul data-type="taskList">' +
  '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Sonnencreme</p></div></li>' +
  '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Wasser</p>' +
  '<ul data-type="taskList">' +
  '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>2 Liter</p></div></li>' +
  '</ul>' +
  '</div></li>' +
  '</ul>';

describe('sanitizeRichTextHtml', () => {
  it('preserves Tiptap taskList and taskItem elements', () => {
    const clean = sanitizeRichTextHtml(SAMPLE_TASK_LIST);
    expect(clean).toContain('data-type="taskList"');
    expect(clean).toContain('data-type="taskItem"');
    expect(clean).toContain('data-checked="true"');
    expect(clean).toContain('type="checkbox"');
  });

  it('strips non-checkbox inputs and script/event handlers', () => {
    const dirty =
      '<p onclick="alert(1)">Hallo</p><input type="text" value="x"><input type="checkbox"><script>alert(2)</script>';
    const clean = sanitizeRichTextHtml(dirty);
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('type="text"');
    expect(clean).not.toContain('<script');
    expect(clean).toContain('type="checkbox"');
  });
});

describe('prepareChecklistHtmlForDisplay', () => {
  it('marks checkboxes disabled and unfocusable when interactive is false', () => {
    const html = prepareChecklistHtmlForDisplay(SAMPLE_TASK_LIST, false);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const checkboxes = Array.from(doc.querySelectorAll('input[type="checkbox"]'));

    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0].hasAttribute('disabled')).toBe(true);
    expect(checkboxes[0].getAttribute('tabindex')).toBe('-1');
    expect(checkboxes[0].getAttribute('aria-label')).toBe('Sonnencreme');
    expect(checkboxes[1].hasAttribute('checked')).toBe(true);
  });

  it('keeps checkboxes enabled and removes tabindex when interactive is true', () => {
    const html = prepareChecklistHtmlForDisplay(SAMPLE_TASK_LIST, true);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const checkboxes = Array.from(doc.querySelectorAll('input[type="checkbox"]'));

    expect(checkboxes[0].hasAttribute('disabled')).toBe(false);
    expect(checkboxes[0].hasAttribute('tabindex')).toBe(false);
    expect(checkboxes[1].hasAttribute('checked')).toBe(true);
  });
});

describe('toggleTaskItemInHtml', () => {
  it('toggles a flat task item and syncs its checkbox attribute', () => {
    const updated = toggleTaskItemInHtml(SAMPLE_TASK_LIST, 0);
    const doc = new DOMParser().parseFromString(updated, 'text/html');
    const items = doc.querySelectorAll('li[data-type="taskItem"]');

    expect(items[0].getAttribute('data-checked')).toBe('true');
    expect(items[0].querySelector('input[type="checkbox"]')?.hasAttribute('checked')).toBe(true);
    expect(items[1].getAttribute('data-checked')).toBe('true');
  });

  it('toggles a nested task item without altering parent state', () => {
    const updated = toggleTaskItemInHtml(SAMPLE_TASK_LIST, 2, true);
    const doc = new DOMParser().parseFromString(updated, 'text/html');
    const items = doc.querySelectorAll('li[data-type="taskItem"]');

    expect(items[2].getAttribute('data-checked')).toBe('true');
    expect(items[1].getAttribute('data-checked')).toBe('true');
  });

  it('returns html unchanged for out-of-bounds index', () => {
    expect(toggleTaskItemInHtml(SAMPLE_TASK_LIST, -1)).toBe(SAMPLE_TASK_LIST);
    expect(toggleTaskItemInHtml(SAMPLE_TASK_LIST, 99)).toBe(SAMPLE_TASK_LIST);
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('createLatestWinsSaveQueue', () => {
  it('coalesces rapid updates and skips stale onCommitted callbacks', async () => {
    const queue = createLatestWinsSaveQueue<string>();
    const first = createDeferred<string>();
    const third = createDeferred<string>();
    const onCommitted = vi.fn();
    const onRollback = vi.fn();
    const persist1 = vi.fn(() => first.promise);
    const persist2 = vi.fn(async () => 'v2');
    const persist3 = vi.fn(() => third.promise);

    const p1 = queue.enqueue('note-1', {
      captureSnapshot: () => 'v0',
      persist: persist1,
      onCommitted,
      onRollback,
    });
    const p2 = queue.enqueue('note-1', {
      captureSnapshot: () => 'v1-optimistic',
      persist: persist2,
      onCommitted,
      onRollback,
    });
    const p3 = queue.enqueue('note-1', {
      captureSnapshot: () => 'v2-optimistic',
      persist: persist3,
      onCommitted,
      onRollback,
    });

    expect(persist1).toHaveBeenCalledTimes(1);
    expect(persist2).not.toHaveBeenCalled();
    expect(persist3).not.toHaveBeenCalled();

    first.resolve('v1-server');
    await Promise.resolve();
    await Promise.resolve();

    expect(onCommitted).not.toHaveBeenCalled();
    expect(persist2).not.toHaveBeenCalled();
    expect(persist3).toHaveBeenCalledTimes(1);

    third.resolve('v3-server');
    await Promise.all([p1, p2, p3]);

    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(onCommitted).toHaveBeenCalledWith('v3-server');
    expect(onRollback).not.toHaveBeenCalled();
  });

  it('rolls back to initial snapshot when first request fails with queued update', async () => {
    const queue = createLatestWinsSaveQueue<string>();
    const first = createDeferred<string>();
    const onCommitted = vi.fn();
    const onRollback = vi.fn();
    const persist2 = vi.fn(async () => 'v2-server');

    const p1 = queue.enqueue('note-1', {
      captureSnapshot: () => 'v0',
      persist: () => first.promise,
      onCommitted,
      onRollback,
    });
    const p2 = queue.enqueue('note-1', {
      captureSnapshot: () => 'v1-optimistic',
      persist: persist2,
      onCommitted,
      onRollback,
    });

    first.reject(new Error('network error'));
    await Promise.all([p1, p2]);

    expect(persist2).not.toHaveBeenCalled();
    expect(onCommitted).not.toHaveBeenCalled();
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onRollback).toHaveBeenCalledWith('v0');
  });

  it('rolls back to server-confirmed first result when second coalesced request fails', async () => {
    const queue = createLatestWinsSaveQueue<string>();
    const first = createDeferred<string>();
    const second = createDeferred<string>();
    const onCommitted = vi.fn();
    const onRollback = vi.fn();

    const p1 = queue.enqueue('note-1', {
      captureSnapshot: () => 'v0',
      persist: () => first.promise,
      onCommitted,
      onRollback,
    });
    const p2 = queue.enqueue('note-1', {
      captureSnapshot: () => 'v1-optimistic',
      persist: () => second.promise,
      onCommitted,
      onRollback,
    });

    first.resolve('v1-server');
    await Promise.resolve();
    await Promise.resolve();

    second.reject(new Error('network error'));
    await Promise.all([p1, p2]);

    expect(onCommitted).not.toHaveBeenCalled();
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(onRollback).toHaveBeenCalledWith('v1-server');
  });
});

describe('table sanitization and display wrapper', () => {
  it('preserves valid tables and strips style, scripts, and invalid span/scope attributes', () => {
    const input =
      '<table style="width:100%"><thead><tr><th scope="col" colspan="2">Kopf</th>' +
      '<th scope="evil" rowspan="0">Bad</th></tr></thead>' +
      '<tbody><tr><td style="color:red" colspan="abc" onclick="alert(1)"><p>Zelle</p></td>' +
      '<td><script>alert(2)</script><p>Sicher</p></td></tr></tbody></table>';

    const output = sanitizeRichTextHtml(input);
    expect(output).toContain('<table>');
    expect(output).toContain('scope="col"');
    expect(output).toContain('colspan="2"');
    expect(output).not.toContain('style=');
    expect(output).not.toContain('scope="evil"');
    expect(output).not.toContain('rowspan="0"');
    expect(output).not.toContain('colspan="abc"');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('<script');
    expect(output).toContain('Sicher');
  });

  it('wraps tables in a keyboard-scrollable region by default and skips wrapping when wrapTables is false', () => {
    const tableHtml = '<table><tbody><tr><th>A</th><td>B</td></tr></tbody></table>';

    const fullHtml = prepareChecklistHtmlForDisplay(tableHtml, false);
    expect(fullHtml).toContain('class="richtext-table-wrapper"');
    expect(fullHtml).toContain('tabindex="0"');
    expect(fullHtml).toContain('role="region"');
    expect(fullHtml).toContain('aria-label="Tabelle"');

    const compactHtml = prepareChecklistHtmlForDisplay(tableHtml, false, { wrapTables: false });
    expect(compactHtml).not.toContain('richtext-table-wrapper');
    expect(compactHtml).not.toContain('tabindex="0"');
  });
});

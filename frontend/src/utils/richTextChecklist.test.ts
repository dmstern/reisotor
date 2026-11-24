// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
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

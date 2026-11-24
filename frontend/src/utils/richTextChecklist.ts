import DOMPurify from 'dompurify';

const ALLOWED_DATA_ATTRS = new Set(['data-type', 'data-checked']);

/**
 * Sanitizes Rich-Text HTML while preserving Tiptap TaskList/TaskItem structures
 * (`data-type`, `data-checked`, `<label>`, `<input type="checkbox">`, `<span>`, `<div>`).
 * Non-checkbox `<input>` elements and arbitrary `data-*` attributes are stripped.
 */
export function sanitizeRichTextHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html, {
    ADD_TAGS: ['label', 'input', 'span', 'div'],
    ADD_ATTR: ['data-type', 'data-checked', 'type', 'checked', 'disabled'],
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
 * attributes for read-only vs. interactive `RichTextDisplay` rendering.
 */
export function prepareChecklistHtmlForDisplay(html: string, interactive: boolean): string {
  if (typeof DOMParser === 'undefined') {
    return html;
  }

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

import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../../src/utils/sanitizeHtml.js';

describe('sanitizeHtml', () => {
  it('preserves standard rich-text formatting and safe links', () => {
    const input =
      '<p><strong>Fett</strong>, <em>Kursiv</em>, <a href="https://example.com" target="_blank" rel="noopener">Link</a></p>';
    expect(sanitizeHtml(input)).toBe(input);
  });

  it('preserves Tiptap taskList and taskItem checklists (checked, unchecked, nested)', () => {
    const input =
      '<ul data-type="taskList">' +
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span></span></label><div><p>Sonnencreme</p></div></li>' +
      '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked" /><span></span></label><div><p>Wasser</p>' +
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox" /><span></span></label><div><p>2 Liter</p></div></li></ul>' +
      '</div></li>' +
      '</ul>';

    const output = sanitizeHtml(input);
    expect(output).toContain('data-type="taskList"');
    expect(output).toContain('data-type="taskItem"');
    expect(output).toContain('data-checked="true"');
    expect(output).toContain('data-checked="false"');
    expect(output).toContain('type="checkbox"');
    expect(output).toContain('checked="checked"');
    expect(output).toContain('Sonnencreme');
    expect(output).toContain('2 Liter');
  });

  it('strips non-checkbox inputs, invalid data attributes, scripts, and event handlers', () => {
    const input =
      '<p onclick="alert(1)">Text</p>' +
      '<script>alert(2)</script>' +
      '<input type="text" value="secret" />' +
      '<input type="image" src="x" onerror="alert(3)" />' +
      '<ul data-type="evil"><li data-type="evil" data-checked="maybe">Item</li></ul>';

    const output = sanitizeHtml(input);
    expect(output).not.toContain('<script');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('onerror');
    expect(output).not.toContain('type="text"');
    expect(output).not.toContain('type="image"');
    expect(output).not.toContain('data-type="evil"');
    expect(output).not.toContain('data-checked="maybe"');
    expect(output).toContain('<p>Text</p>');
    expect(output).toContain('Item');
  });
});

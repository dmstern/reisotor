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

  it('preserves valid tables with headers, formatting, and safe span/scope attributes', () => {
    const input =
      '<table><thead><tr><th scope="col" colspan="2"><p><strong>Plan</strong></p></th></tr></thead>' +
      '<tbody><tr><td rowspan="2"><p>Tag 1</p></td><td><p><em>Anreise</em></p></td></tr>' +
      '<tr><td><p>Check-in</p></td></tr></tbody><tfoot><tr><td><p>Summe</p></td><td><p>2</p></td></tr></tfoot></table>';

    const output = sanitizeHtml(input);
    expect(output).toBe(input);
  });

  it('strips unsafe attributes, invalid spans/scopes, and scripts inside tables', () => {
    const input =
      '<table class="evil" style="color:red" width="100" bgcolor="#000" onclick="alert(1)">' +
      '<tbody><tr><th scope="evil" colspan="0" rowspan="abc" style="background:red"><p>Kopf</p></th>' +
      '<td colspan="-2" rowspan="100" onclick="alert(2)"><p>Zelle</p><script>alert(3)</script></td></tr></tbody></table>';

    const output = sanitizeHtml(input);
    expect(output).not.toContain('style=');
    expect(output).not.toContain('class=');
    expect(output).not.toContain('width=');
    expect(output).not.toContain('bgcolor=');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('scope="evil"');
    expect(output).not.toContain('colspan=');
    expect(output).not.toContain('rowspan=');
    expect(output).toContain(
      '<table><tbody><tr><th><p>Kopf</p></th><td><p>Zelle</p></td></tr></tbody></table>'
    );
  });
});

import { describe, expect, it } from 'vitest';
import { formatInline, renderRichText } from './richText';

describe('renderRichText', () => {
  it('escapes HTML special characters before any markdown processing', () => {
    expect(renderRichText('<script>alert("hi")</script>')).toBe(
      '&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;<br>',
    );
  });

  it('renders a URL with an underscore in a query param as one intact link, not split by the italic rule', () => {
    const html = renderRichText('Link: https://maps.google.com/?g_ep=foo_bar&x=1');
    // Genau ein <a>-Tag, keine durch die _..._-Kursiv-Regel abgetrennten Fragmente.
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain('<em>');
    expect(html).toContain('href="https://maps.google.com/?g_ep=foo_bar&amp;x=1"');
  });

  it('renders a plain email address as a mailto link', () => {
    expect(renderRichText('Kontakt: max@example.com')).toContain('href="mailto:max@example.com"');
  });

  it('renders a phone-shaped digit sequence not already consumed by URL/email as a tel link', () => {
    expect(renderRichText('Ruf an: 030 1234567')).toContain('href="tel:0301234567"');
  });

  it('renders **bold** and _italic_ markdown', () => {
    expect(renderRichText('**fett** und _kursiv_')).toContain('<strong>fett</strong>');
    expect(renderRichText('**fett** und _kursiv_')).toContain('<em>kursiv</em>');
  });

  it('groups consecutive bullet lines into a single <ul> with one <li> per line', () => {
    const html = renderRichText('* eins\n* zwei\nkein bullet\n- drei');
    expect(html.match(/<ul>/g)).toHaveLength(2); // eine Liste für eins/zwei, eine zweite für drei
    expect(html).toContain('<li>eins</li>');
    expect(html).toContain('<li>zwei</li>');
    expect(html).toContain('<li>drei</li>');
  });
});

describe('formatInline', () => {
  it('wraps bold text directly', () => {
    expect(formatInline('**wichtig**')).toBe('<strong>wichtig</strong>');
  });
});

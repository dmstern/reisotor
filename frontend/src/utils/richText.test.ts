import { describe, expect, it } from 'vitest';
import { formatInline, isEmptyRichText, renderRichText } from './richText';

describe('isEmptyRichText', () => {
  it('treats an empty Tiptap paragraph as empty', () => {
    expect(isEmptyRichText('<p></p>')).toBe(true);
  });

  it('treats whitespace-only paragraphs as empty', () => {
    expect(isEmptyRichText('<p>   </p>')).toBe(true);
  });

  it('treats an empty string as empty', () => {
    expect(isEmptyRichText('')).toBe(true);
  });

  it('treats real text content as non-empty', () => {
    expect(isEmptyRichText('<p>Hallo</p>')).toBe(false);
  });
});

describe('renderRichText', () => {
  it('escapes HTML special characters before any markdown processing', () => {
    // DOMPurify renormalisiert &quot; → " innerhalb von bereits escapeten Tags (kein Risiko,
    // da der Tag selbst als &lt;script&gt; escaped bleibt und nie als echter Tag interpretiert wird).
    expect(renderRichText('<script>alert("hi")</script>')).toBe(
      '&lt;script&gt;alert("hi")&lt;/script&gt;<br>'
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

  it('groups consecutive numbered lines into a single <ol> with one <li> per line', () => {
    const html = renderRichText('1. eins\n2. zwei\nkein listenpunkt\n1. drei');
    expect(html.match(/<ol>/g)).toHaveLength(2);
    expect(html).toContain('<li>eins</li>');
    expect(html).toContain('<li>zwei</li>');
    expect(html).toContain('<li>drei</li>');
  });

  it('renders # through ###### as headings, with inline formatting inside', () => {
    expect(renderRichText('# Titel')).toBe('<h1>Titel</h1>');
    expect(renderRichText('## Titel')).toBe('<h2>Titel</h2>');
    expect(renderRichText('###### Titel')).toBe('<h6>Titel</h6>');
    expect(renderRichText('# **fett**')).toBe('<h1><strong>fett</strong></h1>');
  });

  it('renders a single quote line as a <blockquote>', () => {
    expect(renderRichText('> Zitat')).toBe('<blockquote>Zitat</blockquote>');
  });

  it('groups consecutive quote lines into one <blockquote> joined by <br>', () => {
    const html = renderRichText('> eins\n> zwei');
    expect(html.match(/<blockquote>/g)).toHaveLength(1);
    expect(html).toBe('<blockquote>eins<br>zwei</blockquote>');
  });

  it('renders ---, *** and ___ as a horizontal rule', () => {
    expect(renderRichText('---')).toBe('<hr>');
    expect(renderRichText('***')).toBe('<hr>');
    expect(renderRichText('___')).toBe('<hr>');
  });

  it('flushes an open list when a different block type follows', () => {
    const html = renderRichText('* eins\n> Zitat');
    expect(html).toBe('<ul><li>eins</li></ul><blockquote>Zitat</blockquote>');
  });

  it('renders `code` spans and leaves their content unformatted/un-autolinked', () => {
    expect(renderRichText('nutz `code` hier')).toContain('<code>code</code>');
    const html = renderRichText('`**nicht fett** https://example.com`');
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<a ');
    expect(html).toContain('<code>**nicht fett** https://example.com</code>');
  });

  it('renders ~~text~~ as <del>', () => {
    expect(renderRichText('~~weg~~')).toContain('<del>weg</del>');
  });
});

describe('formatInline', () => {
  it('wraps bold text directly', () => {
    expect(formatInline('**wichtig**')).toBe('<strong>wichtig</strong>');
  });
});

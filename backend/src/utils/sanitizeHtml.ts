import sanitize from 'sanitize-html';

// Verteidigung gegen Clients, die die clientseitige Sanitizing (RichTextEditor.vue,
// DOMPurify.sanitize() vor dem Absenden) umgehen - jede Route, die vom neuen WYSIWYG-Editor
// befülltes HTML entgegennimmt (siehe content_format/note_format-Spalten, db/index.ts), sanitized
// hier ein zweites Mal serverseitig, bevor es gespeichert wird.
//
// sanitize-html statt isomorphic-dompurify: letzteres zieht jsdom@30 nach sich, das ^22.22.2
// voraussetzt und beim Modul-Import (nicht erst beim Sanitizen) crasht, wenn die Node-Version
// darunter liegt - auf dem Raspberry-Pi-Deploy-Ziel nicht garantiert. sanitize-html ist ein reiner
// String-Parser ohne DOM-Abhängigkeit, funktioniert also auf jeder Node-Version.
//
// Allowlist entspricht genau dem, was RichTextEditor.vue's Tiptap-Toolbar erzeugen kann (StarterKit
// + Link-Extension + TaskList/TaskItem für Checklisten + Table für Tabellen): Absätze,
// Fett/Kursiv/Durchgestrichen, Überschriften, Listen (inkl. interaktiver Task-Listen), Tabellen,
// Zitat, Code (inline + Block), Trennlinie, Zeilenumbruch, Links.
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'code',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'a',
  'label',
  'input',
  'span',
  'div',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
];

const VALID_SPAN_PATTERN = /^[1-9]\d?$/;
const ALLOWED_TABLE_SCOPES = new Set(['col', 'row', 'colgroup', 'rowgroup']);

function sanitizeTableCellAttribs(tagName: string, attribs: sanitize.Attributes): sanitize.Tag {
  const nextAttribs: sanitize.Attributes = { ...attribs };

  for (const attr of ['colspan', 'rowspan'] as const) {
    if (nextAttribs[attr] !== undefined && !VALID_SPAN_PATTERN.test(nextAttribs[attr])) {
      delete nextAttribs[attr];
    }
  }

  if (
    tagName === 'th' &&
    nextAttribs.scope !== undefined &&
    !ALLOWED_TABLE_SCOPES.has(nextAttribs.scope)
  ) {
    delete nextAttribs.scope;
  }

  return { tagName, attribs: nextAttribs };
}

export function sanitizeHtml(html: string): string {
  return sanitize(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      ul: [{ name: 'data-type', values: ['taskList'] }],
      li: [
        { name: 'data-type', values: ['taskItem'] },
        { name: 'data-checked', values: ['true', 'false'] },
      ],
      input: [{ name: 'type', values: ['checkbox'] }, 'checked', 'disabled'],
      th: ['colspan', 'rowspan', { name: 'scope', values: ['col', 'row', 'colgroup', 'rowgroup'] }],
      td: ['colspan', 'rowspan'],
    },
    transformTags: {
      th: sanitizeTableCellAttribs,
      td: sanitizeTableCellAttribs,
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    exclusiveFilter: (frame) => frame.tag === 'input' && frame.attribs.type !== 'checkbox',
  });
}

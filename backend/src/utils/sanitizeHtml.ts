import DOMPurify from 'isomorphic-dompurify';

// Verteidigung gegen Clients, die die clientseitige Sanitizing (RichTextEditor.vue,
// DOMPurify.sanitize() vor dem Absenden) umgehen - jede Route, die vom neuen WYSIWYG-Editor
// befülltes HTML entgegennimmt (siehe content_format/note_format-Spalten, db/index.ts), sanitized
// hier ein zweites Mal serverseitig, bevor es gespeichert wird.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

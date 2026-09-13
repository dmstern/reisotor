<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import { renderRichText } from '../utils/richText';

// Zeigt ein Freitext-/Notizfeld an, das entweder schon (sanitiztes) HTML vom neuen WYSIWYG-Editor
// enthält (format === 'html', siehe RichTextEditor.vue/content_format-Spalten) oder noch im alten
// Markdown-ähnlichen Klartext vorliegt (format 'legacy'/fehlend, ältere Zeilen von vor dieser
// Umstellung) - für Letztere bleibt renderRichText() (utils/richText.ts) der Anzeige-Weg, kein
// Content-Sniffing nötig, das Format-Flag entscheidet eindeutig. Erneutes DOMPurify.sanitize() hier
// zusätzlich zum bereits serverseitig sanitizten Wert - günstige zweite Absicherung direkt vorm
// v-html, kostet nichts an einer einzelnen Stelle statt X Views einzeln absichern zu müssen.
const props = defineProps<{ content: string; format?: string | null }>();

// Wenn format='html', direkt durch DOMPurify sanitizen und als HTML rendern.
// Fallback: Wenn das Format nicht explizit 'html' ist, aber der Inhalt offensichtlich HTML ist
// (beginnt mit '<'), wird Content-Sniffing als letzter Ausweg angewendet - das tritt auf, wenn
// Notizen im WYSIWYG-Editor geschrieben wurden, bevor note_format-Tracking für Touren eingeführt
// wurde (DB-Default war 'legacy'). Ohne diesen Fallback würden die <p>-Tags als Rohtext angezeigt.
const html = computed(() => {
  if (props.format === 'html' || props.content.trimStart().startsWith('<')) {
    return DOMPurify.sanitize(props.content);
  }
  return renderRichText(props.content);
});
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="richtext" v-html="html"></div>
</template>

<style scoped>
.richtext :deep(> :first-child) {
  margin-top: 0;
}

.richtext :deep(ul),
.richtext :deep(ol) {
  margin: 4px 0;
  padding-left: 1.3em;
}

.richtext :deep(h1),
.richtext :deep(h2),
.richtext :deep(h3),
.richtext :deep(h4),
.richtext :deep(h5),
.richtext :deep(h6) {
  margin: var(--space-2) 0 4px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--color-text);
}

.richtext :deep(h1) {
  font-size: 1.3rem;
}

.richtext :deep(h2) {
  font-size: 1.15rem;
}

.richtext :deep(h3) {
  font-size: 1.05rem;
}

.richtext :deep(h4),
.richtext :deep(h5),
.richtext :deep(h6) {
  font-size: 0.95rem;
}

.richtext :deep(blockquote) {
  margin: 4px 0;
  padding: 2px 0 2px 10px;
  border-left: 3px solid var(--color-border);
  color: var(--color-text-muted);
}

.richtext :deep(hr) {
  margin: var(--space-2) 0;
  border: none;
  border-top: 1px solid var(--color-border);
}

.richtext :deep(code) {
  background: var(--color-bg);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: 0.9em;
}

.richtext :deep(del) {
  color: var(--color-text-muted);
}

.richtext :deep(> br:last-child) {
  display: none;
}

.richtext :deep(.richtext-link) {
  vertical-align: middle;
}
</style>

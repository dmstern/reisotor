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

const html = computed(() =>
  props.format === 'html' ? DOMPurify.sanitize(props.content) : renderRichText(props.content)
);
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="richtext" v-html="html"></div>
</template>

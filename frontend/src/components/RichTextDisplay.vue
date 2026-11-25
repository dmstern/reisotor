<script setup lang="ts">
import { computed, ref } from 'vue';
import { renderRichText } from '../utils/richText';
import {
  prepareChecklistHtmlForDisplay,
  sanitizeRichTextHtml,
  toggleTaskItemInHtml,
} from '../utils/richTextChecklist';

// Zeigt ein Freitext-/Notizfeld an, das entweder schon (sanitiztes) HTML vom neuen WYSIWYG-Editor
// enthält (format === 'html', siehe RichTextEditor.vue/content_format-Spalten) oder noch im alten
// Markdown-ähnlichen Klartext vorliegt (format 'legacy'/fehlend, ältere Zeilen von vor dieser
// Umstellung) - für Letztere bleibt renderRichText() (utils/richText.ts) der Anzeige-Weg, kein
// Content-Sniffing nötig, das Format-Flag entscheidet eindeutig. Erneutes Sanitizing hier
// zusätzlich zum bereits serverseitig sanitizten Wert - günstige zweite Absicherung direkt vorm
// v-html, kostet nichts an einer einzelnen Stelle statt X Views einzeln absichern zu müssen.
const props = withDefaults(
  defineProps<{
    content: string;
    format?: string | null;
    interactive?: boolean;
    compact?: boolean;
  }>(),
  { format: null, interactive: false, compact: false }
);
const emit = defineEmits<{
  (e: 'update:content', value: string): void;
}>();

const containerRef = ref<HTMLElement | null>(null);

// Wenn format='html', direkt durch sanitizeRichTextHtml() sanitizen und als HTML rendern.
// Fallback: Wenn das Format nicht explizit 'html' ist, aber der Inhalt offensichtlich HTML ist
// (beginnt mit '<'), wird Content-Sniffing als letzter Ausweg angewendet - das tritt auf, wenn
// Notizen im WYSIWYG-Editor geschrieben wurden, bevor note_format-Tracking für Touren eingeführt
// wurde (DB-Default war 'legacy'). Ohne diesen Fallback würden die <p>-Tags als Rohtext angezeigt.
const html = computed(() => {
  if (props.format === 'html' || props.content.trimStart().startsWith('<')) {
    return prepareChecklistHtmlForDisplay(sanitizeRichTextHtml(props.content), props.interactive, {
      wrapTables: !props.compact,
    });
  }

  return renderRichText(props.content);
});

function onContainerClick(event: MouseEvent) {
  if (!props.interactive) {
    return;
  }

  const target = event.target as HTMLElement | null;

  if (target?.closest('li[data-type="taskItem"]')) {
    event.stopPropagation();
  }
}

function onContainerChange(event: Event) {
  if (!props.interactive || !containerRef.value) {
    return;
  }

  const target = event.target as HTMLInputElement | null;

  if (!target || target.tagName !== 'INPUT' || target.type !== 'checkbox') {
    return;
  }

  const taskItem = target.closest('li[data-type="taskItem"]');

  if (!taskItem) {
    return;
  }

  const allItems = Array.from(containerRef.value.querySelectorAll('li[data-type="taskItem"]'));
  const taskIndex = allItems.indexOf(taskItem);

  if (taskIndex === -1) {
    return;
  }

  const nextHtml = toggleTaskItemInHtml(props.content, taskIndex, target.checked);
  emit('update:content', nextHtml);
}
</script>

<template>
  <!-- eslint-disable vue/no-v-html, vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
  <div
    ref="containerRef"
    class="richtext"
    :class="{ 'is-interactive': interactive, 'is-compact': compact }"
    @click="onContainerClick"
    @change="onContainerChange"
    v-html="html"
  ></div>
  <!-- eslint-enable vue/no-v-html, vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
</template>

<style lang="scss" scoped>
@use '../styles/_richtextTaskList.scss' as *;
@use '../styles/_richtextTable.scss' as *;

.richtext :deep(> :first-child) {
  margin-top: 0;
}

.richtext :deep(ul),
.richtext :deep(ol) {
  margin: var(--space-xs) 0;
  padding-left: 1.3em;
}

.richtext :deep() {
  @include richtext-task-list;
  @include richtext-headings;
  @include richtext-table;
}

.richtext :deep(blockquote) {
  margin: var(--space-xs) 0;
  padding: var(--space-2xs) 0 var(--space-2xs) 10px;
  border-left: 3px solid var(--color-border-divider);
  color: var(--color-text-muted);
}

.richtext :deep(hr) {
  margin: var(--space-sm) 0;
  border: none;
  @include divider-engraved('bottom');
}

.richtext :deep(code) {
  background: var(--color-bg);
  border-radius: var(--radius-2xs);
  padding: 1px 5px;
  font-size: 0.9em;
}

.richtext :deep(del) {
  color: var(--color-text-muted);
}

.richtext :deep(> :last-child) {
  margin-bottom: 0;
}

.richtext :deep(> br:last-child) {
  display: none;
}

.richtext :deep(.richtext-link) {
  vertical-align: middle;
}

.richtext.is-compact :deep(.richtext-table-wrapper),
.richtext.is-compact :deep(table),
.richtext.is-compact :deep(thead),
.richtext.is-compact :deep(tbody),
.richtext.is-compact :deep(tfoot),
.richtext.is-compact :deep(tr),
.richtext.is-compact :deep(th),
.richtext.is-compact :deep(td),
.richtext.is-compact :deep(p),
.richtext.is-compact :deep(h1),
.richtext.is-compact :deep(h2),
.richtext.is-compact :deep(h3),
.richtext.is-compact :deep(h4),
.richtext.is-compact :deep(h5),
.richtext.is-compact :deep(h6) {
  display: inline;
  border: none;
  background: transparent;
  padding: 0;
  margin: 0;
  min-width: 0;
  overflow: visible;
}

.richtext.is-compact :deep(h1),
.richtext.is-compact :deep(h2),
.richtext.is-compact :deep(h3),
.richtext.is-compact :deep(h4),
.richtext.is-compact :deep(h5),
.richtext.is-compact :deep(h6) {
  font-size: inherit;
  font-weight: 600;
}

.richtext.is-compact :deep(th) {
  font-weight: 600;
}

.richtext.is-compact :deep(th + th::before),
.richtext.is-compact :deep(td + td::before),
.richtext.is-compact :deep(th + td::before),
.richtext.is-compact :deep(td + th::before),
.richtext.is-compact :deep(tr + tr::before),
.richtext.is-compact :deep(thead + tbody > tr:first-child::before),
.richtext.is-compact :deep(tbody + tfoot > tr:first-child::before),
.richtext.is-compact :deep(thead + tfoot > tr:first-child::before),
.richtext.is-compact
  :deep(:is(p, h1, h2, h3, h4, h5, h6, table) + :is(p, h1, h2, h3, h4, h5, h6, table)::before) {
  content: ' · ';
  color: var(--color-text-muted);
  font-weight: 400;
}
</style>

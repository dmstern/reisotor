<script setup lang="ts">
import { watch } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import DOMPurify from 'dompurify';

// Ersetzt die bisherigen <textarea>+renderRichText()-Vorschau-Formularfelder (Notizen, Tagebuch,
// Reise-/Ausflugs-/Spot-Notizen) durch einen echten WYSIWYG-Editor - Formatierung wird direkt beim
// Tippen sichtbar statt erst beim Anzeigen aus Markdown-Syntax gerendert zu werden. v-model verhält
// sich wie bei einem normalen Textfeld (HTML-String rein/raus), damit bestehende Formulare (inkl.
// useDraftAutosave) unverändert weiterlaufen. Sanitizing hier UND nochmal serverseitig
// (backend/src/utils/sanitizeHtml.ts) - Verteidigung in der Tiefe, falls das Frontend umgangen wird.
const props = withDefaults(defineProps<{ modelValue: string; placeholder?: string }>(), {
  placeholder: '',
});
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Link.configure({ autolink: true, openOnClick: false, linkOnPaste: true }),
  ],
  editorProps: {
    attributes: { class: 'richtext-content richtext' },
  },
  onUpdate: ({ editor }) => {
    emit('update:modelValue', DOMPurify.sanitize(editor.getHTML()));
  },
});

// Externe Änderungen am v-model (z. B. Entwurfs-Wiederherstellung durch useDraftAutosave, oder ein
// Formular-Reset nach dem Absenden) müssen den Editor-Inhalt nachziehen - ohne den Vergleich würde
// jede Nutzereingabe den Cursor zurücksetzen, da setContent() sonst bei jedem Tastendruck erneut liefe.
watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value || editor.value.getHTML() === value) return;
    editor.value.commands.setContent(value, { emitUpdate: false });
  },
);

function isActive(name: string, attrs?: Record<string, unknown>) {
  return editor.value?.isActive(name, attrs) ?? false;
}
</script>

<template>
  <div class="richtext-editor">
    <!-- Bewusst immer gerendert (kein v-if="editor") statt erst nach der asynchronen
         Editor-Initialisierung zu erscheinen - sonst poppt die Toolbar kurz nach dem ersten Render
         rein und verschiebt den Editor-Inhalt (und alles darunter, z. B. ein Datei-Upload-Feld) nach
         unten. Führte zu einem echten Layout-Shift beim Öffnen (Fehlklicks bei zu schnellem
         Interagieren) und genau daraus resultierender E2E-Flakiness (Klicks auf den Editor trafen
         stattdessen kurzzeitig ein darunterliegendes Element). Buttons bis dahin deaktiviert statt
         funktionslos anklickbar. -->
    <div class="toolbar">
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('bold') }"
        title="Fett"
        aria-label="Fett"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleBold().run()"
      >
        <strong>F</strong>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('italic') }"
        title="Kursiv"
        aria-label="Kursiv"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleItalic().run()"
      >
        <em>K</em>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('strike') }"
        title="Durchgestrichen"
        aria-label="Durchgestrichen"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleStrike().run()"
      >
        <s>D</s>
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('heading', { level: 2 }) }"
        title="Überschrift"
        aria-label="Überschrift"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleHeading({ level: 2 }).run()"
      >
        H
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('bulletList') }"
        title="Aufzählung"
        aria-label="Aufzählung"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleBulletList().run()"
      >
        •
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('orderedList') }"
        title="Nummerierte Liste"
        aria-label="Nummerierte Liste"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleOrderedList().run()"
      >
        1.
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('blockquote') }"
        title="Zitat"
        aria-label="Zitat"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleBlockquote().run()"
      >
        "
      </button>
      <button
        type="button"
        class="toolbar-btn"
        :class="{ active: isActive('code') }"
        title="Code"
        aria-label="Code"
        :disabled="!editor"
        @click="editor?.chain().focus().toggleCode().run()"
      >
        ⌨︎
      </button>
    </div>
    <editor-content :editor="editor" />
    <p v-if="placeholder && editor?.isEmpty" class="editor-placeholder" aria-hidden="true">{{ placeholder }}</p>
  </div>
</template>

<style scoped>
.richtext-editor {
  position: relative;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  overflow: hidden;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-hover);
}

.toolbar-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text);
  font-size: 0.85rem;
  cursor: pointer;
  line-height: 1;
}

.toolbar-btn:hover {
  background: var(--color-primary-tint);
}

.toolbar-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.toolbar-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.editor-placeholder {
  position: absolute;
  left: 12px;
  /* Unter der Toolbar statt am Container-Anfang - der Editor-Inhalt selbst startet dort. */
  top: 44px;
  margin: 0;
  color: var(--color-text-muted);
  pointer-events: none;
  font-size: 0.95rem;
}

.richtext-editor :deep(.richtext-content) {
  padding: var(--space-2) var(--space-3);
  min-height: 6em;
  outline: none;
}
</style>

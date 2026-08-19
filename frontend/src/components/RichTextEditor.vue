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

// Gesetzt während des eigenen onUpdate-Emits, siehe Watcher unten - verhindert, dass das direkt
// danach vom Formular zurückgespiegelte v-model (identischer Inhalt, ggf. nur durch DOMPurify leicht
// normalisiert) den Editor per setContent() erneut komplett neu aufbaut. So ein Reentrant-Aufbau
// mitten im Tippen kappt auf iOS Safari u. a. die native "zweimal Leertaste -> Punkt"-Ersetzung, die
// an einer ununterbrochenen nativen Eingabe-Session auf dem contenteditable-Element hängt.
let syncingFromEditor = false;

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
    syncingFromEditor = true;
    emit('update:modelValue', DOMPurify.sanitize(editor.getHTML()));
  },
});

// Externe Änderungen am v-model (z. B. Entwurfs-Wiederherstellung durch useDraftAutosave, oder ein
// Formular-Reset nach dem Absenden) müssen den Editor-Inhalt nachziehen - der syncingFromEditor-Guard
// oben sorgt dafür, dass das nur bei echten externen Änderungen passiert, nicht als Echo der eigenen
// Eingabe (siehe Kommentar dort).
watch(
  () => props.modelValue,
  (value) => {
    if (syncingFromEditor) {
      syncingFromEditor = false;
      return;
    }
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
    <editor-content :editor="editor" class="content-scroll" />
    <p v-if="placeholder && editor?.isEmpty" class="editor-placeholder" aria-hidden="true">{{ placeholder }}</p>
  </div>
</template>

<style scoped>
/* display:flex + flex-shrink:0 + max-height (statt einfach nur overflow:hidden ohne Höhenangabe):
   innerhalb eines full-height-Modal-Formulars (Modal.vue, :slotted(form) { flex:1; overflow-y:auto })
   ist dieser Editor sonst selbst ein schrumpfbares Flex-Item - durch overflow:hidden bekommt es lt.
   Flexbox-Spec eine automatische Mindestgröße von 0 und kann bei Platzmangel (z. B. eine lange
   Touren-/Spot-Auswahlliste darunter) bis auf wenige Pixel zusammengedrückt werden, wobei die Toolbar
   (erstes Kind) mit-geclippt wird. flex-shrink:0 verhindert das Zusammendrücken, max-height deckelt
   stattdessen die Gesamthöhe - der eigentliche Scrollbereich für lange Texte ist .content-scroll
   unten, nicht dieser äußere Rahmen. */
.richtext-editor {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: min(55vh, 480px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-surface);
  overflow: hidden;
}

/* Desktop hat spürbar mehr Platz als das mobile 55vh/480px-Limit hergibt (#88) - Editor darf dort
   deutlich größer werden, Schrift etwas größer mitwachsen statt bei mobiler Lesegröße zu bleiben. */
@media (min-width: 800px) {
  .richtext-editor {
    max-height: min(65vh, 640px);
  }

  .richtext-editor :deep(.richtext-content) {
    font-size: 1.05rem;
  }
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px;
  /* Fixer Flex-Sibling außerhalb von .content-scroll (siehe unten) statt Teil des scrollenden
     Bereichs - bleibt dadurch beim Scrollen langer Texte immer sichtbar, ganz ohne position:sticky. */
  flex-shrink: 0;
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

/* <editor-content> rendert einen eigenen, ungestylten Wrapper-Div um den tatsächlichen
   contenteditable-Div (.richtext-content, siehe editorProps.attributes oben) - flex/overflow müssen
   deshalb hier auf dem Wrapper sitzen, nicht auf .richtext-content selbst (das wäre kein direktes
   Flex-Kind von .richtext-editor und flex:1 hätte dort keine Wirkung). min-height:0 erlaubt dem
   Wrapper trotz max-height am Editor selbst kleiner als der Inhalt zu werden, statt ihn zu sprengen -
   genau das macht .content-scroll zum eigentlichen, unabhängig scrollbaren Bereich für lange Texte. */
.content-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.richtext-editor :deep(.richtext-content) {
  padding: var(--space-2) var(--space-3);
  min-height: 6em;
  outline: none;
}
</style>

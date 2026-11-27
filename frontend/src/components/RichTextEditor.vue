<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import AppIcon from './AppIcon.vue';
import DropdownMenu from './primitives/DropdownMenu.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { sanitizeRichTextHtml } from '../utils/richTextChecklist';

const DEFAULT_TABLE_ROWS = 2;
const DEFAULT_TABLE_COLS = 2;
const HEADING_LEVEL_1 = 1;
const HEADING_LEVEL_2 = 2;
const HEADING_LEVEL_3 = 3;
const HEADING_LEVELS = [HEADING_LEVEL_1, HEADING_LEVEL_2, HEADING_LEVEL_3] as const;
type HeadingLevel = (typeof HEADING_LEVELS)[number];
const HEADING_MENU_CLASS = 'richtext-heading-menu';

interface TextStyleOption {
  id: 'h1' | 'h2' | 'h3' | 'p';
  label: string;
  level: HeadingLevel | null;
  previewClass: string;
}

const TEXT_STYLE_OPTIONS: readonly TextStyleOption[] = [
  {
    id: 'h1',
    label: 'Titel',
    level: HEADING_LEVEL_1,
    previewClass: 'heading-preview--h1',
  },
  {
    id: 'h2',
    label: 'Überschrift',
    level: HEADING_LEVEL_2,
    previewClass: 'heading-preview--h2',
  },
  {
    id: 'h3',
    label: 'Unterüberschrift',
    level: HEADING_LEVEL_3,
    previewClass: 'heading-preview--h3',
  },
  { id: 'p', label: 'Text', level: null, previewClass: 'heading-preview--p' },
];

// Ersetzt die bisherigen <textarea>+renderRichText()-Vorschau-Formularfelder (Notizen, Tagebuch,
// Reise-/Ausflugs-/Spot-Notizen) durch einen echten WYSIWYG-Editor - Formatierung wird direkt beim
// Tippen sichtbar statt erst beim Anzeigen aus Markdown-Syntax gerendert zu werden. v-model verhält
// sich wie bei einem normalen Textfeld (HTML-String rein/raus), damit bestehende Formulare (inkl.
// useDraftAutosave) unverändert weiterlaufen. Sanitizing hier UND nochmal serverseitig
// (backend/src/utils/sanitizeHtml.ts) - Verteidigung in der Tiefe, falls das Frontend umgangen wird.
// compact (#194): Notiz-Felder an nebensächlichen Objekten (Spots, Touren, Kalender-Events, ...)
// sollen NICHT die für Tagebuch/Notizen (#88) eingeführte Desktop-Vergrößerung erben - dort ist das
// Freitextfeld die Hauptsache des Formulars, hier nur eine ergänzende Randnotiz.
// expandable (#258): Initial zugeklappt als kompaktes Klickfeld, expandiert erst bei Interaktion.
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    compact?: boolean;
    expandable?: boolean;
    invalid?: boolean;
    modified?: boolean;
  }>(),
  {
    placeholder: '',
    compact: false,
    expandable: false,
    invalid: false,
    modified: false,
  }
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'blur'): void;
}>();

const isExpanded = ref(false);
const isFocused = ref(false);
const headingMenuOpen = ref(false);
const editorContainerRef = ref<HTMLElement | null>(null);
const headingMenuRef = ref<InstanceType<typeof PickerMenu> | null>(null);

const hasContent = computed(() => {
  if (!props.modelValue) {
    return false;
  }

  if (/<table[\s>]/i.test(props.modelValue)) {
    return true;
  }

  const stripped = props.modelValue.replace(/<[^>]+>/g, '').trim();
  return stripped.length > 0;
});

function isWithinEditorOrMenu(node: Node | null): boolean {
  if (!node) {
    return false;
  }

  if (editorContainerRef.value?.contains(node)) {
    return true;
  }

  return node instanceof Element && node.closest(`.${HEADING_MENU_CLASS}`) !== null;
}

function expandAndFocus() {
  isExpanded.value = true;
  nextTick(() => {
    if (editor.value) {
      editor.value.commands.focus('end');
    }

    isFocused.value = true;
  });
}

function onFocusIn() {
  isFocused.value = true;
}

function onFocusOut(event: FocusEvent) {
  const related = event.relatedTarget as Node | null;

  if (isWithinEditorOrMenu(related)) {
    return;
  }

  isFocused.value = false;
  headingMenuOpen.value = false;
  emit('blur');

  if (props.expandable && !hasContent.value) {
    isExpanded.value = false;
  }
}

function focusEditor() {
  if (!editor.value?.isFocused) {
    editor.value?.commands.focus();
  }
}

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
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
  ],
  editorProps: {
    attributes: { class: 'richtext-content richtext' },
  },
  onFocus: () => {
    isFocused.value = true;
  },
  onBlur: ({ event }) => {
    const relatedTarget = (event as FocusEvent)?.relatedTarget as Node | null;

    if (isWithinEditorOrMenu(relatedTarget)) {
      return;
    }

    isFocused.value = false;
    headingMenuOpen.value = false;

    if (props.expandable && !hasContent.value) {
      isExpanded.value = false;
    }
  },
  onUpdate: ({ editor }) => {
    syncingFromEditor = true;
    emit('update:modelValue', sanitizeRichTextHtml(editor.getHTML()));
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

    if (!editor.value || editor.value.getHTML() === value) {
      return;
    }

    editor.value.commands.setContent(value, { emitUpdate: false });

    if (!hasContent.value && !isFocused.value) {
      isExpanded.value = false;
    }
  }
);

watch(isFocused, (focused) => {
  if (!focused) {
    headingMenuOpen.value = false;
  }
});

function isActive(name: string, attrs?: Record<string, unknown>) {
  return editor.value?.isActive(name, attrs) ?? false;
}

const activeHeadingLevel = computed<HeadingLevel | null>(() => {
  for (const level of HEADING_LEVELS) {
    if (isActive('heading', { level })) {
      return level;
    }
  }

  return null;
});

const activeHeadingLabel = computed(() => {
  if (activeHeadingLevel.value === null) {
    return 'H';
  }

  return `H${activeHeadingLevel.value}`;
});

function isStyleActive(option: TextStyleOption): boolean {
  if (option.level === null) {
    return activeHeadingLevel.value === null;
  }

  return activeHeadingLevel.value === option.level;
}

function toggleHeadingMenu() {
  headingMenuOpen.value = !headingMenuOpen.value;
}

function closeHeadingMenu() {
  headingMenuOpen.value = false;
}

function applyTextStyle(level: HeadingLevel | null) {
  headingMenuOpen.value = false;

  if (!editor.value) {
    return;
  }

  if (level === null) {
    editor.value.chain().focus().setParagraph().run();
    return;
  }

  editor.value.chain().focus().setHeading({ level }).run();
}

function onHeadingMenuKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    return;
  }

  const menuEl = headingMenuRef.value?.el;

  if (!menuEl) {
    return;
  }

  const items = Array.from(
    menuEl.querySelectorAll<HTMLButtonElement>('button.dropdown-item:not(:disabled)')
  );

  if (!items.length) {
    return;
  }

  event.preventDefault();
  const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  let nextIndex = 0;

  if (event.key === 'End') {
    nextIndex = items.length - 1;
  } else if (event.key === 'ArrowDown') {
    nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
  } else if (event.key === 'ArrowUp') {
    nextIndex =
      currentIndex >= 0 ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
  }

  items[nextIndex]?.focus();
}

function onWindowKeydownCapture(event: KeyboardEvent) {
  if (!headingMenuOpen.value || event.key !== 'Escape') {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  headingMenuOpen.value = false;
  editor.value?.commands.focus();
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydownCapture, true);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onWindowKeydownCapture, true);
});

const isTableToolbarOpen = computed(() => isFocused.value && isActive('table'));

const isHeaderRowActive = computed(() => {
  if (!editor.value || !isActive('table')) {
    return false;
  }

  const { $from } = editor.value.state.selection;

  for (let depth = $from.depth; depth >= 1; depth -= 1) {
    const node = $from.node(depth);

    if (node.type.name === 'table') {
      return node.firstChild?.firstChild?.type.name === 'tableHeader';
    }
  }

  return false;
});

function insertTable() {
  if (!editor.value || isActive('table')) {
    return;
  }

  editor.value
    .chain()
    .focus()
    .insertTable({ rows: DEFAULT_TABLE_ROWS, cols: DEFAULT_TABLE_COLS, withHeaderRow: true })
    .run();
}

defineExpose({
  focus: focusEditor,
});
</script>

<template>
  <div
    v-if="expandable && !isExpanded && !hasContent"
    class="collapsed-trigger"
    :class="{ 'is-modified': modified }"
    role="button"
    tabindex="0"
    @click="expandAndFocus"
    @keydown.enter.space.prevent="expandAndFocus"
  >
    <AppIcon :icon="ACTION_ICONS.edit" :size="13" group="actions" />
    <span class="collapsed-placeholder">{{ placeholder || 'Notiz hinzufügen …' }}</span>
  </div>
  <div
    v-else
    ref="editorContainerRef"
    class="richtext-editor"
    :class="{ compact, 'is-focused': isFocused, 'is-invalid': invalid, 'is-modified': modified }"
    :aria-invalid="invalid || undefined"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <!-- Die Toolbar wird animiert ein- und ausgeblendet, wenn der Editor fokussiert wird bzw. den Fokus verliert.
         @mousedown.prevent verhindert Fokusverlust beim Klick auf Formatierungs-Buttons oder freie Bereiche. -->
    <div
      class="toolbar-wrapper"
      :class="{ 'is-open': isFocused }"
      :inert="!isFocused"
      @mousedown.prevent
    >
      <div class="toolbar-inner">
        <div class="toolbar" role="toolbar" aria-label="Textformatierung">
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('bold') }"
            :aria-pressed="isActive('bold')"
            title="Fett"
            aria-label="Fett"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleBold().run()"
          >
            <strong>F</strong>
          </button>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('italic') }"
            :aria-pressed="isActive('italic')"
            title="Kursiv"
            aria-label="Kursiv"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleItalic().run()"
          >
            <em>K</em>
          </button>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('strike') }"
            :aria-pressed="isActive('strike')"
            title="Durchgestrichen"
            aria-label="Durchgestrichen"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleStrike().run()"
          >
            <s>D</s>
          </button>
          <DropdownMenu :open="headingMenuOpen" teleport align="left" @toggle="toggleHeadingMenu">
            <template #trigger>
              <button
                type="button"
                class="toolbar-btn toolbar-btn--heading"
                :class="{ active: activeHeadingLevel !== null || headingMenuOpen }"
                title="Textstil"
                aria-label="Textstil"
                aria-haspopup="menu"
                :aria-expanded="headingMenuOpen"
                :disabled="!editor"
                @mousedown.prevent
                @click="toggleHeadingMenu"
                @keydown="onHeadingMenuKeydown"
              >
                <span>{{ activeHeadingLabel }}</span>
                <AppIcon :icon="ACTION_ICONS.chevronDown" :size="11" group="actions" />
              </button>
            </template>
            <PickerMenu
              ref="headingMenuRef"
              :class="HEADING_MENU_CLASS"
              :backdrop="true"
              @close="closeHeadingMenu"
              @mousedown.prevent
              @keydown="onHeadingMenuKeydown"
              @focusout="onFocusOut"
            >
              <DropdownMenuItem
                v-for="option in TEXT_STYLE_OPTIONS"
                :key="option.id"
                :active="isStyleActive(option)"
                :trailing-icon="isStyleActive(option) ? ACTION_ICONS.check : undefined"
                @mousedown.prevent
                @click="applyTextStyle(option.level)"
              >
                <span :class="option.previewClass">{{ option.label }}</span>
              </DropdownMenuItem>
            </PickerMenu>
          </DropdownMenu>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('bulletList') }"
            :aria-pressed="isActive('bulletList')"
            title="Aufzählung"
            aria-label="Aufzählung"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleBulletList().run()"
          >
            •
          </button>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('orderedList') }"
            :aria-pressed="isActive('orderedList')"
            title="Nummerierte Liste"
            aria-label="Nummerierte Liste"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleOrderedList().run()"
          >
            1.
          </button>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('taskList') }"
            :aria-pressed="isActive('taskList')"
            title="Checkliste"
            aria-label="Checkliste"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleTaskList().run()"
          >
            <AppIcon :icon="ACTION_ICONS.checklist" :size="15" group="actions" />
          </button>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('table') }"
            :aria-pressed="isActive('table')"
            title="Tabelle einfügen"
            aria-label="Tabelle einfügen"
            :disabled="!editor || isActive('table')"
            @mousedown.prevent
            @click="insertTable"
          >
            <AppIcon :icon="ACTION_ICONS.table" :size="15" group="actions" />
          </button>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('blockquote') }"
            :aria-pressed="isActive('blockquote')"
            title="Zitat"
            aria-label="Zitat"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleBlockquote().run()"
          >
            "
          </button>
          <button
            type="button"
            class="toolbar-btn"
            :class="{ active: isActive('code') }"
            :aria-pressed="isActive('code')"
            title="Code"
            aria-label="Code"
            :disabled="!editor"
            @mousedown.prevent
            @click="editor?.chain().focus().toggleCode().run()"
          >
            ⌨︎
          </button>
        </div>
        <div
          class="table-toolbar-wrapper"
          :class="{ 'is-open': isTableToolbarOpen }"
          :inert="!isTableToolbarOpen"
        >
          <div class="table-toolbar-inner">
            <div class="table-toolbar" role="toolbar" aria-label="Tabellen-Aktionen">
              <div class="toolbar-group" role="group" aria-label="Zeilen">
                <button
                  type="button"
                  class="toolbar-btn"
                  title="Zeile darüber"
                  aria-label="Zeile darüber"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().addRowBefore().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.rowInsertTop" :size="15" group="actions" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  title="Zeile darunter"
                  aria-label="Zeile darunter"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().addRowAfter().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.rowInsertBottom" :size="15" group="actions" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  title="Zeile löschen"
                  aria-label="Zeile löschen"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().deleteRow().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.rowRemove" :size="15" group="actions" />
                </button>
              </div>
              <span class="toolbar-separator" role="separator" aria-orientation="vertical" />
              <div class="toolbar-group" role="group" aria-label="Spalten">
                <button
                  type="button"
                  class="toolbar-btn"
                  title="Spalte links"
                  aria-label="Spalte links"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().addColumnBefore().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.columnInsertLeft" :size="15" group="actions" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  title="Spalte rechts"
                  aria-label="Spalte rechts"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().addColumnAfter().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.columnInsertRight" :size="15" group="actions" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn"
                  title="Spalte löschen"
                  aria-label="Spalte löschen"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().deleteColumn().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.columnRemove" :size="15" group="actions" />
                </button>
              </div>
              <span class="toolbar-separator" role="separator" aria-orientation="vertical" />
              <div class="toolbar-group" role="group" aria-label="Tabelle">
                <button
                  type="button"
                  class="toolbar-btn"
                  :class="{ active: isHeaderRowActive }"
                  :aria-pressed="isHeaderRowActive"
                  title="Kopfzeile umschalten"
                  aria-label="Kopfzeile umschalten"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().toggleHeaderRow().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.tableHeader" :size="15" group="actions" />
                </button>
                <button
                  type="button"
                  class="toolbar-btn toolbar-btn--danger"
                  title="Tabelle löschen"
                  aria-label="Tabelle löschen"
                  :disabled="!editor"
                  @mousedown.prevent
                  @click="editor?.chain().focus().deleteTable().run()"
                >
                  <AppIcon :icon="ACTION_ICONS.delete" :size="15" group="actions" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- eslint-disable-next-line vuejs-accessibility/click-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
    <div class="content-scroll" @click="focusEditor">
      <editor-content :editor="editor" />
      <p v-if="placeholder && editor?.isEmpty" class="editor-placeholder" aria-hidden="true">
        {{ placeholder }}
      </p>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/_richtextTaskList.scss' as *;
@use '../styles/_richtextTable.scss' as *;

/* display:flex + flex-shrink:0 + max-height (statt einfach nur overflow:hidden ohne Höhenangabe):
   innerhalb eines full-height-Modal-Formulars (Modal.vue, :slotted(form) { flex:1; overflow-y:auto })
   ist dieser Editor sonst selbst ein schrumpfbares Flex-Item - durch overflow:hidden bekommt es lt.
   Flexbox-Spec eine automatische Mindestgröße von 0 und kann bei Platzmangel (z. B. eine lange
   Touren-/Spot-Auswahlliste darunter) bis auf wenige Pixel zusammengedrückt werden, wobei die Toolbar
   (erstes Kind) mit-geclippt wird. flex-shrink:0 verhindert das Zusammendrücken, max-height deckelt
   stattdessen die Gesamthöhe - der eigentliche Scrollbereich für lange Texte ist .content-scroll
   unten, nicht dieser äußere Rahmen. */
.richtext-editor {
  @include control-field-inset($focus-within: true);
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: min(55vh, 480px);
  overflow: hidden;
}

/* Desktop hat spürbar mehr Platz als das mobile 55vh/480px-Limit hergibt (#88) - Editor darf dort
   deutlich größer werden, Schrift etwas größer mitwachsen statt bei mobiler Lesegröße zu bleiben.
   65vh/640px reichte für ein Reisetagebuch-Freitextfeld mit viel Inhalt immer noch nicht (#88 wurde
   deswegen wieder geöffnet) - nochmal deutlich höher, zusammen mit dem breiteren Modal (Modal.vue).
   :not(.compact), weil dieselbe Vergrößerung inzwischen zu konsequent auch auf nebensächliche
   Notiz-Felder (Spots, Touren, ...) durchschlug (#194) - compact-Instanzen bleiben beim mobilen Limit. */
@include media-up('desktop-sm') {
  .richtext-editor:not(.compact) {
    max-height: min(75vh, 860px);
  }
}

.toolbar-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  flex-shrink: 0;
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease,
    visibility 0s linear 0.22s;
}

.toolbar-wrapper.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease,
    visibility 0s linear 0s;
}

.toolbar-inner {
  min-height: 0;
  overflow: hidden;
}

.toolbar,
.table-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2xs);
  /* Fixer Flex-Sibling außerhalb von .content-scroll (siehe unten) statt Teil des scrollenden
     Bereichs - bleibt dadurch beim Scrollen langer Texte immer sichtbar, ganz ohne position:sticky. */
  flex-shrink: 0;
  border-bottom: 1px solid var(--color-border-divider);
}

.toolbar {
  padding: var(--space-xs);
  background: var(--color-hover);
  transform: translateY(-4px);
  transition: transform 0.18s ease;
}

.toolbar-wrapper.is-open .toolbar {
  transform: translateY(0);
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2xs);
  min-inline-size: 28px;
  min-block-size: 28px;
  padding: 0 var(--space-1-5);
  border: none;
  border-radius: var(--radius-2xs);
  background: transparent;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  cursor: pointer;
  line-height: var(--line-height-none);
}

.toolbar-btn--heading {
  font-weight: 600;
  padding: 0 var(--space-xs);
}

.toolbar-btn:hover {
  background: var(--color-primary-tint);
}

.toolbar-btn--danger:hover {
  background: var(--color-danger-tint, rgba(220, 38, 38, 0.12));
  color: var(--color-danger, #dc2626);
}

.toolbar-btn:focus-visible {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.toolbar-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.toolbar-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

@media (pointer: coarse) {
  .toolbar-btn {
    min-inline-size: 34px;
    min-block-size: 34px;
  }
}

.table-toolbar-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  visibility: hidden;
  transition:
    grid-template-rows 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.15s ease,
    visibility 0s linear 0.18s;
}

.table-toolbar-wrapper.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  visibility: visible;
  transition:
    grid-template-rows 0.18s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.16s ease,
    visibility 0s linear 0s;
}

.table-toolbar-inner {
  min-height: 0;
  overflow: hidden;
}

.table-toolbar {
  padding: var(--space-2xs) var(--space-xs);
  background: var(--color-surface-sunken);
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
}

.toolbar-separator {
  align-self: stretch;
  width: 1px;
  margin: var(--space-2xs) var(--space-2xs);
  background: var(--color-border-divider);
}

:global(.richtext-heading-menu .heading-preview--h1) {
  font-size: var(--font-size-lg);
  font-weight: 700;
  line-height: var(--line-height-tight);
}

:global(.richtext-heading-menu .heading-preview--h2) {
  font-size: var(--font-size-md);
  font-weight: 600;
  line-height: var(--line-height-tight);
}

:global(.richtext-heading-menu .heading-preview--h3) {
  font-size: var(--font-size-sm);
  font-weight: 600;
  line-height: var(--line-height-tight);
}

:global(.richtext-heading-menu .heading-preview--p) {
  font-size: var(--font-size-sm);
  font-weight: 400;
}

.editor-placeholder {
  position: absolute;
  left: var(--space-lg);
  top: var(--space-md);
  margin: 0;
  color: var(--color-text-muted);
  pointer-events: none;
  font-size: var(--font-size-md);
  line-height: var(--line-height-normal);
}

/* <editor-content> rendert einen eigenen, ungestylten Wrapper-Div um den tatsächlichen
   contenteditable-Div (.richtext-content, siehe editorProps.attributes oben) - flex/overflow müssen
   deshalb hier auf dem Wrapper sitzen, nicht auf .richtext-content selbst (das wäre kein direktes
   Flex-Kind von .richtext-editor und flex:1 hätte dort keine Wirkung). min-height:0 erlaubt dem
   Wrapper trotz max-height am Editor selbst kleiner als der Inhalt zu werden, statt ihn zu sprengen -
   genau das macht .content-scroll zum eigentlichen, unabhängig scrollbaren Bereich für lange Texte. */
.content-scroll {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}

.richtext-editor :deep(.richtext-content) {
  padding: var(--space-md) var(--space-lg);
  min-height: 6em;
  outline: none;
}

/* Das umgebende Modal (Modal.vue) wächst nur mit seinem Inhalt bis max-height, streckt sich nicht
   selbst auf die volle Höhe (siehe Kommentar dort, #88) - eine spürbar größere min-height hier statt
   nur ein höheres max-height (siehe oben) ist deshalb nötig, damit das Freitextfeld auf Desktop
   tatsächlich von Anfang an groß erscheint statt erst beim Volltippen zu wachsen. Muss nach der
   6em-Basisregel oben stehen, sonst gewinnt bei gleicher Spezifität die spätere Basisregel.
   :not(.compact) siehe Kommentar oben (#194) - compact-Instanzen bleiben bei der 6em-Basisregel. */
@include media-up('desktop-sm') {
  .richtext-editor:not(.compact) :deep(.richtext-content) {
    min-height: 24em;
  }
}

.richtext-editor :deep(.richtext-content > :first-child) {
  margin-top: 0;
}

.richtext-editor :deep(.richtext-content > :last-child) {
  margin-bottom: 0;
}

.richtext-editor :deep(.richtext-content ul),
.richtext-editor :deep(.richtext-content ol) {
  margin: var(--space-xs) 0;
  padding-left: 1.3em;
}

.richtext-editor :deep(.richtext-content) {
  @include richtext-task-list;
  @include richtext-headings;
  @include richtext-table;
}

.richtext-editor :deep(.richtext-content blockquote) {
  margin: var(--space-xs) 0;
  padding: var(--space-2xs) 0 var(--space-2xs) 10px;
  border-left: 3px solid var(--color-border-divider);
  color: var(--color-text-muted);
}

.richtext-editor :deep(.richtext-content hr) {
  margin: var(--space-sm) 0;
  border: none;
  @include divider-engraved('bottom');
}

.richtext-editor :deep(.richtext-content code) {
  background: var(--color-bg);
  border-radius: var(--radius-2xs);
  padding: 1px 5px;
  font-size: 0.9em;
}

.richtext-editor :deep(.richtext-content del) {
  color: var(--color-text-muted);
}

.collapsed-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  min-height: var(--input-height, 46px);
  width: 100%;
  border: 1.5px solid var(--input-border-color);
  border-radius: var(--control-radius-md);
  background: var(--color-input-bg);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  box-sizing: border-box;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}

.collapsed-trigger:hover {
  border-color: var(--color-border-strong);
  background: var(--color-hover);
  color: var(--color-text);
}

.collapsed-trigger:focus-visible {
  border-color: var(--color-border-strong);
  background: var(--color-hover);
  color: var(--color-text);
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
}

.collapsed-trigger.is-modified {
  @include control-modified-outline;

  &:focus-visible {
    border-color: var(--input-border-color) !important;
    outline: var(--focus-ring-width, 3px) solid var(--color-success);
    outline-offset: var(--focus-ring-offset, 2px);
    box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface));
  }
}

.collapsed-placeholder {
  color: var(--color-text-muted);
  user-select: none;
}

@media (prefers-reduced-motion: reduce) {
  .toolbar-wrapper,
  .table-toolbar-wrapper,
  .toolbar {
    transition: none !important;
    transform: none !important;
  }
}
</style>

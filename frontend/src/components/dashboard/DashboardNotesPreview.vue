<script setup lang="ts">
import { computed } from 'vue';
import type { Note } from '../../api/types';
import { stripHtml } from '../../utils/richText';

const props = defineProps<{
  notes: Note[];
}>();

const latestNote = computed(() => {
  if (!props.notes.length) return null;
  return props.notes[0];
});

const previewText = computed(() => {
  if (!latestNote.value) return 'Notiz schreiben… ✍️';
  const text = latestNote.value.title?.trim() || stripHtml(latestNote.value.content);
  return text ? text.slice(0, 35) : 'Notiz';
});

const secondPreviewText = computed(() => {
  if (props.notes.length > 1) {
    const second = props.notes[1];
    const text = second.title?.trim() || stripHtml(second.content);
    return text ? text.slice(0, 25) : '';
  }
  return '';
});
</script>

<template>
  <div class="notes-preview-stage" aria-hidden="true">
    <!-- Unterer Notizzettel (pastell-minze) -->
    <div class="sticky-note bottom-note" />

    <!-- Mittlerer Notizzettel (pastell-rosa/pfirsich) -->
    <div class="sticky-note middle-note" />

    <!-- Oberer Notizzettel (gelbes Post-It) -->
    <div class="sticky-note top-note">
      <!-- Washi-Tape am oberen Rand -->
      <div class="washi-tape" />

      <!-- Eselsohr / Papierecke unten rechts -->
      <div class="curl-corner" />

      <!-- Linierte Notizzeilen -->
      <div class="note-lines">
        <span class="note-line" />
        <span class="note-line" />
        <span class="note-line" />
      </div>

      <!-- Vorschautext -->
      <div class="note-body">
        <p class="note-text">{{ previewText }}</p>
        <p v-if="secondPreviewText" class="note-subtext">· {{ secondPreviewText }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notes-preview-stage {
  position: relative;
  width: 105px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.sticky-note {
  position: absolute;
  width: 82px;
  height: 70px;
  border-radius: 4px;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.12),
    0 1px 3px rgba(0, 0, 0, 0.08);
  transition:
    transform 0.25s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.2s ease;
}

.bottom-note {
  background: var(--color-travel-tint);
  border: 1px solid var(--color-travel-border);
  transform: rotate(-7deg) translate(-4px, 2px);
  z-index: 1;
}

.middle-note {
  background: var(--color-tour-tint);
  border: 1px solid var(--color-tour-border);
  transform: rotate(5deg) translate(3px, -1px);
  z-index: 2;
}

.top-note {
  background: var(--color-highlight);
  border: 1px solid var(--color-highlight-border);
  transform: rotate(-1.5deg);
  z-index: 3;
  padding: 12px 7px 6px 8px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

/* Washi-Tape Klebestreifen */
.washi-tape {
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%) rotate(1deg);
  width: 32px;
  height: 12px;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  border-left: 1px dashed rgba(0, 0, 0, 0.15);
  border-right: 1px dashed rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(1px);
  z-index: 4;
}

:root[data-theme='dark'] .washi-tape {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .washi-tape {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.3);
  }
}

/* Umgebogene Papierecke unten rechts */
.curl-corner {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  background:
    linear-gradient(135deg, transparent 50%, rgba(0, 0, 0, 0.09) 50%),
    linear-gradient(315deg, transparent 50%, #fde047 50%);
  border-top-left-radius: 3px;
  box-shadow: -1px -1px 3px rgba(0, 0, 0, 0.12);
}

:root[data-theme='dark'] .curl-corner {
  background:
    linear-gradient(135deg, transparent 50%, rgba(0, 0, 0, 0.4) 50%),
    linear-gradient(315deg, transparent 50%, #854d0e 50%);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .curl-corner {
    background:
      linear-gradient(135deg, transparent 50%, rgba(0, 0, 0, 0.4) 50%),
      linear-gradient(315deg, transparent 50%, #854d0e 50%);
  }
}

.note-lines {
  position: absolute;
  top: 18px;
  left: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.note-line {
  height: 1px;
  background: rgba(202, 138, 4, 0.22);
}

:root[data-theme='dark'] .note-line {
  background: rgba(250, 204, 21, 0.15);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .note-line {
    background: rgba(250, 204, 21, 0.15);
  }
}

.note-body {
  position: relative;
  z-index: 2;
  margin-top: 4px;
}

.note-text {
  font-size: 0.65rem;
  font-weight: 700;
  color: #713f12;
  line-height: 1.15;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 66px;
  font-family: inherit;
}

:root[data-theme='dark'] .note-text {
  color: #fef08a;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .note-text {
    color: #fef08a;
  }
}

.note-subtext {
  font-size: 0.52rem;
  color: #a16207;
  margin: 4px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60px;
}

:root[data-theme='dark'] .note-subtext {
  color: #ca8a04;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .note-subtext {
    color: #ca8a04;
  }
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .top-note,
.notes-preview-stage:hover .top-note {
  transform: translateY(-3px) rotate(1deg);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.16),
    0 2px 4px rgba(0, 0, 0, 0.1);
}
</style>

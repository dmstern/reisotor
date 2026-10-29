<script setup lang="ts">
import { computed } from 'vue';
import type { ChangelogGroup } from '../api/types';
import { formatInline } from '../utils/richText';

const props = defineProps<{
  groups?: ChangelogGroup[];
  notes?: string[];
}>();

const EMOJI_PREFIX_REGEX =
  /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*/u;

function parseNote(rawNote: string): { bullet: string; html: string } {
  const clean = rawNote.startsWith('- ') ? rawNote.slice(2).trim() : rawNote.trim();
  const match = clean.match(EMOJI_PREFIX_REGEX);
  if (match) {
    return {
      bullet: match[1],
      html: formatInline(clean.slice(match[0].length)),
    };
  }
  return {
    bullet: '✨',
    html: formatInline(clean),
  };
}

function isHighlightGroup(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes('highlight') || lower.includes('wichtigste');
}

const allGroups = computed(() => props.groups ?? []);

const highlightGroups = computed(() => {
  return allGroups.value.filter((g) => isHighlightGroup(g.title));
});

const otherGroups = computed(() => {
  if (highlightGroups.value.length === 0) {
    return [];
  }
  return allGroups.value.filter((g) => !isHighlightGroup(g.title));
});

const standardGroups = computed(() => {
  if (highlightGroups.value.length > 0) {
    return [];
  }
  return allGroups.value;
});

const totalOtherNotesCount = computed(() => {
  return otherGroups.value.reduce((sum, g) => sum + g.notes.length, 0);
});

const cleanNotes = computed(() => {
  const rawNotes = props.notes ?? [];
  return rawNotes.map((n) => (n.startsWith('- ') ? n.slice(2).trim() : n.trim())).filter(Boolean);
});
</script>

<template>
  <div class="changelog-content">
    <!-- 1. Wenn Highlights vorhanden sind: Highlights direkt anzeigen -->
    <template v-if="highlightGroups.length > 0">
      <section
        v-for="group in highlightGroups"
        :key="group.title"
        class="changelog-group changelog-group--highlights"
      >
        <h4 class="changelog-group-title">
          <span class="highlight-star" aria-hidden="true">🌟</span>
          <span>{{ group.title }}</span>
        </h4>
        <ul class="changelog-list">
          <li
            v-for="(item, idx) in group.notes.map(parseNote)"
            :key="idx"
            class="changelog-item changelog-item--highlight"
          >
            <span class="note-bullet" aria-hidden="true">{{ item.bullet }}</span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="note-text" v-html="item.html"></span>
          </li>
        </ul>
      </section>

      <!-- 2. Die restliche Liste aller weiteren Änderungen in einem großen Collapsible -->
      <details v-if="otherGroups.length > 0" class="changelog-all-details-collapsible">
        <summary class="changelog-all-details-summary">
          <span class="summary-title-wrap">
            <span class="changelog-collapsible-title">Alle weiteren Neuerungen &amp; Details</span>
          </span>
          <span class="changelog-collapsible-badge">
            {{ totalOtherNotesCount }} Änderungen in {{ otherGroups.length }} Bereichen
          </span>
        </summary>
        <div class="changelog-other-groups">
          <section v-for="group in otherGroups" :key="group.title" class="changelog-group">
            <h4 class="changelog-group-title">{{ group.title }}</h4>
            <ul class="changelog-list">
              <li
                v-for="(item, idx) in group.notes.map(parseNote)"
                :key="idx"
                class="changelog-item"
              >
                <span class="note-bullet" aria-hidden="true">{{ item.bullet }}</span>
                <!-- eslint-disable-next-line vue/no-v-html -->
                <span class="note-text" v-html="item.html"></span>
              </li>
            </ul>
          </section>
        </div>
      </details>
    </template>

    <!-- 3. Fallback für Gruppen ohne Highlights-Sektion -->
    <template v-else-if="standardGroups.length > 0">
      <section v-for="group in standardGroups" :key="group.title" class="changelog-group">
        <h4 class="changelog-group-title">{{ group.title }}</h4>
        <ul class="changelog-list">
          <li v-for="(item, idx) in group.notes.map(parseNote)" :key="idx" class="changelog-item">
            <span class="note-bullet" aria-hidden="true">{{ item.bullet }}</span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="note-text" v-html="item.html"></span>
          </li>
        </ul>
      </section>
    </template>

    <!-- 4. Fallback für flache Notizen-Liste -->
    <ul v-else-if="cleanNotes.length > 0" class="changelog-list">
      <li v-for="(item, idx) in cleanNotes.map(parseNote)" :key="idx" class="changelog-item">
        <span class="note-bullet" aria-hidden="true">{{ item.bullet }}</span>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="note-text" v-html="item.html"></span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.changelog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.changelog-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.changelog-group--highlights {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(236, 72, 153, 0.04));
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  gap: var(--space-2);
}

.changelog-group-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding-bottom: 2px;
  border-bottom: 1px solid var(--color-border);
}

.changelog-group--highlights .changelog-group-title {
  color: var(--color-primary);
  font-size: 1rem;
}

.highlight-star {
  font-size: 1.1rem;
}

.changelog-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.changelog-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: 0.95rem;
  line-height: 1.45;
  color: var(--color-text);
  background: var(--color-surface-glass);
  border: 1px solid var(--color-surface-glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
}

.changelog-item--highlight {
  background: var(--color-surface);
  border-color: rgba(124, 58, 237, 0.25);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.note-bullet {
  font-size: 1.1rem;
  flex-shrink: 0;
  line-height: 1.4;
}

.note-text {
  flex: 1;
}

.note-text :deep(strong) {
  font-weight: 600;
  color: var(--color-text);
}

/* Großes Collapsible für alle weiteren Änderungen */
.changelog-all-details-collapsible {
  margin-top: var(--space-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface-glass);
  overflow: hidden;
  transition: border-color var(--transition-fast, 150ms ease);
}

.changelog-all-details-collapsible[open] {
  border-color: var(--color-primary);
}

.changelog-all-details-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-3);
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  user-select: none;
  background: rgba(255, 255, 255, 0.03);
  transition: background 150ms ease;
}

.changelog-all-details-summary:hover {
  background: rgba(255, 255, 255, 0.06);
}

.summary-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.changelog-collapsible-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: rgba(124, 58, 237, 0.15);
  color: var(--color-primary);
  white-space: nowrap;
}

.changelog-other-groups {
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  border-top: 1px solid var(--color-border);
}
</style>

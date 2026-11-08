<script setup lang="ts">
import { computed } from 'vue';
import type { BaseRelease, ChangelogGroup } from '../api/types';
import { formatInline } from '../utils/richText';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import CollapsibleFieldset from './primitives/CollapsibleFieldset.vue';

const props = defineProps<{
  groups?: ChangelogGroup[];
  notes?: string[];
  baseRelease?: BaseRelease | null;
  repoUrl?: string;
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
    bullet: '•',
    html: formatInline(clean),
  };
}

function isHighlightGroup(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes('highlight') || lower.includes('wichtigste');
}

const allGroups = computed(() => props.groups ?? []);

const highlightGroups = computed(() => {
  return allGroups.value.filter((group) => isHighlightGroup(group.title));
});

const otherGroups = computed(() => {
  if (highlightGroups.value.length === 0) {
    return [];
  }

  return allGroups.value.filter((group) => !isHighlightGroup(group.title));
});

const standardGroups = computed(() => {
  if (highlightGroups.value.length > 0) {
    return [];
  }

  return allGroups.value;
});

const cleanNotes = computed(() => {
  const rawNotes = props.notes ?? [];
  return rawNotes
    .map((note) => (note.startsWith('- ') ? note.slice(2).trim() : note.trim()))
    .filter(Boolean);
});

// Basis-Release-Highlights (z. B. aus v2.0.0, wenn wir auf Patch v2.0.1 sind)
const baseSeriesName = computed(() => {
  if (!props.baseRelease?.version) {
    return '';
  }

  const match = props.baseRelease.version.match(/^(\d+\.\d+)/);
  return match ? match[1] : props.baseRelease.version;
});

const baseAllGroups = computed(() => props.baseRelease?.groups ?? []);

const baseHighlightGroups = computed(() => {
  return baseAllGroups.value.filter((group) => isHighlightGroup(group.title));
});

const baseOtherGroups = computed(() => {
  if (baseHighlightGroups.value.length === 0) {
    return baseAllGroups.value;
  }

  return baseAllGroups.value.filter((group) => !isHighlightGroup(group.title));
});

const baseCleanNotes = computed(() => {
  if (baseAllGroups.value.length > 0) {
    return [];
  }

  const rawNotes = props.baseRelease?.notes ?? [];
  return rawNotes
    .map((note) => (note.startsWith('- ') ? note.slice(2).trim() : note.trim()))
    .filter(Boolean);
});

const changelogGithubUrl = computed(() => {
  const base = props.repoUrl?.trim() || 'https://github.com/dmstern/reisotor';
  return `${base.replace(/\/+$/, '')}/blob/main/CHANGELOG.md`;
});
</script>

<template>
  <div class="changelog-content">
    <!-- 1. Wenn Highlights vorhanden sind: Highlights prominent anzeigen -->
    <template v-if="highlightGroups.length > 0">
      <section
        v-for="group in highlightGroups"
        :key="group.title"
        class="changelog-group changelog-group--highlights"
      >
        <h4 class="changelog-group-title">
          <AppIcon :icon="ACTION_ICONS.sparkles" :size="16" group="actions" />
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

      <!-- 2. Die restliche Liste aller weiteren Änderungen im Design-System-Collapsible -->
      <CollapsibleFieldset
        v-if="otherGroups.length > 0"
        label="Alle weiteren Neuerungen &amp; Details"
        :open-initial="false"
        class="changelog-collapsible"
      >
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
      </CollapsibleFieldset>
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

    <!-- 5. Basis-Release (Highlights & Details der Minor-/Major-Reihe bei Patch-Releases) -->
    <template v-if="props.baseRelease">
      <section
        v-for="group in baseHighlightGroups"
        :key="'base-' + group.title"
        class="changelog-group changelog-group--highlights changelog-group--base-highlights"
      >
        <h4 class="changelog-group-title">
          <AppIcon :icon="ACTION_ICONS.sparkles" :size="16" group="actions" />
          <span
            >Highlights der {{ baseSeriesName }}-Serie (aus v{{ props.baseRelease.version }})</span
          >
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

      <CollapsibleFieldset
        v-if="baseOtherGroups.length > 0"
        :label="`Alle weiteren Neuerungen aus v${props.baseRelease.version} anzeigen`"
        :open-initial="false"
        class="changelog-collapsible"
      >
        <div class="changelog-other-groups">
          <section
            v-for="group in baseOtherGroups"
            :key="'base-' + group.title"
            class="changelog-group"
          >
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
      </CollapsibleFieldset>

      <CollapsibleFieldset
        v-else-if="baseCleanNotes.length > 0"
        :label="`Neuerungen aus v${props.baseRelease.version} anzeigen`"
        :open-initial="false"
        class="changelog-collapsible"
      >
        <ul class="changelog-list">
          <li
            v-for="(item, idx) in baseCleanNotes.map(parseNote)"
            :key="idx"
            class="changelog-item"
          >
            <span class="note-bullet" aria-hidden="true">{{ item.bullet }}</span>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <span class="note-text" v-html="item.html"></span>
          </li>
        </ul>
      </CollapsibleFieldset>
    </template>

    <!-- 6. Link zum vollständigen GitHub-Changelog -->
    <div class="changelog-footer">
      <a
        :href="changelogGithubUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="changelog-github-link"
      >
        <AppIcon :icon="ACTION_ICONS.externalLink" :size="15" group="actions" />
        <span>Vollständiges Changelog auf GitHub ansehen</span>
      </a>
    </div>
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
  background: var(--color-primary-tint);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
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
  gap: var(--space-2);
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.changelog-group--highlights .changelog-group-title {
  color: var(--color-primary);
  border-bottom-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
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
  align-items: baseline;
  gap: var(--space-2);
  font-size: 0.925rem;
  line-height: 1.5;
  color: var(--color-text);
  padding: 2px 0;
}

.note-bullet {
  font-size: 1.05rem;
  flex-shrink: 0;
  line-height: 1.4;
  user-select: none;
}

.note-text {
  flex: 1;
}

.note-text :deep(strong) {
  font-weight: 600;
  color: var(--color-text);
}

.changelog-collapsible {
  margin-top: var(--space-1);
}

.changelog-other-groups {
  padding-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.changelog-footer {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px dashed var(--color-border);
  display: flex;
  align-items: center;
}

.changelog-github-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-primary);
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: color var(--transition-fast, 0.15s ease);
}

.changelog-github-link:hover,
.changelog-github-link:focus-visible {
  text-decoration: underline;
  color: var(--color-primary-hover, var(--color-primary));
}
</style>

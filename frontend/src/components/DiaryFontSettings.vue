<script setup lang="ts">
import { computed } from 'vue';
import {
  useUiSettingsStore,
  DIARY_FONT_OPTIONS,
  DEFAULT_DIARY_FONT,
  type DiaryFont,
} from '../stores/uiSettings';
import Button from './primitives/Button.vue';
import Card from './primitives/Card.vue';
import Badge from './primitives/Badge.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

const uiSettings = useUiSettingsStore();

const isDefault = computed(() => {
  return uiSettings.diaryFont === DEFAULT_DIARY_FONT;
});

function selectFont(fontId: DiaryFont) {
  uiSettings.diaryFont = fontId;
}

function resetFont() {
  uiSettings.diaryFont = DEFAULT_DIARY_FONT;
}

const currentFont = computed(() => {
  return DIARY_FONT_OPTIONS.find((o) => o.id === uiSettings.diaryFont) ?? DIARY_FONT_OPTIONS[0];
});
</script>

<template>
  <Card>
    <div class="card-header-row">
      <h2>Tagebuch-Schriftart</h2>
      <Button
        variant="ghost"
        size="sm"
        :icon="ACTION_ICONS.restore"
        :disabled="isDefault"
        aria-label="Auf Standard zurücksetzen"
        :title="isDefault ? 'Bereits auf Standard-Schriftart' : 'Auf Standard zurücksetzen'"
        class="card-reset-btn"
        @click="resetFont"
      >
        <span class="card-reset-btn-label">Zurücksetzen</span>
      </Button>
    </div>
    <p class="hint">
      Wähle die Schriftart, in der Tagebucheinträge für deinen Account dargestellt werden.
    </p>

    <!-- Schriftarten-Auswahl -->
    <div class="font-options-grid" role="radiogroup" aria-label="Tagebuch-Schriftart auswählen">
      <button
        v-for="font in DIARY_FONT_OPTIONS"
        :key="font.id"
        type="button"
        role="radio"
        :aria-checked="uiSettings.diaryFont === font.id"
        class="font-option-card"
        :class="{ active: uiSettings.diaryFont === font.id }"
        @click="selectFont(font.id)"
      >
        <div class="font-option-header">
          <span class="font-name">{{ font.name }}</span>
          <Badge v-if="font.id === DEFAULT_DIARY_FONT" variant="default" size="sm">Standard</Badge>
        </div>
        <div class="font-sample" :style="{ fontFamily: font.fontFamily }">
          Liebes Reisetagebuch… ☀️
        </div>
      </button>
    </div>

    <!-- Live Vorschau -->
    <div class="preview-stage">
      <div class="diary-preview-card" :style="{ fontFamily: currentFont.fontFamily }">
        <div class="preview-entry-head">
          <span class="preview-avatar">🌅</span>
          <div class="preview-meta">
            <strong class="preview-title">Sonnenuntergang an der Klippe</strong>
            <span class="preview-date">Heute · Reisetag</span>
          </div>
        </div>
        <p class="preview-body">
          Nach einer langen Wanderung haben wir den perfekten Aussichtspunkt gefunden. Die Farben am
          Horizont waren einfach atemberaubend!
        </p>
      </div>
    </div>
  </Card>
</template>

<style scoped>
.font-options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.font-option-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: var(--space-3);
  background: var(--color-surface);
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: none;
}

.font-option-card:hover {
  background: var(--color-hover);
  border-color: var(--color-border);
}

.font-option-card.active {
  background: var(--color-primary-tint);
  border-color: var(--color-primary);
}

.font-option-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.font-option-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.font-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
}

.font-sample {
  font-size: 1.05rem;
  color: var(--color-primary-dark);
  line-height: 1.3;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}

.preview-stage {
  margin-top: var(--space-4);
  padding: var(--space-3);
  background: var(--color-bg);
  border-radius: var(--radius-md-squircle);
  border: var(--ui-border-width, 1px) solid var(--color-border);
}

.diary-preview-card {
  background: var(--color-surface);
  border: var(--ui-border-width, 1px) solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  padding: var(--space-3);
  transition: font-family 0.2s ease;
}

.preview-entry-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.preview-avatar {
  font-size: 1.5rem;
  line-height: 1;
}

.preview-meta {
  display: flex;
  flex-direction: column;
}

.preview-title {
  font-size: 1.1rem;
  color: var(--color-primary-dark);
  line-height: 1.25;
}

.preview-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  font-family: var(--font-sans);
}

.preview-body {
  margin: 0;
  font-size: 1rem;
  line-height: 1.45;
  color: var(--color-text);
}
</style>

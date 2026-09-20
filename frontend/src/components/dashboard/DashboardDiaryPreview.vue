<script setup lang="ts">
import { computed } from 'vue';
import type { DiaryEntry } from '../../api/types';

const props = defineProps<{
  entries: DiaryEntry[];
  latestEntry: DiaryEntry | null;
}>();

const previewText = computed(() => {
  if (!props.latestEntry) return 'Reisebericht schreiben… ✍️';
  return props.latestEntry.title || props.latestEntry.content?.slice(0, 30) || 'Reisetag';
});

const previewDate = computed(() => {
  if (!props.latestEntry?.date) return 'Tag 1';
  // Kurzes Format wie "14. Jul"
  const parts = props.latestEntry.date.split('-');
  if (parts.length === 3) {
    const months = [
      'Jan',
      'Feb',
      'Mär',
      'Apr',
      'Mai',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Okt',
      'Nov',
      'Dez',
    ];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parseInt(parts[2], 10)}. ${months[mIdx] || parts[1]}`;
  }
  return props.latestEntry.date;
});
</script>

<template>
  <div class="diary-preview-stage" aria-hidden="true">
    <!-- Reisetagebuch Buchkörper (Lederband / Hardcover) -->
    <div class="book-cover">
      <!-- Buchseiten (links und rechts aufgeschlagen) -->
      <div class="book-pages">
        <!-- Linke Seite -->
        <div class="book-page page-left">
          <!-- Reisestempel oben links -->
          <div class="travel-stamp">
            <span class="stamp-star">★</span>
            <span class="stamp-text">JOURNAL</span>
            <span class="stamp-date">{{ previewDate }}</span>
          </div>

          <!-- Skizzierte Notizzeilen -->
          <div class="page-lines">
            <span class="page-line short" />
            <span class="page-line" />
            <span class="page-line medium" />
          </div>
        </div>

        <!-- Buchfalz / Mittelknick mit 3D-Schatten -->
        <div class="book-spine-crease" />

        <!-- Lesezeichen-Band (Satin-Leseband) -->
        <div class="bookmark-ribbon" />

        <!-- Rechte Seite -->
        <div class="book-page page-right">
          <!-- Textzeilen mit echtem Tagebuchauszug -->
          <div class="page-entry-header">
            <span class="entry-title">{{ previewText }}</span>
          </div>

          <div class="page-lines">
            <span class="page-line" />
            <span class="page-line" />
            <span class="page-line medium" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diary-preview-stage {
  position: relative;
  width: 120px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.book-cover {
  position: relative;
  width: 108px;
  height: 70px;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%);
  border-radius: 6px;
  padding: 3px;
  box-sizing: border-box;
  box-shadow:
    0 5px 14px rgba(0, 0, 0, 0.22),
    0 2px 4px rgba(0, 0, 0, 0.12);
  transform: rotateX(12deg) rotateZ(-1deg);
  transition:
    transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.22s ease;
}

:root[data-theme='dark'] .book-cover {
  background: linear-gradient(135deg, #172554 0%, #0f172a 100%);
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.5),
    0 2px 5px rgba(0, 0, 0, 0.3);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .book-cover {
    background: linear-gradient(135deg, #172554 0%, #0f172a 100%);
    box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.5),
      0 2px 5px rgba(0, 0, 0, 0.3);
  }
}

.book-pages {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  background: #fefce8;
  border-radius: 4px;
  overflow: visible;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.12);
}

:root[data-theme='dark'] .book-pages {
  background: #23221d;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.35);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .book-pages {
    background: #23221d;
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.35);
  }
}

.book-page {
  flex: 1;
  padding: 5px 4px 4px 5px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.page-left {
  background: linear-gradient(90deg, #fefce8 85%, #fef08a 100%);
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

:root[data-theme='dark'] .page-left {
  background: linear-gradient(90deg, #23221d 85%, #1c1a17 100%);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .page-left {
    background: linear-gradient(90deg, #23221d 85%, #1c1a17 100%);
  }
}

.page-right {
  background: linear-gradient(90deg, #fef08a 0%, #fefce8 15%);
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

:root[data-theme='dark'] .page-right {
  background: linear-gradient(90deg, #1c1a17 0%, #23221d 15%);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .page-right {
    background: linear-gradient(90deg, #1c1a17 0%, #23221d 15%);
  }
}

/* Buchfalz / Mittlere Wölbung */
.book-spine-crease {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.18) 0%,
    rgba(0, 0, 0, 0.04) 40%,
    rgba(0, 0, 0, 0.22) 100%
  );
  pointer-events: none;
  z-index: 2;
}

/* Rotes Satin-Leseband */
.bookmark-ribbon {
  position: absolute;
  top: -2px;
  left: 51%;
  width: 4px;
  height: 72px;
  background: linear-gradient(180deg, #ef4444 0%, #b91c1c 100%);
  border-radius: 1px;
  box-shadow: 1px 1px 3px rgba(0, 0, 0, 0.25);
  transform: rotate(4deg);
  z-index: 3;
}

/* Reisestempel */
.travel-stamp {
  width: 32px;
  height: 32px;
  border: 1px dashed rgba(225, 29, 72, 0.6);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(-10deg);
  color: #e11d48;
  margin-bottom: 4px;
}

:root[data-theme='dark'] .travel-stamp {
  border-color: rgba(251, 113, 133, 0.6);
  color: #fb7185;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .travel-stamp {
    border-color: rgba(251, 113, 133, 0.6);
    color: #fb7185;
  }
}

.stamp-star {
  font-size: 0.38rem;
  line-height: 1;
}

.stamp-text {
  font-size: 0.34rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  line-height: 1;
}

.stamp-date {
  font-size: 0.32rem;
  font-weight: 700;
  line-height: 1;
}

.page-lines {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 3px;
}

.page-line {
  height: 1px;
  background: rgba(148, 163, 184, 0.35);
  border-radius: 1px;
  width: 100%;
}

.page-line.short {
  width: 60%;
}

.page-line.medium {
  width: 80%;
}

:root[data-theme='dark'] .page-line {
  background: rgba(148, 163, 184, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .page-line {
    background: rgba(148, 163, 184, 0.2);
  }
}

.page-entry-header {
  margin-bottom: 2px;
}

.entry-title {
  font-family: var(--font-diary);
  font-size: 0.52rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.15;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-width: 44px;
}

:root[data-theme='dark'] .entry-title {
  color: #f1f5f9;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .entry-title {
    color: #f1f5f9;
  }
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .book-cover,
.diary-preview-stage:hover .book-cover {
  transform: rotateX(6deg) rotateZ(0deg) translateY(-3px) scale(1.03);
  box-shadow:
    0 10px 22px rgba(0, 0, 0, 0.28),
    0 3px 6px rgba(0, 0, 0, 0.16);
}

:deep(.tile:hover) .bookmark-ribbon,
.diary-preview-stage:hover .bookmark-ribbon {
  transform: rotate(8deg) translateY(1px);
}
</style>

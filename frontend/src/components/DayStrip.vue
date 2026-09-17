<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import DayChip from './DayChip.vue';
import AppIcon from './AppIcon.vue';
import { ACTION_ICONS } from '../utils/actionIcons';
import { useScrollArrows } from '../composables/useScrollArrows';

const props = defineProps<{
  days: string[];
  activeDate?: string | null;
  hasContent?: (date: string) => boolean;
  dateTitle?: (date: string) => string;
}>();

const emit = defineEmits<{
  (e: 'select', date: string): void;
}>();

const scrollEl = ref<HTMLElement | null>(null);

const { canScrollLeft, canScrollRight, updateScrollArrows, scrollBy } = useScrollArrows(scrollEl, {
  scrollRatio: 0.7,
});

function scrollToDate(date: string, behavior: ScrollBehavior = 'smooth') {
  const el = scrollEl.value;
  if (!el) return;
  const chipEl = el.querySelector<HTMLElement>(`[data-date="${date}"]`);
  if (!chipEl) return;

  const chipLeft = chipEl.offsetLeft;
  const chipRight = chipLeft + chipEl.offsetWidth;
  const scrollLeft = el.scrollLeft;
  const clientWidth = el.clientWidth;

  // Puffer, damit der Chip nicht unter den Pfeil-Verläufen verdeckt bleibt
  const buffer = 40;
  let targetLeft: number | null = null;
  if (chipLeft < scrollLeft + buffer) {
    targetLeft = Math.max(0, chipLeft - buffer);
  } else if (chipRight > scrollLeft + clientWidth - buffer) {
    targetLeft = chipRight - clientWidth + buffer;
  }

  if (targetLeft !== null) {
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: targetLeft, behavior });
    } else {
      el.scrollLeft = targetLeft;
    }
  }
}

watch(
  () => props.days,
  () => {
    nextTick(updateScrollArrows);
  },
  { deep: true }
);

watch(
  () => props.activeDate,
  (newDate) => {
    if (newDate) {
      nextTick(() => scrollToDate(newDate));
    }
  }
);

onMounted(() => {
  if (props.activeDate) {
    nextTick(() => scrollToDate(props.activeDate!, 'instant'));
  }
});
</script>

<template>
  <div class="day-strip" role="region" aria-label="Tagesauswahl">
    <button
      v-if="canScrollLeft"
      type="button"
      class="day-strip-arrow left"
      aria-label="Tage nach links scrollen"
      @click="scrollBy(-1)"
    >
      <AppIcon :icon="ACTION_ICONS.scrollLeft" :size="16" group="actions" />
    </button>
    <div class="day-strip-scroll" ref="scrollEl" @scroll="updateScrollArrows">
      <DayChip
        v-for="day in days"
        :key="day"
        :date="day"
        :active="activeDate === day"
        :has-content="hasContent ? hasContent(day) : false"
        :title="dateTitle ? dateTitle(day) : undefined"
        @click="emit('select', day)"
      />
    </div>
    <button
      v-if="canScrollRight"
      type="button"
      class="day-strip-arrow right"
      aria-label="Tage nach rechts scrollen"
      @click="scrollBy(1)"
    >
      <AppIcon :icon="ACTION_ICONS.scrollRight" :size="16" group="actions" />
    </button>
  </div>
</template>

<style scoped>
.day-strip {
  position: relative;
  background: var(--color-surface);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  user-select: none;
}

.day-strip-scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 6px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.day-strip-scroll::-webkit-scrollbar {
  display: none;
}

.day-strip-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  width: 32px;
  border: none;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  cursor: pointer;
  color: var(--color-text-muted);
  background: none;
  transition: color 0.15s ease;
}

.day-strip-arrow:hover {
  color: var(--color-primary-dark);
}

.day-strip-arrow:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: -2px;
}

.day-strip-arrow.left {
  left: 0;
  justify-content: flex-start;
  padding-left: 6px;
  background: linear-gradient(to right, var(--color-surface) 50%, transparent);
}

.day-strip-arrow.right {
  right: 0;
  justify-content: flex-end;
  padding-right: 6px;
  background: linear-gradient(to left, var(--color-surface) 50%, transparent);
}

@media (min-width: 1024px) {
  .day-strip-scroll {
    padding: 8px 16px;
  }

  .day-strip-arrow {
    width: 38px;
  }

  .day-strip-arrow.left {
    padding-left: 10px;
  }

  .day-strip-arrow.right {
    padding-right: 10px;
  }
}
</style>

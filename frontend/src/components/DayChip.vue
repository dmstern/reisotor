<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  date: string;
  active?: boolean;
  hasContent?: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();

const weekdayFormatter = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

const dateObj = computed(() => {
  if (!props.date) return null;
  return new Date(props.date.includes('T') ? props.date : `${props.date}T12:00:00`);
});

const weekday = computed(() => {
  if (!dateObj.value) return '';
  return weekdayFormatter.format(dateObj.value);
});

const dayNum = computed(() => {
  if (!dateObj.value) return '';
  return dateObj.value.getDate();
});
</script>

<template>
  <button
    type="button"
    class="day-chip"
    :class="{ active, 'has-content': hasContent }"
    :title="title"
    @click="emit('click', $event)"
  >
    <span class="day-chip-weekday">{{ weekday }}</span>
    <span class="day-chip-num">{{ dayNum }}</span>
    <span v-if="hasContent" class="day-chip-dot" aria-hidden="true"></span>
  </button>
</template>

<style scoped>
.day-chip {
  position: relative;
  flex: 0 0 auto;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 38px;
  padding: 4px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background: var(--color-hover);
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.1;
  cursor: pointer;
  outline: none;
  box-shadow: none;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease,
    box-shadow 0.15s ease;
  user-select: none;
}

.day-chip:hover {
  background: var(--color-surface);
  border-color: var(--color-border-strong);
  transform: translateY(-1px);
}

.day-chip:active {
  transform: scale(0.96);
}

.day-chip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.day-chip-weekday {
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--color-text-muted);
}

.day-chip-num {
  font-size: 0.9rem;
}

.day-chip.has-content .day-chip-num {
  color: var(--color-scheduled);
}

.day-chip-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-scheduled);
}

.day-chip.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary-dark);
  box-shadow: var(--shadow-sm);
}

.day-chip.active .day-chip-weekday {
  color: rgba(255, 255, 255, 0.85);
}

.day-chip.active .day-chip-num {
  color: #fff;
}

.day-chip.active .day-chip-dot {
  background: #fff;
}
</style>

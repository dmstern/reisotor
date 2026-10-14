<script setup lang="ts">
import { computed } from 'vue';
import Badge from './primitives/Badge.vue';

const props = withDefaults(
  defineProps<{
    title: string;
    total: number;
    completed: number;
    completedLabel?: string;
  }>(),
  {
    completedLabel: 'erledigt',
  }
);

const percentage = computed(() =>
  props.total > 0 ? Math.round((props.completed / props.total) * 100) : 0
);

const isAllDone = computed(() => props.completed === props.total && props.total > 0);
</script>

<template>
  <div class="page-header-row">
    <div class="page-header-top">
      <div class="page-title-group">
        <div class="title-with-pill">
          <h1>{{ title }}</h1>
          <div class="progress-pill-group">
            <Badge :variant="isAllDone ? 'success' : 'primary'" size="sm">
              {{ completed }}/{{ total }} {{ completedLabel }}
            </Badge>
            <span v-if="total > 0" class="progress-percentage"> {{ percentage }}% </span>
          </div>
        </div>
        <div v-if="total > 0" class="header-progress-track" aria-hidden="true">
          <div class="header-progress-bar" :style="{ width: `${percentage}%` }"></div>
        </div>
      </div>
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.page-header-row {
  margin-bottom: var(--space-4);
}

.page-header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.page-title-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.title-with-pill {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.title-with-pill h1 {
  margin: 0;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text);
}

.progress-pill-group {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.progress-percentage {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
}

.header-progress-track {
  width: 100%;
  max-width: 320px;
  height: 4px;
  background: var(--color-hover);
  border-radius: var(--radius-pill);
  overflow: hidden;
  margin-top: var(--space-1);
}

.header-progress-bar {
  height: 100%;
  background: var(--color-primary);
  border-radius: var(--radius-pill);
  transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>

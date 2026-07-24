<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  label: string;
  spent: number;
  target: number;
  color: string;
}>();

const hasTarget = computed(() => props.target > 0);
const ratio = computed(() => (hasTarget.value ? props.spent / props.target : 0));
const fillPercent = computed(() => Math.min(100, ratio.value * 100));
const isOver = computed(() => hasTarget.value && props.spent > props.target);
const overBy = computed(() => props.spent - props.target);
</script>

<template>
  <div class="meter-row">
    <div class="meter-head">
      <span class="dot" :style="{ background: color }"></span>
      <span class="label">{{ label }}</span>
      <span class="values">
        <strong>{{ spent.toFixed(2) }} €</strong>
        <span v-if="hasTarget" class="of"> / {{ target.toFixed(2) }} €</span>
        <span v-else class="of muted"> (kein Ziel gesetzt)</span>
      </span>
    </div>
    <div class="track" :style="{ background: `${color}26` }">
      <div
        class="fill"
        :style="{ width: hasTarget ? fillPercent + '%' : '100%', background: color }"
      ></div>
    </div>
    <p v-if="isOver" class="over-badge">⚠️ {{ overBy.toFixed(2) }} € über Budget</p>
  </div>
</template>

<style scoped>
.meter-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-2) 0;
}

.meter-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 0.9rem;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.label {
  font-weight: 600;
  flex: 1;
}

.values {
  color: var(--color-text);
  font-size: 0.85rem;
  white-space: nowrap;
}

.of {
  color: var(--color-text-muted);
}

.of.muted {
  font-style: italic;
}

.track {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.over-badge {
  margin: 0;
  font-size: 0.78rem;
  color: var(--color-danger);
}
</style>

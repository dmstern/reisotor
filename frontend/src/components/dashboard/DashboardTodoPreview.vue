<script setup lang="ts">
import { computed } from 'vue';
import type { TodoItem } from '../../api/types';

const props = defineProps<{
  todos: TodoItem[];
  done: number;
  total: number;
}>();

const previewTodos = computed(() => {
  return props.todos.slice(0, 3);
});
</script>

<template>
  <div class="todo-preview-stage" aria-hidden="true">
    <!-- Klemmbrett (Wooden Clipboard) -->
    <div class="clipboard-board">
      <!-- Metallene Klemme oben (Spring Clip) -->
      <div class="metal-clip">
        <div class="clip-bracket" />
        <div class="clip-spring" />
      </div>

      <!-- Aufgehefteter Notizblock-Zettel -->
      <div class="clipboard-paper">
        <div v-if="previewTodos.length" class="todo-list-preview">
          <div
            v-for="item in previewTodos"
            :key="item.id"
            class="todo-row"
            :class="{ 'is-done': item.done }"
          >
            <span class="todo-box">{{ item.done ? '✓' : '□' }}</span>
            <span class="todo-text">{{ item.title }}</span>
          </div>
        </div>

        <div v-else class="todo-empty">
          <span class="todo-empty-box">□</span>
          <span class="todo-empty-text">Aufgabe planen…</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.todo-preview-stage {
  position: relative;
  width: 90px;
  height: 80px;
  margin: 4px auto 2px;
  perspective: 600px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.clipboard-board {
  position: relative;
  width: 68px;
  height: 74px;
  background: linear-gradient(135deg, #a16207 0%, #78350f 100%);
  border-radius: 6px;
  padding: 10px 4px 4px 4px;
  box-sizing: border-box;
  box-shadow:
    0 5px 12px rgba(0, 0, 0, 0.2),
    0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  transform: rotate(2deg);
  transition:
    transform 0.26s cubic-bezier(0.34, 1.4, 0.64, 1),
    box-shadow 0.22s ease;
}

:root[data-theme='dark'] .clipboard-board {
  background: linear-gradient(135deg, #78350f 0%, #451a03 100%);
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.45),
    0 2px 4px rgba(0, 0, 0, 0.25);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .clipboard-board {
    background: linear-gradient(135deg, #78350f 0%, #451a03 100%);
    box-shadow:
      0 6px 16px rgba(0, 0, 0, 0.45),
      0 2px 4px rgba(0, 0, 0, 0.25);
  }
}

/* Metallklemme oben */
.metal-clip {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 5;
}

.clip-bracket {
  width: 28px;
  height: 8px;
  background: linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%);
  border-radius: 3px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  border: 1px solid #64748b;
}

.clip-spring {
  width: 10px;
  height: 3px;
  background: #475569;
  border-radius: 1px;
  margin-top: -2px;
}

/* Papier auf dem Klemmbrett */
.clipboard-paper {
  position: relative;
  width: 100%;
  height: 100%;
  background: #ffffff;
  border-radius: 3px;
  padding: 6px 4px 4px 4px;
  box-sizing: border-box;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
}

:root[data-theme='dark'] .clipboard-paper {
  background: #1e293b;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .clipboard-paper {
    background: #1e293b;
  }
}

.todo-list-preview {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.todo-row {
  display: flex;
  align-items: center;
  gap: 3px;
  line-height: 1;
}

.todo-box {
  font-size: 0.46rem;
  color: #94a3b8;
  font-weight: 700;
  width: 7px;
  flex-shrink: 0;
}

.todo-row.is-done .todo-box {
  color: #10b981;
}

.todo-text {
  font-size: 0.48rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 48px;
}

:root[data-theme='dark'] .todo-text {
  color: #e2e8f0;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .todo-text {
    color: #e2e8f0;
  }
}

.todo-row.is-done .todo-text {
  text-decoration: line-through;
  opacity: 0.55;
}

.todo-empty {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
}

.todo-empty-box {
  font-size: 0.46rem;
  color: var(--color-text-muted);
}

.todo-empty-text {
  font-size: 0.46rem;
  color: var(--color-text-muted);
  font-style: italic;
}

/* Hover-Interaktion über Elternelement */
:deep(.tile:hover) .clipboard-board,
.todo-preview-stage:hover .clipboard-board {
  transform: rotate(0deg) translateY(-3px) scale(1.03);
  box-shadow:
    0 8px 18px rgba(0, 0, 0, 0.25),
    0 2px 4px rgba(0, 0, 0, 0.12);
}
</style>

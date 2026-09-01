<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** Der aktuell anzuzeigende Text */
    text: string;
    /** Alle möglichen Text-Optionen zur automatischen Bemessung der Containerbreite */
    options?: string[];
    /** Alternativer Text zur manuellen Bemessung des Containers */
    sizerText?: string;
    /** Animationsrichtung beim Textwechsel: 'up' (nach oben), 'down' (nach unten) oder 'auto' (basierend auf Index in options) */
    direction?: 'up' | 'down' | 'auto';
    /** HTML-Tag des Wurzel-Containers (Standard: 'span') */
    tag?: string;
  }>(),
  {
    options: () => [],
    direction: 'up',
    tag: 'span',
  }
);

const currentDirection = ref<'up' | 'down'>('up');

watch(
  () => props.text,
  (newText, oldText) => {
    if (props.direction === 'up' || props.direction === 'down') {
      currentDirection.value = props.direction;
      return;
    }
    if (props.options && props.options.length > 1 && typeof oldText === 'string') {
      const oldIndex = props.options.indexOf(oldText);
      const newIndex = props.options.indexOf(newText);
      if (newIndex >= 0 && oldIndex >= 0) {
        currentDirection.value = newIndex > oldIndex ? 'up' : 'down';
        return;
      }
    }
    currentDirection.value = 'up';
  },
  { immediate: true }
);

const transitionName = computed(() => `animated-text-swipe-${currentDirection.value}`);

const sizerOptions = computed(() => {
  if (props.options && props.options.length > 0) {
    return props.options;
  }
  if (props.sizerText) {
    return [props.sizerText];
  }
  return [props.text];
});
</script>

<template>
  <component :is="tag" class="animated-text">
    <span class="animated-text__sizer" aria-hidden="true">
      <span v-for="(opt, idx) in sizerOptions" :key="idx" class="animated-text__sizer-item">
        {{ opt }}
      </span>
    </span>
    <Transition :name="transitionName">
      <span :key="text" class="animated-text__content">
        {{ text }}
      </span>
    </Transition>
  </component>
</template>

<style scoped>
.animated-text {
  display: inline-grid;
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
  align-items: center;
  position: relative;
  overflow: hidden;
}

.animated-text__sizer {
  display: contents;
}

.animated-text__sizer-item {
  grid-area: 1 / 1;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
  user-select: none;
}

.animated-text__content {
  grid-area: 1 / 1;
  white-space: nowrap;
  display: inline-block;
  will-change: transform, opacity;
}

.animated-text-swipe-up-enter-active,
.animated-text-swipe-up-leave-active,
.animated-text-swipe-down-enter-active,
.animated-text-swipe-down-leave-active {
  transition:
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.18s ease;
}

.animated-text-swipe-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.animated-text-swipe-up-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

.animated-text-swipe-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.animated-text-swipe-down-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>

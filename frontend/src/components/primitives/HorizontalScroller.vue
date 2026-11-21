<script setup lang="ts">
import { ref } from 'vue';
import { useScrollArrows } from '../../composables/useScrollArrows';
import PagerButton from './PagerButton.vue';

const DEFAULT_SCROLL_RATIO = 0.7;

const props = withDefaults(
  defineProps<{
    prevLabel?: string;
    nextLabel?: string;
    scrollRatio?: number;
    role?: string;
    ariaLabel?: string;
  }>(),
  {
    prevLabel: 'Nach links scrollen',
    nextLabel: 'Nach rechts scrollen',
    scrollRatio: DEFAULT_SCROLL_RATIO,
    role: undefined,
    ariaLabel: undefined,
  }
);

const viewportEl = ref<HTMLElement | null>(null);

const { canScrollLeft, canScrollRight, updateScrollArrows, scrollBy } = useScrollArrows(
  viewportEl,
  {
    scrollRatio: () => props.scrollRatio,
  }
);

defineExpose({
  viewportEl,
  canScrollLeft,
  canScrollRight,
  scrollBy,
  updateScrollArrows,
});
</script>

<template>
  <div class="horizontal-scroller">
    <div
      ref="viewportEl"
      class="horizontal-scroller-viewport"
      :class="{ 'fade-left': canScrollLeft, 'fade-right': canScrollRight }"
      :role="role"
      :aria-label="ariaLabel"
      @scroll="updateScrollArrows"
    >
      <div class="horizontal-scroller-track">
        <slot />
      </div>
    </div>

    <PagerButton
      v-if="canScrollLeft"
      direction="prev"
      class="horizontal-scroller-arrow left"
      :aria-label="prevLabel"
      @click="scrollBy(-1)"
    />

    <PagerButton
      v-if="canScrollRight"
      direction="next"
      class="horizontal-scroller-arrow right"
      :aria-label="nextLabel"
      @click="scrollBy(1)"
    />
  </div>
</template>

<style lang="scss" scoped>
.horizontal-scroller {
  position: relative;
}

.horizontal-scroller-viewport {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-padding-inline: 44px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.horizontal-scroller-viewport::-webkit-scrollbar {
  display: none;
}

.horizontal-scroller-viewport.fade-left {
  mask-image: linear-gradient(to right, transparent 0, transparent 8px, black 52px, black 100%);
}

.horizontal-scroller-viewport.fade-right {
  mask-image: linear-gradient(to left, transparent 0, transparent 8px, black 52px, black 100%);
}

.horizontal-scroller-viewport.fade-left.fade-right {
  mask-image: linear-gradient(
    to right,
    transparent 0,
    transparent 8px,
    black 52px,
    black calc(100% - 52px),
    transparent calc(100% - 8px),
    transparent 100%
  );
}

.horizontal-scroller-track {
  display: flex;
  gap: var(--horizontal-scroller-gap, var(--space-2));
  padding: var(--horizontal-scroller-padding, 0);
  min-width: max-content;
}

.horizontal-scroller-arrow {
  position: absolute;
  top: 0;
  bottom: 0;
  margin-block: auto;
  z-index: 2;
}

.horizontal-scroller-arrow.left {
  left: 0;
}

.horizontal-scroller-arrow.right {
  right: 0;
}
</style>

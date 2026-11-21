<script setup lang="ts">
import { computed, ref } from 'vue';
import { useScrollArrows } from '../../composables/useScrollArrows';
import PagerButton from './PagerButton.vue';

const DEFAULT_SCROLL_RATIO = 0.7;

const props = withDefaults(
  defineProps<{
    fadeBg?: 'bg' | 'surface' | (string & {});
    prevLabel?: string;
    nextLabel?: string;
    scrollRatio?: number;
    role?: string;
    ariaLabel?: string;
  }>(),
  {
    fadeBg: undefined,
    prevLabel: 'Nach links scrollen',
    nextLabel: 'Nach rechts scrollen',
    scrollRatio: DEFAULT_SCROLL_RATIO,
    role: undefined,
    ariaLabel: undefined,
  }
);

const effectiveFadeBg = computed(() => {
  if (props.fadeBg === 'surface') {
    return 'var(--color-surface)';
  }

  if (props.fadeBg === 'bg') {
    return 'var(--color-bg)';
  }

  if (props.fadeBg) {
    return props.fadeBg;
  }

  return undefined;
});

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
  <div
    class="horizontal-scroller"
    :style="effectiveFadeBg ? { '--horizontal-scroller-fade-bg': effectiveFadeBg } : undefined"
  >
    <div
      ref="viewportEl"
      class="horizontal-scroller-viewport"
      :role="role"
      :aria-label="ariaLabel"
      @scroll="updateScrollArrows"
    >
      <div class="horizontal-scroller-track">
        <slot />
      </div>
    </div>

    <span v-if="canScrollLeft" class="horizontal-scroller-fade left" aria-hidden="true"></span>
    <PagerButton
      v-if="canScrollLeft"
      direction="prev"
      class="horizontal-scroller-arrow left"
      :aria-label="prevLabel"
      @click="scrollBy(-1)"
    />

    <span v-if="canScrollRight" class="horizontal-scroller-fade right" aria-hidden="true"></span>
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
  --horizontal-scroller-effective-fade-bg: var(
    --horizontal-scroller-fade-bg,
    var(--scroll-fade-bg, var(--color-bg))
  );
}

:where(
    .modal,
    dialog,
    [role='dialog'],
    .drawer,
    .drawer-panel,
    .sheet,
    .bottom-sheet,
    .card,
    [data-surface]
  )
  .horizontal-scroller,
.horizontal-scroller:where(.on-surface, [data-surface]) {
  --horizontal-scroller-effective-fade-bg: var(
    --horizontal-scroller-fade-bg,
    var(--scroll-fade-bg, var(--color-surface))
  );
}

.horizontal-scroller:where(.on-bg) {
  --horizontal-scroller-effective-fade-bg: var(
    --horizontal-scroller-fade-bg,
    var(--scroll-fade-bg, var(--color-bg))
  );
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

.horizontal-scroller-track {
  display: flex;
  gap: var(--horizontal-scroller-gap, var(--space-2));
  padding: var(--horizontal-scroller-padding, 0);
  min-width: max-content;
}

.horizontal-scroller-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 1;
  width: 48px;
  pointer-events: none;
}

.horizontal-scroller-fade.left {
  left: 0;
  background: linear-gradient(
    to right,
    var(--horizontal-scroller-effective-fade-bg) 65%,
    transparent
  );
}

.horizontal-scroller-fade.right {
  right: 0;
  background: linear-gradient(
    to left,
    var(--horizontal-scroller-effective-fade-bg) 65%,
    transparent
  );
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

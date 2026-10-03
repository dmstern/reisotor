<script setup lang="ts">
withDefaults(
  defineProps<{
    canScrollUp?: boolean;
    canScrollDown?: boolean;
  }>(),
  {
    canScrollUp: false,
    canScrollDown: false,
  }
);
</script>

<template>
  <div
    class="scroll-fade scroll-fade--top"
    :class="{ 'is-visible': canScrollUp }"
    aria-hidden="true"
  />
  <div
    class="scroll-fade scroll-fade--bottom"
    :class="{ 'is-visible': canScrollDown }"
    aria-hidden="true"
  />
</template>

<style scoped>
.scroll-fade {
  position: absolute;
  left: 0;
  right: 0;
  height: 28px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 10;
}

.scroll-fade--top {
  top: 0;
  background: linear-gradient(
    to bottom,
    var(--scroll-fade-bg, var(--color-surface)) 0%,
    transparent 100%
  );
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}

.scroll-fade--bottom {
  bottom: 0;
  background: linear-gradient(
    to top,
    var(--scroll-fade-bg, var(--color-surface)) 0%,
    transparent 100%
  );
  border-bottom-left-radius: inherit;
  border-bottom-right-radius: inherit;
}

.scroll-fade.is-visible {
  opacity: 1;
}
</style>

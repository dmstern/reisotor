<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLabel?: string;
    placement?: 'absolute' | 'inline';
  }>(),
  {
    ariaLabel: 'Neue Änderungen',
    placement: 'absolute',
  }
);
</script>

<template>
  <span
    class="unseen-dot"
    :class="`unseen-dot--${placement}`"
    role="status"
    :aria-label="ariaLabel"
  />
</template>

<style scoped>
@keyframes badgePulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(224, 142, 69, 0.6);
  }
  70% {
    transform: scale(1.08);
    box-shadow: 0 0 0 6px rgba(224, 142, 69, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(224, 142, 69, 0);
  }
}

.unseen-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 1.5px solid var(--color-surface);
  animation: badgePulse 2s infinite ease-in-out;
  flex-shrink: 0;
}

.unseen-dot--absolute {
  position: absolute;
  top: -2px;
  right: -4px;
}

.unseen-dot--inline {
  display: inline-block;
  margin-left: 2px;
  vertical-align: middle;
}
</style>

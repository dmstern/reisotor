<script setup lang="ts">
withDefaults(
  defineProps<{
    ariaLabel?: string;
    placement?: 'absolute' | 'inline';
    variant?: 'danger' | 'success';
    sparkle?: boolean;
  }>(),
  {
    ariaLabel: 'Neue Änderungen',
    placement: 'absolute',
    variant: 'danger',
    sparkle: false,
  }
);
</script>

<template>
  <span
    class="unseen-dot"
    :class="[`unseen-dot--${placement}`, `unseen-dot--${variant}`, { 'has-sparkles': sparkle }]"
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

@keyframes badgePulseSuccess {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(92, 179, 126, 0.6);
  }
  70% {
    transform: scale(1.08);
    box-shadow: 0 0 0 6px rgba(92, 179, 126, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(92, 179, 126, 0);
  }
}

@keyframes sparkleFloat1 {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(0deg);
    opacity: 0;
  }
  20% {
    opacity: 1;
    transform: translate(-10px, -15px) scale(1) rotate(45deg);
  }
  80% {
    opacity: 1;
    transform: translate(-15px, -25px) scale(0.8) rotate(90deg);
  }
  100% {
    opacity: 0;
    transform: translate(-20px, -35px) scale(0) rotate(135deg);
  }
}

@keyframes sparkleFloat2 {
  0% {
    transform: translate(-50%, -50%) scale(0) rotate(0deg);
    opacity: 0;
  }
  20% {
    opacity: 1;
    transform: translate(5px, -10px) scale(0.8) rotate(45deg);
  }
  80% {
    opacity: 1;
    transform: translate(15px, -20px) scale(0.6) rotate(90deg);
  }
  100% {
    opacity: 0;
    transform: translate(20px, -30px) scale(0) rotate(135deg);
  }
}

.unseen-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--color-surface);
  flex-shrink: 0;
  position: relative;
}

.unseen-dot--danger {
  background: var(--color-danger);
  animation: badgePulse 2s infinite ease-in-out;
}

.unseen-dot--success {
  background: var(--color-success);
  animation: badgePulseSuccess 2s infinite ease-in-out;
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

.unseen-dot.has-sparkles::before,
.unseen-dot.has-sparkles::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 10px;
  height: 10px;
  /* Kleiner 4-zackiger Stern als SVG in var(--color-success) */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%235cb37e'%3E%3Cpath d='M12 0l2.5 9.5L24 12l-9.5 2.5L12 24l-2.5-9.5L0 12l9.5-2.5z'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  pointer-events: none;
  opacity: 0;
}

.unseen-dot.has-sparkles::before {
  animation: sparkleFloat1 2.5s infinite ease-out;
}

.unseen-dot.has-sparkles::after {
  animation: sparkleFloat2 2.5s infinite ease-out;
  animation-delay: 1.25s;
}
</style>

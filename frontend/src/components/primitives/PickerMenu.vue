<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

defineOptions({
  inheritAttrs: false,
});

withDefaults(
  defineProps<{
    /** Ob ein bildschirmfüllender Backdrop hinter dem Menü gerendert werden soll */
    backdrop?: boolean;
    /** Breitere Variante (252px) für Menüs mit längeren Texten und Zeilenumbruch */
    wide?: boolean;
    /** Positionierungs-Modus: 'fixed' (Standard) oder 'absolute' */
    position?: 'fixed' | 'absolute';
    /** Ausrichtungs-Ursprung für die Auffalt-Animation: 'top' (Standard), 'top-left', 'top-right', 'bottom', 'bottom-left', 'bottom-right' */
    origin?: 'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right';
    /** Z-Index für das Menü-Fenster */
    zIndex?: number | string;
    /** Z-Index für den Backdrop */
    backdropZIndex?: number | string;
    /** ARIA-Rolle für das Menü-Element */
    role?: string;
  }>(),
  {
    backdrop: true,
    wide: false,
    position: 'fixed',
    origin: 'top',
    zIndex: undefined,
    backdropZIndex: undefined,
    role: 'menu',
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const menuRef = ref<HTMLElement | null>(null);

defineExpose({
  el: menuRef,
});

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onWindowKeydown);
});
</script>

<template>
  <div
    v-if="backdrop"
    class="picker-backdrop"
    role="button"
    tabindex="0"
    aria-label="Menü schließen"
    :style="backdropZIndex !== undefined ? { zIndex: backdropZIndex } : undefined"
    @click="emit('close')"
    @keydown.enter.prevent="emit('close')"
    @keydown.space.prevent="emit('close')"
  />
  <div
    ref="menuRef"
    v-bind="$attrs"
    class="picker-menu"
    :class="[
      {
        'picker-menu-wide': wide,
        'picker-menu--absolute': position === 'absolute',
      },
      origin ? `picker-menu--origin-${origin}` : undefined,
      $attrs.class,
    ]"
    :style="[$attrs.style as any, zIndex !== undefined ? { zIndex } : undefined]"
    :role="role"
    @click.stop
  >
    <slot />
  </div>
</template>

<style scoped>
@keyframes picker-backdrop-fade {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover, 1100);
  background: transparent;
  animation: picker-backdrop-fade 0.15s ease;
}

@keyframes popover-unfold {
  0% {
    opacity: 0;
    transform: scaleY(0.68) scaleX(0.94) translateY(-6px);
  }
  100% {
    opacity: 1;
    transform: scaleY(1) scaleX(1) translateY(0);
  }
}

@keyframes popover-unfold-up {
  0% {
    opacity: 0;
    transform: scaleY(0.68) scaleX(0.94) translateY(6px);
  }
  100% {
    opacity: 1;
    transform: scaleY(1) scaleX(1) translateY(0);
  }
}

.picker-menu {
  position: fixed;
  z-index: calc(var(--z-popover, 1100) + 1);
  min-width: 180px;
  max-block-size: calc(100vh - 16px);
  max-block-size: calc(100dvh - 16px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: var(--color-surface);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-dropdown-menu);
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  transform-origin: top center;
  animation: popover-unfold 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.picker-menu--origin-top-left {
  transform-origin: top left;
}

.picker-menu--origin-top-right {
  transform-origin: top right;
}

.picker-menu--origin-bottom {
  transform-origin: bottom center;
  animation-name: popover-unfold-up;
}

.picker-menu--origin-bottom-left {
  transform-origin: bottom left;
  animation-name: popover-unfold-up;
}

.picker-menu--origin-bottom-right {
  transform-origin: bottom right;
  animation-name: popover-unfold-up;
}

@media (prefers-reduced-motion: reduce) {
  .picker-backdrop {
    animation: none;
  }
  .picker-menu {
    animation: none;
  }
}

.picker-menu--absolute {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: calc(var(--z-popover, 1100) + 1);
}

.picker-menu-wide {
  width: 252px;
}

.picker-menu-wide :deep(button),
.picker-menu-wide :deep(.dropdown-item-label) {
  white-space: normal;
}

/* Einheitlicher Menüpunkt-Reset für native <button> und <a> innerhalb des Menüs (schließt Primitives wie Button.vue aus) */
.picker-menu :deep(button:not(.btn)),
.picker-menu :deep(a:not(.btn)) {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 8px;
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  color: var(--color-text);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 500;
  line-height: 1.3;
  text-decoration: none;
  white-space: nowrap;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  box-shadow: none;
  user-select: none;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.picker-menu :deep(button:not(.btn):hover:not(:disabled)),
.picker-menu :deep(a:not(.btn):hover) {
  background: var(--color-hover);
}

.picker-menu :deep(button:not(.btn):disabled) {
  opacity: 0.4;
  cursor: not-allowed;
}

.picker-menu :deep(button:not(.btn).active),
.picker-menu :deep(button:not(.btn).is-active),
.picker-menu :deep(a:not(.btn).active),
.picker-menu :deep(a:not(.btn).is-active) {
  background: var(--color-primary-tint);
  color: var(--color-primary-dark);
  font-weight: 600;
}

.picker-menu :deep(.picker-menu-hint) {
  margin: 0 0 2px;
  padding: 4px 8px;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: normal;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { computePopoverPosition } from '../../utils/popoverPosition';
import AppIcon from '../AppIcon.vue';
import PickerMenu from './PickerMenu.vue';

// InfoPopover-Primitive: Kapselt ein dezentes Info-Icon mit aufklappendem Erklär-Popover (Issue #239).
// Nutzt PickerMenu.vue mit computePopoverPosition für zuverlässige Ausrichtung und Viewport-Clamping.

const props = withDefaults(
  defineProps<{
    /** Tooltip/Titel für den Trigger-Button */
    title?: string;
    /** ARIA-Label für Screenreader */
    ariaLabel?: string;
    /** Größe des Info-Icons (Standard: 16) */
    iconSize?: number;
    /** Breite des Popover-Menüs (Standard: 280) */
    menuWidth?: number;
    /** Bevorzugte Platzierung ('auto' | 'bottom' | 'top') */
    placement?: 'bottom' | 'top' | 'auto';
    /** Horizontale Ausrichtung zum Trigger-Element ('left' | 'right') */
    align?: 'left' | 'right';
    /** Z-Index für das Menü-Fenster (Standard: 1101, über Modals) */
    zIndex?: number;
    /** Z-Index für den Backdrop (Standard: 1100) */
    backdropZIndex?: number;
  }>(),
  {
    title: 'Informationen anzeigen',
    ariaLabel: 'Informationen anzeigen',
    iconSize: 16,
    menuWidth: 280,
    placement: 'auto',
    align: 'left',
    zIndex: 1101,
    backdropZIndex: 1100,
  }
);

const emit = defineEmits<{
  (e: 'toggle', open: boolean): void;
}>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const menuStyle = ref({ top: '0px', left: '0px' });

function updatePosition() {
  if (!triggerRef.value) return;
  menuStyle.value = computePopoverPosition(triggerRef.value, {
    menuWidth: props.menuWidth,
    placement: props.placement,
    align: props.align,
  });
}

function toggle() {
  if (!open.value) {
    updatePosition();
    open.value = true;
    emit('toggle', true);
    nextTick(() => updatePosition());
  } else {
    close();
  }
}

function close() {
  if (open.value) {
    open.value = false;
    emit('toggle', false);
  }
}

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    close();
  }
}

onMounted(() => {
  document.addEventListener('keydown', onEscape);
});

onUnmounted(() => {
  document.removeEventListener('keydown', onEscape);
});

defineExpose({
  open,
  close,
  toggle,
});
</script>

<template>
  <span class="info-popover-wrap">
    <button
      ref="triggerRef"
      type="button"
      class="info-popover-btn"
      :title="title"
      :aria-label="ariaLabel || title"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click.stop="toggle"
    >
      <slot name="icon">
        <AppIcon :icon="ACTION_ICONS.info" :size="iconSize" group="actions" />
      </slot>
    </button>

    <Teleport to="body">
      <template v-if="open">
        <PickerMenu
          class="info-popover-menu"
          :style="menuStyle"
          :z-index="zIndex"
          :backdrop-z-index="backdropZIndex"
          @close="close"
        >
          <div class="info-popover-content">
            <slot :close="close" />
          </div>
        </PickerMenu>
      </template>
    </Teleport>
  </span>
</template>

<style scoped>
.info-popover-wrap {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.info-popover-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-muted);
  box-shadow: none;
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0.7;
  border-radius: var(--radius-full);
  transition:
    opacity 0.15s ease,
    color 0.15s ease;
}

.info-popover-btn:hover,
.info-popover-btn:focus-visible {
  opacity: 1;
  color: var(--color-primary);
}

.info-popover-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

:global(.info-popover-menu) {
  min-width: 240px;
  max-width: min(340px, 85vw);
  padding: var(--space-3, 12px);
}

:global(.info-popover-content) {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

:global(.info-popover-content p) {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

:global(.info-popover-content p strong) {
  color: var(--color-text);
}

:global(.info-popover-content .popover-tip) {
  font-size: 0.82rem;
  color: var(--color-text);
  background: var(--color-hover);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}
</style>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { computePopoverPosition } from '../../utils/popoverPosition';
import AppIcon from '../AppIcon.vue';
import Button from './Button.vue';
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
const triggerRef = ref<InstanceType<typeof Button> | null>(null);
const menuStyle = ref({ top: '0px', left: '0px' });

function updatePosition() {
  const triggerElement = triggerRef.value?.$el as HTMLElement | undefined;

  if (!triggerElement) {
    return;
  }

  menuStyle.value = computePopoverPosition(triggerElement, {
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
    <Button
      ref="triggerRef"
      variant="ghost"
      shape="circle"
      size="sm"
      :active="open"
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
    </Button>

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

<style lang="scss" scoped>
.info-popover-wrap {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.info-popover-btn.btn {
  --info-popover-btn-size: 30px;
  width: var(--info-popover-btn-size);
  height: var(--info-popover-btn-size);
  min-width: var(--info-popover-btn-size);
  min-height: var(--info-popover-btn-size);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

:global(.info-popover-menu.picker-menu) {
  min-width: 240px;
  max-width: min(340px, 85vw);
  padding: var(--space-3, 12px);
  border-color: var(--color-border);
}

:global(.info-popover-content) {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 8px);
}

:global(.info-popover-content p) {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: var(--color-text-muted);
}

:global(.info-popover-content p strong) {
  color: var(--color-text);
}

:global(.info-popover-content .popover-tip) {
  font-size: var(--font-size-xs);
  color: var(--color-text);
  background: var(--color-hover);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
}
</style>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type ComponentPublicInstance } from 'vue';
import type { IconDef } from '../../utils/icon';
import { ACTION_ICONS } from '../../utils/actionIcons';
import { computePopoverPosition } from '../../utils/popoverPosition';
import AppIcon from '../AppIcon.vue';
import Button from './Button.vue';

// DropdownMenu-Primitive: Kapselt Aktions-Menü / Flyout-Trigger-Container, .dropdown__field und .dropdown__button (Issue #391, #721).
// Dient als Flyout-Trigger für Aktions- und Options-Menüs (im Zusammenspiel mit PickerMenu.vue / DropdownMenuItem.vue) –
// zur klaren Abgrenzung von Select.vue (Formularfeld Einzelauswahl) und Combobox.vue (Autocomplete-Filterfeld).
// Entspricht BEM-System: .dropdown (Block), .dropdown__field und .dropdown__button (Elemente).
const props = withDefaults(
  defineProps<{
    label?: string;
    icon?: IconDef;
    disabled?: boolean;
    open?: boolean;
    size?: 'sm' | 'md' | 'lg';
    block?: boolean;
    ariaLabel?: string;
    ariaHaspopup?: 'menu' | 'listbox' | boolean;
    triggerClass?: string;
    teleport?: boolean;
    align?: 'left' | 'right';
  }>(),
  {
    label: '',
    icon: undefined,
    disabled: false,
    open: false,
    size: 'md',
    block: false,
    ariaLabel: undefined,
    ariaHaspopup: 'menu',
    triggerClass: undefined,
    teleport: true,
    align: 'left',
  }
);

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'keydown', event: KeyboardEvent): void;
}>();

const DEFAULT_MENU_HEIGHT_PX = 160;
const DROPDOWN_OFFSET_PX = 4;

const dropdownRef = ref<HTMLElement | null>(null);
const buttonRef = ref<InstanceType<typeof Button> | HTMLElement | null>(null);
const menuCoords = ref<{ top: string; left: string; minWidth: string }>({
  top: '0px',
  left: '0px',
  minWidth: '0px',
});

function updatePosition() {
  const el =
    (buttonRef.value as ComponentPublicInstance | null)?.$el ??
    (buttonRef.value as HTMLElement | null) ??
    dropdownRef.value?.querySelector('.dropdown__button') ??
    dropdownRef.value;

  if (!el || typeof el.getBoundingClientRect !== 'function') {
    return;
  }

  const rect = el.getBoundingClientRect();
  const coords = computePopoverPosition(el, {
    menuWidth: Math.max(180, Math.round(rect.width)),
    menuHeight: DEFAULT_MENU_HEIGHT_PX,
    placement: 'bottom',
    offset: DROPDOWN_OFFSET_PX,
    align: props.align,
  });

  menuCoords.value = {
    ...coords,
    minWidth: `${Math.round(rect.width)}px`,
  };
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.teleport) {
      updatePosition();
      nextTick(() => updatePosition());

      if (typeof window !== 'undefined') {
        window.addEventListener('resize', updatePosition, { passive: true });
        window.addEventListener('scroll', updatePosition, { passive: true, capture: true });
      }
    } else if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, { capture: true });
    }
  }
);

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, { capture: true });
});

const portalStyle = computed(() => {
  if (!props.teleport) {
    return {};
  }

  return {
    position: 'fixed' as const,
    top: menuCoords.value.top,
    left: menuCoords.value.left,
    minWidth: menuCoords.value.minWidth,
    zIndex: 'var(--z-popover, 1100)',
  };
});

defineExpose({
  focus: () => {
    const el =
      (buttonRef.value as ComponentPublicInstance | null)?.$el ??
      (buttonRef.value as HTMLElement | null);
    el?.focus?.();
  },
  el: buttonRef,
});
</script>

<template>
  <div
    ref="dropdownRef"
    class="dropdown"
    :class="[
      { 'dropdown--open': open, 'dropdown--block': block },
      size !== 'md' ? `dropdown--${size}` : undefined,
    ]"
  >
    <slot name="trigger" :open="open" :toggle="() => emit('toggle')">
      <Button
        ref="buttonRef"
        variant="ghost"
        :size="size"
        class="dropdown__button dropdown__field"
        :class="[{ 'dropdown__button--active': open, 'btn--block': block }, triggerClass]"
        :disabled="disabled"
        :aria-expanded="open"
        :aria-label="ariaLabel"
        :aria-haspopup="ariaHaspopup"
        @click="emit('toggle')"
        @keydown="emit('keydown', $event)"
      >
        <AppIcon v-if="icon" :icon="icon" group="actions" :size="16" />
        <span class="dropdown__label">
          <slot name="label">{{ label }}</slot>
        </span>
        <AppIcon
          :icon="ACTION_ICONS.chevronDown"
          :size="size === 'sm' ? 12 : 14"
          group="actions"
          class="dropdown__caret"
          :class="{ 'is-open': open }"
        />
      </Button>
    </slot>
    <Teleport to="body" :disabled="!teleport">
      <div
        v-if="open"
        class="dropdown__portal"
        :class="{ 'is-teleported': teleport }"
        :style="portalStyle"
      >
        <slot :open="open" :menu-style="portalStyle" />
      </div>
    </Teleport>
  </div>
</template>

<style scoped lang="scss">
.dropdown {
  position: relative;
  display: inline-block;
}

.dropdown--block {
  display: block;
  width: 100%;
}

.dropdown--open,
.dropdown:has([aria-expanded='true']) {
  z-index: var(--z-popover, 1100);
}

.dropdown__portal.is-teleported {
  position: fixed;
  z-index: var(--z-popover, 1100);
}

.dropdown__portal :deep(.picker-menu--absolute) {
  top: 0;
  left: 0;
}

.dropdown__button.dropdown__field {
  @include control-3d-progressive(
    '&.dropdown__button--active, &:active:not(:disabled), .dropdown--open &'
  );
  padding: 9px 12px;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--font-size-md);
  font-weight: 500;
  height: var(--input-height, 46px);
  min-height: var(--input-height, 46px);
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.dropdown--block .dropdown__button.dropdown__field {
  width: 100%;
  justify-content: space-between;
}

.dropdown--sm .dropdown__button.dropdown__field,
.dropdown__button.dropdown__field.btn--sm {
  padding: 6px 10px;
  height: var(--input-height-sm, 38px);
  min-height: var(--input-height-sm, 38px);
  font-size: var(--font-size-sm);
}

.dropdown--lg .dropdown__button.dropdown__field,
.dropdown__button.dropdown__field.btn--lg {
  padding: 12px 16px;
  height: var(--input-height-lg, 52px);
  min-height: var(--input-height-lg, 52px);
  font-size: var(--font-size-md);
}

.dropdown__button.dropdown__field :deep(.app-icon) {
  color: var(--color-primary);
  opacity: 0.8;
}

.dropdown__label {
  flex: 1;
  text-align: left;
}

.dropdown__caret {
  transition: transform 0.2s ease;
  margin-left: auto;
}

.dropdown__caret.is-open {
  transform: rotate(180deg);
}
</style>

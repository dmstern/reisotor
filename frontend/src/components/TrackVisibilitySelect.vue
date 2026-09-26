<script lang="ts">
import type { TrackVisibility } from '../api/types';
import type { IconDef } from '../utils/icon';
import { ACTION_ICONS } from '../utils/actionIcons';

export interface VisibilityOption {
  value: TrackVisibility;
  label: string;
  icon: IconDef;
}

export const TRACK_VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    value: 'private',
    label: 'Nur für mich sichtbar (privat)',
    icon: ACTION_ICONS.private,
  },
  {
    value: 'shared',
    label: 'Für alle Mitreisenden sichtbar',
    icon: ACTION_ICONS.shared,
  },
];
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import { computePopoverPosition } from '../utils/popoverPosition';

const props = withDefaults(
  defineProps<{
    modelValue: TrackVisibility;
    disabled?: boolean;
    id?: string;
    name?: string;
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    disabled: false,
    size: 'md',
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: TrackVisibility): void;
  (e: 'change', value: TrackVisibility): void;
}>();

const isOpen = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const menuStyle = ref<Record<string, string>>({});

const currentOption = computed(
  () =>
    TRACK_VISIBILITY_OPTIONS.find((opt) => opt.value === props.modelValue) ??
    TRACK_VISIBILITY_OPTIONS[0]
);

function updatePosition() {
  if (!triggerRef.value) return;
  const rect = triggerRef.value.getBoundingClientRect();
  const coords = computePopoverPosition(triggerRef.value, {
    menuWidth: rect.width,
    menuHeight: 88,
    placement: 'bottom',
    offset: 4,
  });
  menuStyle.value = {
    ...coords,
    width: `${rect.width}px`,
    minWidth: `${rect.width}px`,
  };
}

async function toggle() {
  if (props.disabled) return;
  if (isOpen.value) {
    isOpen.value = false;
    return;
  }
  updatePosition();
  isOpen.value = true;
  await nextTick();
  updatePosition();
}

function close() {
  isOpen.value = false;
}

function selectOption(val: TrackVisibility) {
  emit('update:modelValue', val);
  emit('change', val);
  close();
  triggerRef.value?.focus();
}

function onNativeSelectChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  const val = target.value as TrackVisibility;
  emit('update:modelValue', val);
  emit('change', val);
}

function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!isOpen.value) {
      toggle();
    } else {
      const nextIdx = props.modelValue === 'private' ? 1 : 0;
      selectOption(TRACK_VISIBILITY_OPTIONS[nextIdx].value);
    }
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault();
    close();
  }
}

watch(isOpen, (open) => {
  if (open) {
    window.addEventListener('resize', updatePosition, { passive: true });
    window.addEventListener('scroll', updatePosition, { passive: true, capture: true });
  } else {
    window.removeEventListener('resize', updatePosition);
    window.removeEventListener('scroll', updatePosition, { capture: true });
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updatePosition);
    window.removeEventListener('scroll', updatePosition, { capture: true });
  }
});

defineOptions({
  inheritAttrs: false,
});
</script>

<template>
  <div class="track-visibility-select-wrap" :class="[size !== 'md' ? `size-${size}` : undefined]">
    <button
      ref="triggerRef"
      type="button"
      class="track-visibility-trigger"
      :class="{ 'is-open': isOpen, 'is-disabled': disabled }"
      :disabled="disabled"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      aria-label="Sichtbarkeit auswählen"
      @click="toggle"
      @keydown="onKeyDown"
    >
      <div class="track-visibility-content">
        <AppIcon
          :icon="currentOption.icon"
          group="actions"
          :size="size === 'sm' ? 14 : 16"
          class="track-visibility-icon"
          aria-hidden="true"
        />
        <span class="track-visibility-label">{{ currentOption.label }}</span>
      </div>
      <AppIcon
        :icon="ACTION_ICONS.chevronDown"
        group="actions"
        :size="size === 'sm' ? 12 : 14"
        class="track-visibility-caret"
        :class="{ 'is-open': isOpen }"
        aria-hidden="true"
      />
    </button>

    <Teleport to="body">
      <PickerMenu
        v-if="isOpen"
        class="track-visibility-menu"
        :style="menuStyle"
        role="listbox"
        aria-label="Sichtbarkeit"
        @close="close"
      >
        <DropdownItem
          v-for="opt in TRACK_VISIBILITY_OPTIONS"
          :key="opt.value"
          :label="opt.label"
          :icon="opt.icon"
          icon-group="actions"
          :icon-size="16"
          :active="modelValue === opt.value"
          :trailing-icon="modelValue === opt.value ? ACTION_ICONS.done : undefined"
          trailing-icon-group="actions"
          :trailing-icon-size="14"
          role="option"
          :aria-selected="modelValue === opt.value"
          @click="selectOption(opt.value)"
        />
      </PickerMenu>
    </Teleport>

    <!-- Barrierefreiheits- und Test-Kompatibilität (synchrone Bindung) -->
    <!-- eslint-disable-next-line vuejs-accessibility/no-onchange -->
    <select
      :id="id"
      :name="name"
      :value="modelValue"
      :disabled="disabled"
      class="track-visibility-hidden-select"
      aria-label="Sichtbarkeit"
      tabindex="-1"
      @change="onNativeSelectChange"
    >
      <option v-for="opt in TRACK_VISIBILITY_OPTIONS" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.track-visibility-select-wrap {
  position: relative;
  width: 100%;
}

.track-visibility-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0 var(--space-3);
  height: var(--input-height, var(--input-default-height));
  min-height: var(--input-height, var(--input-default-height));
  border: var(--ui-border-width, 1px) solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  background-color: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-sm);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  box-sizing: border-box;
  user-select: none;
  text-align: left;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}

.size-sm .track-visibility-trigger {
  height: 32px;
  min-height: 32px;
  padding: 0 10px;
  font-size: 0.85rem;
}

.track-visibility-trigger:hover:not(:disabled) {
  background-color: var(--color-hover);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.track-visibility-trigger:focus-visible,
.track-visibility-trigger.is-open {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  border-color: var(--color-primary);
}

.track-visibility-trigger.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.track-visibility-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex: 1;
}

.track-visibility-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.track-visibility-label {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-visibility-caret {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.15s ease;
  margin-left: auto;
}

.track-visibility-trigger:hover:not(:disabled) .track-visibility-caret,
.track-visibility-trigger.is-open .track-visibility-caret {
  color: var(--color-primary);
}

.track-visibility-caret.is-open {
  transform: rotate(180deg);
}

.track-visibility-hidden-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.001;
  pointer-events: none;
  z-index: -1;
}
</style>

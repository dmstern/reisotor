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
import { computed, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import DropdownMenu from './primitives/DropdownMenu.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';

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

const currentOption = computed(
  () =>
    TRACK_VISIBILITY_OPTIONS.find((opt) => opt.value === props.modelValue) ??
    TRACK_VISIBILITY_OPTIONS[0]
);

function toggle() {
  if (props.disabled) {
    return;
  }

  isOpen.value = !isOpen.value;
}

function close() {
  isOpen.value = false;
}

function selectOption(val: TrackVisibility) {
  emit('update:modelValue', val);
  emit('change', val);
  close();
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
      isOpen.value = true;
    } else {
      const nextIdx = props.modelValue === 'private' ? 1 : 0;
      selectOption(TRACK_VISIBILITY_OPTIONS[nextIdx].value);
    }
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault();
    close();
  }
}

defineOptions({
  inheritAttrs: false,
});
</script>

<template>
  <div class="track-visibility-select-wrap" :class="[size !== 'md' ? `size-${size}` : undefined]">
    <DropdownMenu
      block
      :size="size"
      :open="isOpen"
      :disabled="disabled"
      aria-label="Sichtbarkeit auswählen"
      aria-haspopup="listbox"
      trigger-class="track-visibility-trigger"
      @toggle="toggle"
      @keydown="onKeyDown"
    >
      <template #label>
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
      </template>

      <PickerMenu
        v-if="isOpen"
        position="absolute"
        class="track-visibility-menu"
        role="listbox"
        aria-label="Sichtbarkeit"
        @close="close"
      >
        <DropdownMenuItem
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
    </DropdownMenu>

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

.track-visibility-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
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

.track-visibility-menu {
  width: 100%;
  min-width: 100%;
  box-sizing: border-box;
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

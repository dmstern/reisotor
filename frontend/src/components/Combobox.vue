<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import Input from './primitives/Input.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Combobox.vue: Custom Dropdown-/Freitext-Auswahlfeld mit einheitlichem Styling.
// Unterstützt sowohl v-model-Freitext als auch Dropdown-Ausstattung (Optionsliste + Caret-Icon).

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: string[];
    placeholder?: string;
    iconFor?: (option: string) => string;
    iconDefFor?: (option: string) => IconDef | undefined;
    colorFor?: (option: string) => string | undefined;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    required?: boolean;
    invalid?: boolean;
    id?: string;
    name?: string;
  }>(),
  { modelValue: '', size: 'md', disabled: false, required: false, invalid: false }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', value: string): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
}>();

const open = ref(false);
const flipUp = ref(false);
const maxMenuHeight = ref<number | undefined>(undefined);
const comboboxRef = ref<HTMLElement | null>(null);
const inputRef = ref<InstanceType<typeof Input> | null>(null);

function updatePlacement() {
  if (!comboboxRef.value) return;
  const rect = comboboxRef.value.getBoundingClientRect();
  const viewportHeight =
    typeof window !== 'undefined'
      ? window.innerHeight || document.documentElement.clientHeight
      : 768;
  const spaceBelow = viewportHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;

  // Wenn unten weniger als 200px Platz ist und oben mehr Raum als unten frei ist: nach oben flippen
  if (spaceBelow < 200 && spaceAbove > spaceBelow) {
    flipUp.value = true;
    maxMenuHeight.value = Math.min(200, Math.max(80, Math.floor(spaceAbove)));
  } else {
    flipUp.value = false;
    maxMenuHeight.value = Math.min(200, Math.max(80, Math.floor(spaceBelow)));
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    updatePlacement();
    nextTick(() => updatePlacement());
    window.addEventListener('resize', updatePlacement, { passive: true });
    window.addEventListener('scroll', updatePlacement, { passive: true, capture: true });
  } else {
    window.removeEventListener('resize', updatePlacement);
    window.removeEventListener('scroll', updatePlacement, { capture: true });
  }
});

const filteredOptions = computed(() => {
  const q = (props.modelValue ?? '').trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => o.toLowerCase().includes(q));
});

watch(filteredOptions, () => {
  if (open.value) {
    nextTick(() => updatePlacement());
  }
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updatePlacement);
    window.removeEventListener('scroll', updatePlacement, { capture: true });
  }
});

function selectOption(option: string) {
  emit('update:modelValue', option);
  emit('select', option);
  open.value = false;
}

function onBlur(event: FocusEvent) {
  window.setTimeout(() => {
    open.value = false;
  }, 150);
  emit('blur', event);
}

function onFocus(event: FocusEvent) {
  updatePlacement();
  open.value = true;
  emit('focus', event);
}

defineExpose({
  close: () => {
    open.value = false;
    return true;
  },
  focus: () => {
    inputRef.value?.$el?.focus();
  },
});

defineOptions({
  inheritAttrs: false,
});
</script>

<template>
  <div
    ref="comboboxRef"
    class="combobox"
    :class="[{ open, 'flip-up': flipUp }, size !== 'md' ? `combobox--${size}` : undefined]"
  >
    <Input
      ref="inputRef"
      v-bind="$attrs"
      :id="id"
      :name="name"
      type="text"
      :model-value="modelValue ?? ''"
      :placeholder="placeholder"
      :size="size"
      :disabled="disabled"
      :required="required"
      :invalid="invalid"
      class="combobox-input"
      @update:model-value="emit('update:modelValue', $event)"
      @focus="onFocus"
      @blur="onBlur"
    />
    <AppIcon
      :icon="ACTION_ICONS.chevronDown"
      :size="size === 'sm' ? 12 : 14"
      group="actions"
      class="combobox-caret"
      :class="{ open }"
    />
    <Transition name="dropdown-unfold">
      <ul
        v-if="open && filteredOptions.length"
        class="options"
        role="listbox"
        :style="maxMenuHeight ? { maxHeight: `${maxMenuHeight}px` } : undefined"
      >
        <li
          v-for="option in filteredOptions"
          :key="option"
          role="option"
          :aria-selected="option === modelValue"
          tabindex="-1"
          @mousedown.prevent="selectOption(option)"
        >
          <span
            v-if="iconDefFor?.(option) || iconFor?.(option) || colorFor?.(option)"
            class="option-icon"
            :style="colorFor?.(option) ? { color: colorFor(option) } : {}"
          >
            <AppIcon
              v-if="iconDefFor?.(option)"
              :icon="iconDefFor(option)!"
              :size="16"
              group="categories"
            />
            <span v-else-if="iconFor?.(option)">{{ iconFor(option) }}</span>
          </span>
          <span class="option-label">{{ option }}</span>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.combobox {
  position: relative;
  flex: 1;
  min-width: 140px;
  display: flex;
  align-items: center;
}

.combobox.open,
.combobox:focus-within {
  z-index: 20;
}

.combobox :deep(.combobox-input),
.combobox :deep(input) {
  width: 100%;
  padding-right: 36px;
}

.combobox--sm :deep(.combobox-input),
.combobox--sm :deep(input) {
  padding-right: 28px;
}

.combobox--lg :deep(.combobox-input),
.combobox--lg :deep(input) {
  padding-right: 42px;
}

.combobox-caret {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: var(--color-primary);
  transition: transform 0.2s ease;
}

.combobox-caret.open {
  transform: translateY(-50%) rotate(180deg);
}

.combobox--sm .combobox-caret {
  right: 8px;
}

.options {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: 1000;
  list-style: none;
  margin: 0;
  padding: 4px 0;
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  transform-origin: top center;
}

.combobox.flip-up .options {
  top: auto;
  bottom: calc(100% + 2px);
  transform-origin: bottom center;
}

@keyframes dropdown-unfold-up {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.combobox.flip-up .dropdown-unfold-enter-active {
  animation-name: dropdown-unfold-up;
}

.options li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s ease;
}

.option-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  flex-shrink: 0;
}

.option-label {
  flex: 1;
}

.options li:hover {
  background: var(--color-hover);
}
</style>

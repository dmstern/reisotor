<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
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
const listboxRef = ref<HTMLElement | null>(null);
const highlightedIndex = ref(-1);

const generatedId = useId();
const listboxId = computed(() =>
  props.id ? `${props.id}-listbox` : `combobox-listbox-${generatedId}`
);

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
    maxMenuHeight.value = Math.min(240, Math.max(80, Math.floor(spaceAbove)));
  } else {
    flipUp.value = false;
    maxMenuHeight.value = Math.min(240, Math.max(80, Math.floor(spaceBelow)));
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    updatePlacement();
    nextTick(() => updatePlacement());
    window.addEventListener('resize', updatePlacement, { passive: true });
    window.addEventListener('scroll', updatePlacement, { passive: true, capture: true });
  } else {
    highlightedIndex.value = -1;
    window.removeEventListener('resize', updatePlacement);
    window.removeEventListener('scroll', updatePlacement, { capture: true });
  }
});

const filteredOptions = computed(() => {
  const q = (props.modelValue ?? '').trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((o) => o.toLowerCase().includes(q));
});

function scrollHighlightedIntoView() {
  nextTick(() => {
    if (!listboxRef.value || highlightedIndex.value < 0) return;
    const items = listboxRef.value.querySelectorAll('li');
    const target = items[highlightedIndex.value];
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'nearest' });
    }
  });
}

function initHighlightedIndex() {
  if (filteredOptions.value.length === 1) {
    highlightedIndex.value = 0;
  } else {
    const idx = filteredOptions.value.indexOf(props.modelValue ?? '');
    highlightedIndex.value = idx >= 0 ? idx : -1;
  }
}

watch(filteredOptions, (newOpts) => {
  if (newOpts.length === 1) {
    highlightedIndex.value = 0;
  } else {
    highlightedIndex.value = -1;
  }
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
  highlightedIndex.value = -1;
}

function onModelValueInput(val: string) {
  emit('update:modelValue', val);
  if (!open.value) {
    open.value = true;
    updatePlacement();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (!open.value) {
      open.value = true;
      updatePlacement();
      highlightedIndex.value = filteredOptions.value.length > 0 ? 0 : -1;
    } else if (filteredOptions.value.length > 0) {
      if (highlightedIndex.value < 0) {
        highlightedIndex.value = 0;
      } else {
        highlightedIndex.value = (highlightedIndex.value + 1) % filteredOptions.value.length;
      }
      scrollHighlightedIntoView();
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (!open.value) {
      open.value = true;
      updatePlacement();
      highlightedIndex.value =
        filteredOptions.value.length > 0 ? filteredOptions.value.length - 1 : -1;
    } else if (filteredOptions.value.length > 0) {
      if (highlightedIndex.value <= 0) {
        highlightedIndex.value = filteredOptions.value.length - 1;
      } else {
        highlightedIndex.value = highlightedIndex.value - 1;
      }
      scrollHighlightedIntoView();
    }
  } else if (event.key === 'Enter') {
    if (open.value) {
      const q = (props.modelValue ?? '').trim().toLowerCase();

      // 1. Per Pfeiltaste navigierte/hervorgehobene Option
      if (highlightedIndex.value >= 0 && highlightedIndex.value < filteredOptions.value.length) {
        event.preventDefault();
        event.stopPropagation();
        selectOption(filteredOptions.value[highlightedIndex.value]);
        return;
      }

      // 2. Einziger Treffer bei Teilstring-Eingabe (z. B. "FLUG" -> "Flughafen")
      if (filteredOptions.value.length === 1) {
        event.preventDefault();
        event.stopPropagation();
        selectOption(filteredOptions.value[0]);
        return;
      }

      // 3. Exakter Treffer (case-insensitive) unter den Optionen
      const exactMatch = filteredOptions.value.find((o) => o.toLowerCase() === q);
      if (exactMatch) {
        event.preventDefault();
        event.stopPropagation();
        selectOption(exactMatch);
        return;
      }

      // 4. Keine eindeutige Auswahl: Dropdown schließen
      open.value = false;
      highlightedIndex.value = -1;
    }
  } else if (event.key === 'Escape') {
    if (open.value) {
      event.preventDefault();
      event.stopPropagation();
      open.value = false;
      highlightedIndex.value = -1;
    }
  } else if (event.key === 'Tab') {
    open.value = false;
    highlightedIndex.value = -1;
  }
}

function onBlur(event: FocusEvent) {
  window.setTimeout(() => {
    if (
      typeof document !== 'undefined' &&
      comboboxRef.value &&
      comboboxRef.value.contains(document.activeElement)
    ) {
      return;
    }
    open.value = false;
    highlightedIndex.value = -1;
  }, 150);
  emit('blur', event);
}

function onFocus(event: FocusEvent) {
  updatePlacement();
  open.value = true;
  initHighlightedIndex();
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

const selectedIconDef = computed(() => {
  const val = (props.modelValue ?? '').trim();
  if (!val) return undefined;
  return props.iconDefFor?.(val);
});

const selectedIcon = computed(() => {
  const val = (props.modelValue ?? '').trim();
  if (!val) return undefined;
  return props.iconFor?.(val);
});

const selectedColor = computed(() => {
  const val = (props.modelValue ?? '').trim();
  if (!val) return undefined;
  return props.colorFor?.(val);
});

const hasLeadingIcon = computed(() => Boolean(selectedIconDef.value || selectedIcon.value));

defineOptions({
  inheritAttrs: false,
});
</script>

<template>
  <div
    ref="comboboxRef"
    class="combobox"
    :class="[
      { open, 'flip-up': flipUp, 'has-leading-icon': hasLeadingIcon },
      size !== 'md' ? `combobox--${size}` : undefined,
    ]"
  >
    <span
      v-if="hasLeadingIcon"
      class="combobox-leading-icon"
      :style="selectedColor ? { color: selectedColor } : {}"
      aria-hidden="true"
    >
      <AppIcon
        v-if="selectedIconDef"
        :icon="selectedIconDef"
        :size="size === 'sm' ? 14 : size === 'lg' ? 18 : 16"
        group="categories"
      />
      <span v-else>{{ selectedIcon }}</span>
    </span>
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
      role="combobox"
      :aria-expanded="open"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      :aria-controls="open ? listboxId : undefined"
      :aria-activedescendant="
        open && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined
      "
      class="combobox-input"
      @update:model-value="onModelValueInput"
      @keydown="onKeydown"
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
      <div
        v-if="open && (filteredOptions.length || $slots.footer)"
        class="combobox-menu"
        :style="maxMenuHeight ? { maxHeight: `${maxMenuHeight}px` } : undefined"
      >
        <ul
          v-if="filteredOptions.length"
          :id="listboxId"
          ref="listboxRef"
          class="options"
          role="listbox"
        >
          <li
            v-for="(option, idx) in filteredOptions"
            :id="`${listboxId}-option-${idx}`"
            :key="option"
            role="option"
            :aria-selected="option === modelValue"
            :class="{
              'is-highlighted': highlightedIndex === idx,
              'is-selected': option === modelValue,
            }"
            tabindex="-1"
            @mouseenter="highlightedIndex = idx"
            @focus="highlightedIndex = idx"
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
        <div v-else-if="$slots.footer" class="combobox-empty">Keine Vorschläge</div>
        <div v-if="$slots.footer" class="combobox-footer">
          <slot name="footer" />
        </div>
      </div>
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
  z-index: var(--z-popover, 1100);
}

.combobox:hover :deep(.combobox-input:not(:disabled)),
.combobox.open :deep(.combobox-input),
.combobox:focus-within :deep(.combobox-input) {
  box-shadow: var(--shadow-sm);
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

.combobox-leading-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
  line-height: 1;
}

.combobox--sm .combobox-leading-icon {
  left: 8px;
}

.combobox--lg .combobox-leading-icon {
  left: 14px;
}

.combobox.has-leading-icon :deep(.combobox-input),
.combobox.has-leading-icon :deep(input) {
  padding-left: 36px;
}

.combobox--sm.has-leading-icon :deep(.combobox-input),
.combobox--sm.has-leading-icon :deep(input) {
  padding-left: 28px;
}

.combobox--lg.has-leading-icon :deep(.combobox-input),
.combobox--lg.has-leading-icon :deep(input) {
  padding-left: 42px;
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

.combobox-menu {
  position: absolute;
  top: calc(100% + 2px);
  left: 0;
  right: 0;
  z-index: var(--z-popover, 1100);
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-md);
  transform-origin: top center;
  max-height: 240px;
  overflow: hidden;
}

.combobox.flip-up .combobox-menu {
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

.combobox.flip-up .dropdown-unfold-leave-active {
  animation-name: dropdown-unfold-up;
  animation-direction: reverse;
}

.options {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1 1 auto;
}

.options li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 10px;
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
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

.options li:hover,
.options li.is-highlighted {
  background: var(--color-hover);
}

.options li.is-selected {
  font-weight: 600;
  color: var(--color-primary-dark);
}

.options li.is-highlighted.is-selected {
  background: var(--color-primary-tint);
}

.combobox-empty {
  padding: 8px 10px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
}

.combobox-footer {
  border-top: 1px solid var(--color-border);
  padding: 4px;
  background: var(--color-surface);
  flex-shrink: 0;
}
</style>

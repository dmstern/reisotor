<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';
import type { IconDef } from '../utils/icon';
import AppIcon from './AppIcon.vue';
import Input from './primitives/Input.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// Combobox.vue: Suchbares Autocomplete-/Freitext-Eingabefeld mit Filterliste (Issue #721).
// Unterstützt v-model-Freitext, Dropdown-Ausstattung (Optionsliste + Caret-Icon) und Tastaturnavigation.
// Abgrenzung: Für feste Einzelauswahl ohne Freitext -> Select.vue; für Aktions-/Flyout-Menüs -> DropdownMenu.vue.

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
    teleport?: boolean;
  }>(),
  {
    modelValue: '',
    size: 'md',
    disabled: false,
    required: false,
    invalid: false,
    teleport: true,
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'select', value: string): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
}>();

const DEFAULT_MAX_DROPDOWN_HEIGHT = 240;
const MIN_DROPDOWN_HEIGHT = 80;
const MIN_SPACE_BELOW_FOR_DROPDOWN = 200;
const DROPDOWN_OFFSET_PX = 2;
const VIEWPORT_PADDING_PX = 8;
const VIEWPORT_FALLBACK_WIDTH = 1024;
const VIEWPORT_FALLBACK_HEIGHT = 768;
const BLUR_CLOSE_DELAY_MS = 150;

const open = ref(false);
const flipUp = ref(false);
const maxMenuHeight = ref<number | undefined>(undefined);
const comboboxRef = ref<HTMLElement | null>(null);
const inputRef = ref<InstanceType<typeof Input> | null>(null);
const listboxRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const highlightedIndex = ref(-1);
const filterText = ref<string | null>(null);

const menuCoords = ref<{
  top?: string;
  bottom?: string;
  left?: string;
  width?: string;
}>({});

const generatedId = useId();
const listboxId = computed(() =>
  props.id ? `${props.id}-listbox` : `combobox-listbox-${generatedId}`
);

function updatePlacement() {
  if (!comboboxRef.value) {
    return;
  }

  const rect = comboboxRef.value.getBoundingClientRect();
  const viewportHeight =
    typeof window !== 'undefined'
      ? window.innerHeight || document.documentElement.clientHeight
      : VIEWPORT_FALLBACK_HEIGHT;
  const viewportWidth =
    typeof window !== 'undefined'
      ? window.innerWidth || document.documentElement.clientWidth
      : VIEWPORT_FALLBACK_WIDTH;

  if (rect.bottom < 0 || rect.top > viewportHeight) {
    open.value = false;
    return;
  }

  const spaceBelow = viewportHeight - rect.bottom - DROPDOWN_OFFSET_PX - VIEWPORT_PADDING_PX;
  const spaceAbove = rect.top - DROPDOWN_OFFSET_PX - VIEWPORT_PADDING_PX;

  // Wenn unten weniger als 200px Platz ist und oben mehr Raum als unten frei ist: nach oben flippen
  const shouldFlip = spaceBelow < MIN_SPACE_BELOW_FOR_DROPDOWN && spaceAbove > spaceBelow;
  flipUp.value = shouldFlip;

  const availableHeight = shouldFlip ? spaceAbove : spaceBelow;
  maxMenuHeight.value = Math.min(
    DEFAULT_MAX_DROPDOWN_HEIGHT,
    Math.max(MIN_DROPDOWN_HEIGHT, Math.floor(availableHeight))
  );

  const left = Math.max(
    VIEWPORT_PADDING_PX,
    Math.min(rect.left, viewportWidth - rect.width - VIEWPORT_PADDING_PX)
  );
  const width = Math.min(rect.width, viewportWidth - 2 * VIEWPORT_PADDING_PX);

  if (shouldFlip) {
    menuCoords.value = {
      bottom: `${Math.round(viewportHeight - rect.top + DROPDOWN_OFFSET_PX)}px`,
      top: undefined,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
    };
  } else {
    menuCoords.value = {
      top: `${Math.round(rect.bottom + DROPDOWN_OFFSET_PX)}px`,
      bottom: undefined,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
    };
  }
}

const menuStyle = computed(() => {
  if (!props.teleport) {
    return maxMenuHeight.value ? { maxHeight: `${maxMenuHeight.value}px` } : {};
  }

  return {
    position: 'fixed' as const,
    top: menuCoords.value.top,
    bottom: menuCoords.value.bottom,
    left: menuCoords.value.left,
    width: menuCoords.value.width,
    maxHeight: maxMenuHeight.value ? `${maxMenuHeight.value}px` : undefined,
    zIndex: 'var(--z-popover, 1100)',
  };
});

function onDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null;

  if (!target) {
    return;
  }

  if (comboboxRef.value?.contains(target) || menuRef.value?.contains(target)) {
    return;
  }

  open.value = false;
  highlightedIndex.value = -1;
}

watch(open, (isOpen) => {
  if (isOpen) {
    filterText.value = null;
    updatePlacement();
    nextTick(() => {
      updatePlacement();
      scrollHighlightedIntoView();
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updatePlacement, { passive: true });
      window.addEventListener('scroll', updatePlacement, { passive: true, capture: true });
      document.addEventListener('mousedown', onDocumentClick, true);
    }
  } else {
    filterText.value = null;
    highlightedIndex.value = -1;

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, { capture: true });
      document.removeEventListener('mousedown', onDocumentClick, true);
    }
  }
});

const isExactOptionMatch = computed(() => {
  const current = (props.modelValue ?? '').trim().toLowerCase();

  if (!current) {
    return false;
  }

  return props.options.some((option) => option.toLowerCase() === current);
});

const filteredOptions = computed(() => {
  // Wenn der Nutzer noch keinen eigenen Suchtext getippt hat und der aktuelle Wert einer Option entspricht:
  // alle Optionen anzeigen, damit bequem eine andere ausgewählt werden kann.
  if (filterText.value === null && isExactOptionMatch.value) {
    return props.options;
  }

  const query = (filterText.value ?? props.modelValue ?? '').trim().toLowerCase();

  if (!query) {
    return props.options;
  }

  return props.options.filter((option) => option.toLowerCase().includes(query));
});

function scrollHighlightedIntoView() {
  nextTick(() => {
    if (!listboxRef.value || highlightedIndex.value < 0) {
      return;
    }

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
    const query = (filterText.value ?? props.modelValue ?? '').trim().toLowerCase();
    const idx = filteredOptions.value.findIndex((option) => option.toLowerCase() === query);
    highlightedIndex.value = idx >= 0 ? idx : -1;
  }
}

watch(filteredOptions, (newOpts) => {
  if (newOpts.length === 1) {
    highlightedIndex.value = 0;
  } else {
    const query = (filterText.value ?? props.modelValue ?? '').trim().toLowerCase();
    const idx = newOpts.findIndex((option) => option.toLowerCase() === query);
    highlightedIndex.value = idx >= 0 ? idx : -1;
  }

  if (open.value) {
    nextTick(() => updatePlacement());
  }
});

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal !== filterText.value) {
      filterText.value = null;
    }
  }
);

function selectOption(option: string) {
  filterText.value = null;
  emit('update:modelValue', option);
  emit('select', option);
  open.value = false;
  highlightedIndex.value = -1;
}

function onModelValueInput(val: string) {
  filterText.value = val;
  emit('update:modelValue', val);

  if (!open.value) {
    open.value = true;
    updatePlacement();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return;
  }

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
      const query = (props.modelValue ?? '').trim().toLowerCase();

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
      const exactMatch = filteredOptions.value.find((option) => option.toLowerCase() === query);

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
      ((comboboxRef.value && comboboxRef.value.contains(document.activeElement)) ||
        (menuRef.value && menuRef.value.contains(document.activeElement)))
    ) {
      return;
    }

    open.value = false;
    highlightedIndex.value = -1;
  }, BLUR_CLOSE_DELAY_MS);
  emit('blur', event);
}

onBeforeUnmount(() => {
  if (typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('resize', updatePlacement);
  window.removeEventListener('scroll', updatePlacement, { capture: true });
  document.removeEventListener('mousedown', onDocumentClick, true);
});

function onFocus(event: FocusEvent) {
  updatePlacement();
  filterText.value = null;
  open.value = true;
  initHighlightedIndex();

  if (isExactOptionMatch.value) {
    (event.target as HTMLInputElement)?.select();
  }

  emit('focus', event);
}

function onClick(event: MouseEvent) {
  if (props.disabled) {
    return;
  }

  if (open.value) {
    return;
  }

  updatePlacement();
  filterText.value = null;
  open.value = true;
  initHighlightedIndex();

  if (isExactOptionMatch.value) {
    (event.target as HTMLInputElement)?.select();
  }
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

  if (!val) {
    return undefined;
  }

  return props.iconDefFor?.(val);
});

const selectedIcon = computed(() => {
  const val = (props.modelValue ?? '').trim();

  if (!val) {
    return undefined;
  }

  return props.iconFor?.(val);
});

const selectedColor = computed(() => {
  const val = (props.modelValue ?? '').trim();

  if (!val) {
    return undefined;
  }

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
      @click="onClick"
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
    <Teleport to="body" :disabled="!teleport">
      <Transition name="dropdown-unfold">
        <div
          v-if="open && (filteredOptions.length || $slots.footer)"
          ref="menuRef"
          class="combobox-menu"
          :class="{ 'flip-up': flipUp, 'is-teleported': teleport }"
          :style="menuStyle"
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
              class="combobox-option"
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
    </Teleport>
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

.combobox :deep(.combobox-input) {
  width: 100%;
  padding-right: 36px;
}

.combobox.open :deep(.combobox-input),
.combobox:focus-within :deep(.combobox-input) {
  outline: var(--focus-ring-width, 3px) solid var(--focus-ring-color, var(--color-primary));
  outline-offset: var(--focus-ring-offset, 2px);
  box-shadow: var(--focus-ring-halo, 0 0 0 2px var(--color-surface)), var(--shadow-control-inset);
}

.combobox.open :deep(.combobox-input.input--invalid),
.combobox:focus-within :deep(.combobox-input.input--invalid) {
  border-color: var(--color-border-strong);
  outline-color: var(--color-danger);
}

.combobox--sm :deep(.combobox-input) {
  padding-right: 28px;
}

.combobox--lg :deep(.combobox-input) {
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

.combobox.has-leading-icon :deep(.combobox-input) {
  padding-left: 36px;
}

.combobox--sm.has-leading-icon :deep(.combobox-input) {
  padding-left: 28px;
}

.combobox--lg.has-leading-icon :deep(.combobox-input) {
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
  border: 1.5px solid var(--color-border-strong);
  border-radius: var(--radius-sm-squircle);
  corner-shape: squircle;
  box-shadow: var(--shadow-dropdown-menu);
  transform-origin: top center;
  max-height: 240px;
  overflow: hidden;
  box-sizing: border-box;
}

.combobox-menu.flip-up {
  transform-origin: bottom center;
}

.combobox.flip-up .combobox-menu:not(.is-teleported) {
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

.combobox-menu.flip-up.dropdown-unfold-enter-active,
.combobox.flip-up .dropdown-unfold-enter-active {
  animation-name: dropdown-unfold-up;
}

.combobox-menu.flip-up.dropdown-unfold-leave-active,
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

.combobox-option,
.options li {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 10px 12px;
  box-sizing: border-box;
  font-size: var(--font-size-sm);
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

.combobox-option:hover,
.combobox-option.is-highlighted,
.options li:hover,
.options li.is-highlighted {
  background: var(--color-hover);
}

.combobox-option.is-selected,
.options li.is-selected {
  font-weight: 600;
  color: var(--color-primary-dark);
}

.combobox-option.is-highlighted.is-selected,
.options li.is-highlighted.is-selected {
  background: var(--color-primary-tint);
}

.combobox-empty {
  padding: 8px 10px;
  font-size: var(--font-size-sm);
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

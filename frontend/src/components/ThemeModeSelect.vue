<script setup lang="ts">
import { ref, computed, useId } from 'vue';
import { useThemeStore, THEME_MODE_OPTIONS, type ThemeMode } from '../stores/theme';
import AppIcon from './AppIcon.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownItem from './primitives/DropdownItem.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// icon: kompakter runder Button wie der bisherige Toggle (AppHeader.vue, LoginView.vue) - das
// eigentliche <select> liegt unsichtbar über dem Icon und fängt den Klick ab, damit sich der
// gewohnte Header-Platzbedarf nicht ändert. block: modernes, taktiles Dropdown im
// Reisotor-Design-System (SettingsView.vue) mit Vektor-Icons, animiertem Pfeil und PickerMenu.
withDefaults(defineProps<{ variant?: 'icon' | 'block' }>(), { variant: 'icon' });

const theme = useThemeStore();
const isOpen = ref(false);
const selectId = useId();

const currentOption = computed(
  () => THEME_MODE_OPTIONS.find((o) => o.value === theme.mode) ?? THEME_MODE_OPTIONS[2]
);

function selectMode(val: ThemeMode) {
  theme.mode = val;
  isOpen.value = false;
}
</script>

<template>
  <div class="theme-mode-select" :class="variant" title="Erscheinungsbild">
    <template v-if="variant === 'icon'">
      <AppIcon
        class="icon-face"
        :size="18"
        :icon="currentOption.tabler"
        :active="true"
        group="navigation"
        aria-hidden="true"
      />
      <select :id="selectId" v-model="theme.mode" aria-label="Erscheinungsbild">
        <option v-for="option in THEME_MODE_OPTIONS" :key="option.value" :value="option.value">
          {{ option.icon }} {{ option.label }}
        </option>
      </select>
    </template>
    <template v-else>
      <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
      <label :for="selectId" class="block-label">Erscheinungsbild</label>
      <div class="theme-dropdown-wrap">
        <button
          type="button"
          class="theme-dropdown-trigger"
          :class="{ 'is-open': isOpen }"
          :aria-expanded="isOpen"
          aria-haspopup="listbox"
          aria-label="Erscheinungsbild auswählen"
          @click="isOpen = !isOpen"
          @keydown.down.prevent="isOpen = true"
          @keydown.up.prevent="isOpen = true"
        >
          <div class="theme-trigger-content">
            <AppIcon
              :icon="currentOption.tabler"
              group="navigation"
              :active="true"
              :size="18"
              class="theme-trigger-icon"
              aria-hidden="true"
            />
            <span class="theme-trigger-label">{{ currentOption.label }}</span>
          </div>
          <AppIcon
            :icon="ACTION_ICONS.chevronDown"
            group="actions"
            :size="14"
            class="theme-trigger-caret"
            :class="{ 'is-open': isOpen }"
            aria-hidden="true"
          />
        </button>

        <PickerMenu
          v-if="isOpen"
          position="absolute"
          origin="top-left"
          class="theme-picker-menu"
          role="listbox"
          @close="isOpen = false"
        >
          <DropdownItem
            v-for="option in THEME_MODE_OPTIONS"
            :key="option.value"
            :label="option.label"
            :icon="option.tabler"
            icon-group="navigation"
            :icon-size="16"
            :active="theme.mode === option.value"
            :trailing-icon="theme.mode === option.value ? ACTION_ICONS.done : undefined"
            trailing-icon-group="actions"
            :trailing-icon-size="14"
            role="option"
            :aria-selected="theme.mode === option.value"
            @click="selectMode(option.value)"
          />
        </PickerMenu>

        <!-- Barrierefreiheits- und Test-Kompatibilität (synchrone Bindung) -->
        <select
          :id="selectId"
          v-model="theme.mode"
          class="theme-hidden-select"
          aria-label="Erscheinungsbild"
          tabindex="-1"
        >
          <option v-for="option in THEME_MODE_OPTIONS" :key="option.value" :value="option.value">
            {{ option.icon }} {{ option.label }}
          </option>
        </select>
      </div>
    </template>
  </div>
</template>

<style scoped>
.theme-mode-select {
  display: inline-flex;
  align-items: center;
}

.theme-mode-select.icon {
  position: relative;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  corner-shape: round;
  justify-content: center;
}

.theme-mode-select.icon .icon-face {
  font-size: 1.1rem;
  line-height: 1;
  pointer-events: none;
}

.theme-mode-select.icon select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  opacity: 0;
  border: none;
  padding: 0;
  cursor: pointer;
}

.theme-mode-select.block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
  max-width: 320px;
}

.theme-mode-select.block .block-label {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-text);
  letter-spacing: -0.01em;
}

.theme-dropdown-wrap {
  position: relative;
  width: 100%;
}

.theme-dropdown-trigger {
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
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
}

.theme-dropdown-trigger:hover {
  background-color: var(--color-hover);
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
}

.theme-dropdown-trigger:focus-visible,
.theme-dropdown-trigger.is-open {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
  border-color: var(--color-primary);
}

.theme-dropdown-trigger:active {
  transform: scale(0.99);
}

.theme-trigger-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.theme-trigger-icon {
  flex-shrink: 0;
  color: var(--color-primary);
}

.theme-trigger-label {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-trigger-caret {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    color 0.15s ease;
  margin-left: auto;
}

.theme-dropdown-trigger:hover .theme-trigger-caret,
.theme-dropdown-trigger.is-open .theme-trigger-caret {
  color: var(--color-primary);
}

.theme-trigger-caret.is-open {
  transform: rotate(180deg);
}

.theme-picker-menu {
  width: 100%;
  min-width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
}

.theme-hidden-select {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.001;
  pointer-events: none;
  z-index: -1;
}

@media (max-width: 500px) {
  .theme-mode-select.block {
    max-width: 100%;
  }
}
</style>

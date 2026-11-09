<script setup lang="ts">
import { ref, computed, useId } from 'vue';
import { useThemeStore, THEME_MODE_OPTIONS, type ThemeMode } from '../stores/theme';
import AppIcon from './AppIcon.vue';
import DropdownMenu from './primitives/DropdownMenu.vue';
import PickerMenu from './primitives/PickerMenu.vue';
import DropdownMenuItem from './primitives/DropdownMenuItem.vue';
import { ACTION_ICONS } from '../utils/actionIcons';

// icon: kompakter runder Button wie der bisherige Toggle (AppHeader.vue, LoginView.vue) - das
// eigentliche <select> liegt unsichtbar über dem Icon und fängt den Klick ab, damit sich der
// gewohnte Header-Platzbedarf nicht ändert. block: modernes, taktiles Dropdown im
// Reisotor-Design-System (SettingsView.vue) via DropdownMenu-Primitive und PickerMenu.
withDefaults(defineProps<{ variant?: 'icon' | 'block' }>(), { variant: 'icon' });

const theme = useThemeStore();
const isOpen = ref(false);
const selectId = useId();

const currentOption = computed(
  () => THEME_MODE_OPTIONS.find((option) => option.value === theme.mode) ?? THEME_MODE_OPTIONS[2]
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
      <div class="theme-dropdown-wrap" :class="{ 'is-open': isOpen }">
        <DropdownMenu
          block
          size="md"
          :open="isOpen"
          aria-label="Erscheinungsbild auswählen"
          aria-haspopup="listbox"
          trigger-class="theme-dropdown-trigger"
          @toggle="isOpen = !isOpen"
          @keydown.down.prevent="isOpen = true"
          @keydown.up.prevent="isOpen = true"
        >
          <template #label>
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
          </template>

          <PickerMenu
            position="absolute"
            origin="top-left"
            class="theme-picker-menu"
            role="listbox"
            @close="isOpen = false"
          >
            <DropdownMenuItem
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
        </DropdownMenu>

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

.theme-dropdown-wrap.is-open,
.theme-dropdown-wrap:has(.theme-picker-menu) {
  z-index: var(--z-popover, 1100);
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

.theme-picker-menu {
  width: 100%;
  min-width: 100%;
  box-sizing: border-box;
  margin-top: 4px;
  z-index: var(--z-popover, 1100);
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
